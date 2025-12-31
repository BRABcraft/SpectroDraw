const expressions = [];
const DPR = Math.max(1, window.devicePixelRatio || 1);
let fontSpec = '14px Consolas, "Liberation Mono", Monaco, monospace';
let lineHeight = 20;
let padding = {top:8, left:6, right:8, bottom:8};
let renderYOffset = -3;
let isDragging = false;
const HISTORY_LIMIT = 200;
const keywords = new Set(["function","return","const","let","var","if","else","for","while","switch","case","break","new","class","extends","import","from","export","try","catch","finally","await","async","throw","in","of","typeof","instanceof","null","true","false"]);
const colors = {
  base: '#d6deff', comment: '#6E9B54', keyword: '#57A5D8', string: '#ffb86b',
  number: '#a7f3d0', punct: '#ffffff', constvar: '#50C2FF', mutvar: '#9AE9FF', return: '#c792ea'
};
const builtinMut = new Set(['Math','Date','JSON','console','Array','Object','String','Number','Boolean','Set','Map','Promise']);

function createExpressionDOM(i){
  const container = document.createElement('div');
  container.className = 'expressionBox';
  container.id = `name-${i}-box`;
  container.style.position = 'relative';
  container.innerHTML = `
    <p style="display:none;color:red;padding:0;margin:0;" id="error-${i}"></p>
    <div class="expressionBoxwrap">
      <div class="expressionEditorArea">
        <canvas class="gutterCanvas" id="name-${i}-gutter" style="cursor:default;"></canvas>
        <div class="mainExpCanvasWrap" id="name-${i}-mainExpWrap">
          <canvas id="name-${i}-mainEditor" tabindex="0" style="cursor:text;"></canvas>
        </div>
      </div>
    </div>
    <div id="name-${i}-findBox" class="findBox" role="dialog" aria-hidden="true" style="display:none;">
      <div style="display:flex;gap:2px;align-items:center;">
        <input id="name-${i}-findInput" placeholder="Find" style="background:#333"/>
        <button id="name-${i}-findPrevBtn">↑</button>
        <button id="name-${i}-findNextBtn">↓</button>
        <button id="name-${i}-closeFindBtn" style="margin-left:8px">Close</button>
      </div>
      <div style="display:flex;gap:2px;align-items:center;margin-top:5px;">
        <input id="name-${i}-replaceInput" placeholder="Replace" style="width:50px; display:none;background:#333"/>
        <button id="name-${i}-replaceBtn" style="display:none">Replace</button>
        <button id="name-${i}-replaceAllBtn" style="display:none">Replace All</button>
      </div>
    </div>
  `;
  return container;
}
function getExpressionById(id){
  for (let i = 0; i < expressions.length; i++) {
    if (expressions[i].id === id) {return expressions[i];}
  }
}
function showExpression(targetId) {
  let expr = getExpressionById(targetId);
  expr.showing = true;
  const dom = createExpressionDOM(targetId);
  document.getElementById(targetId).parentNode.appendChild(dom);
  initEditor(expr);
  const targetEl = document.getElementById(targetId);
  targetEl.parentNode.insertBefore(dom, targetEl.nextSibling);
}

function hideExpression(targetId) {
  const expr = getExpressionById(targetId);
  if (!expr || !expr.showing) return;
  expr.showing = false;
  //console.log(parseExpression(expr),expr);

  // remove DOM
  const box = document.getElementById(`name-${targetId}-box`);
  if (box && box.parentNode) {
    box.parentNode.removeChild(box);
  }

  // clear active editor if this one was focused
  if (editingExpression === targetId) {
    editingExpression = null;
  }

  expr.showing = false;
}


// helper to create a fully-shaped expression object
function makeExpressionObject(text, id){
  const obj = {
    id,
    isError: false,
    showing: false,
    hasChanged: false,
    expression: (text || ''),
    lines: (text || '').split(/\r\n|\r|\n/),
    caret: {row:0, col:0},
    anchor: null,
    scrollY: 0,
    scrollX: 0,
    undoStack: [],
    redoStack: [],
    lastFinds: {term:'', matches: [], index: -1},
    declarations: new Map(),
    needsRenderFlag: true,
    caretVisibleFlag: true,
    blinkTimer: null,
    selectionColor: 'rgba(124,156,255,0.3)',
    viewport: {w:0, h:0},
    maxLineWidth: 0,
    needsResize: true,
  };
  return obj;
}

