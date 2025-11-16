function hzToNoteName(frequency) {
  if (frequency <= 0) return "0";
  const A4 = 440;
  const A4_MIDI = 69;
  const midi = Math.round(12 * Math.log2(frequency / A4) + A4_MIDI);
  const noteNames = ["C", "C#", "D", "D#", "E", "F", 
                     "F#", "G", "G#", "A", "A#", "B"];
  const note = noteNames[(midi+1200) % 12];
  const octave = Math.floor(midi / 12) - 1;
  const ret = `${note}${octave}`;
  return ret;
}
let sineOsc = null;
let sineGain = null;
function getSineFreq(cy) {
    const h = specHeight;
    const s = parseFloat(logScaleVal); 
    let bin;
    if (s <= 1.0000001) {
        bin = h - 1 - cy;
    } else {
        const a = s - 1;
        const denom = Math.log(1 + a * (h - 1));
        const t = 1 - cy / (h - 1);
        bin = (Math.exp(t * denom) - 1) / a;
    }
    bin = Math.max(0, Math.min(h - 1, bin));
    return bin * sampleRate / fftSize;
}
function setSineFreq(cy) {
    sineOsc.frequency.setTargetAtTime(getSineFreq(cy), audioCtx.currentTime, 0.01);
}
function visibleToSpecY(visY) {
    const fStart = Math.max(0, Math.floor(specHeight * (1 - fHigh / (sampleRate/2))));
    const fullY = Math.round(visY + fStart);
    return Math.max(0, Math.min(specHeight - 1, fullY));
}
let snapshotMags = null;
let snapshotPhases = null;

function cxToFrame(cx) {
  return Math.floor((cx/canvas.width*(iWidth/specWidth)+iLow)*specWidth);
}

function frameToCx(frame) {
  return ((frame-iLow)/(iWidth/specWidth)*1);
}
function handleMoveSprite(cx,cy) {
  let dx = cx-startX, dy=startY-cy;
  moveSprite(selectedSpriteId, Math.round(dx), Math.round(dy));
}
let sx2 = 0, sy2 = 0;

