const FREQ_LOG_SCALE = 2;
const gainScale = parseInt(sliders[11][0].max);
console.log(gainScale);
let eqBands = [
    { type: "low_shelf", freq: 0, gain: 0, Q: 1 }, 
    { type: "peaking", freq: sampleRate/128, gain: 0, Q: 1 }, 
    { type: "peaking", freq: sampleRate/32, gain: 0, Q: 1 }, 
    { type: "peaking", freq: sampleRate/16, gain: 0, Q: 1 }, 
    { type: "peaking", freq: sampleRate/8, gain: 0, Q: 1 }, 
    { type: "peaking", freq: sampleRate/4, gain: 0, Q: 1 }, 
    { type: "high_shelf", freq: sampleRate/2, gain: 0, Q: 1 }
];// --- config (unchanged) ---
const POINT_HIT_RADIUS = 7.5;
const HANDLE_HIT_RADIUS = 7.5;

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
  if (typeof b.tLen !== 'number') b.tLen = 60;
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
  return ((gain + gainScale) / (gainScale*2)) * w;
}
function xToGain(x, w) {
  return ((clamp(x, 0, w) / w) * (gainScale*2)) - gainScale;
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
  if (!eqCanvas || !eCtx || currentPanel !== "2") return;
  const w = eqCanvas.width, h = eqCanvas.height;
  // clear
  eCtx.clearRect(0, 0, w, h);
  // background
  eCtx.fillStyle = "#111";
  eCtx.fillRect(0, 0, w, h);

  const pts = buildPts(w, h);

  // grid/center lines
  eCtx.lineWidth = 1;
  eCtx.strokeStyle = "#444";
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
  eCtx.font = "12px 'Inter', 'Segoe UI', sans-serif";
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
    eCtx.moveTo(p.x - p.mx/3, p.y - p.my/3);
    eCtx.lineTo(p.x + p.mx/3, p.y + p.my/3);
    eCtx.stroke();
    // handle tip
    let hx, hy;
    if (p.b.type === "high_shelf") {hx = p.x - p.mx/3, hy = p.y - p.my/3;}else{hx = p.x + p.mx/3, hy = p.y + p.my/3;}
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
  drawSpectrals();
}

function drawSpectrals() {
  const bandCount = 128;
  const pos = currentCursorX * hop;
  if (pos + fftSize > pcm.length) { rendering = false; status.style.display = "none"; return false; }
  const re = new Float32Array(fftSize);
  const im = new Float32Array(fftSize);
  for (let i = 0; i < fftSize;i++) { re[i] = (pcm[pos + i] || 0) * win[i]; im[i] = 0; }
  fft_inplace(re, im);

  let bands = [];

  for (let i = 0; i < bandCount; i++) {
      const bin = Math.floor(yToFreq(((i / bandCount)),1)/(sampleRate/2)*specHeight);
      // const bin = Math.floor((i / bandCount) * (fftSize / 2));
      const mag = Math.hypot(re[bin] || 0, im[bin] || 0);
      bands[bin] = mag;
  }
  // console.log(bands);
  
  eCtx.strokeStyle ="rgba(255, 255, 255, 0.48)";
  eCtx.lineWidth = eqCanvas.height/bandCount/1.25;
  for (let yy = 0; yy < bandCount; yy++) {
      const mappedBin = Math.floor(yToFreq(((yy / bandCount)),1)/(sampleRate/2)*specHeight);
      // const mappedBin = Math.floor((yy / bandCount) * (fftSize / 2));
      const mag = bands[mappedBin] || 0;
      eCtx.beginPath();
      eCtx.moveTo(0, (yy/bandCount)*eqCanvas.height);
      const magToDb = m => 20 * Math.log10(m);
      const gain = xToGain(evalEQGainAtY((yy/bandCount)*eqCanvas.height),eqCanvas.width);
      const db = magToDb(mag/256) + (gain || 0);
      const lineTo = (db+128)/128*(eqCanvas.width/2);
      eCtx.lineTo(lineTo, (yy/bandCount)*eqCanvas.height);
      eCtx.stroke();
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
    let hx = x + mx/3, hy = y + my/3;
    if (b.type == "high_shelf") {hx = x-mx/3; hy = y-my/3;}
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

eqCanvas.addEventListener('pointerdown', (evt) => {  
  ensureAudioCtx();
  if (!sineOsc && !playing) {
      sineOsc = audioCtx.createOscillator();
      sineOsc.type = "sine";
      sineGain = audioCtx.createGain();
      sineGain.gain.value = 0.2;
      sineOsc.connect(sineGain).connect(audioCtx.destination);
      sineOsc.frequency.setTargetAtTime(yToFreq(getCanvasPos(evt).y, eqCanvas.height), audioCtx.currentTime, 0.01);
      sineOsc.start();
  }
});
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
    drawEQ();
    if (!findHit(getCanvasPos(evt))) {
        eCtx.save();
        eCtx.fillStyle = "limegreen";
        eCtx.beginPath();
        eCtx.arc(XonSpline, pos.y, 3, 0, Math.PI * 2);
        eCtx.fill();
        eCtx.restore();
    }
  }
  if (typeof info !== 'undefined' && info) {
    info.innerHTML = `Freq: ${freqAtCursor.toFixed(0)} Hz<br>Gain: ${gainText}<br>`;
  }
}

