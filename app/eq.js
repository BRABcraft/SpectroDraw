const FREQ_LOG_SCALE = 2;
let eqBands = [
    { type: "low_shelf", freq: sampleRate/2048, gain: 0, Q: 1 }, 
    { type: "peaking", freq: sampleRate/128, gain: 0, Q: 1 }, 
    { type: "peaking", freq: sampleRate/32, gain: 0, Q: 1 }, 
    { type: "peaking", freq: sampleRate/16, gain: 0, Q: 1 }, 
    { type: "peaking", freq: sampleRate/8, gain: 0, Q: 1 }, 
    { type: "peaking", freq: sampleRate/4, gain: 0, Q: 1 }, 
    { type: "high_shelf", freq: sampleRate/2, gain: 0, Q: 1 }
];// --- config (unchanged) ---
const POINT_HIT_RADIUS = 8;
const HANDLE_HIT_RADIUS = 10;

// --- state ---
let draggingPointIndex = -1;
let draggingTangentIndex = -1;
let dragOffset = { x: 0, y: 0 };
let ptsCache = null;         // cached sorted pts for current canvas size
let ptsCacheW = 0, ptsCacheH = 0;
let ptsDirty = true;
let drawScheduled = false;

// ensure default angle/tLen on bands (do once)
eqBands.forEach(b => {
  if (typeof b.angle !== 'number') b.angle = Math.PI / 2;
  if (typeof b.tLen !== 'number') b.tLen = 15;
  // cache mx/my if possible
  b.mx = Math.cos(b.angle) * b.tLen;
  b.my = Math.sin(b.angle) * b.tLen;
});

// utility
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// frequency/gain <-> screen (vertical orientation)
function freqToY(freq, h) {
  const nyquist = sampleRate * 0.5;
  let nf = (freq <= 0) ? 0 : freq / nyquist;
  if (nf <= 0) return 0;
  if (nf >= 1) return h;
  const mapped = Math.pow(nf, 1 / FREQ_LOG_SCALE);
  return mapped * h;
}
function yToFreq(y, h) {
  const nyquist = sampleRate * 0.5;
  const ny = clamp(y / h, 0, 1);
  return clamp(Math.pow(ny, FREQ_LOG_SCALE) * nyquist, 0, nyquist);
}
function gainToX(gain, w) {
  return ((gain + 24) / 48) * w;
}
function xToGain(x, w) {
  return ((clamp(x, 0, w) / w) * 48) - 24;
}

// Build (and cache) screen-space points array sorted by y.
// returns array of { i, b, x, y, mx, my }
function buildPts(w, h) {
  if (!ptsDirty && ptsCache && ptsCacheW === w && ptsCacheH === h) {
    return ptsCache;
  }
  const arr = new Array(eqBands.length);
  for (let i = 0; i < eqBands.length; i++) {
    const b = eqBands[i];
    // ensure band cached tangent values are up to date
    if (b._cachedAngle !== b.angle || b._cachedTLen !== b.tLen) {
      b.mx = Math.cos(b.angle) * (b.tLen || 40);
      b.my = Math.sin(b.angle) * (b.tLen || 40);
      b._cachedAngle = b.angle;
      b._cachedTLen = b.tLen;
    }
    const y = freqToY(b.freq, h);
    const x = gainToX(b.gain || 0, w);
    arr[i] = { i, b, x, y, mx: b.mx, my: b.my };
  }
  arr.sort((A, B) => A.y - B.y);
  ptsCache = arr;
  ptsCacheW = w; ptsCacheH = h;
  ptsDirty = false;
  return arr;
}

// requestAnimationFrame coalesced draw
function scheduleDraw() {
  if (drawScheduled) return;
  drawScheduled = true;
  requestAnimationFrame(() => {
    drawScheduled = false;
    drawEQ();
  });
}

