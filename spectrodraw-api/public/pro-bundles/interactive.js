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
    const s = (currentTool === "autotune")?2:parseFloat(logScaleVal[currentLayer]); 
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
function visibleToSpecY(visY) {
    const fStart = Math.max(0, Math.floor(specHeight * (1 - fHigh / (sampleRate/2))));
    const fullY = Math.round(visY + fStart);
    return Math.max(0, Math.min(specHeight - 1, fullY));
}

function cxToFrame(cx) {
  return Math.floor((cx/canvas.width*(iWidth/specWidth)+iLow)*specWidth);
}

function frameToCx(frame) {
  return ((frame-iLow)/(iWidth/specWidth)*1);
}
function handleMoveSprite(cx,cy) {
  let dx = Math.round(cx-startX), dy=Math.round(startY-cy);
  moveSprite(selectedSpriteId, dx, dy);
  newGlobalXYHistory("redo");
}
function newSprite(opts={}){
  let count = 1;
  for (let sprite of sprites) {
    if (sprite.effect.tool === (opts.name??currentTool)) count++;
  }
  let name = (opts.name??currentTool) + `_${count}`;
  let pixelmap=[];
  for(let c=0;c<layerCount;c++) pixelmap.push((syncLayers||c==currentLayer)?(new Map()):null);
  currentSprite = {
    id: nextSpriteId++,
    effect: {tool: opts.tool??currentTool, brushBrightness, brushSize, brushOpacity, phaseStrength, phaseShift, amp, noiseAgg,
      blurRadius,phaseTexture:phaseTextureEl.value,anpo,aStartOnP,autoTuneStrength,t0,tau,sigma,harmonicCenter,userDelta,
      refPhaseFrame,chirpRate,shape:currentShape,noiseProfileMin,noiseProfileMax,noiseProfile,width:opts.width??0,height:opts.height??0},
    enabled: true,
    pixels: pixelmap,
    minCol: Infinity,
    maxCol: -Infinity,
    createdAt: performance.now(),
    fadePoints: defaultFadePoints,
    spriteFade: [],
    prevSpriteFade: [],
    name,
    ch: syncLayers?"all":currentLayer
  };
  sprites.push(currentSprite);
  historyStack = historyStack.slice(0, historyIndex+1);
  historyIndex = historyStack.length;
  historyStack.push({type:"toggleSprite"});
}
let sx2 = 0, sy2 = 0;