function onPointerMove(evt) {
  evt.preventDefault();
  const pos = getCanvasPos(evt);
  updateCanvasCursorFromPos(pos);
  if (sineOsc) {sineOsc.frequency.setTargetAtTime(yToFreq(pos.y, eqCanvas.height), audioCtx.currentTime, 0.01);}

  if (draggingPointIndex !== -1) {
    const idx = draggingPointIndex;
    const b = eqBands[idx];
    const newX = pos.x - dragOffset.x;
    const newY = pos.y - dragOffset.y;
    const newGain = xToGain(newX, eqCanvas.width);
    const newFreq = yToFreq(newY, eqCanvas.height);
    if (b.type !== "low_shelf" && b.type !== "high_shelf") b.freq = clamp(newFreq, 20, sampleRate / 2);
    b.gain = clamp(Number(newGain.toFixed(2)), 0-gainScale, gainScale);
    ptsDirty = true;
  } else if (draggingTangentIndex !== -1) {
    const idx = draggingTangentIndex;
    const b = eqBands[idx];
    const px = gainToX(b.gain, eqCanvas.width);
    const py = freqToY(b.freq, eqCanvas.height);
    const angle = ((b.type !== "high_shelf") ? 0 : Math.PI) + Math.atan2(pos.y - py, pos.x - px);
    b.angle = angle;
    // update cached mx/my immediately so hit tests use new value
    b.mx = Math.cos(b.angle) * (b.tLen || 40);
    b.my = Math.sin(b.angle) * (b.tLen || 40);
    b._cachedAngle = b.angle; b._cachedTLen = b.tLen;
    ptsDirty = true;
  }
  scheduleDraw();
  updateCurveEQ();
  updateGlobalGain(); // keep globalGain in sync while dragging
}

function onPointerUp(evt) {
  draggingPointIndex = -1;
  draggingTangentIndex = -1;
  window.removeEventListener('pointermove', onPointerMove);
  ptsDirty = true;
  scheduleDraw();
  updateCurveEQ();
  if (sineOsc) {
      sineOsc.stop();
      sineOsc.disconnect();
      sineOsc = null;
      sineGain = null;
  }
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
    eqBands[i].gain = clamp(Number((eqBands[i].gain + delta).toFixed(3)), 0-gainScale, gainScale);
  }
  ptsDirty = true;
  scheduleDraw();
  updateCurveEQ();
}
// --- globals (reuse your audioCtx/eqCanvas existing vars) ---
let curveEQ = {
  eqInput: null,
  eqOutput: null,
  filters: [],     // array of BiquadFilterNode
  bandCount: 24,   // default, adjustable
  inited: false
};

function ensureCurveEQ(bandCount = 24) {
  ensureAudioCtx();
  if (curveEQ.inited && curveEQ.bandCount === bandCount) return;
  curveEQ.bandCount = bandCount;
  // tear down previous chain (if any)
  try { curveEQ.eqInput && curveEQ.eqInput.disconnect(); } catch(e){}
  curveEQ.filters.forEach(f => { try { f.disconnect(); } catch(e){} });
  try { curveEQ.eqOutput && curveEQ.eqOutput.disconnect(); } catch(e){}

  curveEQ.eqInput = audioCtx.createGain();
  curveEQ.eqOutput = audioCtx.createGain();
  // final destination
  curveEQ.eqOutput.connect(audioCtx.destination);

  // create placeholder filters - they will be configured in buildCurveEQ()
  curveEQ.filters = new Array(bandCount).fill(0).map(() => audioCtx.createBiquadFilter());

  // wire: eqInput -> filt0 -> filt1 -> ... -> eqOutput
  if (curveEQ.filters.length === 0) {
    curveEQ.eqInput.connect(curveEQ.eqOutput);
  } else {
    curveEQ.eqInput.connect(curveEQ.filters[0]);
    for (let i = 0; i < curveEQ.filters.length - 1; i++) {
      curveEQ.filters[i].connect(curveEQ.filters[i + 1]);
    }
    curveEQ.filters[curveEQ.filters.length - 1].connect(curveEQ.eqOutput);
  }
  curveEQ.inited = true;
  // (initial configure)
  buildCurveEQ(bandCount);
}