// Main drawing (uses buildPts)
function drawEQ() {
  if (!eqCanvas || !eCtx) return;
  const w = eqCanvas.width, h = eqCanvas.height;
  // clear
  eCtx.clearRect(0, 0, w, h);
  // background
  eCtx.fillStyle = "#111";
  eCtx.fillRect(0, 0, w, h);

  const pts = buildPts(w, h);

  // grid/center lines
  eCtx.lineWidth = 1;
  eCtx.strokeStyle = "#222";
  eCtx.beginPath();
  const xZero = gainToX(0, w);
  eCtx.moveTo(xZero, 0); eCtx.lineTo(xZero, h);
  const xGlobal = gainToX(globalGain || 0, w);
  eCtx.moveTo(xGlobal, 0); eCtx.lineTo(xGlobal, h);
  eCtx.stroke();

  // Hermite spline (sample per segment proportionally)
  eCtx.lineWidth = 2;
  eCtx.strokeStyle = "#fff";
  eCtx.beginPath();
  if (pts.length > 0) {
    eCtx.moveTo(pts[0].x, pts[0].y);
    for (let k = 0; k < pts.length - 1; k++) {
      const p0 = pts[k], p1 = pts[k + 1];
      // number of steps proportional to euclidean distance
      const dx = p1.x - p0.x, dy = p1.y - p0.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const steps = Math.max(8, Math.floor(dist / 6));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const t2 = t * t, t3 = t2 * t;
        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;
        const X = h00 * p0.x + h10 * p0.mx + h01 * p1.x + h11 * p1.mx;
        const Y = h00 * p0.y + h10 * p0.my + h01 * p1.y + h11 * p1.my;
        eCtx.lineTo(X, Y);
      }
    }
  }
  eCtx.stroke();

  // control points & handles & labels
  eCtx.font = "12px monospace";
  eCtx.textBaseline = "middle";
  for (let idx = 0; idx < pts.length; idx++) {
    const p = pts[idx];
    // point
    eCtx.beginPath();
    eCtx.fillStyle = "#fff";
    eCtx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    eCtx.fill();
    // tangent line (both directions)
    eCtx.strokeStyle = "#f00";
    eCtx.lineWidth = 2;
    eCtx.beginPath();
    eCtx.moveTo(p.x - p.mx, p.y - p.my);
    eCtx.lineTo(p.x + p.mx, p.y + p.my);
    eCtx.stroke();
    // handle tip
    const hx = p.x + p.mx, hy = p.y + p.my;
    eCtx.beginPath();
    eCtx.fillStyle = "#ff0";
    eCtx.arc(hx, hy, 3, 0, Math.PI * 2);
    eCtx.fill();
    // label: compute once
    const freqLabel = `${Math.round(p.b.freq)} Hz`;
    const gainLabel = `${(p.b.gain >= 0 ? "+" : "")}${Number((p.b.gain || 0).toFixed(1))} dB`;
    const label = `${freqLabel} / ${gainLabel}`;
    const labelW = eCtx.measureText(label).width;
    let tx = p.x + 12;
    let ty = p.y;
    if (tx + labelW > w - 4) tx = p.x - 12 - labelW;
    if (ty < 8) ty = 8;
    if (ty > h - 8) ty = h - 8;
    const tw = labelW + 8;
    const th = 18;
    eCtx.fillStyle = "rgba(0,0,0,0.6)";
    eCtx.fillRect(tx - 4, ty - th / 2, tw, th);
    eCtx.fillStyle = "#fff";
    eCtx.fillText(label, tx, ty);
  }
}

// ---- hit-testing (uses band cached mx/my when available)
function findHit(pos) {
  if (!eqCanvas) return null;
  const w = eqCanvas.width, h = eqCanvas.height;
  for (let i = 0; i < eqBands.length; i++) {
    const b = eqBands[i];
    const y = freqToY(b.freq, h);
    const x = gainToX(b.gain || 0, w);
    // handle tip: prefer cached mx/my if present
    const mx = (typeof b.mx === 'number') ? b.mx : Math.cos(b.angle || 0) * (b.tLen || 40);
    const my = (typeof b.my === 'number') ? b.my : Math.sin(b.angle || 0) * (b.tLen || 40);
    const hx = x + mx, hy = y + my;
    const dxh = pos.x - hx, dyh = pos.y - hy;
    if ((dxh * dxh + dyh * dyh) <= (HANDLE_HIT_RADIUS * HANDLE_HIT_RADIUS)) return { type: 'handle', index: i };
    const dxp = pos.x - x, dyp = pos.y - y;
    if ((dxp * dxp + dyp * dyp) <= (POINT_HIT_RADIUS * POINT_HIT_RADIUS)) return { type: 'point', index: i };
  }
  return null;
}

