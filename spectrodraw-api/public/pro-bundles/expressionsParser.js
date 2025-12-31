// Put these constants once (top-level) so they are not recreated on every call
const __PE_RESERVED = new Set([
  "if","else","for","while","do","switch","case","break","continue","return",
  "var","let","const","function","new","this","typeof","instanceof","in",
  "try","catch","finally","throw","class","extends","super","import","export",
  "default","yield","await","async","with","debugger"
]);
const __PE_ALLOWED_ROOTS = new Set([
  "Math","Array","Number","String","Object","Boolean","JSON","Date","RegExp",
  "parseInt","parseFloat","isNaN","isFinite","console","Intl","Map","Set",
  "WeakMap","WeakSet","BigInt"
]);
const __PE_SIMPLE_LITERALS = new Set(["true","false","null","undefined","NaN","Infinity"]);
const __ID_START = /[A-Za-z_$]/;
const __ID_CONT = /[A-Za-z0-9_$]/;

function parseExpression(exprObj, defaultExprObj) {
  // keep the same external behavior
  const expressionId = (exprObj && exprObj.id) ? exprObj.id : undefined;
  const source = defaultExprObj??exprObj.expression;
  const S = source || "";
  const N = S.length;

  // quick helpers: precompute lineStarts for O(log n) position->line/col
  const lineStarts = [0];
  for (let k = 0; k < N; k++) if (S[k] === "\n") lineStarts.push(k + 1);
  function lineColFromIndex(idx) {
    if (idx < 0) idx = 0;
    // binary search in lineStarts
    let lo = 0, hi = lineStarts.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (lineStarts[mid] <= idx) lo = mid + 1;
      else hi = mid - 1;
    }
    const line = hi + 1;
    const col = idx - lineStarts[hi] + 1;
    return { line, col };
  }

  // -------------------------
  // 1) Gather declared identifiers (var/let/const/function + params) — single regex passes
  // -------------------------
  const declared = new Set();
  for (const m of source.matchAll(/\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
  for (const m of source.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) declared.add(m[1]);
  // function params in classic function declarations
  for (const m of source.matchAll(/function\b[^(]*\(([^)]*)\)/g)) {
    const raw = m[1].trim();
    if (!raw) continue;
    for (const p of raw.split(",")) {
      const pname = p.split("=")[0].trim();
      if (pname) declared.add(pname);
    }
  }
  // arrow params
  for (const m of source.matchAll(/([A-Za-z_$][\w$]*|\([^)]*\))\s*=>/g)) {
    const raw = m[1].trim();
    if (!raw) continue;
    if (raw[0] === "(") {
      const inner = raw.slice(1, -1).trim();
      if (!inner) continue;
      for (const p of inner.split(",")) {
        const pname = p.split("=")[0].trim();
        if (pname) declared.add(pname);
      }
    } else declared.add(raw);
  }

  // -------------------------
  // 2) Single-pass scanner: find candidate dotted identifiers (skip strings/comments/template-expr)
  // -------------------------
  const matches = []; // {text, start, end}
  let i = 0;
  while (i < N) {
    const ch = S[i];

    // Strings / template / skip
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      if (quote === "`") {
        // template literal - need to handle ${ ... } blocks
        while (i < N) {
          if (S[i] === "\\") { i += 2; continue; }
          if (S[i] === "$" && S[i+1] === "{") {
            i += 2;
            // skip until matching }
            let depth = 1;
            while (i < N && depth > 0) {
              if (S[i] === "\\") { i += 2; continue; }
              if (S[i] === "{") depth++;
              else if (S[i] === "}") depth--;
              else if (S[i] === "'" || S[i] === '"' || S[i] === "`") {
                const q = S[i]; i++;
                while (i < N) {
                  if (S[i] === "\\") { i += 2; continue; }
                  if (S[i] === q) { i++; break; }
                  i++;
                }
                continue;
              }
              i++;
            }
            continue;
          }
          if (S[i] === "`") { i++; break; }
          i++;
        }
      } else {
        while (i < N) {
          if (S[i] === "\\") { i += 2; continue; }
          if (S[i] === quote) { i++; break; }
          i++;
        }
      }
      continue;
    }

    // single-line comment
    if (S[i] === "/" && S[i+1] === "/") {
      i += 2;
      while (i < N && S[i] !== "\n") i++;
      continue;
    }
    // multi-line comment
    if (S[i] === "/" && S[i+1] === "*") {
      i += 2;
      while (i < N && !(S[i] === "*" && S[i+1] === "/")) i++;
      i += 2;
      continue;
    }

    // identifier start?
    if (__ID_START.test(ch)) {
      let j = i + 1;
      while (j < N && __ID_CONT.test(S[j])) j++;
      // now optionally chained ".id"
      while (j < N && S[j] === ".") {
        let k = j + 1;
        if (k < N && __ID_START.test(S[k])) {
          k++;
          while (k < N && __ID_CONT.test(S[k])) k++;
          j = k;
        } else break;
      }

      // check object-literal property like "{ foo: ... }" — skip those
      let next = j;
      while (next < N && /\s/.test(S[next])) next++;
      if (S[next] === ":") {
        // check previous non-space
        let prev = i - 1;
        while (prev >= 0 && /\s/.test(S[prev])) prev--;
        const prevCh = prev >= 0 ? S[prev] : null;
        if (prevCh === "{" || prevCh === ",") {
          i = j;
          continue; // skip object key
        }
      }

      matches.push({ text: S.slice(i, j), start: i, end: j });
      i = j;
      continue;
    }

    i++;
  }

  // -------------------------
  // 3) Validate tokens against allowed set (fast checks + caching)
  // -------------------------
  const varMap = parseExpression.vars || {};
  const varKeys = Object.keys(varMap);
  const varSet = new Set(varKeys);
  const tokenAllowedCache = new Map();

  function tokenAllowed(token) {
    if (!token) return true;
    if (tokenAllowedCache.has(token)) return tokenAllowedCache.get(token);

    // quick checks
    if (__PE_RESERVED.has(token)) return tokenAllowedCache.set(token, true), true;
    if (varSet.has(token)) return tokenAllowedCache.set(token, true), true;
    const root = token.split(".")[0];
    if (declared.has(root)) return tokenAllowedCache.set(token, true), true;
    if (__PE_ALLOWED_ROOTS.has(root)) return tokenAllowedCache.set(token, true), true;
    if (__PE_SIMPLE_LITERALS.has(token)) return tokenAllowedCache.set(token, true), true;

    tokenAllowedCache.set(token, false);
    return false;
  }

  // Helper for property-access case: if identifier appears after a dot, allow it if left-root is allowed
  function allowedByLeftRoot(mt) {
    // find preceding non-space char
    let leftPos = mt.start - 1;
    while (leftPos >= 0 && /\s/.test(S[leftPos])) leftPos--;
    if (leftPos < 0 || S[leftPos] !== ".") return false;

    // skip backward over a parenthesized/bracketed expression (fast heuristic)
    let left = leftPos - 1;
    function skipBack(openChar, closeChar) {
      let depth = 1;
      left--;
      while (left >= 0 && depth > 0) {
        if (S[left] === closeChar) depth++;
        else if (S[left] === openChar) depth--;
        else if (S[left] === '"' || S[left] === "'" || S[left] === "`") {
          const q = S[left]; left--;
          while (left >= 0) {
            if (S[left] === "\\") { left -= 2; continue; }
            if (S[left] === q) { left--; break; }
            left--;
          }
          continue;
        }
        left--;
      }
      while (left >= 0 && /\s/.test(S[left])) left--;
    }
    if (left >= 0 && S[left] === ")") skipBack("(", ")");
    else if (left >= 0 && S[left] === "]") skipBack("[", "]");

    // collect identifier left of that position (if any)
    let idEnd = left;
    while (idEnd >= 0 && __ID_CONT.test(S[idEnd])) idEnd--;
    const idStart = idEnd + 1;
    if (idStart <= left) {
      const root = S.slice(idStart, left + 1);
      return tokenAllowed(root) || varSet.has(root);
    }
    return false;
  }

  for (const mt of matches) {
    const t = mt.text;
    if (tokenAllowed(t)) continue;
    // try property-access rescue
    if (allowedByLeftRoot(mt)) continue;
    // If reached here token unknown -> error
    const pos = lineColFromIndex(mt.start);
    if (exprObj) exprObj.isError = true;
    return `Error parsing expression at line ${pos.line}, col ${pos.col}: Cannot find "${t}"`;
  }

  // -------------------------
  // 4) Build replacements for mapped vars (single pass, stable order)
  // -------------------------
  const replacements = []; // {start,end,name,value}
  let paramCounter = 0;
  // Map occurrences in order; fetch each var value once now
  for (const mt of matches) {
    const tok = mt.text;
    if (varSet.has(tok)) {
      const name = "__p" + (paramCounter++);
      // fetch value by calling var function (guarded)
      let value;
      try {
        const accessor = varMap[tok];
        value = (typeof accessor === "function") ? accessor() : accessor;
      } catch (e) { value = undefined; }
      replacements.push({ start: mt.start, end: mt.end, name, value });
    }
  }
  // sort by start (should already be in order but ensure)
  replacements.sort((a,b)=>a.start-b.start);

  // build transformed code with minimal slicing
  if (replacements.length === 0) {
    var newSrc = source;
  } else {
    let parts = [];
    let last = 0;
    for (const r of replacements) {
      if (r.start > last) parts.push(S.substring(last, r.start));
      parts.push(r.name);
      last = r.end;
    }
    if (last < N) parts.push(S.substring(last));
    var newSrc = parts.join("");
  }

  // collect param names/values in order
  const usedParamNames = replacements.map(r=>r.name);
  const paramValues = replacements.map(r=>r.value);

  // -------------------------
  // 5) Decide what to evaluate/return (return keyword or bare-expression line)
  // -------------------------
  const hasReturnKeyword = /\breturn\b/.test(source); // acceptable heuristic

  function evaluateCode(codeText) {
    try {
      const fn = new Function(...usedParamNames, '"use strict";\n' + codeText);
      return fn(...paramValues);
    } catch (err) {
      // Attempt to produce friendly errors similar to previous behavior
      if (err instanceof ReferenceError) {
        const m = /(\w+)\s+is not defined/.exec(err.message);
        if (m) {
          const name = m[1];
          const idx = source.indexOf(name);
          const pos = idx >= 0 ? lineColFromIndex(idx) : {line:1,col:1};
          if (exprObj) exprObj.isError = true;
          return `Error parsing expression at line ${pos.line}, col ${pos.col}: Cannot find "${name}"`;
        }
      }
      // attempt to get column from stack if possible
      let extra = err.message || String(err);
      if (err.stack) {
        const stackMatch = /<anonymous>:(\d+):(\d+)/.exec(err.stack) || /:1:(\d+)/.exec(err.stack);
        if (stackMatch) {
          const col = parseInt(stackMatch[stackMatch.length-1], 10);
          const pos = lineColFromIndex(Math.max(0, col-1));
          if (exprObj) exprObj.isError = true;
          return `Error parsing expression at line ${pos.line}, col ${pos.col}: ${extra}`;
        }
      }
      if (exprObj) exprObj.isError = true;
      return `Error parsing expression: ${extra}`;
    }
  }

  // Reuse your finalizeResult logic (kept nearly identical)
  function finalizeResult(result) {
    if (typeof result === "string" && result.startsWith("Error")) return result;
    function err(msg) { try { if (exprObj) exprObj.isError = true; } catch (e) {} return msg; }

    if (expressionId !== "eqPresetsDiv" && expressionId !== "brushHarmonicsEditorh3" && typeof result === "object") {
      return err("Error: Expected a single numeric value, but got an object: " + JSON.stringify(result));
    }

    if (expressionId === "brushHarmonicsEditorh3") {
      if (!Array.isArray(result)) return err(`Error: Expected an array, got ${typeof result}: ${JSON.stringify(result)}`);
      if (result.length !== 100) return err(`Error: Expected an array of length 100, got an array of length ${result.length}.`);
      if (!result.every(v => typeof v === "number" && Number.isFinite(v) && v >= 0.0 && v <= 1.0)) {
        return err(`Error: Array must contain all numbers in the range [0.0, 1.0]. Got [${result.map(v => JSON.stringify(v)).join(", ")}]`);
      }
      if (result.every(v => v === 0.0)) return err("Error: Must contain at least one nonzero value.");
    }

    if (expressionId === "eqPresetsDiv") {
      let sr = typeof sampleRate !== "undefined" ? sampleRate : NaN;
      if ((!sr || !Number.isFinite(sr)) && parseExpression.vars && typeof parseExpression.vars["sampleRate"] === "function") {
        try { sr = parseExpression.vars["sampleRate"](); } catch (e) { sr = NaN; }
      }
      if (!Array.isArray(result)) return err(`Error: EQ presets must be an array. Got ${typeof result}: ${JSON.stringify(result)}`);
      const allowedTypes = new Set(["low_shelf", "peaking", "high_shelf"]);
      for (let idx = 0; idx < result.length; idx++) {
        const band = result[idx], label = `band[${idx}]`;
        if (band === null || typeof band !== "object" || Array.isArray(band)) return err(`Error: ${label} must be an object. Got ${JSON.stringify(band)}.`);
        if (!("gain" in band) || typeof band.gain !== "number" || !Number.isFinite(band.gain)) return err(`Error: ${label}.gain must be a finite number. Got ${JSON.stringify(band.gain)}.`);
        if (!("freq" in band) || typeof band.freq !== "number" || !Number.isFinite(band.freq) || !(band.freq >= 0)) return err(`Error: ${label}.freq cannot be negative. Got ${JSON.stringify(band.freq)}.`);
        if (Number.isFinite(sr) && !(band.freq >= 0 && band.freq <= sr)) return err(`Error: ${label}.freq must be >= 0 and <= sampleRate (${sr}). Got ${band.freq}.`);
        if (!("angle" in band) || typeof band.angle !== "number" || !Number.isFinite(band.angle)) return err(`Error: ${label}.angle must be a finite number. Got ${JSON.stringify(band.angle)}.`);
        if (!("tLen" in band) || typeof band.tLen !== "number" || !Number.isFinite(band.tLen) || !(band.tLen > 0)) return err(`Error: ${label}.tLen must be a positive number. Got ${JSON.stringify(band.tLen)}.`);
        if (!("type" in band) || typeof band.type !== "string" || !allowedTypes.has(band.type)) return err(`Error: ${label}.type must be one of ${JSON.stringify(Array.from(allowedTypes))}. Got ${JSON.stringify(band.type)}.`);
      }
    }

    try { if (exprObj) exprObj.isError = false; } catch (e) {}
    return result;
  }

  // If there's a top-level 'return', evaluate the transformed source as the function body
  if (hasReturnKeyword) {
    const result = evaluateCode(newSrc);
    return finalizeResult(result);
  }

  // Otherwise try to find the first bare expression line (avoid scanning twice aggressively)
  const lines = S.split(/\r?\n/);
  let exprLineIndex = -1, exprText = null;
  for (let idx = 0, pos = 0; idx < lines.length; idx++) {
    const raw = lines[idx]; const trimmed = raw.trim();
    if (!trimmed) { pos += raw.length + 1; continue; }
    if (/^(var|let|const|if|for|while|switch|function|return|throw|break|continue|try|catch|class)\b/.test(trimmed)) { pos += raw.length + 1; continue; }
    if (/[^=!<>+\-*/%^|&?:]\=/.test(raw)) { pos += raw.length + 1; continue; }
    exprLineIndex = idx; exprText = raw; break;
  }

  if (exprLineIndex !== -1) {
    // compute lineStart index
    let lineStartIndex = 0;
    for (let k = 0; k < exprLineIndex; k++) lineStartIndex += lines[k].length + 1;
    // apply replacements that intersect this line to produce transformed expression
    if (replacements.length === 0) {
      const codeToEval = `return (${exprText.trim()});`;
      const r = evaluateCode(codeToEval);
      return finalizeResult(r);
    } else {
      let transformedParts = [];
      let last = lineStartIndex;
      for (const r of replacements) {
        const lineEnd = lineStartIndex + lines[exprLineIndex].length;
        if (r.end <= lineStartIndex) continue;
        if (r.start > lineEnd) continue;
        const rs = Math.max(r.start, lineStartIndex);
        if (rs > last) transformedParts.push(S.substring(last, rs));
        transformedParts.push(r.name);
        last = r.end;
      }
      if (last <= lineStartIndex + lines[exprLineIndex].length) transformedParts.push(S.substring(Math.max(last, lineStartIndex), lineStartIndex + lines[exprLineIndex].length + 1));
      const transformedExpr = transformedParts.join("").trim();
      const codeToEval = `return (${transformedExpr});`;
      const result = evaluateCode(codeToEval);
      return finalizeResult(result);
    }
  }

  // fallback: evaluate whole code as an IIFE (preserve original behavior)
  const codeToEval = `(function(){\n${newSrc}\n})();`;
  const result = evaluateCode(codeToEval);
  return finalizeResult(result);
}
parseExpression.vars = {
  //-- defaults (placeholders). Replace these with your actual runtime values:
  "brush.tool.size": () => parseFloat(sliders[1][0].value),
  "brush.tool.width": () => parseFloat(sliders[21][0].value),
  "brush.tool.height": () => parseFloat(sliders[22][0].value),
  "brush.tool.opacity": () => parseFloat(sliders[4][0].value),
  "brush.tool.harmonics": () => harmonics,
  "brush.tool.clonerRefX": ()=> clonerX,
  "brush.tool.clonerRefY": ()=> clonerY,
  "brush.tool.clonerScale": ()=> clonerScale,
  "brush.effect.brightness": () => parseFloat(sliders[2][0].value),
  "brush.effect.blurRadius": () => parseFloat(sliders[16][0].value),
  "brush.effect.amplify": () => parseFloat(sliders[17][0].value),
  "brush.effect.aggressiveness": () => parseFloat(sliders[18][0].value),
  "brush.effect.autotuneStrength": () => parseFloat(sliders[23][0].value),
  "brush.effect.baseHz": () => parseFloat(sliders[25][0].value),
  "brush.effect.notesPerOctave": () => parseFloat(sliders[24][0].value),
  "brush.effect.phaseTexture": () => phaseTextureEl.value,
  "brush.effect.phaseSettings": () => parseFloat(sliders[27][0].value),
  "brush.effect.phaseStrength": () => parseFloat(sliders[5][0].value),
  "brush.effect.phaseShift": () => parseFloat(sliders[3][0].value),
  "eqBands": () => eqBands,
  "mouse.frame": () => Math.max(0, Math.min($x, framesTotal)),
  "mouse.bin": () => visibleToSpecY($y),
  "zoom.x.min": () => iLow,
  "zoom.x.max": () => iHigh,
  "zoom.y.min": () => fLow,
  "zoom.y.max": () => fHigh,
  "currentChannel.logScale": () => logScaleVal[currentChannel],
  "sampleRate": () => sampleRate,
  "specHeight": () => specHeight,
  "specWidth": () => framesTotal,
  "currentTool": () => currentTool,
  "currentEffect": () => currentShape,
  "pixel.frame": () => Math.max(0, Math.min($x, framesTotal)),
  "pixel.bin": () => visibleToSpecY($y),
  "hop": () => hop,
  "brush.effect.phaseSettings.t0": () => t0,
  "brush.effect.phaseSettings.tau": () => tau,
  "brush.effect.phaseSettings.sigma": () => sigma,
  "brush.effect.phaseSettings.harmonicCenter": () => harmonicCenter,
  "brush.effect.phaseSettings.userDelta": () => userDelta,
  "brush.effect.phaseSettings.refPhaseFrame": () => refPhaseFrame,
  "brush.effect.phaseSettings.chirpRate": () => chirpRate,
  "currentChannel": () => currentChannel,
  "channels": () => channels,
};
// keep helper to set vars
parseExpression.setVars = function(map) {
  parseExpression.vars = Object.assign({}, parseExpression.vars || {}, map);
};