// Build / configure the BiquadFilterNodes from the spline curve
function buildCurveEQ(bandCount = 24) {
  if (!eqCanvas) {
    console.warn("buildCurveEQ: need eqCanvas for screen mapping; using defaults (no curve).");
    return;
  }
  ensureCurveEQ(bandCount);
  const nyquist = sampleRate * 0.5;
  const fMin = 20;
  const fMax = nyquist;

  // geometric spacing between fMin and fMax
  const ratio = Math.pow(fMax / fMin, 1 / Math.max(1, bandCount - 1));
  const centers = new Array(bandCount);
  centers[0] = fMin;
  for (let i = 1; i < bandCount; i++) centers[i] = centers[i - 1] * ratio;

  const w = eqCanvas.width, h = eqCanvas.height;

  for (let i = 0; i < bandCount; i++) {
    const fc = centers[i];
    // sample the curve: get screen Y for this freq, then eval the curve for screen X
    const y = freqToY(fc, h);                       // normalized to canvas height
    const XonSpline = evalEQGainAtY(y);
    const gainDb = (XonSpline === null) ? 0 : xToGain(XonSpline, w);

    // estimate bandwidth -> Q
    const prevFc = (i === 0) ? (fc / ratio) : centers[i - 1];
    const nextFc = (i === bandCount - 1) ? (fc * ratio) : centers[i + 1];
    // approximate - avoid divide by 0:
    const bw = Math.max(1e-6, nextFc - prevFc);
    // conservative Q: fc / bw; clamp into reasonable range
    let Q = fc / bw;
    Q = clamp(Q, 0.3, 18);

    // configure filter node
    const fnode = curveEQ.filters[i];
    fnode.type = 'peaking';
    fnode.frequency.value = Math.min(Math.max(fc, 1), nyquist - 1);
    fnode.Q.value = Q;
    fnode.gain.value = gainDb;
  }
}

// Update existing filters' gains from the current spline (call often while editing)
function updateCurveEQ() {
  if (!curveEQ.inited || curveEQ.filters.length === 0) return;
  if (!eqCanvas) return;
  const bandCount = curveEQ.filters.length;
  const w = eqCanvas.width, h = eqCanvas.height;
  for (let i = 0; i < bandCount; i++) {
    const fnode = curveEQ.filters[i];
    const fc = fnode.frequency.value;
    const y = freqToY(fc, h);
    const XonSpline = evalEQGainAtY(y);
    const gainDb = (XonSpline === null) ? 0 : xToGain(XonSpline, w);
    // smooth transition
    fnode.gain.setTargetAtTime(gainDb, audioCtx.currentTime, 0.01);
  }
}

// Call this once (or whenever you want a different resolution)
ensureCurveEQ(24);        // create 24-band approx
buildCurveEQ(24);

// Hook up your sourceNode connection: instead of sourceNode.connect(audioCtx.destination)
// connect to curveEQ.eqInput
// Example modifications to your playPCM/playFrame:
// after you create `sourceNode`:
if (curveEQ && curveEQ.inited) {
  // connect source to eqInput (and not directly to dest)
  try { sourceNode.connect(curveEQ.eqInput); } catch(e){ console.warn(e); }
} else {
  sourceNode.connect(audioCtx.destination);
}

const eqPresetsData = {
  "Flat":        [0, 0, 0, 0, 0, 0, 0],
  "Bass boost":  [6, 4, 3, 1, 0, -1, -2],
  "Lowpass":     [0, -2, -4, -6, -8, -10, -12],
  "Mid boost":   [0, 0, 6, 6, 0, 0, 0],
  "Midpass":     [-6, -4, 0, 4, 0, -4, -6],
  "High boost":  [-2, -1, 0, 1, 3, 5, 7],
  "Highpass":    [-12, -10, -8, -6, -4, -2, 0],
  "Custom":      null
};