let prevMouseX =null, prevMouseY = null;
/* ===== Modified canvasMouseDown ===== */
function canvasMouseDown(e,touch) {
  if (!touch) zooming=false;
  if (!touch && e.button !== 0) return;
  //if (pendingHistory) return;
  if (!hasSetNoiseProfile) autoSetNoiseProfile();
  const {cx,cy,scaleX,scaleY} = getCanvasCoords(e,touch);
  prevMouseX = cx; prevMouseY = cy; vr = 1;
  const mags = layers[currentLayer].mags, phases = layers[currentLayer].phases;
  const overlayCanvas = document.getElementById("overlay-"+currentLayer)
  const overlayCtx = overlayCanvas.getContext("2d");
  startX = cx; startY = cy;
  if (currentTool==="cloner"&&changingClonerPos) {clonerX = cx; clonerY = cy;clonerCh=currentLayer;updateBrushPreview();}
  painting = true;
  if (changingNoiseProfile) {
    if (currentPanel!=="2"){
      noiseProfileMin = noiseProfileMax = Math.floor(cx);
    } else {
      const e = getSpriteById(selectedSpriteId).effect;
      e.noiseProfileMin = e.noiseProfileMax = Math.floor(cx);
    }
    return;
  }
  if (movingSprite) {
    newGlobalXYHistory("undo");
    spritePath = generateSpriteOutlinePath(getSpriteById(selectedSpriteId), { height: specHeight });
    return;
  }
  if (currentShape === "select") return;
  let $s = syncLayers?0:currentLayer, $e = syncLayers?layerCount:currentLayer+1;
  for (let ch=$s;ch<$e;ch++){
    layers[ch].snapshotMags = new Float32Array(layers[ch].mags);
    layers[ch].snapshotPhases = new Float32Array(layers[ch].phases);
  }

  visited = Array.from({ length: layerCount }, () => new Uint8Array(mags.length));
  stopSource();
  paintedPixels = new Set();
  
  if (alignTime) {
    const snapSize = 30/bpm/subBeat;
    const startTime = Math.floor((cx/(sampleRate/hop))/snapSize)*snapSize;
    const startFrame0 = Math.round((startTime*(sampleRate/hop)) + iLow);
    sx2 = cx; sy2 = cy;
    startX = startFrame0 - iLow;
  }
  overlayCtx.clearRect(0,0,overlayCanvas.width, overlayCanvas.height);
  const realY = visibleToSpecY(cy);


  // --- CREATE NEW SPRITE FOR THIS STROKE ---
  startCh = currentLayer;
  newSprite();

  const isRectangle = currentShape === "rectangle";
  const isLine = currentShape === "line";
  const isDragToDrawEnabled = document.getElementById("dragToDraw").checked;
  const isStampOrImage = currentShape === "stamp" || currentShape === "image";
  const isDragStampOrImage = isDragToDrawEnabled && isStampOrImage;
  const shouldDisable = isRectangle || isLine || isDragStampOrImage || (currentTool==="cloner"&&changingClonerPos);

  if (!shouldDisable) {
    setClonerYShift();
    paint(cx + iLow, realY);
  }
  currentFrame = Math.floor(cx);
  ensureAudioCtx();
  mouseDown = true;
  playFrame(currentFrame);

  if (!sineOsc) {
    const real = new Float32Array(101);
    const imag = new Float32Array(101);
    if (typeof harmonics !== 'undefined' && harmonics && harmonics.length >= 100) {
      for (let i = 0; i < 100; i++) imag[i + 1] = harmonics[i];
    } else {
      imag[1] = 1.0;
    }

    const wave = audioCtx.createPeriodicWave(real, imag, { disableNormalization: false });

    sineOsc = audioCtx.createOscillator();
    sineOsc.setPeriodicWave(wave);
    sineGain = audioCtx.createGain();
    sineGain.gain.value = 0.2*document.getElementById("drawVolume").value*masterVolumeKnob.getValue();

    sineOsc.connect(sineGain).connect(audioCtx.destination);
    setSineFreq(realY);
    sineOsc.start();
  }
}
function setSineFreq(cy) {
  sineOsc.frequency.setTargetAtTime(getSineFreq(cy), audioCtx.currentTime, 0.01);
}
function setClonerYShift(){
  if (currentTool==="cloner") {
    rcY = displayYToBin(visibleToSpecY(clonerY),specHeight,currentLayer);
    rsY = displayYToBin(visibleToSpecY(startY),specHeight,currentLayer);
  }
}

