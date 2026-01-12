const FREQ_LOG_SCALE = 2;
const gainScale = parseInt(sliders[11][0].max);
let defaultEQBands= [
    { type: "low_shelf", freq: 0, gain: 0}, 
    { type: "peaking", freq: sampleRate/128}, 
    { type: "peaking", freq: sampleRate/32}, 
    { type: "peaking", freq: sampleRate/16}, 
    { type: "peaking", freq: sampleRate/8}, 
    { type: "peaking", freq: sampleRate/4}, 
    { type: "high_shelf", freq: sampleRate/2}
];
let eqBands = defaultEQBands.map(band => ({ ...band }));
const POINT_HIT_RADIUS = 7.5;
const HANDLE_HIT_RADIUS = 7.5;

let draggingPointIndex = -1;
let draggingTangentIndex = -1;
let dragOffset = { x: 0, y: 0 };
let ptsCache = null;         
let ptsCacheW = 0, ptsCacheH = 0;
let ptsDirty = true;
let drawScheduled = false;

eqBands.forEach(b => {
  if (typeof b.angle !== 'number') b.angle = Math.PI / 2;
  if (typeof b.tLen !== 'number') b.tLen = 60;
  b.gain = 0; b.Q = 1;

  b.mx = Math.cos(b.angle) * b.tLen;
  b.my = Math.sin(b.angle) * b.tLen;
});

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

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