/* ===== Modified canvasMouseDown ===== */
function canvasMouseDown(e,touch) {
  if (!touch) zooming=false;
  if (!mags || !phases) return;
  if (!touch && e.button !== 0) return;
  if (pendingHistory) return; 
  const {cx,cy,scaleX,scaleY} = getCanvasCoords(e,touch);
  startX = cx; startY = cy;
  painting = true;
  if (movingSprite) {
    spritePath = generateSpriteOutlinePath(getSpriteById(selectedSpriteId), { height: specHeight });
    return;
  } else {
    snapshotMags = new Float32Array(mags);
    snapshotPhases = new Float32Array(phases);

    visited = new Uint8Array(mags.length);
    stopSource();
    paintedPixels = new Set();
    
    if (alignTime) {
      const snapSize = 30/bpm/subBeat;
      const startTime = Math.floor((cx/(sampleRate/hopSizeEl.value))/snapSize)*snapSize;
      const startFrame0 = Math.round((startTime*(sampleRate/hopSizeEl.value)) + iLow);
      sx2 = cx; sy2 = cy;
      startX = startFrame0 - iLow;
    }
    overlayCtx.clearRect(0,0,overlayCanvas.width, overlayCanvas.height);
    const realY = visibleToSpecY(cy);

    let count = 1;
    for (let sprite of sprites) {
      if (sprite.tool === currentTool) count++;
    }
    let name = currentTool + `_${count}`;

    // --- CREATE NEW SPRITE FOR THIS STROKE ---
    currentSprite = {
      id: nextSpriteId++,
      effect: {tool: currentTool, brushColor, brushSize, brushOpacity, phaseOpacity, penPhase, amp, noiseRemoveFloor, blurRadius},
      enabled: true,
      pixels: new Map(), // Map<columnX, {ys:[], prevMags:[], prevPhases:[], nextMags:[], nextPhases:[]}>
      minCol: Infinity,
      maxCol: -Infinity,
      createdAt: performance.now(),
      name
    };
    sprites.push(currentSprite);

    if (!(currentShape === "rectangle" || currentShape === "line")) {
        paint(cx + iLow, realY);
    }
    currentFrame = Math.floor(cx);
    if (document.getElementById("previewWhileDrawing").checked) {
      ensureAudioCtx();
      mouseDown = true;
      playFrame(currentFrame);

      if (!sineOsc) {
          sineOsc = audioCtx.createOscillator();
          sineOsc.type = "sine";
          sineGain = audioCtx.createGain();
          sineGain.gain.value = 0.2;
          sineOsc.connect(sineGain).connect(audioCtx.destination);
          setSineFreq(realY); 
          sineOsc.start();
      }
    }
  }
}
canvas.addEventListener("mousedown", e=>{
    canvasMouseDown(e,false);
});
canvas.addEventListener("touchstart", e=>{
    canvasMouseDown(e,true);
});
let previewingShape = false;
function canvasMouseMove(e,touch) {
  const {cx,cy,scaleX,scaleY} = getCanvasCoords(e,touch);
  if (painting && movingSprite) {previewShape(cx, cy);return;}
  if (zooming) return;
  if (!recording) {
    const hz = getSineFreq(visibleToSpecY(cy));
    const secs = Math.floor(cx/(sampleRate/hopSizeEl.value)*10000)/10000;
    const hx = Math.floor(cx);
    const hy = Math.floor(hz/(sampleRate/fftSize));
    const i = hx*specHeight+hy;
    let normalizedMag = Math.min(1, mags[i] / 256);
    let db = (20 * Math.log10(normalizedMag)).toFixed(1);
    info.innerHTML=`Pitch: ${hz.toFixed(0)}hz (${hzToNoteName(hz)}) <br>Time: ${secs}<br>Loudness: ${db} db`
  }
  if (!painting && (currentShape === "brush" || currentShape === "image") && !movingSprite) {
    previewShape(cx, cy);
    previewingShape = true;
    return;
  }
  if(!painting && currentTool != "image") return;

  if (currentShape !== "brush") {
    previewShape(cx, cy);
    previewingShape = true;
  } else {
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    const realY = visibleToSpecY(cy);
    paint(cx + iLow, realY);
    drawCursor(true);
  }

  currentFrame = Math.floor(cx+iLow);
  if (mouseDown) {
    playFrame(currentFrame);
    if (sineOsc) setSineFreq( visibleToSpecY(cy) ); 
  }

  currentCursorX = currentFrame;
}
canvas.addEventListener("mousemove", e=>{
  canvasMouseMove(e,false);
});
canvas.addEventListener("touchmove", e=>{
  canvasMouseMove(e,true);
});
function canvasMouseUp(e,touch) {
  previewingShape = false;
  if (zooming) return;
  if (!mags || !phases || !painting) return;
  renderSpritesTable();
  
  minCol = Infinity; maxCol = -Infinity;
  visited = null;
  painting = false;
  paintedPixels = null;
  mouseDown = false;
  stopSource();
  if (sineOsc) {
    sineOsc.stop();
    sineOsc.disconnect();
    sineOsc = null;
    sineGain = null;
  }
  const { cx, cy } = getCanvasCoords(e,touch);
  if (movingSprite) handleMoveSprite(cx,cy);
  if (currentShape === "rectangle" || currentShape === "line") {
    commitShape(cx, cy); 
    overlayCtx.clearRect(0,0,overlayCanvas.width,overlayCanvas.height);
  }
  if (alignTime && currentTool === "color") {
    const startFrame = Math.round(cx + iLow);
    const snapSize = 30/bpm/subBeat;
    const brushS = brushSize*fWidth/sampleRate*fftSize/512;

    let startTime = Math.floor((sx2/(sampleRate/hopSizeEl.value))/snapSize)*snapSize + ((cx<startX) ? snapSize : 0);
    let startFrame0 = Math.round((startTime*(sampleRate/hopSizeEl.value)) + iLow);
    line(startFrame0, sx2, visibleToSpecY(sy2), visibleToSpecY(sy2),brushS);

    startTime = Math.floor((cx/(sampleRate/hopSizeEl.value))/snapSize)*snapSize + ((cx>startX) ? snapSize : 0);
    startFrame0 = Math.round((startTime*(sampleRate/hopSizeEl.value)) + iLow);
    line(startFrame0, cx, visibleToSpecY(cy), visibleToSpecY(cy),brushS);
  }

  startX=startY=null;

  startTime = performance.now();
  audioProcessed = 0;

  if (snapshotMags && snapshotPhases && mags && phases && !movingSprite) {

    autoRecomputePCM(-1,-1);

    pendingHistory = true;
    pendingPlayAfterRender = true; 
  }

  let startFrame = calcMinMaxCol().minCol;
  if (startFrame == Infinity) startFrame = 0;
  pos = startFrame * hop;
  x = startFrame;
  rendering = true;
  requestAnimationFrame(() => drawLoop());

  startTime = performance.now();
  audioProcessed = 0;

}