let previewingShape = false;
let mouseVelocity = 0;
function canvasMouseMove(e,touch,el) {
  if (recording) return;
  currentLayer = parseInt(el.id.match(/(\d+)$/)[1], 10);
  const {cx,cy,scaleX,scaleY} = getCanvasCoords(e,touch);
  let mags = layers[currentLayer].mags; //change to layer that mouse is touching
  if (painting && (movingSprite||changingNoiseProfile||currentShape==="select") || draggingSample.length>0) {previewShape(cx, cy);return;}
  if (changingNoiseProfile) return;
  if (zooming) return;
  if (!recording) {
    const hz = getSineFreq(visibleToSpecY(cy));
    const secs = Math.floor((cx+iLow)/(sampleRate/hop)*10000)/10000;
    const hx = Math.floor(cx);
    const hy = Math.floor(hz/(sampleRate/fftSize));
    const i = hx*specHeight+hy;
    let normalizedMag = Math.min(1, mags[i] / 256);
    let db = (20 * Math.log10(normalizedMag)).toFixed(1);
    info.innerHTML=`Pitch: ${hz.toFixed(0)}hz (${hzToNoteName(hz)}) <br>Time: ${secs}<br>Loudness: ${db} db`
  }
  if (!painting && (currentShape === "brush" ||currentShape === "note" || (!document.getElementById("dragToDraw").checked&&(currentShape === "stamp"||currentShape === "image"))) && !movingSprite) {
    previewShape(cx, cy);
    previewingShape = true;
    return;
  }
  if (currentTool==="cloner") {
    if (changingClonerPos&&painting) {
      previewShape(cx, cy);
      previewingShape = true;
      clonerX = cx; clonerY = cy;
      clonerCh=currentLayer;
      updateBrushPreview();
      return;
    } else {
      updateBrushPreview();
    }
  }
  if(!painting && currentTool != "image") return;
  
  mouseVelocity = Math.sqrt(Math.pow(cx-prevMouseX,2)+Math.pow(cy-prevMouseY,2));
  if (currentShape !== "brush"&&currentShape !== "note") {
    previewShape(cx, cy);
    previewingShape = true;
  } else {
    if (currentLayer !== startCh) return;
    let $s = syncLayers?0:currentLayer, $e = syncLayers?layerCount:currentLayer+1;
    for (let ch=$s;ch<$e;ch++){
      const overlayCanvas = document.getElementById("overlay-"+ch);
      const overlayCtx = overlayCanvas.getContext("2d");
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    }
    const realY = visibleToSpecY(cy);
    setClonerYShift();
    paint(cx + iLow, realY);
    drawCursor(true);
  }
  
  prevMouseX = cx, prevMouseY = cy;

  currentFrame = Math.floor(cx+iLow);
  if (mouseDown) {
    playFrame(currentFrame);
    if (sineOsc) setSineFreq( visibleToSpecY(cy) ); 
  }

  currentCursorX = currentFrame;
}let debugTime = 0;
function canvasMouseUp(e,touch) {debugTime = Date.now();
  previewingShape = false;
  if (zooming || !painting) return;
  renderSpritesTable();
  
  stopSource();
  if (sineOsc) {
    sineOsc.stop();
    sineOsc.disconnect();
    sineOsc = null;
    sineGain = null;
  }
  minCol = Infinity; maxCol = -Infinity;
  visited = null;
  painting = false;
  if(currentTool==="cloner"){changingClonerPos=false;updateBrushPreview();const ccp = document.getElementById("changeClonerPosBtn"); ccp.innerText ="Change Reference Point";ccp.classList.toggle('moving', false);}
  paintedPixels = null;
  mouseDown = false;
  if (changingNoiseProfile) {
    if (currentPanel==="2"){
      document.getElementById("ssetNoiseProfile").click();
    } else {
      document.getElementById("setNoiseProfile").click();
    }
    return;}
  const { cx, cy } = getCanvasCoords(e,touch);
  if (movingSprite) {handleMoveSprite(cx,cy);return;}
  if (currentShape === "select") {createNewSpriteFromSelection(startX, displayYToBin(visibleToSpecY(startY),specHeight,currentLayer), cx, displayYToBin(visibleToSpecY(cy),specHeight,currentLayer)); return;}
  const overlayCanvas = document.getElementById("overlay-"+currentLayer);
  const overlayCtx = overlayCanvas.getContext("2d");
  if (currentShape === "rectangle" || (document.getElementById("dragToDraw").checked&&(currentShape === "stamp"||currentShape === "image")) || currentShape === "line") {
    commitShape(cx, cy);
    overlayCtx.clearRect(0,0,overlayCanvas.width,overlayCanvas.height);
  }
  if (alignTime && currentTool === "fill" && currentShape !== "rectangle") {
    const startFrame = Math.round(cx + iLow);
    const snapSize = 30/bpm/subBeat;
    let brushS = (brushSize)*((fHigh-fLow)/(sampleRate/4));
    if (currentShape === "note") brushS = 1;

    let startTime = Math.floor((sx2/(sampleRate/hop))/snapSize)*snapSize + ((cx<startX) ? snapSize : 0);
    let startFrame0 = Math.round((startTime*(sampleRate/hop)) + iLow);
    line(startFrame0, sx2, visibleToSpecY(sy2), visibleToSpecY(sy2),brushS);

    startTime = Math.floor((cx/(sampleRate/hop))/snapSize)*snapSize + ((cx>startX) ? snapSize : 0);
    startFrame0 = Math.round((startTime*(sampleRate/hop)) + iLow);
    line(startFrame0, cx, visibleToSpecY(cy), visibleToSpecY(cy),brushS);
  }
  simpleRestartRender();
}