// cursor SVG helper (unchanged)
function makeSvgCursor(svgString, hotspotX = 16, hotspotY = 16) {
  const svg = svgString.replace(/\n/g, ' ');
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${hotspotX} ${hotspotY}, auto`;
}
const rotateSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 32 32'>
  <path d='M16 4 a12 12 0 1 0 12 12 h-2 a10 10 0 1 1 -10 -10 v-3 l5 4 -5 4 v-3z' fill='white' />
</svg>`;
const rotateCursorUrl = makeSvgCursor(rotateSvg, 16, 16);

function updateCanvasCursorFromPos(pos) {
  const hit = findHit(pos);
  if (!hit && draggingPointIndex === -1 && draggingTangentIndex === -1) {
    if (eqCanvas) eqCanvas.style.cursor = 'crosshair';
  } else if (draggingPointIndex !== -1 || (hit && hit.type === 'point')) {
    eqCanvas.style.cursor = 'pointer';
  } else {
    eqCanvas.style.cursor = rotateCursorUrl;
  }
}

// --- Hermite eval + solver (uses pts from buildPts) ---
function evalHermiteAt(p0, p1, t) {
  const t2 = t * t, t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  const X = h00 * p0.x + h10 * p0.mx + h01 * p1.x + h11 * p1.mx;
  const Y = h00 * p0.y + h10 * p0.my + h01 * p1.y + h11 * p1.my;
  return { X, Y };
}

// Find t in [0,1] such that Y(t) ~= targetY. Bracket then bisection.
// reduced samples to speed up; conservative bounds check first.
function findTForYOnSegment(p0, p1, targetY) {
  const minY = Math.min(p0.y, p1.y) - Math.abs(p0.my) - Math.abs(p1.my) - 1;
  const maxY = Math.max(p0.y, p1.y) + Math.abs(p0.my) + Math.abs(p1.my) + 1;
  if (targetY < minY || targetY > maxY) return null;

  // coarse sampling to find bracket (fewer samples)
  const SAMPLES = 24;
  let tPrev = 0;
  let fPrev = evalHermiteAt(p0, p1, 0).Y - targetY;
  if (Math.abs(fPrev) < 0.5) return 0;
  for (let i = 1; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const f = evalHermiteAt(p0, p1, t).Y - targetY;
    if (Math.abs(f) < 0.5) return t;
    if (fPrev * f <= 0) {
      // bracket found between tPrev and t
      let a = tPrev, b = t, fa = fPrev, fb = f;
      for (let iter = 0; iter < 28; iter++) {
        const m = 0.5 * (a + b);
        const fm = evalHermiteAt(p0, p1, m).Y - targetY;
        if (Math.abs(fm) < 0.5) return m;
        if (fa * fm <= 0) { b = m; fb = fm; } else { a = m; fa = fm; }
      }
      return 0.5 * (a + b);
    }
    tPrev = t; fPrev = f;
  }
  return null;
}

// Evaluate curve's X at a given screen Y position (returns screen X or null)
function evalEQGainAtY(targetY) {
  if (!eqCanvas) return null;
  const w = eqCanvas.width, h = eqCanvas.height;
  const pts = buildPts(w, h);
  if (pts.length === 0) return null;
  if (targetY <= pts[0].y) return pts[0].x;
  if (targetY >= pts[pts.length - 1].y) return pts[pts.length - 1].x;

  for (let k = 0; k < pts.length - 1; k++) {
    const p0 = pts[k], p1 = pts[k + 1];
    const possible = !(targetY < Math.min(p0.y, p1.y) - Math.abs(p0.my) - Math.abs(p1.my)
                       || targetY > Math.max(p0.y, p1.y) + Math.abs(p0.my) + Math.abs(p1.my));
    if (!possible) continue;
    const t = findTForYOnSegment(p0, p1, targetY);
    if (t !== null) {
      return evalHermiteAt(p0, p1, t).X;
    }
  }
  return null;
}

// --- pointer / interaction handlers (events unchanged behavior, set ptsDirty when mutate) ---
function getCanvasPos(evt) {
  const rect = eqCanvas.getBoundingClientRect();
  let clientX, clientY;
  if (evt.touches && evt.touches[0]) {
    clientX = evt.touches[0].clientX; clientY = evt.touches[0].clientY;
  } else {
    clientX = evt.clientX; clientY = evt.clientY;
  }
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function onPointerDown(evt) {
  evt.preventDefault();
  const pos = getCanvasPos(evt);
  const hit = findHit(pos);
  if (evt.pointerId && eqCanvas.setPointerCapture) {
    try { eqCanvas.setPointerCapture(evt.pointerId); } catch(e) {}
  }
  if (!hit) {
    draggingPointIndex = -1; draggingTangentIndex = -1;
    if (eqCanvas) eqCanvas.style.cursor = "crosshair";
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
    return;
  }
  if (hit.type === 'point') {
    eqCanvas.style.cursor = "pointer";
    draggingPointIndex = hit.index;
    const b = eqBands[hit.index];
    const sx = gainToX(b.gain, eqCanvas.width);
    const sy = freqToY(b.freq, eqCanvas.height);
    dragOffset.x = pos.x - sx; dragOffset.y = pos.y - sy;
  } else if (hit.type === 'handle') {
    eqCanvas.style.cursor = rotateCursorUrl;
    draggingTangentIndex = hit.index;
  }
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp, { once: true });
}

function eqMouseMove(evt) {
  const pos = getCanvasPos(evt);
  updateCanvasCursorFromPos(pos);

  const w = eqCanvas.width, h = eqCanvas.height;
  const freqAtCursor = yToFreq(pos.y, h);
  const XonSpline = evalEQGainAtY(pos.y);
  let gainText;
  if (XonSpline === null) {
    gainText = `${xToGain(pos.x, w).toFixed(1)} dB (raw X)`;
  } else {
    gainText = `${xToGain(XonSpline, w).toFixed(1)} dB (curve)`;
  }
  if (typeof info !== 'undefined' && info) {
    info.innerHTML = `Freq: ${freqAtCursor.toFixed(0)} Hz<br>Gain: ${gainText}<br>`;
  }
}

function onPointerMove(evt) {
  evt.preventDefault();
  const pos = getCanvasPos(evt);
  updateCanvasCursorFromPos(pos);

  if (draggingPointIndex !== -1) {
    const idx = draggingPointIndex;
    const b = eqBands[idx];
    const newX = pos.x - dragOffset.x;
    const newY = pos.y - dragOffset.y;
    const newGain = xToGain(newX, eqCanvas.width);
    const newFreq = yToFreq(newY, eqCanvas.height);
    b.freq = clamp(newFreq, 20, sampleRate / 2);
    b.gain = clamp(Number(newGain.toFixed(2)), -24, 24);
    ptsDirty = true;
    scheduleDraw();
  } else if (draggingTangentIndex !== -1) {
    const idx = draggingTangentIndex;
    const b = eqBands[idx];
    const px = gainToX(b.gain, eqCanvas.width);
    const py = freqToY(b.freq, eqCanvas.height);
    const angle = Math.atan2(pos.y - py, pos.x - px);
    b.angle = angle;
    // update cached mx/my immediately so hit tests use new value
    b.mx = Math.cos(b.angle) * (b.tLen || 40);
    b.my = Math.sin(b.angle) * (b.tLen || 40);
    b._cachedAngle = b.angle; b._cachedTLen = b.tLen;
    ptsDirty = true;
    scheduleDraw();
  }
  updateGlobalGain(); // keep globalGain in sync while dragging
}

function onPointerUp(evt) {
  draggingPointIndex = -1;
  draggingTangentIndex = -1;
  window.removeEventListener('pointermove', onPointerMove);
  ptsDirty = true;
  scheduleDraw();
}

// attach listeners
if (eqCanvas) {
  eqCanvas.style.touchAction = 'none';
  eqCanvas.addEventListener('pointerdown', onPointerDown);
  eqCanvas.addEventListener('pointermove', eqMouseMove);
}

// --- update functions ---
function updateGlobalGain() {
  if (!eqBands || eqBands.length === 0) {
    globalGain = 0;
  } else {
    let sum = 0;
    for (let i = 0; i < eqBands.length; i++) sum += (eqBands[i].gain || 0);
    globalGain = sum / eqBands.length;
  }
  // write back to UI sliders if they exist and are valid
  try {
    if (sliders && sliders[11]) {
      if (sliders[11][0]) sliders[11][0].value = globalGain;
      if (sliders[11][1]) sliders[11][1].value = globalGain;
    }
  } catch (e) { /* ignore UI update errors */ }
  return globalGain;
}

function updateEQ(targetGain = null) {
  const target = (typeof targetGain === 'number') ? targetGain : (globalGain ?? 0);
  let sum = 0;
  for (let i = 0; i < eqBands.length; i++) sum += (eqBands[i].gain || 0);
  const avg = sum / eqBands.length;
  const delta = target - avg;
  for (let i = 0; i < eqBands.length; i++) {
    eqBands[i].gain = clamp(Number((eqBands[i].gain + delta).toFixed(3)), -24, 24);
  }
  ptsDirty = true;
  scheduleDraw();
}