let minCol = Infinity; maxCol = -Infinity;
function calcMinMaxCol() {
  if (minCol != Infinity) return {minCol,maxCol};
  if (snapshotMags == null || snapshotMags.length != mags.length) {minCol = 0;maxCol=specWidth;return {minCol,maxCol};}
  const epsMag = 1e-6;
  const epsPhase = 1e-3;
  const h = specHeight;
  const total = mags.length;
  for (let idx = 0; idx < total; idx++) {
    const oldM = (snapshotMags) ? snapshotMags[idx] : 0;
    const newM = mags[idx] ?? 0;
    if (Math.abs(oldM - newM) > epsMag) {
      const col = Math.floor(idx / h);
      if (col < minCol) minCol = col;
      if (col > maxCol) maxCol = col;
      continue;
    }
    const oldP = (snapshotPhases) ? snapshotPhases[idx] : 0;
    const newP = phases[idx] || 0;
    if (Math.abs(angleDiff(oldP, newP)) > epsPhase) {
      const col = Math.floor(idx / h);
      if (col < minCol) minCol = col;
      if (col > maxCol) maxCol = col;
    }
  }
  if (isFinite(minCol)) {
    minCol = Math.max(0, minCol);
    maxCol = Math.min(specWidth - 1, maxCol);
    const overlapCols = Math.ceil(fftSize / Math.max(1, hop)); // how many frames overlap a sample
    minCol = Math.max(0, minCol - overlapCols);
    maxCol = Math.min(specWidth - 1, maxCol + overlapCols);
  }
  return {minCol,maxCol};
}

function autoRecomputePCM(min,max) {
  let minCol, maxCol;
  if (min == -1) {
    let a = calcMinMaxCol();
    minCol=a.minCol;maxCol=a.maxCol;
  } else {
    minCol = min;
    maxCol = max;
  }

  if (isFinite(minCol)) {

    try {
      recomputePCMForCols(minCol, maxCol, { oldMags: snapshotMags, oldPhases: snapshotPhases });

      pendingRecomputeDone = true;
      pendingRecomputeMinCol = minCol;
      pendingRecomputeMaxCol = maxCol;
    } catch (e) {
      console.warn("Immediate recomputePCMForCols failed, will attempt recompute after render:", e);
      pendingRecomputeDone = false;
      pendingRecomputeMinCol = pendingRecomputeMaxCol = null;
    }
  } else {

    pendingRecomputeDone = false;
    pendingRecomputeMinCol = pendingRecomputeMaxCol = null;
  }
}

function newHistory() {
  const epsMag = 0.1;
  const epsPhase = 0.4;

  const changedIdxs = [];
  const prevMags = [];
  const prevPhases = [];

  const h = specHeight;
  const startF = minCol*fftSize/2
  const endF = maxCol*fftSize/2; 
  let totalDiff = 0;
  let countDiff = 0;
  for (let idx = startF; idx < endF; idx++) {
    const oldM = snapshotMags[idx] || 0;
    const newM = mags[idx] || 0;
    const oldP = snapshotPhases[idx] || 0;
    const newP = phases[idx] || 0;
    if (idx%fftSize/2 === 0) {countDiff=0; totalDiff=0;}
    countDiff++;
    totalDiff += Math.abs(oldM - newM);  
    if (Math.abs(oldM - newM) > Math.min(0.4,(totalDiff/countDiff)*0.2)){
      changedIdxs.push(idx);
      prevMags.push(oldM);
      prevPhases.push(snapshotPhases[idx] || 0);
      addPixelToSprite(currentSprite, Math.floor(idx/(fftSize/2)), idx%(fftSize/2), oldM, oldP, newM, newP);
    }
  }
}

document.addEventListener("mouseup", e => {
    canvasMouseUp(e,false);
});
document.addEventListener("touchend", e => {
    canvasMouseUp(e,true);
});

let sourceNode = null;
let playing = false;
let mouseDown = false;
let pausedAtSample = null; 
let sourceStartTime = 0; 
let wasPlayingDuringDrag = false;