function buildPts(w, h) {
  if (!ptsDirty && ptsCache && ptsCacheW === w && ptsCacheH === h) {
    return ptsCache;
  }
  const arr = new Array(eqBands.length);
  for (let i = 0; i < eqBands.length; i++) {
    const b = eqBands[i];

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

function scheduleDraw() {
  if (drawScheduled) return;
  drawScheduled = true;
  requestAnimationFrame(() => {
    drawScheduled = false;
    drawEQ();
  });
}

function drawEQ() {
  if (!EQcanvas || !eCtx || currentPanel !== "5") return;
  const w = EQcanvas.width, h = EQcanvas.height;

  eCtx.clearRect(0, 0, w, h);

  eCtx.fillStyle = "#111";
  eCtx.fillRect(0, 0, w, h);

  const pts = buildPts(w, h);

  eCtx.lineWidth = 1;
  eCtx.strokeStyle = "#444";
  eCtx.beginPath();
  const xZero = gainToX(0, w);
  eCtx.moveTo(xZero, 0); eCtx.lineTo(xZero, h);
  const xGlobal = gainToX(globalGain || 0, w);
  eCtx.moveTo(xGlobal, 0); eCtx.lineTo(xGlobal, h);
  eCtx.stroke();

  eCtx.lineWidth = 2;
  eCtx.strokeStyle = "#fff";
  eCtx.beginPath();
  if (pts.length > 0) {
    eCtx.moveTo(pts[0].x, pts[0].y);
    for (let k = 0; k < pts.length - 1; k++) {
      const p0 = pts[k], p1 = pts[k + 1];

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

  eCtx.font = "12px 'Inter', 'Segoe UI', sans-serif";
  eCtx.textBaseline = "middle";
  for (let idx = 0; idx < pts.length; idx++) {
    const p = pts[idx];

    eCtx.beginPath();
    eCtx.fillStyle = "#fff";
    eCtx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    eCtx.fill();

    eCtx.strokeStyle = "#f00";
    eCtx.lineWidth = 2;
    eCtx.beginPath();
    eCtx.moveTo(p.x - p.mx/3, p.y - p.my/3);
    eCtx.lineTo(p.x + p.mx/3, p.y + p.my/3);
    eCtx.stroke();

    let hx, hy;
    if (p.b.type === "high_shelf") {hx = p.x - p.mx/3, hy = p.y - p.my/3;}else{hx = p.x + p.mx/3, hy = p.y + p.my/3;}
    eCtx.beginPath();
    eCtx.fillStyle = "#ff0";
    eCtx.arc(hx, hy, 3, 0, Math.PI * 2);
    eCtx.fill();

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

      const mag = Math.hypot(re[bin] || 0, im[bin] || 0);
      bands[bin] = mag;
  }

  eCtx.strokeStyle ="rgba(255, 255, 255, 0.48)";
  eCtx.lineWidth = EQcanvas.height/bandCount/1.25;
  for (let yy = 0; yy < bandCount; yy++) {
      const mappedBin = Math.floor(yToFreq(((yy / bandCount)),1)/(sampleRate/2)*specHeight);

      const mag = bands[mappedBin] || 0;
      eCtx.beginPath();
      eCtx.moveTo(0, (yy/bandCount)*EQcanvas.height);
      const magToDb = m => 20 * Math.log10(m);
      const gain = xToGain(evalEQGainAtY((yy/bandCount)*EQcanvas.height),EQcanvas.width);
      const db = magToDb(mag/256) + (gain || 0);
      const lineTo = (db+128)/128*(EQcanvas.width/2);
      eCtx.lineTo(lineTo, (yy/bandCount)*EQcanvas.height);
      eCtx.stroke();
  }
}

function findHit(pos) {
  if (!EQcanvas) return null;
  const w = EQcanvas.width, h = EQcanvas.height;
  for (let i = 0; i < eqBands.length; i++) {
    const b = eqBands[i];
    const y = freqToY(b.freq, h);
    const x = gainToX(b.gain || 0, w);

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
    if (EQcanvas) EQcanvas.style.cursor = 'crosshair';
  } else if (draggingPointIndex !== -1 || (hit && hit.type === 'point')) {
    EQcanvas.style.cursor = 'pointer';
  } else {
    EQcanvas.style.cursor = rotateCursorUrl;
  }
}

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

function findTForYOnSegment(p0, p1, targetY) {
  const minY = Math.min(p0.y, p1.y) - Math.abs(p0.my) - Math.abs(p1.my) - 1;
  const maxY = Math.max(p0.y, p1.y) + Math.abs(p0.my) + Math.abs(p1.my) + 1;
  if (targetY < minY || targetY > maxY) return null;

  const SAMPLES = 24;
  let tPrev = 0;
  let fPrev = evalHermiteAt(p0, p1, 0).Y - targetY;
  if (Math.abs(fPrev) < 0.5) return 0;
  for (let i = 1; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const f = evalHermiteAt(p0, p1, t).Y - targetY;
    if (Math.abs(f) < 0.5) return t;
    if (fPrev * f <= 0) {

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

function evalEQGainAtY(targetY) {
  if (!EQcanvas) return null;
  const w = EQcanvas.width, h = EQcanvas.height;
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

function getCanvasPos(evt) {
  const rect = EQcanvas.getBoundingClientRect();
  let clientX, clientY;
  if (evt.touches && evt.touches[0]) {
    clientX = evt.touches[0].clientX; clientY = evt.touches[0].clientY;
  } else {
    clientX = evt.clientX; clientY = evt.clientY;
  }
  return { x: clientX - rect.left, y: clientY - rect.top };
}

EQcanvas.addEventListener('pointerdown', (evt) => {  
  ensureAudioCtx();
  if (!sineOsc && !playing) {
      sineOsc = audioCtx.createOscillator();
      sineOsc.type = "sine";
      sineGain = audioCtx.createGain();
      sineGain.gain.value = 0.2*document.getElementById("drawVolume").value;
      sineOsc.connect(sineGain).connect(audioCtx.destination);
      sineOsc.frequency.setTargetAtTime(yToFreq(getCanvasPos(evt).y, EQcanvas.height), audioCtx.currentTime, 0.01);
      sineOsc.start();
  }
});
function onPointerDown(evt) {
  evt.preventDefault();
  const pos = getCanvasPos(evt);
  const hit = findHit(pos);
  if (evt.pointerId && EQcanvas.setPointerCapture) {
    try { EQcanvas.setPointerCapture(evt.pointerId); } catch(e) {}
  }
  if (!hit) {
    draggingPointIndex = -1; draggingTangentIndex = -1;
    if (EQcanvas) EQcanvas.style.cursor = "crosshair";
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, { once: true });
    return;
  }
  if (hit.type === 'point') {
    EQcanvas.style.cursor = "pointer";
    draggingPointIndex = hit.index;
    const b = eqBands[hit.index];
    const sx = gainToX(b.gain, EQcanvas.width);
    const sy = freqToY(b.freq, EQcanvas.height);
    dragOffset.x = pos.x - sx; dragOffset.y = pos.y - sy;
  } else if (hit.type === 'handle') {
    EQcanvas.style.cursor = rotateCursorUrl;
    draggingTangentIndex = hit.index;
  }
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp, { once: true });
}

function eqMouseMove(evt) {
  const pos = getCanvasPos(evt);
  updateCanvasCursorFromPos(pos);

  const w = EQcanvas.width, h = EQcanvas.height;
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
  if (sineOsc) {sineOsc.frequency.setTargetAtTime(yToFreq(pos.y, EQcanvas.height), audioCtx.currentTime, 0.01);}

  if (draggingPointIndex !== -1) {
    const idx = draggingPointIndex;
    const b = eqBands[idx];
    const newX = pos.x - dragOffset.x;
    const newY = pos.y - dragOffset.y;
    const newGain = xToGain(newX, EQcanvas.width);
    const newFreq = yToFreq(newY, EQcanvas.height);
    if (b.type !== "low_shelf" && b.type !== "high_shelf") b.freq = clamp(newFreq, 20, sampleRate / 2);
    b.gain = clamp(Number(newGain.toFixed(2)), 0-gainScale, gainScale);
    ptsDirty = true;
  } else if (draggingTangentIndex !== -1) {
    const idx = draggingTangentIndex;
    const b = eqBands[idx];
    const px = gainToX(b.gain, EQcanvas.width);
    const py = freqToY(b.freq, EQcanvas.height);
    const angle = ((b.type !== "high_shelf") ? 0 : Math.PI) + Math.atan2(pos.y - py, pos.x - px);
    b.angle = angle;

    b.mx = Math.cos(b.angle) * (b.tLen || 40);
    b.my = Math.sin(b.angle) * (b.tLen || 40);
    b._cachedAngle = b.angle; b._cachedTLen = b.tLen;
    ptsDirty = true;
  }
  scheduleDraw();
  updateCurveEQ();
  updateGlobalGain(); 
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

if (EQcanvas) {
  EQcanvas.style.touchAction = 'none';
  EQcanvas.addEventListener('pointerdown', onPointerDown);
  EQcanvas.addEventListener('pointermove', eqMouseMove);
}

function updateGlobalGain() {
  if (!eqBands || eqBands.length === 0) {
    globalGain = 0;
  } else {
    let sum = 0;
    for (let i = 0; i < eqBands.length; i++) sum += (eqBands[i].gain || 0);
    globalGain = sum / eqBands.length;
  }

  try {
    if (sliders && sliders[11]) {
      if (sliders[11][0]) sliders[11][0].value = globalGain;
      if (sliders[11][1]) sliders[11][1].value = globalGain;
    }
  } catch (e) {  }
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

let curveEQ = {
  eqInput: null,
  eqOutput: null,
  filters: [],     
  bandCount: 24,   
  inited: false
};

function ensureCurveEQ(bandCount = 24) {
  ensureAudioCtx();
  if (curveEQ.inited && curveEQ.bandCount === bandCount) return;
  curveEQ.bandCount = bandCount;

  try { curveEQ.eqInput && curveEQ.eqInput.disconnect(); } catch(e){}
  curveEQ.filters.forEach(f => { try { f.disconnect(); } catch(e){} });
  try { curveEQ.eqOutput && curveEQ.eqOutput.disconnect(); } catch(e){}

  curveEQ.eqInput = audioCtx.createGain();
  curveEQ.eqOutput = audioCtx.createGain();

  curveEQ.eqOutput.connect(audioCtx.destination);

  curveEQ.filters = new Array(bandCount).fill(0).map(() => audioCtx.createBiquadFilter());

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

  buildCurveEQ(bandCount);
}

function buildCurveEQ(bandCount = 24) {
  if (!EQcanvas) {
    console.warn("buildCurveEQ: need EQcanvas for screen mapping; using defaults (no curve).");
    return;
  }
  ensureCurveEQ(bandCount);
  const nyquist = sampleRate * 0.5;
  const fMin = 20;
  const fMax = nyquist;

  const ratio = Math.pow(fMax / fMin, 1 / Math.max(1, bandCount - 1));
  const centers = new Array(bandCount);
  centers[0] = fMin;
  for (let i = 1; i < bandCount; i++) centers[i] = centers[i - 1] * ratio;

  const w = EQcanvas.width, h = EQcanvas.height;

  for (let i = 0; i < bandCount; i++) {
    const fc = centers[i];

    const y = freqToY(fc, h);                       
    const XonSpline = evalEQGainAtY(y);
    const gainDb = (XonSpline === null) ? 0 : xToGain(XonSpline, w);

    const prevFc = (i === 0) ? (fc / ratio) : centers[i - 1];
    const nextFc = (i === bandCount - 1) ? (fc * ratio) : centers[i + 1];

    const bw = Math.max(1e-6, nextFc - prevFc);

    let Q = fc / bw;
    Q = clamp(Q, 0.3, 18);

    const fnode = curveEQ.filters[i];
    fnode.type = 'peaking';
    fnode.frequency.value = Math.min(Math.max(fc, 1), nyquist - 1);
    fnode.Q.value = Q;
    fnode.gain.value = gainDb;
  }
}

function updateCurveEQ() {
  if (!curveEQ.inited || curveEQ.filters.length === 0) return;
  if (!EQcanvas) return;
  const bandCount = curveEQ.filters.length;
  const w = EQcanvas.width, h = EQcanvas.height;
  for (let i = 0; i < bandCount; i++) {
    const fnode = curveEQ.filters[i];
    const fc = fnode.frequency.value;
    const y = freqToY(fc, h);
    const XonSpline = evalEQGainAtY(y);
    const gainDb = (XonSpline === null) ? 0 : xToGain(XonSpline, w);

    fnode.gain.setTargetAtTime(gainDb, audioCtx.currentTime, 0.01);
  }
}

ensureCurveEQ(24);        
buildCurveEQ(24);

// if (curveEQ && curveEQ.inited) {

//   try { sourceNode.connect(curveEQ.eqInput); } catch(e){ console.warn(e); }
// } else {
//   sourceNode.connect(audioCtx.destination);
// }

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

function applyPresetValues(gainsArray) {
  if (!Array.isArray(gainsArray) || gainsArray.length !== eqBands.length) {
    eqBands = defaultEQBands;
  }
  for (let i = 0; i < eqBands.length; i++) {

    eqBands[i].gain = clamp(Number(gainsArray[i]||0), -gainScale, gainScale);
    eqBands[i].angle = Math.PI/2;
  }
  ptsDirty = true;
  scheduleDraw();
  updateCurveEQ();
  updateGlobalGain();

  tryUpdateBandSlidersFromBands();
}

function tryUpdateBandSlidersFromBands() {

  try {
    if (typeof sliders !== 'undefined' && Array.isArray(sliders)) {
      for (let i = 0; i < eqBands.length && i < sliders.length; i++) {
        if (sliders[i] && sliders[i][0]) sliders[i][0].value = eqBands[i].gain;
        if (sliders[i] && sliders[i][1]) sliders[i][1].value = eqBands[i].gain;
      }
      return;
    }
  } catch (e) {  }

  for (let i = 0; i < eqBands.length; i++) {
    const sel = document.querySelectorAll(`[data-eq-band="${i}"]`);
    sel.forEach(node => {
      if ('value' in node) node.value = eqBands[i].gain;
    });
  }
}

function applyPresetByName(name) {
  if (!name) return;
  if (name.toLowerCase() === "custom") {

    return;
  }
  const preset = eqPresetsData[name];
  if (!preset) {
    console.warn("Preset not found:", name);
    return;
  }
  applyPresetValues(preset);
}

function saveCurrentAsPreset(name) {
  if (!name) return;
  const arr = eqBands.map(b => Number(b.gain || 0));
  eqPresetsData[name] = arr;

  const optExists = !!document.querySelector(`#eqPresets option[value="${name}"]`);
  if (!optExists) {
    const op = document.createElement('option');
    op.value = name; op.textContent = name;
    document.getElementById('eqPresets').appendChild(op);
  }
}

const eqPresetsSelect = document.getElementById('eqPresets');
if (eqPresetsSelect) {
  eqPresetsSelect.addEventListener("change", (e) => {
    const presetName = eqPresetsSelect.value;
    if (!presetName) return;
    if (presetName.toLowerCase() === "custom") {

      return;
    }
    if (eqPresetsData[presetName]) {
      applyPresetByName(presetName);
    } else {
      console.warn("No preset data for:", presetName);
    }
  });
}

function markPresetCustom() {
  if (!eqPresetsSelect) return;
  const cur = eqPresetsSelect.value;
  if (cur !== "Custom") eqPresetsSelect.value = "Custom";
}

function attachSliderChangeDetection() {

  const slidersByAttr = document.querySelectorAll('[data-eq-band]');
  if (slidersByAttr.length) {
    slidersByAttr.forEach(el => el.addEventListener('input', markPresetCustom));
  }

  const slidersByClass = document.querySelectorAll('.eq-band-slider');
  if (slidersByClass.length) {
    slidersByClass.forEach(el => el.addEventListener('input', markPresetCustom));
  }
}
attachSliderChangeDetection();

if (typeof EQcanvas !== 'undefined' && EQcanvas) {
  EQcanvas.addEventListener('pointerup', (e) => {

    markPresetCustom();
  }, { passive: true });
}

window.eqPresets = window.eqPresets || {};
window.eqPresets.apply = applyPresetByName;
window.eqPresets.save = saveCurrentAsPreset;
window.eqPresets.data = eqPresetsData;

if (eqPresetsSelect && eqPresetsSelect.value === "") {
  eqPresetsSelect.value = "Flat";
  applyPresetByName("Flat");
}