// ensure an object has the expected properties (used when user pushes raw data)
function ensureExpressionShape(expr){
  if (!expr) return;
  if (typeof expr.expression === 'undefined') expr.expression = expr.lines ? expr.lines.join('\n') : '';
  if (!Array.isArray(expr.lines)) expr.lines = (expr.expression || '').split(/\r\n|\r|\n/);
  expr.caret = expr.caret || {row:0, col:0};
  expr.anchor = typeof expr.anchor !== 'undefined' ? expr.anchor : null;
  expr.scrollY = typeof expr.scrollY === 'number' ? expr.scrollY : 0;
  expr.scrollX = typeof expr.scrollX === 'number' ? expr.scrollX : 0;
  expr.undoStack = expr.undoStack || [];
  expr.redoStack = expr.redoStack || [];
  expr.lastFinds = expr.lastFinds || {term:'', matches: [], index:-1};
  expr.declarations = expr.declarations || new Map();
  expr.needsRenderFlag = typeof expr.needsRenderFlag === 'boolean' ? expr.needsRenderFlag : true;
  expr.caretVisibleFlag = typeof expr.caretVisibleFlag === 'boolean' ? expr.caretVisibleFlag : true;
  expr.blinkTimer = expr.blinkTimer || null;
  expr.selectionColor = expr.selectionColor || 'rgba(124,156,255,0.3)';
  expr.viewport = expr.viewport || {w:0,h:0};
  expr.maxLineWidth = typeof expr.maxLineWidth === 'number' ? expr.maxLineWidth : 0;
  expr.needsResize = typeof expr.needsResize === 'boolean' ? expr.needsResize : true;
}
const defaultExpressions={
  "brushBrightnessDiv":"brush.effect.brightness",
  "blurRadiusDiv":"brush.effect.blurRadius",
  "amplifyDiv":"brush.effect.amplify",
  "noiseAggDiv":"brush.effect.aggressiveness",
  "autoTuneStrengthDiv":"brush.effect.autotuneStrength",
  "astartOnPitchDiv":"brush.effect.baseHz",
  "anpoDiv":"brush.effect.notesPerOctave",
  "phaseTextureDiv":"return (Math.random() * 2 - 1) * Math.PI + brush.effect.phaseShift;",
  "phaseSettingsDiv":"brush.effect.phaseSettings",
  "phaseDiv":"brush.effect.phaseShift",
  "phaseStrengthDiv":"brush.effect.phaseStrength",
  "brushWidthDiv":"brush.tool.width",
  "brushHeightDiv":"brush.tool.height",
  "opacityDiv":"brush.tool.opacity",
  "brushHarmonicsEditorh3":`//uncomment for advanced editing
//let h = Array(100).fill(0);
//h[0]=1; 
//return h;
return brush.tool.harmonics;`,
  "eqPresetsDiv":`//uncomment for advanced editing
//return [
//   { gain:0, freq: 0, type: "low_shelf", angle: Math.PI/2, tLen: 60}, 
//   { gain:0, freq: sampleRate/128, type: "peaking", angle: Math.PI/2, tLen: 60}, 
//   { gain:0, freq: sampleRate/32, type: "peaking", angle: Math.PI/2, tLen: 60}, 
//   { gain:0, freq: sampleRate/16, type: "peaking", angle: Math.PI/2, tLen: 60}, 
//   { gain:0, freq: sampleRate/8, type: "peaking", angle: Math.PI/2, tLen: 60}, 
//   { gain:0, freq: sampleRate/4, type: "peaking", angle: Math.PI/2, tLen: 60}, 
//   { gain:0, freq: sampleRate/2, type: "high_shelf", angle: Math.PI/2, tLen: 60}
//];
return eqBands;`,
  "clonerScaleDiv":"brush.tool.clonerScale",
}
addExpressionBtns();
function addExpressionBtns(){
  const expBtnSVG =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentcolor" stroke-width="3">' +
    '<path d="M4.5 14.5C6 5 10 5 13 12S18 19 19.5 9.4"/>' +
    '<circle cx="4.5" cy="17" r="3"/>' +
    '<circle cx="19.5" cy="7" r="3"/>' +
    '</svg>';

  const targetDivIds = [
    "brushBrightnessDiv",
    "blurRadiusDiv",
    "amplifyDiv",
    "noiseAggDiv",
    "autoTuneStrengthDiv",
    "astartOnPitchDiv",
    "anpoDiv",
    "phaseTextureDiv",
    "phaseSettingsDiv",
    "phaseDiv",
    "phaseStrengthDiv",
    "brushWidthDiv",
    "brushHeightDiv",
    "opacityDiv",
    "brushHarmonicsEditorh3",
    "eqPresetsDiv",
    "clonerScaleDiv",
  ];
  for (const id of targetDivIds) {
    const div = document.getElementById(id);
    if (!div) continue;
    

    const btn = document.createElement("button");
    btn.className = "expBtn";
    btn.setAttribute("target", id);
    btn.innerHTML = expBtnSVG;
    btn.style.cursor = "pointer";
    btn.style.color = "#bbb";
    btn.title = "Edit expression for " + id;
    btn.id=`expBtn${id}`;

    btn.addEventListener("click", e => {
      e.stopPropagation();
      const exp = getExpressionById(id);
      if (!exp.showing) {
        showExpression(id);
        btn.style.color = "red";
        btn.title = "Editing expression for " + id;
      } else {
        hideExpression(id);
        btn.style.color = exp.hasChanged?"#c4f":"#bbb";
        btn.title = "Edit expression for " + id;
      }
    });
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Remove any existing menu
      const existingMenu = document.getElementById('resetExprMenu');
      if (existingMenu) existingMenu.remove();

      // Create menu element
      const menu = document.createElement('div');
      menu.id = 'resetExprMenu';
      menu.textContent = 'Reset Expression';
      menu.style.fontSize = '14px';
      menu.style.position = 'absolute';
      menu.style.left = e.pageX + 'px';
      menu.style.top = e.pageY + 'px';
      menu.style.background = '#222';
      menu.style.border = '1px solid #777';
      menu.style.padding = '2px 4px';
      menu.style.cursor = 'pointer';
      menu.style.zIndex = 10000;
      menu.style.borderRadius = '2px';
      menu.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
      menu.style.color = "#f00";

      // Attach click handler
      menu.addEventListener('click', () => {
        const expObj = getExpressionById(id);
        expObj.expression = defaultExpressions[id];
        expObj.lines = expObj.expression.split(/\r\n|\r|\n/);
        menu.remove(); // remove menu after click
      });

      // Remove menu if click elsewhere
      const removeMenu = () => {
        menu.remove();
        document.removeEventListener('click', removeMenu);
      };
      document.addEventListener('click', removeMenu);

      document.body.appendChild(menu);
    });

    expressions.push(makeExpressionObject(defaultExpressions[id], id));
    div.appendChild(btn);
  }
}
const predefinedConstVars = new Set([ "brush", "tool", "size", "width", "height", "opacity", "harmonics", "effect", "brightness", "blurRadius", "amplify", "aggressiveness", "autotuneStrength", "baseHz", "notesPerOctave", "phaseTexture", "phaseSettings", "phaseStrength", "phaseShift", "eqBands", "mouse", "frame", "bin", "zoom", "x", "min", "max", "y", "currentChannel", "logScale", "sampleRate", "specHeight", "specWidth", "clonerScale", "currentTool", "currentEffect","pixel"]);