initEmptyPCM();

function updateCursorLoop() {
    if (playing && !painting && pcm && sourceNode) {
        const elapsed = audioCtx.currentTime - sourceStartTime; 
        let samplePos = elapsed * sampleRate;

        if (sourceNode.loop) {
            samplePos = samplePos % pcm.length; 
        }

        const frame = Math.floor(samplePos / hop);
        currentCursorX = Math.min(frame, specWidth - 1);

        specCtx.putImageData(imageBuffer, 0, 0);
        renderView();
        drawCursor(false);
        drawEQ();
    }
    requestAnimationFrame(updateCursorLoop);
}
updateCursorLoop();

function stopSource(preservePaused=false){
    if(sourceNode){
        try { sourceNode.stop(); } catch(e) {  }
        try { sourceNode.disconnect(); } catch(e) {  }
        sourceNode = null;
    }

    if (!preservePaused) pausedAtSample = null;
    playing = false;
}

function _getPlaybackTarget() {

  if (typeof curveEQ !== 'undefined' && curveEQ && curveEQ.inited && curveEQ.eqInput) {

    if (typeof updateCurveEQ === 'function') {
      try { updateCurveEQ(); } catch (e) {  }
    }
    return curveEQ.eqInput;
  }

  if (typeof eqInput !== 'undefined' && eqInput) return eqInput;

  return audioCtx.destination;
}


async function playPCM(loop = true, startFrame = null) {
  if (!pcm) return;
  ensureAudioCtx();

  stopSource(true);

  let startSample = 0;
  if (startFrame !== null && !isNaN(startFrame)) {
      startSample = Math.max(0, Math.min(pcm.length - 1, startFrame * hop));
  } else if (pausedAtSample !== null) {
      startSample = Math.max(0, Math.min(pcm.length - 1, pausedAtSample));
  }

  sourceNode = audioCtx.createBufferSource();
  const buffer = audioCtx.createBuffer(1, pcm.length, sampleRate);
  buffer.copyToChannel(pcm, 0);
  sourceNode.buffer = buffer;
  sourceNode.loop = !!loop;

  try {
    const targetNode = _getPlaybackTarget();
    sourceNode.connect(targetNode);
  } catch (e) {
    try { sourceNode.connect(audioCtx.destination); } catch (e2) { console.warn("connect fallback failed", e2); }
  }

  const offsetSec = startSample / sampleRate;
  sourceStartTime = audioCtx.currentTime - offsetSec;
  try {
    sourceNode.start(0, offsetSec);
  } catch (e) {
    const remaining = pcm.length - startSample;
    const shortBuf = audioCtx.createBuffer(1, Math.max(1, remaining), sampleRate);
    shortBuf.copyToChannel(pcm.subarray(startSample, startSample + remaining), 0);
    try { sourceNode.stop(); } catch(_) {}
    try { sourceNode.disconnect(); } catch(_) {}
    sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = shortBuf;
    sourceNode.loop = !!loop;
    try {
      const targetNode = _getPlaybackTarget();
      sourceNode.connect(targetNode);
    } catch (e2) {
      try { sourceNode.connect(audioCtx.destination); } catch (_) {}
    }
    sourceStartTime = audioCtx.currentTime;
    sourceNode.start();
  }

  playing = true;
  pausedAtSample = null;
}

async function playFrame(frameX) {
  currentCursorX = frameX;
  if (!pcm) return;
  ensureAudioCtx();

  if (audioCtx.state === 'suspended') {
    try { await audioCtx.resume(); } catch (e) { console.warn("audioCtx.resume() failed:", e); }
  }

  stopSource(true);
  const start = frameX * hop;
  const end = Math.min(start + fftSize, pcm.length);
  if (end <= start) return;
  const frameLen = end - start;

  const buffer = audioCtx.createBuffer(1, frameLen, sampleRate);
  buffer.copyToChannel(pcm.subarray(start, end), 0);

  sourceNode = audioCtx.createBufferSource();
  sourceNode.buffer = buffer;
  sourceNode.loop = true; 

  try {
    const targetNode = _getPlaybackTarget();
    sourceNode.connect(targetNode);
  } catch (e) {
    try { sourceNode.connect(audioCtx.destination); } catch (_) {}
  }

  sourceStartTime = audioCtx.currentTime - (start / sampleRate);
  sourceNode.start();
  playing = true;
  pausedAtSample = null;
}