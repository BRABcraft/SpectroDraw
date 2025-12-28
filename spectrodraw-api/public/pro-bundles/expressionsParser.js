function parseExpression(source) {
  // -------------------------
  // Configuration / vars map
  // -------------------------
  // Edit this object from outside before calling parseExpression:
  if (!parseExpression.vars) parseExpression.vars = {
    // sliders / elements
    "brush.tool.size": () => sliders[1][0],
    "brush.tool.width": () => sliders[21][0],
    "brush.tool.height": () => sliders[22][0],
    "brush.tool.opacity": () => sliders[4][0],
    "brush.tool.harmonics": () => harmonics,
    "brush.effect.brightness": () => sliders[2][0],
    "brush.effect.blurRadius": () => sliders[16][0],
    "brush.effect.amplify": () => sliders[17][0],
    "brush.effect.aggressiveness": () => sliders[18][0],
    "brush.effect.autotuneStrength": () => sliders[23][0],
    "brush.effect.baseHz": () => sliders[25][0],
    "brush.effect.notesPerOctave": () => sliders[24][0],
    "brush.effect.phaseTexture": () => phaseTextureEl,
    "brush.effect.phaseSettings": () => sliders[27][0],
    "brush.effect.phaseStrength": () => sliders[5][0],
    "brush.effect.phaseShift": () => sliders[3][0],
    "eqBands": () => eqBands,
    "mouse.frame": () => $x,
    "mouse.bin": () => visibleToSpecY($y),
    "zoom.x.min": () => iLow,
    "zoom.x.max": () => iHigh,
    "zoom.y.min": () => fLow,
    "zoom.y.max": () => fHigh,
    "currentChannel.logScale": () => logScaleVal[currentChannel],
    "sampleRate": () => sampleRate,
    "specHeight": () => specHeight,
    "specWidth": () => framesTotal,
  };


  const reservedWords = new Set([
    "if","else","for","while","do","switch","case","break","continue","return",
    "var","let","const","function","new","this","typeof","instanceof","in",
    "try","catch","finally","throw","class","extends","super","import","export",
    "default","yield","await","async","with","debugger"
  ]);

  const allowedGlobalRoots = new Set([
    "Math","Array","Number","String","Object","Boolean","JSON","Date","RegExp",
    "parseInt","parseFloat","isNaN","isFinite","console","Intl","Map","Set",
    "WeakMap","WeakSet","BigInt"
  ]);

  function lineColFromIndex(str, idx) {
    const upTo = str.slice(0, idx);
    const lines = upTo.split("\n");
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;
    return { line, col };
  }

  // -------------------------
  // Step 1: Scan the source and find dotted identifiers (skipping strings/comments)
  // -------------------------
  const matches = []; // {text, start, end}
  const S = source;
  const N = S.length;
  let i = 0;

  while (i < N) {
    const ch = S[i];

    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      while (i < N) {
        if (S[i] === "\\") { i += 2; continue; }
        if (S[i] === quote) { i++; break; }
        if (quote === "`" && S[i] === "$" && S[i+1] === "{") {
          i += 2;
          let depth = 1;
          while (i < N && depth > 0) {
            if (S[i] === "\\") { i += 2; continue; }
            if (S[i] === "{") depth++;
            else if (S[i] === "}") depth--;
            else if (S[i] === "'" || S[i] === '"' || S[i] === "`") {
              const q = S[i];
              i++;
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
        i++;
      }
      continue;
    }

    if (S[i] === "/" && S[i+1] === "/") {
      i += 2;
      while (i < N && S[i] !== "\n") i++;
      continue;
    }

    if (S[i] === "/" && S[i+1] === "*") {
      i += 2;
      while (i < N && !(S[i] === "*" && S[i+1] === "/")) i++;
      i += 2;
      continue;
    }

    const idStart = /[A-Za-z_$]/;
    if (idStart.test(ch)) {
      let j = i;
      while (j < N && /[A-Za-z0-9_$]/.test(S[j])) j++;
      while (j < N && S[j] === ".") {
        let k = j+1;
        if (k < N && /[A-Za-z_$]/.test(S[k])) {
          k++;
          while (k < N && /[A-Za-z0-9_$]/.test(S[k])) k++;
          j = k;
        } else break;
      }
      const text = S.slice(i, j);
      matches.push({ text, start: i, end: j });
      i = j;
      continue;
    }

    i++;
  }

  // -------------------------
  // Step 2: Find declarations inside the source to allow local vars
  // -------------------------
  const declared = new Set();
  const declRegex = /\b(?:var|let|const)\s+([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = declRegex.exec(source)) !== null) declared.add(m[1]);

  const fnDeclRegex = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g;
  while ((m = fnDeclRegex.exec(source)) !== null) declared.add(m[1]);

  const fnParamsRegex = /function\b[^(]*\(([^)]*)\)/g;
  while ((m = fnParamsRegex.exec(source)) !== null) {
    const params = m[1].split(",").map(s => s.trim()).filter(Boolean);
    params.forEach(p => {
      const pname = p.split("=")[0].trim();
      if (pname) declared.add(pname);
    });
  }
  const arrowParamsRegex = /([A-Za-z_$][\w$]*|\([^)]*\))\s*=>/g;
  while ((m = arrowParamsRegex.exec(source)) !== null) {
    const raw = m[1].trim();
    if (raw.startsWith("(")) {
      const inner = raw.slice(1, -1);
      inner.split(",").map(s => s.trim()).filter(Boolean).forEach(p => {
        declared.add(p.split("=")[0].trim());
      });
    } else declared.add(raw);
  }

  // -------------------------
  // Step 3: Validate tokens against parseExpression.vars and allowed globals
  // -------------------------
  const varKeys = Object.keys(parseExpression.vars || {});
  varKeys.sort((a,b)=>b.length-a.length); // prefer longest

  function tokenAllowed(token) {
    if (!token) return true;
    if (reservedWords.has(token)) return true;
    if (parseExpression.vars && Object.prototype.hasOwnProperty.call(parseExpression.vars, token)) return true;
    // allow token that ends with ".value" when base exists in vars
    if (token.endsWith(".value")) {
      const base = token.slice(0, -6);
      if (parseExpression.vars && Object.prototype.hasOwnProperty.call(parseExpression.vars, base)) return true;
    }
    const root = token.split(".")[0];
    if (declared.has(root)) return true;
    if (allowedGlobalRoots.has(root)) return true;
    if (["true","false","null","undefined","NaN","Infinity"].includes(token)) return true;
    return false;
  }

  for (const mt of matches) {
    const t = mt.text;
    if (!tokenAllowed(t)) {
      const pos = lineColFromIndex(source, mt.start);
      return(`Error parsing expression at line ${pos.line}, col ${pos.col}: Cannot find "${t}"`);
    }
  }

  // -------------------------
  // Step 4: Replace mapped keys with safe parameter names (support .value)
  // -------------------------
  const replacements = []; // {start,end, name, value, replacementText, original}
  const usedParamNames = [];
  const paramValues = [];

  let paramCounter = 0;
  function makeParamName() { return "__p" + (paramCounter++); }

  for (const mt of matches) {
    const tok = mt.text;
    // find longest varKey that matches either tok exactly or tok === key + ".value"
    let matchedKey = null;
    let isValueAccess = false;
    for (const key of varKeys) {
      if (tok === key) { matchedKey = key; isValueAccess = false; break; }
      if (tok === key + ".value") { matchedKey = key; isValueAccess = true; break; }
    }
    if (matchedKey !== null) {
      const name = makeParamName();
      const val = parseExpression.vars[matchedKey]();
      const replacementText = isValueAccess ? (name + ".value") : name;
      replacements.push({ start: mt.start, end: mt.end, name, value: val, replacementText, original: tok });
      usedParamNames.push(name);
      paramValues.push(val);
    }
  }

  replacements.sort((a,b)=>a.start-b.start);

  // build transformed source using replacementText
  let newSrc = "";
  let lastPos = 0;
  for (const r of replacements) {
    newSrc += source.slice(lastPos, r.start);
    newSrc += r.replacementText;
    lastPos = r.end;
  }
  newSrc += source.slice(lastPos);

  // -------------------------
  // Step 5: Decide what to evaluate/return
  // -------------------------
  const hasReturnKeyword = /\breturn\b/.test(source);

  function evaluateCode(codeText) {
    try {
      const fn = new Function(...usedParamNames, '"use strict";\n' + codeText);
      return fn(...paramValues);
    } catch (err) {
      if (err instanceof ReferenceError) {
        const mm = /(\w+)\s+is not defined/.exec(err.message);
        if (mm) {
          const name = mm[1];
          const idx = source.indexOf(name);
          const pos = idx >= 0 ? lineColFromIndex(source, idx) : {line:1,col:1};
          return(`Error parsing expression at line ${pos.line}, col ${pos.col}: Cannot find "${name}"`);
        }
      }
      let extra = err.message || String(err);
      if (err.stack) {
        const stackMatch = /<anonymous>:(\d+):(\d+)/.exec(err.stack) || /:1:(\d+)/.exec(err.stack);
        if (stackMatch) {
          const col = parseInt(stackMatch[stackMatch.length-1], 10);
          const pos = lineColFromIndex(source, Math.max(0, col-1));
          return(`Error parsing expression at line ${pos.line}, col ${pos.col}: ${extra}`);
        }
      }
      return(`Error parsing expression: ${extra}`);
    }
  }

  if (hasReturnKeyword) {
    // use newSrc as the function body so top-level `return` works
    return evaluateCode(newSrc);
  }

  // find first bare-expression line (no "=" and not a statement)
  const lines = source.split(/\r?\n/);
  let exprLineIndex = -1;
  let exprText = null;
  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx];
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (/^(var|let|const|if|for|while|switch|function|return|throw|break|continue|try|catch|class)\b/.test(trimmed)) continue;
    if (/[^=!<>+\-*/%^|&?:]\=/.test(raw)) continue;
    exprLineIndex = idx;
    exprText = raw;
    break;
  }

  if (exprLineIndex !== -1) {
    const lineStartIndex = (() => {
      let pos = 0;
      for (let k = 0; k < exprLineIndex; k++) pos += lines[k].length + 1;
      return pos;
    })();

    // Build transformed expression using replacements affecting the line
    let transformedExpr = "";
    let last = lineStartIndex;
    for (const r of replacements) {
      if (r.end <= lineStartIndex) continue;
      if (r.start >= lineStartIndex + lines[exprLineIndex].length + 1) continue;
      const rs = Math.max(r.start, lineStartIndex);
      transformedExpr += source.slice(last, rs) + r.replacementText;
      last = r.end;
    }
    transformedExpr += source.slice(last, lineStartIndex + lines[exprLineIndex].length + 1);
    transformedExpr = transformedExpr.replace(/^\s+|\s+$/g, "");
    const codeToEval = `return (${transformedExpr});`;
    return evaluateCode(codeToEval);
  }

  // Fallback: evaluate whole transformed source as function body (no IIFE)
  return evaluateCode(newSrc);
}

// helper
parseExpression.setVars = function(map) {
  parseExpression.vars = Object.assign({}, parseExpression.vars || {}, map);
};