//Restarts render without resetting all canvases
function simpleRestartRender(min=-1,max=-1){
  startX=startY=null;
  startTime = performance.now();
  audioProcessed = 0;
  let a;
  a = autoRecomputePCM(min,max);
  pendingHistory = true;
  pendingPlayAfterRender = true; 
  let startFrame = a.minCol;
  if (startFrame === Infinity) startFrame = 0;
  pos = startFrame * hop;
  x = startFrame;
  rendering = true;
  requestAnimationFrame(() => drawLoop());
  startTime = performance.now();
  audioProcessed = 0;
}

let minCol = Infinity; maxCol = -Infinity;
function calcMinMaxCol() {
  if (isFinite(minCol) && isFinite(maxCol)) {return {minCol,maxCol};}
  const mags = layers[currentLayer].mags, snapshotMags = layers[currentLayer].snapshotMags;
  if (snapshotMags === null || snapshotMags.length !== mags.length) {minCol = 0;maxCol=specWidth;return {minCol,maxCol};}
  const epsMag = 1e-2;
  const h = specHeight;
  const total = mags.length;
  for (let idx = 0; idx < total; idx++) {
    const oldM = snapshotMags[idx];
    const newM = mags[idx];
    if (Math.abs(oldM - newM) > epsMag) {
      const col = Math.floor(idx / h);
      if (col < minCol) minCol = col;
      if (col > maxCol) maxCol = col;
      continue;
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
      recomputePCMForCols(minCol, maxCol);

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
  return {minCol,maxCol};
}

function newHistory() {if (!currentSprite) return;
  pendingHistory = false;
  //console.log(layers[0].snapshotMags);
  if (dontChangeSprites) {dontChangeSprites=false; return;}
  let $s = syncLayers?0:currentLayer, $e = syncLayers?layerCount:currentLayer+1;
  for (let ch=$s;ch<$e;ch++){
    let mags = layers[ch].mags, phases = layers[ch].phases;
    let snapshotMags = layers[ch].snapshotMags, snapshotPhases = layers[ch].snapshotPhases;
    const startF = minCol*specHeight;
    const endF = maxCol*specHeight;
    let totalDiff = 0;
    let countDiff = 0;
    for (let idx = startF; idx < endF; idx++) {
      const oldM = snapshotMags[idx] || 0;
      const newM = mags[idx] || 0;
      const bin = idx%specHeight;
      if (bin === 0) {countDiff=0; totalDiff=0;}
      countDiff++;
      totalDiff += Math.abs(oldM - newM);  
      if (Math.abs(oldM - newM) > Math.min(0.4,(totalDiff/countDiff)*0.2)){
        const oldP = snapshotPhases[idx] || 0;
        const newP = phases[idx] || 0;
        addPixelToSprite(currentSprite, Math.floor(idx/specHeight), bin, oldM, oldP, newM, newP, ch);
      }
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

initEmptyPCM(false);
historyStack.push({type:"init",command:initEmptyPCM(true)});
historyIndex = 1;

function updateCursorLoop() {
  const specCanvas = document.getElementById("spec-"+currentLayer);
  if (!specCanvas) return;
  const specCtx = specCanvas.getContext("2d");
  if (playing && !painting && layers[currentLayer].pcm && sourceNode) {
    const elapsed = audioCtx.currentTime - sourceStartTime; 
    let samplePos = elapsed * sampleRate;

    if (sourceNode.loop) {
      samplePos = samplePos % layers[currentLayer].pcm.length; 
    }

    const frame = Math.floor(samplePos / hop);
    currentCursorX = Math.min(frame, specWidth - 1);

    specCtx.putImageData(imageBuffer[currentLayer], 0, 0);
    renderView();
    drawCursor(false);
    drawEQ();
  }
  requestAnimationFrame(updateCursorLoop);
}
updateCursorLoop();

function stopSource(preservePaused=false){
    if(sourceNode){
      sourceNode.stop();
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
  ensureAudioCtx();

  //stopSource(true);

  if (!layers || layers.length === 0) {
    console.warn("No layers to play.");
    return;
  }

  // Determine total length (use longest layer)
  const totalSamples = layers.reduce((max, ch) => {
    const len = ch && ch.pcm ? ch.pcm.length : 0;
    return Math.max(max, len);
  }, 0);

  if (totalSamples === 0) {
    console.warn("Channels contain no PCM data.");
    return;
  }

  // Compute startSample clamped to the totalSamples
  let startSample = 0;
  if (startFrame !== null && !isNaN(startFrame)) {
    startSample = Math.max(0, Math.min(totalSamples - 1, Math.floor(startFrame * hop)));
  } else if (pausedAtSample !== null) {
    startSample = Math.max(0, Math.min(totalSamples - 1, pausedAtSample));
  }

  // stop any previous node(s)
  try { sourceNode && sourceNode.stop(); } catch (_) {}
  try { sourceNode && sourceNode.disconnect(); } catch (_) {}

  sourceNode = audioCtx.createBufferSource();

  // We mix all logical layers into a stereo output buffer according to layers[ch].audioDevice
  const outChannels = 2; // stereo: 0 = left, 1 = right
  const buffer = audioCtx.createBuffer(outChannels, totalSamples, sampleRate);

  // get direct access to layer arrays
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Mix layers into left/right
  const nCh = layers.length;
  for (let ch = 0; ch < nCh; ch++) {
    const chObj = layers[ch];
    if (!chObj || !chObj.pcm) continue;

    const pcm = chObj.pcm;
    const device = (chObj.audioDevice || "both").toLowerCase(); // left/right/both/none
    let vol = chObj.enabled?chObj.volume : 0;
    // clamp to [0,1]
    if (vol < 0) vol = 0;
    else if (vol > 1) vol = 1;

    if (device === "none") continue;

    const maxI = Math.min(pcm.length, totalSamples);
    for (let i = 0; i < maxI; i++) {
      const s = pcm[i] * vol;
      if (device === "left") {
        left[i] += s;
      } else if (device === "right") {
        right[i] += s;
      } else { // "both" or anything else defaults to both
        left[i] += s;
        right[i] += s;
      }
    }
  }

  // NOTE: this simple additive mix can clip if summed samples exceed [-1,1].
  // Consider normalization or soft clipping if needed.

  sourceNode.buffer = buffer;
  sourceNode.loop = !!loop;

  try {
    const targetNode = _getPlaybackTarget();
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(document.getElementById("playbackVolume").value*masterVolumeKnob.getValue(), audioCtx.currentTime);

    sourceNode.connect(gainNode);
    gainNode.connect(targetNode);
  } catch (e) {
    try { sourceNode.connect(audioCtx.destination); } catch (e2) { console.warn("connect fallback failed", e2); }
  }
  
  const offsetSec = startSample / sampleRate;
  sourceStartTime = audioCtx.currentTime - offsetSec;
  sourceNode.start(0, offsetSec);

  playing = true;
  pausedAtSample = null;
}




async function playFrame(frameX) {
  currentCursorX = frameX;
  ensureAudioCtx();

  if (!layers || layers.length === 0) {
    console.warn("No layers available to play.");
    return;
  }

  if (audioCtx.state === 'suspended') {
    try { await audioCtx.resume(); } catch (e) { console.warn("audioCtx.resume() failed:", e); }
  }

  stopSource(true);

  const start = Math.floor(frameX * hop);

  // Compute how many samples are available per layer after start, and use the maximum (so we don't cut off any layer).
  const maxRemaining = layers.reduce((max, ch) => {
    const len = (ch && ch.pcm) ? Math.max(0, ch.pcm.length - start) : 0;
    return Math.max(max, len);
  }, 0);

  // frame length limited by fftSize and what's remaining
  const frameLen = Math.min(fftSize, maxRemaining);
  if (frameLen <= 0) return;

  const buffer = audioCtx.createBuffer(layerCount, frameLen, sampleRate);

  // Copy each layer's slice (or leave as silence if not available)
  for (let ch = 0; ch < layerCount; ch++) {
    const pcm = (layers[ch] && layers[ch].pcm) ? layers[ch].pcm : null;
    if (!pcm || pcm.length <= start) {
      // leave layer silent
      continue;
    }
    const available = pcm.length - start;
    const copyLen = Math.min(frameLen, available);
    const slice = pcm.subarray(start, start + copyLen);

    if (copyLen === frameLen) {
      buffer.copyToChannel(slice, ch);
    } else {
      // pad smaller slice into a tmp buffer of frameLen
      const tmp = new Float32Array(frameLen);
      tmp.set(slice, 0);
      buffer.copyToChannel(tmp, ch);
    }
  }

  sourceNode = audioCtx.createBufferSource();
  sourceNode.buffer = buffer;
  sourceNode.loop = true;

  const targetNode = _getPlaybackTarget();
  const gainNode = audioCtx.createGain();
  gainNode.gain.setValueAtTime(masterVolumeKnob.getValue(), audioCtx.currentTime);
  sourceNode.connect(gainNode);
  gainNode.connect(targetNode);
  sourceStartTime = audioCtx.currentTime - (start / sampleRate);
  sourceNode.start();
  playing = true;
  pausedAtSample = null;
}
function updateNoiseProfile(d,sid=selectedSpriteId){
  const c = d?"s":"";
  const e = d?getSpriteById(sid).effect:null;
  document.getElementById(c+"setNoiseProfileMin").value = d?e.noiseProfileMin:noiseProfileMin;
  document.getElementById(c+"setNoiseProfileMax").value = d?e.noiseProfileMax:noiseProfileMax;
}

function createNewSpriteFromSelection(startX, startY, endX, endY) {
  const minX = Math.floor(Math.min(startX, endX));
  const minY = Math.floor(Math.min(startY, endY));
  const maxX = Math.floor(Math.max(startX, endX));
  const maxY = Math.floor(Math.max(startY, endY));
  const opts = { name: "selection", tool: "n/a",width:maxX-minX,height:maxY-minY };
  newSprite(opts);
  const s = sprites[sprites.length - 1];
  selectedSpriteId = sprites.length;
  s.minCol = minX;
  s.maxCol = maxX;
  s.minY = minY;
  s.maxY = maxY;
  const mags = layers[currentLayer].mags;
  const phases = layers[currentLayer].phases;
  for (let x = minX; x <= maxX; x++) {
    for (let y = minY; y <= maxY; y++) {
      const idx = x * specHeight + y;
      const mag = mags[idx];
      const phase = phases[idx];
      addPixelToSprite(s, x, y, 0, 0, mag, phase, currentLayer);
    }
  }
  renderSpritesTable();
  updateEditorSelection(selectedSpriteId);
}