// Utility: apply an array of gains to eqBands
function applyPresetValues(gainsArray) {
  if (!Array.isArray(gainsArray) || gainsArray.length !== eqBands.length) {
    console.warn("applyPresetValues: preset length mismatch", gainsArray);
    return;
  }
  for (let i = 0; i < eqBands.length; i++) {
    // write and clamp
    eqBands[i].gain = clamp(Number(gainsArray[i]||0), -gainScale, gainScale);
  }
  ptsDirty = true;
  scheduleDraw();
  updateCurveEQ();
  updateGlobalGain();
  // try to reflect changes in UI sliders (two strategies)
  tryUpdateBandSlidersFromBands();
}

// Try to update known slider data structures (best-effort)
function tryUpdateBandSlidersFromBands() {
  // If your code uses a `sliders` global with format sliders[bandIndex][0 or 1]
  try {
    if (typeof sliders !== 'undefined' && Array.isArray(sliders)) {
      for (let i = 0; i < eqBands.length && i < sliders.length; i++) {
        if (sliders[i] && sliders[i][0]) sliders[i][0].value = eqBands[i].gain;
        if (sliders[i] && sliders[i][1]) sliders[i][1].value = eqBands[i].gain;
      }
      return;
    }
  } catch (e) { /* ignore */ }

  // Otherwise try DOM approach: elements with data-eq-band="0" ... "6"
  for (let i = 0; i < eqBands.length; i++) {
    const sel = document.querySelectorAll(`[data-eq-band="${i}"]`);
    sel.forEach(node => {
      if ('value' in node) node.value = eqBands[i].gain;
    });
  }
}

// Apply a named preset (case-sensitive names from your <select>)
function applyPresetByName(name) {
  if (!name) return;
  if (name.toLowerCase() === "custom") {
    // nothing to apply
    return;
  }
  const preset = eqPresetsData[name];
  if (!preset) {
    console.warn("Preset not found:", name);
    return;
  }
  applyPresetValues(preset);
}

// Save current bands as a named preset (overwrites)
function saveCurrentAsPreset(name) {
  if (!name) return;
  const arr = eqBands.map(b => Number(b.gain || 0));
  eqPresetsData[name] = arr;
  // If the select didn't have the name, you may want to add it to the <select>.
  const optExists = !!document.querySelector(`#eqPresets option[value="${name}"]`);
  if (!optExists) {
    const op = document.createElement('option');
    op.value = name; op.textContent = name;
    document.getElementById('eqPresets').appendChild(op);
  }
}

// Hook up the <select> change listener
const eqPresetsSelect = document.getElementById('eqPresets');
if (eqPresetsSelect) {
  eqPresetsSelect.addEventListener("change", (e) => {
    const presetName = eqPresetsSelect.value;
    if (!presetName) return;
    if (presetName.toLowerCase() === "custom") {
      // user chose Custom; do nothing (they will edit)
      return;
    }
    if (eqPresetsData[presetName]) {
      applyPresetByName(presetName);
    } else {
      console.warn("No preset data for:", presetName);
    }
  });
}

// Mark select as Custom when user edits sliders or drags points.
// 1) DOM slider edits: detect elements with data-eq-band or class `.eq-band-slider`
function markPresetCustom() {
  if (!eqPresetsSelect) return;
  const cur = eqPresetsSelect.value;
  if (cur !== "Custom") eqPresetsSelect.value = "Custom";
}

// Add event listeners for slider inputs (best effort)
function attachSliderChangeDetection() {
  // elements with data-eq-band="N"
  const slidersByAttr = document.querySelectorAll('[data-eq-band]');
  if (slidersByAttr.length) {
    slidersByAttr.forEach(el => el.addEventListener('input', markPresetCustom));
  }
  // fallback: any element with class eq-band-slider
  const slidersByClass = document.querySelectorAll('.eq-band-slider');
  if (slidersByClass.length) {
    slidersByClass.forEach(el => el.addEventListener('input', markPresetCustom));
  }
}
attachSliderChangeDetection();

// 2) Canvas pointer interactions already change eqBands; make pointerup mark Custom
if (typeof eqCanvas !== 'undefined' && eqCanvas) {
  eqCanvas.addEventListener('pointerup', (e) => {
    // after user drags a point, mark preset as Custom
    markPresetCustom();
  }, { passive: true });
}

// Optional convenience: allow saving current curve into "Custom" or another name via API:
window.eqPresets = window.eqPresets || {};
window.eqPresets.apply = applyPresetByName;
window.eqPresets.save = saveCurrentAsPreset;
window.eqPresets.data = eqPresetsData;

// Example: if you want the default to be Flat at load:
if (eqPresetsSelect && eqPresetsSelect.value === "") {
  eqPresetsSelect.value = "Flat";
  applyPresetByName("Flat");
}