// ------------ Editor core (per-instance) ----------------
function initEditor(expr){
  const i = expr.id;
  // expr is the unified object for this index
  // DOM elements (per-instance)
  const gutterCanvas = document.getElementById(`name-${i}-gutter`);
  const mainCanvas = document.getElementById(`name-${i}-mainEditor`);
  const mainWrap = document.getElementById(`name-${i}-mainExpWrap`);
  const findBox = document.getElementById(`name-${i}-findBox`);
  const findInput = document.getElementById(`name-${i}-findInput`);
  const replaceInput = document.getElementById(`name-${i}-replaceInput`);
  const findPrevBtn = document.getElementById(`name-${i}-findPrevBtn`);
  const findNextBtn = document.getElementById(`name-${i}-findNextBtn`);
  const replaceBtn = document.getElementById(`name-${i}-replaceBtn`);
  const replaceAllBtn = document.getElementById(`name-${i}-replaceAllBtn`);
  const closeFindBtn = document.getElementById(`name-${i}-closeFindBtn`);
  const container = document.getElementById(`name-${i}-box`);
  const wrapElem = container.querySelector('.expressionBoxwrap');

  // ensure expr shape
  ensureExpressionShape(expr);
  // convenience getters that read/write expr
  function lines(){ return expr.lines; }
  function setLines(v){
    expr.lines = v;
    expr.expression = v.join('\n');
    computeGutterWidth();
    resizeCanvas();
    requestDraw();
  }
  function caret(){ return expr.caret; }
  function setCaretObj(c){ expr.caret = c; }
  function anchor(){ return expr.anchor; }
  function setAnchor(a){ expr.anchor = a; }
  function scrollY(){ return expr.scrollY; }
  function setScrollY(v){ expr.scrollY = v; }
  function scrollX(){ return expr.scrollX; }
  function setScrollX(v){ expr.scrollX = v; }
  function undoStack(){ return expr.undoStack; }
  function redoStack(){ return expr.redoStack; }
  function lastFind(){ return expr.lastFinds; }
  function decls(){ return expr.declarations; }
  function needsRender(){ return expr.needsRenderFlag; }
  function setNeedsRender(v){ expr.needsRenderFlag = v; }
  function caretVisible(){ return expr.caretVisibleFlag; }
  function setCaretVisible(v){ expr.caretVisibleFlag = v; }
  function startBlinkTimer(cb){
    if(expr.blinkTimer) clearInterval(expr.blinkTimer);
    expr.blinkTimer = setInterval(cb, 530);
  }
  function stopBlinkTimer(){ if(expr.blinkTimer) clearInterval(expr.blinkTimer); expr.blinkTimer = null; }

  // metrics & resize
  function computeGutterWidth(){
    const digits = String(Math.max(1, lines().length)).length;
    const measure = document.createElement('canvas').getContext('2d');
    measure.font = fontSpec;
    const w = Math.ceil(measure.measureText('9'.repeat(digits)).width);
    const gutterWidth = Math.max(30, w + 10);
    gutterCanvas.style.width = gutterWidth + 'px';
    return gutterWidth;
  }
  function computeContentWidth(ctx){
    let mm = 0; ctx.font = fontSpec;
    for(let k=0;k<lines().length;k++){
      const w = ctx.measureText(lines()[k] || '').width;
      if(w > mm) mm = w;
    }
    expr.maxLineWidth = mm;
  }

  function clampScroll(){
    const contentHeight = lines().length * lineHeight + padding.top + padding.bottom;
    const maxScroll = Math.max(0, contentHeight - expr.viewport.h);
    if(expr.scrollY < 0) expr.scrollY = 0;
    if(expr.scrollY > maxScroll) expr.scrollY = maxScroll;
  }
  function clampScrollX(){
    const contentWidth = padding.left + expr.maxLineWidth + padding.right;
    const maxScrollX = Math.max(0, contentWidth - expr.viewport.w);
    if(expr.scrollX < 0) expr.scrollX = 0;
    if(expr.scrollX > maxScrollX) expr.scrollX = maxScrollX;
  }

  function resizeCanvas(){
    // adjust expression box height to content (clamped to 400px)
    const contentHeight = (lines().length + 1) * lineHeight + padding.top + padding.bottom;
    const desired = Math.min(300, contentHeight);
    wrapElem.style.height = (desired) + 'px';

    const rectG = gutterCanvas.getBoundingClientRect();
    const rectM = mainWrap.getBoundingClientRect();
    gutterCanvas.width = Math.max(1, Math.floor(rectG.width * DPR));
    gutterCanvas.height = Math.max(1, Math.floor(rectM.height * DPR));
    mainCanvas.width = Math.max(1, Math.floor(rectM.width * DPR));
    mainCanvas.height = Math.max(1, Math.floor(rectM.height * DPR));
    gutterCanvas.style.height = rectM.height + 'px';
    mainCanvas.style.width = rectM.width + 'px';
    mainCanvas.style.height = rectM.height + 'px';
    expr.viewport.w = rectM.width;
    expr.viewport.h = rectM.height;
    const gctx = gutterCanvas.getContext('2d'); gctx.setTransform(DPR,0,0,DPR,0,0); gctx.font = fontSpec; gctx.textBaseline = 'top';
    const ctx = mainCanvas.getContext('2d'); ctx.setTransform(DPR,0,0,DPR,0,0); ctx.font = fontSpec; ctx.textBaseline = 'top';
    computeContentWidth(ctx);
    clampScrollX();
    expr.needsRenderFlag = true;
    requestDraw();
  }

  // tokenization & declarations (local)
  function buildDeclarations(){
    const map = new Map();
    for(let r = 0; r < lines().length; r++){
      let s = lines()[r];
      const commentPos = s.indexOf('//');
      if(commentPos !== -1) s = s.slice(0, commentPos);
      const m = s.match(/\b(const|let|var)\b\s+(.+)/);
      if(!m) continue;
      const kw = m[1];
      let rest = m[2].trim();
      const semiIdx = rest.indexOf(';');
      if(semiIdx !== -1) rest = rest.slice(0, semiIdx);
      const parts = rest.split(',');
      for(const p of parts){
        const pid = p.trim().match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if(pid) map.set(pid[1], kw);
      }
    }
    expr.declarations = map;
  }

  function tokenizeLine(s){
    const tokens = [];
    let idx = 0, n = s.length;
    while(idx < n){
      const ch = s[idx];
      if(ch === '/' && s[idx+1] === '/'){ tokens.push({text: s.slice(idx), type: 'comment'}); break; }
      if(ch === '"' || ch === "'" || ch === '`'){
        const quote = ch; let j = idx+1, esc=false;
        while(j<n){
          if(!esc && s[j] === quote){ j++; break; }
          if(!esc && s[j] === '\\'){ esc = true; j++; continue; }
          esc = false; j++;
        }
        tokens.push({text: s.slice(idx,j), type:'string'}); idx = j; continue;
      }
      if(/\d/.test(ch)){ let j = idx+1; while(j<n && /[\d.eE+-]/.test(s[j])) j++; tokens.push({text: s.slice(idx,j), type:'number'}); idx=j; continue; }
      if(/[a-zA-Z_$]/.test(ch)){ let j=idx+1; while(j<n && /[a-zA-Z0-9_$]/.test(s[j])) j++; const w = s.slice(idx,j); tokens.push({text:w, type: keywords.has(w)?'keyword':'base'}); idx=j; continue; }
      tokens.push({text:ch, type:'punct'}); idx++;
    }

    for(let k=0;k<tokens.length;k++){
      const tk = tokens[k];
      if(tk.type === 'keyword' && tk.text === 'const'){ for(let j=k+1;j<tokens.length;j++){ if(tokens[j].type === 'base'){ tokens[j].type = 'constvar'; break; } } }
      else if(tk.type === 'keyword' && (tk.text === 'let' || tk.text === 'var')){ for(let j=k+1;j<tokens.length;j++){ if(tokens[j].type === 'base'){ tokens[j].type = 'mutvar'; break; } } }
      else if(tk.type === 'base' && builtinMut.has(tk.text)){ tokens[k].type = 'mutvar'; }
    }

    const decl = expr.declarations;
    if(decl && decl.size){
      for(let k=0;k<tokens.length;k++){
        const tk = tokens[k];
        if(tk.type === 'base' || tk.type === 'constvar' || tk.type === 'mutvar'){
          const dt = decl.get(tk.text);
          if(dt === 'const') tokens[k].type = 'constvar';
          else if(dt === 'let' || dt === 'var') tokens[k].type = 'mutvar';
        }
      }
    }
    return tokens;
  }

  // drawing
  function draw(){
    if(!expr.needsRenderFlag) return;
    expr.needsRenderFlag = false;
    buildDeclarations();

    const gctx = gutterCanvas.getContext('2d');
    const ctx = mainCanvas.getContext('2d');
    gctx.clearRect(0,0,expr.viewport.w + 200, expr.viewport.h);
    ctx.clearRect(0,0,expr.viewport.w, expr.viewport.h);

    const firstLine = Math.floor(expr.scrollY / lineHeight);
    const visibleLines = Math.ceil(expr.viewport.h / lineHeight) + 1;

    // gutter
    gctx.fillStyle = '#8b95b8'; gctx.font = fontSpec; gctx.textBaseline = 'top';
    const gutterW = computeGutterWidth();
    for(let r = firstLine; r < Math.min(lines().length, firstLine + visibleLines); r++){
      const y = padding.top + r * lineHeight - expr.scrollY;
      const txt = String(r+1);
      const txtW = gctx.measureText(txt).width;
      const x = gutterW - 6 - txtW;
      gctx.fillText(txt, x, y);
    }

    // find highlights
    const lf = expr.lastFinds;
    if(lf && lf.term && lf.matches && lf.matches.length){
      ctx.fillStyle = 'rgba(200,220,255,0.12)';
      ctx.strokeStyle = 'rgba(200,220,255,0.06)';
      ctx.lineWidth = 1;
      for(const m of lf.matches){
        const r = m.row;
        const y = padding.top + r * lineHeight - expr.scrollY + renderYOffset;
        if(y + lineHeight < 0 || y > expr.viewport.h) continue;
        const line = lines()[r] || '';
        ctx.font = fontSpec;
        const x1 = padding.left - expr.scrollX + ctx.measureText(line.slice(0, m.col)).width;
        const x2 = padding.left - expr.scrollX + ctx.measureText(line.slice(0, m.col + lf.term.length)).width;
        ctx.fillRect(x1, y, Math.max(2, x2 - x1), lineHeight);
        ctx.strokeRect(x1 + 0.5, y + 0.5, Math.max(1, x2 - x1 - 1), lineHeight - 1);
      }
    }

    // selection
    if(expr.anchor && !posEq(expr.anchor, expr.caret)){
      const sel = normalizeSel(expr.anchor, expr.caret);
      if(sel){
        ctx.fillStyle = expr.selectionColor;
        for(let r = sel.start.row; r <= sel.end.row; r++){
          const y = padding.top + r * lineHeight - expr.scrollY + renderYOffset;
          if(y + lineHeight < 0 || y > expr.viewport.h) continue;
          const line = lines()[r] || '';
          ctx.font = fontSpec;
          if(r === sel.start.row && r === sel.end.row){
            const x1 = padding.left - expr.scrollX + ctx.measureText(line.slice(0, sel.start.col)).width;
            const x2 = padding.left - expr.scrollX + ctx.measureText(line.slice(0, sel.end.col)).width;
            ctx.fillRect(x1, y, Math.max(1, x2 - x1), lineHeight);
          } else if(r === sel.start.row){
            const x1 = padding.left - expr.scrollX + ctx.measureText(line.slice(0, sel.start.col)).width;
            const x2 = padding.left - expr.scrollX + ctx.measureText(line).width;
            ctx.fillRect(x1, y, Math.max(1, x2 - x1), lineHeight);
          } else if(r === sel.end.row){
            const x1 = padding.left - expr.scrollX;
            const x2 = padding.left - expr.scrollX + ctx.measureText(line.slice(0, sel.end.col)).width;
            ctx.fillRect(x1, y, Math.max(1, x2 - x1), lineHeight);
          } else {
            const x1 = padding.left - expr.scrollX;
            const x2 = padding.left - expr.scrollX + ctx.measureText(line).width;
            ctx.fillRect(x1, y, Math.max(1, x2 - x1), lineHeight);
          }
        }
      }
    }

    // text rendering
    ctx.font = fontSpec; ctx.textBaseline = 'top';
    for(let r = firstLine; r < Math.min(lines().length, firstLine + visibleLines); r++){
      const y = padding.top + r * lineHeight - expr.scrollY;
      const line = lines()[r] || '';
      let x = padding.left - expr.scrollX;
      const tokens = tokenizeLine(line);
      for(const t of tokens){
        let fill = colors.base;
        if(t.type === 'comment') fill = colors.comment;
        else if(t.type === 'keyword') fill = (t.text==='return'||t.text==='break'||t.text==='continue')?colors.return:colors.keyword;
        else if(t.type === 'string') fill = colors.string;
        else if(t.type === 'number') fill = colors.number;
        else if(t.type === 'punct') fill = colors.punct;
        else if(t.type === 'constvar'|| predefinedConstVars.has(t.text)) fill = colors.constvar;
        else if(t.type === 'mutvar') fill = colors.mutvar;
        ctx.fillStyle = fill;
        ctx.fillText(t.text, x, y);
        x += ctx.measureText(t.text).width;
      }
    }

    // caret
    drawCaret(ctx);

    // active find highlight
    if(lf && lf.index >= 0 && lf.matches && lf.matches[lf.index]){
      const m = lf.matches[lf.index];
      const r = m.row;
      const y = padding.top + r * lineHeight - expr.scrollY + renderYOffset;
      if(!(y + lineHeight < 0 || y > expr.viewport.h)){
        const line = lines()[r] || '';
        ctx.font = fontSpec;
        const x1 = padding.left - expr.scrollX + ctx.measureText(line.slice(0, m.col)).width;
        const x2 = padding.left - expr.scrollX + ctx.measureText(line.slice(0, m.col + lf.term.length)).width;
        ctx.strokeStyle = 'rgba(120,160,255,0.9)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x1 - 1, y + 2, Math.max(2, x2 - x1 + 2), lineHeight - 6);
      }
    }
  } // draw

  function drawCaret(ctx){
    // don't show caret unless this canvas is the focused editor
    if (editingExpression !== i) return;
    if (document.activeElement !== mainCanvas) return;

    if(!expr.caretVisibleFlag) return;
    const row = Math.max(0, Math.min(lines().length-1, expr.caret.row));
    const col = Math.max(0, Math.min((lines()[row]||'').length, expr.caret.col));
    const line = lines()[row] || '';
    ctx.font = fontSpec;
    const w = ctx.measureText(line.slice(0, col)).width;
    const x = padding.left - expr.scrollX + w;
    const y = padding.top + row * lineHeight - expr.scrollY + renderYOffset;
    if(y + lineHeight >= 0 && y <= expr.viewport.h){
      const caretW = Math.max(1, Math.floor(1.5));
      ctx.fillStyle = 'white';
      ctx.fillRect(x, y + 2, caretW, lineHeight - 4);
    }
  }

  function requestDraw(){ expr.needsRenderFlag = true; window.requestAnimationFrame(draw); }
  function startBlink(){ if(expr.blinkTimer) clearInterval(expr.blinkTimer); expr.caretVisibleFlag = true; startBlinkTimer(()=>{ expr.caretVisibleFlag = !expr.caretVisibleFlag; requestDraw(); }); }

  // undo/redo snapshots
  function snapshot(){ return { lines: lines().slice(), caret: {...expr.caret}, anchor: expr.anchor ? {...expr.anchor} : null, scrollY: expr.scrollY, scrollX: expr.scrollX }; }
  function pushUndo(){ expr.undoStack.push(snapshot()); if(expr.undoStack.length > HISTORY_LIMIT) expr.undoStack.shift(); expr.redoStack.length = 0; }
  function doUndo(){ if(expr.undoStack.length === 0) return; const s = expr.undoStack.pop(); expr.redoStack.push(snapshot()); restoreState(s); }
  function doRedo(){ if(expr.redoStack.length === 0) return; const s = expr.redoStack.pop(); expr.undoStack.push(snapshot()); restoreState(s); }
  function restoreState(s){ setLines(s.lines.slice()); expr.caret = {...s.caret}; expr.anchor = s.anchor ? {...s.anchor} : null; expr.scrollY = s.scrollY; expr.scrollX = s.scrollX || 0; computeGutterWidth(); resizeCanvas(); setCaret(expr.caret.row, expr.caret.col, expr.anchor===null); requestDraw(); }

  // utility selection helpers
  function posLess(a,b){ if(a.row !== b.row) return a.row < b.row; return a.col < b.col; }
  function posEq(a,b){ return a && b && a.row===b.row && a.col===b.col; } // local override (fine)
  function normalizeSel(a,b){
    if(!a) return null;
    if(posLess(a,b)) return {start: {...a}, end: {...b}};
    if(posLess(b,a)) return {start: {...b}, end: {...a}};
    return {start: {...a}, end: {...a}};
  }
  function hasSelection(){ return expr.anchor !== null && !posEq(expr.anchor, expr.caret); }

  // editing ops (per-instance)
  function setCaret(r,c, clearAnchor=false){
    expr.caret.row = Math.max(0, Math.min(lines().length-1, r));
    expr.caret.col = Math.max(0, Math.min((lines()[expr.caret.row]||'').length, c));
    if(clearAnchor) expr.anchor = null;
    const caretY = padding.top + expr.caret.row * lineHeight + renderYOffset;
    if(caretY - expr.scrollY < 0) expr.scrollY = caretY - 8;
    else if(caretY + lineHeight - expr.scrollY > expr.viewport.h) expr.scrollY = caretY + lineHeight - expr.viewport.h + 8;
    clampScroll();
    // X visibility
    const ctx = mainCanvas.getContext('2d'); ctx.font = fontSpec;
    const line = lines()[expr.caret.row] || '';
    const caretX = padding.left + ctx.measureText(line.slice(0, expr.caret.col)).width;
    const caretWidth = Math.max(2,2);
    if(caretX - expr.scrollX < 0) expr.scrollX = caretX - 8;
    else if(caretX + caretWidth - expr.scrollX > expr.viewport.w) expr.scrollX = caretX + caretWidth - expr.viewport.w + 8;
    clampScrollX();
    expr.caretVisibleFlag = true;
    startBlink();
    setLines(lines()); // sync expressions[] text
    requestDraw();
  }

  function insertTextAtCaretInternal(text){
    const before = lines()[expr.caret.row].slice(0, expr.caret.col);
    const after = lines()[expr.caret.row].slice(expr.caret.col);
    const parts = text.split(/\r\n|\r|\n/);
    if(parts.length === 1){
      const newLines = lines().slice();
      newLines[expr.caret.row] = before + parts[0] + after;
      setLines(newLines);
      expr.caret.col = before.length + parts[0].length;
    } else {
      const newLines = lines().slice();
      newLines[expr.caret.row] = before + parts[0];
      const spliceArgs = [expr.caret.row + 1, 0].concat(parts.slice(1, parts.length-1)).concat([parts[parts.length - 1] + after]);
      Array.prototype.splice.apply(newLines, spliceArgs);
      setLines(newLines);
      expr.caret.row = expr.caret.row + parts.length - 1;
      expr.caret.col = parts[parts.length - 1].length;
    }
    clampScroll();
  }

  function insertTextAtCaret(text){
    pushUndo();
    if(hasSelection()) deleteSelectionInternal();
    insertTextAtCaretInternal(text);
    computeGutterWidth(); resizeCanvas();
    requestDraw();
    expr.redoStack.length = 0;
  }

  function deleteSelectionInternal(){
    if(!hasSelection()) return;
    const sel = normalizeSel(expr.anchor, expr.caret);
    const s = sel.start, e = sel.end;
    if(s.row === e.row){
      const l = lines()[s.row];
      const newLines = lines().slice();
      newLines[s.row] = l.slice(0, s.col) + l.slice(e.col);
      setLines(newLines);
      expr.caret.row = s.row; expr.caret.col = s.col;
    } else {
      const first = lines()[s.row].slice(0, s.col);
      const last = lines()[e.row].slice(e.col);
      const newLines = lines().slice();
      newLines.splice(s.row, e.row - s.row + 1, first + last);
      setLines(newLines);
      expr.caret.row = s.row; expr.caret.col = s.col;
    }
    expr.anchor = null;
    clampScroll();
    setLines(lines());
  }

  function deleteSelection(){ if(!hasSelection()) return; pushUndo(); deleteSelectionInternal(); computeGutterWidth(); resizeCanvas(); requestDraw(); }
  function deleteBack(){ if(hasSelection()){ deleteSelection(); return; } pushUndo(); if(expr.caret.col > 0){ const line = lines()[expr.caret.row]; const nl = lines().slice(); nl[expr.caret.row] = line.slice(0, expr.caret.col - 1) + line.slice(expr.caret.col); setLines(nl); expr.caret.col -= 1; } else if(expr.caret.row > 0){ const prev = lines()[expr.caret.row - 1]; const cur = lines()[expr.caret.row]; const newCol = prev.length; const nl = lines().slice(); nl[expr.caret.row - 1] = prev + cur; nl.splice(expr.caret.row, 1); setLines(nl); expr.caret.row -= 1; expr.caret.col = newCol; } computeGutterWidth(); resizeCanvas(); requestDraw(); }
  function deleteForward(){ if(hasSelection()){ deleteSelection(); return; } pushUndo(); const line = lines()[expr.caret.row]; if(expr.caret.col < line.length){ const nl = lines().slice(); nl[expr.caret.row] = line.slice(0, expr.caret.col) + line.slice(expr.caret.col + 1); setLines(nl); } else if(expr.caret.row < lines().length - 1){ const next = lines()[expr.caret.row + 1]; const nl = lines().slice(); nl[expr.caret.row] = line + next; nl.splice(expr.caret.row + 1, 1); setLines(nl); } computeGutterWidth(); resizeCanvas(); requestDraw(); }

  function splitLine(){
    pushUndo();
    if(hasSelection()) deleteSelectionInternal();
    const line = lines()[expr.caret.row];
    const before = line.slice(0, expr.caret.col);
    const after = line.slice(expr.caret.col);
    const indentMatch = (before.match(/^\s*/));
    const indent = indentMatch ? indentMatch[0] : '';
    const nl = lines().slice();
    nl[expr.caret.row] = before;
    nl.splice(expr.caret.row + 1, 0, indent + after);
    setLines(nl);
    expr.caret.row += 1;
    expr.caret.col = indent.length;
    computeGutterWidth(); resizeCanvas(); requestDraw();
  }

  function toggleLineComment(){
    pushUndo();
    const nl = lines().slice();
    if(hasSelection()){
      const sel = normalizeSel(expr.anchor, expr.caret);
      for(let r = sel.start.row; r <= sel.end.row; r++){
        const l = nl[r];
        if(l.trim().startsWith('//')) nl[r] = l.replace(/^\s*\/\//,''); else nl[r] = '//' + l;
      }
    } else {
      const idx = expr.caret.row;
      const l = nl[idx];
      if(l.trim().startsWith('//')) { nl[idx] = l.replace(/^\s*\/\//,''); expr.caret.col = Math.max(0, expr.caret.col - 2); }
      else { nl[idx] = '//' + l; expr.caret.col += 2; }
    }
    setLines(nl);
    computeGutterWidth(); resizeCanvas(); requestDraw();
  }

  // word navigation & clipboard (per-instance)
  function isWordChar(ch){ return /[a-zA-Z0-9_]/.test(ch); }
  function moveCaretWordLeft(pos){ let {row,col} = pos; if(col === 0){ if(row === 0) return {row,col}; row -= 1; col = lines()[row].length; return {row,col}; } const line = lines()[row]; let i = col - 1; while(i >= 0 && !isWordChar(line[i])) i--; while(i >= 0 && isWordChar(line[i])) i--; return {row, col: Math.max(0, i + 1)}; }
  function moveCaretWordRight(pos){ let {row,col} = pos; const line = lines()[row]; if(col >= line.length){ if(row >= lines().length - 1) return {row,col}; row += 1; col = 0; return {row,col}; } let i = col; while(i < line.length && !isWordChar(line[i])) i++; while(i < line.length && isWordChar(line[i])) i++; return {row, col: i}; }

  async function copySelectionToClipboard(){ if(!hasSelection()) return; const sel = normalizeSel(expr.anchor, expr.caret); let text; if(sel.start.row === sel.end.row){ text = lines()[sel.start.row].slice(sel.start.col, sel.end.col); } else { const pieces = []; pieces.push(lines()[sel.start.row].slice(sel.start.col)); for(let r = sel.start.row + 1; r < sel.end.row; r++) pieces.push(lines()[r]); pieces.push(lines()[sel.end.row].slice(sel.end.col)); text = pieces.join('\n'); } try { if(navigator.clipboard && navigator.clipboard.writeText){ await navigator.clipboard.writeText(text); } else { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } } catch(e){} }
  async function cutSelectionToClipboard(){ if(!hasSelection()) return; await copySelectionToClipboard(); pushUndo(); deleteSelectionInternal(); computeGutterWidth(); resizeCanvas(); requestDraw(); }
  async function pasteFromClipboard(){ try { let text = ''; if(navigator.clipboard && navigator.clipboard.readText){ text = await navigator.clipboard.readText(); } else { const ta = document.createElement('textarea'); document.body.appendChild(ta); ta.focus(); document.execCommand('paste'); text = ta.value || ''; ta.remove(); } if(text){ pushUndo(); if(hasSelection()) deleteSelectionInternal(); insertTextAtCaretInternal(text); computeGutterWidth(); resizeCanvas(); requestDraw(); } } catch(e){} }

  // FIND (per-instance)
  function buildMatches(term){
    const lf = expr.lastFinds;
    lf.term = term;
    lf.matches = [];
    lf.index = -1;
    if(!term) return;
    for(let r = 0; r < lines().length; r++){
      const s = lines()[r];
      let pos = 0;
      while(true){
        const idx = s.indexOf(term, pos);
        if(idx === -1) break;
        lf.matches.push({row: r, col: idx});
        pos = idx + Math.max(1, term.length);
      }
    }
  }
  function gotoFindIndex(idx){
    const lf = expr.lastFinds;
    if(!lf.matches || lf.matches.length === 0) return;
    idx = ((idx % lf.matches.length) + lf.matches.length) % lf.matches.length;
    const m = lf.matches[idx];
    expr.anchor = {row: m.row, col: m.col};
    expr.caret = {row: m.row, col: m.col + lf.term.length};
    lf.index = idx;
    setCaret(expr.caret.row, expr.caret.col, false);
    requestDraw();
  }

  function showFindBox(showReplace){
    findBox.style.display = 'block';
    findBox.setAttribute('aria-hidden','false');
    replaceInput.style.display = showReplace ? 'inline-block' : 'none';
    replaceBtn.style.display = showReplace ? 'inline-block' : 'none';
    replaceAllBtn.style.display = showReplace ? 'inline-block' : 'none';
    findInput.focus();
    const term = findInput.value || expr.lastFinds.term || '';
    buildMatches(term);
    if(expr.lastFinds.matches.length) expr.lastFinds.index = 0;
    requestDraw();
  }
  function hideFindBox(){
    findBox.style.display = 'none'; findBox.setAttribute('aria-hidden','true');
    try{ mainCanvas.focus(); }catch(e){}
  }

  // attach find buttons/listeners
  findNextBtn.addEventListener('click', ()=>{
    const term = findInput.value || '';
    if(term !== expr.lastFinds.term) buildMatches(term);
    if(!expr.lastFinds.matches || expr.lastFinds.matches.length === 0) return;
    const nextIndex = (expr.lastFinds.index + 1 + expr.lastFinds.matches.length) % expr.lastFinds.matches.length;
    gotoFindIndex(nextIndex);
  });
  findPrevBtn.addEventListener('click', ()=>{
    const term = findInput.value || '';
    if(term !== expr.lastFinds.term) buildMatches(term);
    if(!expr.lastFinds.matches || expr.lastFinds.matches.length === 0) return;
    const prevIndex = (expr.lastFinds.index - 1 + expr.lastFinds.matches.length) % expr.lastFinds.matches.length;
    gotoFindIndex(prevIndex);
  });
  replaceBtn.addEventListener('click', ()=>{
    const term = findInput.value || '';
    const rep = replaceInput.value || '';
    if(!term) return;
    buildMatches(term);
    if(expr.lastFinds.matches.length === 0) return;
    const idx = (expr.lastFinds.index >= 0) ? expr.lastFinds.index : 0;
    const m = expr.lastFinds.matches[idx];
    pushUndo();
    const line = lines()[m.row];
    const nl = lines().slice(); nl[m.row] = line.slice(0, m.col) + rep + line.slice(m.col + term.length);
    setLines(nl);
    expr.anchor = {row: m.row, col: m.col};
    expr.caret = {row: m.row, col: m.col + rep.length};
    computeGutterWidth(); resizeCanvas(); requestDraw();
    expr.redoStack.length = 0;
    buildMatches(term);
    if(expr.lastFinds.matches.length) expr.lastFinds.index = Math.min(expr.lastFinds.index, expr.lastFinds.matches.length - 1);
  });
  replaceAllBtn.addEventListener('click', ()=>{
    const term = findInput.value || '';
    const rep = replaceInput.value || '';
    if(!term) return;
    pushUndo();
    const nl = lines().map(l => l.indexOf(term) !== -1 ? l.split(term).join(rep) : l);
    setLines(nl);
    computeGutterWidth(); resizeCanvas(); requestDraw();
    expr.redoStack.length = 0;
    buildMatches(term);
  });
  closeFindBtn.addEventListener('click', hideFindBox);
  findInput.addEventListener('input', (e)=>{ const term = findInput.value || ''; buildMatches(term); if(expr.lastFinds.matches.length) expr.lastFinds.index = 0; else expr.lastFinds.index = -1; requestDraw(); });
  findInput.addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); findNextBtn.click(); } else if(e.key === 'Escape'){ hideFindBox(); e.preventDefault(); } });
  replaceInput.addEventListener('keydown', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); replaceBtn.click(); } else if(e.key === 'Escape'){ hideFindBox(); e.preventDefault(); } });

  // coordinate mapping
  function getCoordToPos(clientX, clientY){
    const rect = mainCanvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const row = Math.floor((y + expr.scrollY - padding.top - renderYOffset) / lineHeight);
    const clampedRow = Math.max(0, Math.min(lines().length - 1, row));
    const line = lines()[clampedRow] || '';
    const px = x + expr.scrollX - padding.left;
    const ctx = mainCanvas.getContext('2d'); ctx.font = fontSpec;
    if(px <= 0) return {row: clampedRow, col: 0};
    let approx = Math.floor(px / (ctx.measureText('M').width || 8.5));
    approx = Math.max(0, Math.min(line.length, approx));
    let col = approx;
    while(col < line.length && ctx.measureText(line.slice(0, col)).width < px) col++;
    while(col > 0 && ctx.measureText(line.slice(0, col)).width > px) col--;
    return {row: clampedRow, col};
  }

  // mouse & keyboard handlers (attached per-instance)
  function onMouseDown(ev){
    ev.preventDefault();
    // set focus/active expression when clicking
    editingExpression = i;
    try { mainCanvas.focus(); } catch(e) {}
    const pos = getCoordToPos(ev.clientX, ev.clientY);
    if(ev.shiftKey){
      if(!expr.anchor) expr.anchor = {row: expr.caret.row, col: expr.caret.col};
      expr.caret = pos;
      setCaret(expr.caret.row, expr.caret.col, false);
    } else {
      expr.caret = pos;
      setCaret(expr.caret.row, expr.caret.col, true);
    }
    isDragging = true;
  }
  function onMouseMove(ev){
    if(!isDragging) return;
    ev.preventDefault();
    const pos = getCoordToPos(ev.clientX, ev.clientY);
    if(!expr.anchor) expr.anchor = {row: expr.caret.row, col: expr.caret.col};
    expr.caret = pos;
    setCaret(expr.caret.row, expr.caret.col, false);
  }
  function onMouseUp(ev){
    if(!isDragging) return;
    ev.preventDefault();
    const pos = getCoordToPos(ev.clientX, ev.clientY);
    expr.caret = pos;
    if(expr.anchor && posEq(expr.anchor, expr.caret)) expr.anchor = null;
    setCaret(expr.caret.row, expr.caret.col, false);
    isDragging = false;
  }

  function onWheel(e){
    e.preventDefault();
    if(e.deltaX !== 0) expr.scrollX += e.deltaX;
    else if(e.shiftKey) expr.scrollX += e.deltaY;
    else expr.scrollY += e.deltaY;
    clampScroll(); clampScrollX(); requestDraw();
  }
  function onFocus(){editingExpression = i; expr.caretVisibleFlag = true; startBlink(); requestDraw();}

  function onBlur(){expr.caretVisibleFlag = false; if (expr.blinkTimer) { clearInterval(expr.blinkTimer); expr.blinkTimer = null; } requestDraw();}

  async function onKeyDown(e){
    expr.hasChanged = true;document.getElementById(`expBtn${expr.id}`).style.color = "#c4f";
    // if this instance is not active, ignore (except allow Ctrl+F to open the focused instance)
    if(editingExpression !== i) {
      if(document.activeElement !== mainCanvas) return;
      else editingExpression = i;
    }

    // if find overlay input focused, let it handle text normally
    if(findBox.style.display === 'block' && (document.activeElement === findInput || document.activeElement === replaceInput)){
      if(e.key === 'Escape'){ hideFindBox(); e.preventDefault(); }
      return;
    }

    const navKeys = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'];
    if(navKeys.includes(e.key) || e.key === 'Tab' || e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter') e.preventDefault();

    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z'){ e.preventDefault(); doUndo(); return; }
    if((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))){ e.preventDefault(); doRedo(); return; }

    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a'){ e.preventDefault(); expr.anchor = {row:0, col:0}; expr.caret.row = lines().length - 1; expr.caret.col = lines()[expr.caret.row].length; setCaret(expr.caret.row, expr.caret.col, false); return; }

    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c'){ e.preventDefault(); await copySelectionToClipboard(); return; }
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x'){ e.preventDefault(); await cutSelectionToClipboard(); return; }
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v'){ e.preventDefault(); await pasteFromClipboard(); return; }

    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f'){
      if(findBox.style.display === 'block') return;
      e.preventDefault();
      showFindBox(false);
      return;
    }
    if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h'){
      if(findBox.style.display === 'block') return;
      e.preventDefault();
      showFindBox(true);
      return;
    }

    if(e.key === 'Tab'){
      if(e.shiftKey){
        const line = lines()[expr.caret.row];
        if(line.startsWith('  ')){ const nl = lines().slice(); nl[expr.caret.row] = line.slice(2); setLines(nl); expr.caret.col = Math.max(0, expr.caret.col - 2); }
        else if(line.startsWith('\t')){ const nl = lines().slice(); nl[expr.caret.row] = line.slice(1); setLines(nl); expr.caret.col = Math.max(0, expr.caret.col - 1); }
        requestDraw();
        return;
      } else { insertTextAtCaret('  '); return; }
    }
    if(e.key === 'Enter'){ splitLine(); return; }
    if(e.key === 'Backspace'){ deleteBack(); return; }
    if(e.key === 'Delete'){ deleteForward(); return; }

    if(e.key === 'ArrowLeft' || e.key === 'ArrowRight'){
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      let newPos;
      if(ctrl) newPos = (e.key==='ArrowLeft') ? moveCaretWordLeft(expr.caret) : moveCaretWordRight(expr.caret);
      else {
        if(e.key === 'ArrowLeft'){
          if(expr.caret.col > 0) newPos = {row: expr.caret.row, col: expr.caret.col - 1};
          else if(expr.caret.row > 0) newPos = {row: expr.caret.row - 1, col: lines()[expr.caret.row - 1].length};
          else newPos = {row: expr.caret.row, col: expr.caret.col};
        } else {
          if(expr.caret.col < (lines()[expr.caret.row]||'').length) newPos = {row: expr.caret.row, col: expr.caret.col + 1};
          else if(expr.caret.row < lines().length - 1) newPos = {row: expr.caret.row + 1, col: 0};
          else newPos = {row: expr.caret.row, col: expr.caret.col};
        }
      }
      if(shift){ if(!expr.anchor) expr.anchor = {row: expr.caret.row, col: expr.caret.col}; expr.caret = newPos; }
      else { expr.caret = newPos; expr.anchor = null; }
      setCaret(expr.caret.row, expr.caret.col, false); return;
    }

    if(e.key === 'ArrowUp' || e.key === 'ArrowDown'){
      const shift = e.shiftKey;
      if(e.key === 'ArrowUp'){
        const newRow = Math.max(0, expr.caret.row - 1);
        const newCol = Math.min((lines()[newRow]||'').length, expr.caret.col);
        if(shift){ if(!expr.anchor) expr.anchor = {row: expr.caret.row, col: expr.caret.col}; expr.caret.row = newRow; expr.caret.col = newCol; }
        else { expr.caret.row = newRow; expr.caret.col = newCol; expr.anchor = null; }
        setCaret(expr.caret.row, expr.caret.col, false); return;
      } else {
        const newRow = Math.min(lines().length - 1, expr.caret.row + 1);
        const newCol = Math.min((lines()[newRow]||'').length, expr.caret.col);
        if(shift){ if(!expr.anchor) expr.anchor = {row: expr.caret.row, col: expr.caret.col}; expr.caret.row = newRow; expr.caret.col = newCol; }
        else { expr.caret.row = newRow; expr.caret.col = newCol; expr.anchor = null; }
        setCaret(expr.caret.row, expr.caret.col, false); return;
      }
    }

    // printable chars
    if(!e.ctrlKey && !e.metaKey && !e.altKey && e.key && e.key.length === 1){
      pushUndo();
      if(hasSelection()) deleteSelectionInternal();
      const pairs = {'(':')','[':']','{':'}','"':'"',"'" :"'","`":"`"};
      if(pairs[e.key]){
        const close = pairs[e.key];
        const line = lines()[expr.caret.row];
        const before = line.slice(0, expr.caret.col);
        const after = line.slice(expr.caret.col);
        const nl = lines().slice(); nl[expr.caret.row] = before + e.key + close + after; setLines(nl);
        expr.caret.col += 1;
      } else {
        insertTextAtCaretInternal(e.key);
      }
      computeGutterWidth(); resizeCanvas(); requestDraw();
      expr.redoStack.length = 0;
      return;
    }

    if((e.ctrlKey || e.metaKey) && e.key === '/'){ toggleLineComment(); return; }
  } // onKeyDown

  // named paste handler so we can remove it in cleanup
  const pasteHandler = async (e) => {
    if (editingExpression !== i) return;
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if(text){
      pushUndo();
      if(hasSelection()) deleteSelectionInternal();
      insertTextAtCaretInternal(text);
      computeGutterWidth(); resizeCanvas(); requestDraw();
      expr.redoStack.length = 0;
    }
  };
  window.addEventListener('paste', pasteHandler);

  // ResizeObserver for this instance
  const ro = new ResizeObserver(()=>{ resizeCanvas(); });
  ro.observe(mainWrap);

  // start blink timer helper
  startBlink();

  // attach per-instance event listeners
  mainCanvas.addEventListener('mousedown', onMouseDown);
  mainCanvas.addEventListener('focus', onFocus);
  mainCanvas.addEventListener('blur', onBlur);

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  mainWrap.addEventListener('wheel', onWheel, {passive:false});
  // paste handling already registered globally as pasteHandler

  document.addEventListener('mousedown', (ev)=>{
    if(findBox.style.display === 'block'){
      if(!findBox.contains(ev.target)) hideFindBox();
    }
  });

  mainCanvas.addEventListener('focus', ()=>{ editingExpression = i; });

  // intercept keys only when this canvas has focus (capture true but check active)
  window.addEventListener('keydown', (e)=>{ if(document.activeElement === mainCanvas) onKeyDown(e); }, true);

  // initial setup
  computeGutterWidth();
  resizeCanvas();
  requestDraw();
  // initial caret at top-left
  setCaret(0,0,true);
  requestAnimationFrame(() => setCaret(0,0,true));

  // expose helper to get text and force re-render externally if needed
  return {
    getText: () => lines().join('\n'),
    setText: (txt) => { setLines((txt||'').split(/\r\n|\r|\n/)); computeGutterWidth(); resizeCanvas(); requestDraw(); }
  };
} // initEditor

// helper small fns used in the closure
function posEq(a,b){ return a && b && a.row===b.row && a.col===b.col; }
function normalizeSel(a,b){ if(!a) return null; if(a.row < b.row || (a.row===b.row && a.col < b.col)) return {start: {...a}, end: {...b}}; if(b.row < a.row || (b.row===a.row && b.col < a.col)) return {start: {...b}, end: {...a}}; return {start: {...a}, end: {...a}}; }

document.addEventListener('mousedown', (e) => {
  // if click is NOT inside any expression box, clear editingExpression
  if (!e.target.closest('.expressionBoxwrap')) {
    if (editingExpression !== null){
      function evaluateExpressionToVar(expressionId, setValue) {
        const exprObj = getExpressionById(expressionId);
        if (!exprObj) return;

        const expr = exprObj.expression;
        const result = parseExpression(exprObj);

        const errorEl = document.getElementById(`error-${expressionId}`);
        if (!errorEl) return;

        if (typeof result === "string" && result.startsWith("Error")) {
          errorEl.innerText = result;
          errorEl.style.display = "block";
          exprObj.isError = true;
        } else {
          errorEl.style.display = "none";
          exprObj.isError = false;
          setValue(result);
        }
      }
      evaluateExpressionToVar("brushBrightnessDiv", v => {sliders[2][0].value = sliders[2][1].value = brushBrightness = v;});
      evaluateExpressionToVar("blurRadiusDiv",      v => {sliders[16][0].value = sliders[16][1].value = blurRadius = v});
      evaluateExpressionToVar("amplifyDiv",         v => {sliders[17][0].value = sliders[17][1].value = amp = v});
      evaluateExpressionToVar("noiseAggDiv",        v => {sliders[18][0].value = sliders[18][1].value = noiseAgg = v});
      evaluateExpressionToVar("autoTuneStrengthDiv",v => {sliders[23][0].value = sliders[23][1].value = autoTuneStrength = v});
      evaluateExpressionToVar("astartOnPitchDiv",   v => {sliders[25][0].value = sliders[25][1].value = astartOnPitch = v});
      evaluateExpressionToVar("anpoDiv",            v => {sliders[24][0].value = sliders[24][1].value = anpo = v});
      evaluateExpressionToVar("phaseDiv",           v => {sliders[3][0].value = sliders[3][1].value = phaseShift = v});
      evaluateExpressionToVar("phaseStrengthDiv",   v => {sliders[5][0].value = sliders[5][1].value = phaseStrength = v});
      evaluateExpressionToVar("brushWidthDiv",      v => {sliders[21][0].value = sliders[21][1].value = brushWidth = v});
      evaluateExpressionToVar("brushHeightDiv",     v => {sliders[22][0].value = sliders[22][1].value = brushHeight = v});
      evaluateExpressionToVar("opacityDiv",         v => {sliders[4][0].value = sliders[4][1].value = brushOpacity = v});
      evaluateExpressionToVar("clonerScaleDiv",     v => {sliders[26][0].value = sliders[26][1].value = clonerScale = v});
      evaluateExpressionToVar("brushHarmonicsEditorh3",v => {harmonics = v; renderHarmonicsCanvas(); updateBrushPreview();});
      evaluateExpressionToVar("eqPresetsDiv",       v => {eqBands = v; updateGlobalGain();updateEQ();drawEQ();});
    }
    editingExpression = null;
  }
});
