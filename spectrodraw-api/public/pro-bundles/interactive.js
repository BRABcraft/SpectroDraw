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
    const s = (currentTool === "autotune")?2:parseFloat(logScaleVal[currentChannel]); 
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

let prevMouseX =null, prevMouseY = null;
/* ===== Modified canvasMouseDown ===== */
function canvasMouseDown(e,touch) {
  if (!touch) zooming=false;
  if (!touch && e.button !== 0) return;
  if (pendingHistory) return;
  const {cx,cy,scaleX,scaleY} = getCanvasCoords(e,touch);
  prevMouseX = cx; prevMouseY = cy; vr = 1;
  const mags = channels[currentChannel].mags, phases = channels[currentChannel].phases;
  const overlayCanvas = document.getElementById("overlay-"+currentChannel)
  const overlayCtx = overlayCanvas.getContext("2d");
  startX = cx; startY = cy;
  if (currentTool==="cloner"&&changingClonerPos) {clonerX = cx; clonerY = cy;clonerCh=currentChannel;updateBrushPreview();}
  painting = true;
  if (changingNoiseProfile) {noiseProfileMin = noiseProfileMax = Math.floor(cx); return;}
  if (movingSprite) {
    spritePath = generateSpriteOutlinePath(getSpriteById(selectedSpriteId), { height: specHeight });
    return;
  } else {
    let $s = syncChannels?0:currentChannel, $e = syncChannels?channelCount:currentChannel+1;
    for (let ch=$s;ch<$e;ch++){
      channels[ch].snapshotMags = new Float32Array(channels[ch].mags);
      channels[ch].snapshotPhases = new Float32Array(channels[ch].phases);
    }

    visited = Array.from({ length: channelCount }, () => new Uint8Array(mags.length));
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
      if (sprite.effect.tool === currentTool) count++;
    }
    let name = currentTool + `_${count}`;
    let pixelmap=[];
    for(let c=0;c<channelCount;c++) pixelmap.push((syncChannels||c==currentChannel)?(new Map()):null);

    // --- CREATE NEW SPRITE FOR THIS STROKE ---
    currentSprite = {
      id: nextSpriteId++,
      effect: {tool: currentTool, brushBrightness, brushSize, brushOpacity, phaseStrength, phaseShift, amp, noiseAgg, blurRadius,phaseTexture:phaseTextureEl.value,anpo,aStartOnP,autoTuneStrength,t0,tau,sigma,harmonicCenter,userDelta,refPhaseFrame,chirpRate},
      enabled: true,
      pixels: pixelmap,
      minCol: Infinity,
      maxCol: -Infinity,
      createdAt: performance.now(),
      fadePoints: defaultFadePoints,
      spriteFade: [],
      prevSpriteFade: [],
      name,
      ch: syncChannels?"all":currentChannel
    };
    startCh = currentChannel;
    sprites.push(currentSprite);

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
    if (document.getElementById("previewWhileDrawing").checked) {
      ensureAudioCtx();
      mouseDown = true;
      playFrame(currentFrame);

      if (!sineOsc) {
          // Use harmonics array (100 values 0..1) to build a PeriodicWave.
          // If `harmonics` is missing or too short, fall back to a simple sine (fundamental only).
          const real = new Float32Array(101); // index 0 = DC (leave 0)
          const imag = new Float32Array(101); // index 1..100 -> harmonics 1..100

          if (typeof harmonics !== 'undefined' && harmonics && harmonics.length >= 100) {
            for (let i = 0; i < 100; i++) imag[i + 1] = harmonics[i];
          } else {
            // fallback: only the fundamental
            imag[1] = 1.0;
          }

          const wave = audioCtx.createPeriodicWave(real, imag, { disableNormalization: false });

          sineOsc = audioCtx.createOscillator();
          sineOsc.setPeriodicWave(wave);
          // create gain node after periodic wave so we can do clean fades later if needed
          sineGain = audioCtx.createGain();
          sineGain.gain.value = 0.2;

          sineOsc.connect(sineGain).connect(audioCtx.destination);
          setSineFreq(realY);
          sineOsc.start();
      }
    }
  }
}
function setSineFreq(cy) {
  sineOsc.frequency.setTargetAtTime(getSineFreq(cy), audioCtx.currentTime, 0.01);
}
function setClonerYShift(){
  if (currentTool==="cloner") {
    rcY = displayYToBin(visibleToSpecY(clonerY),specHeight,currentChannel);
    rsY = displayYToBin(visibleToSpecY(startY),specHeight,currentChannel);
  }
}

let previewingShape = false;
let mouseVelocity = 0;
function canvasMouseMove(e,touch,el) {
  currentChannel = parseInt(el.id.match(/(\d+)$/)[1], 10);
  const {cx,cy,scaleX,scaleY} = getCanvasCoords(e,touch);
  let mags = channels[currentChannel].mags; //change to channel that mouse is touching
  if (painting && (movingSprite||changingNoiseProfile) || draggingSample.length>0) {previewShape(cx, cy);return;}
  if (changingNoiseProfile) return;
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
      clonerCh=currentChannel;
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
    if (currentChannel !== startCh) return;
    let $s = syncChannels?0:currentChannel, $e = syncChannels?channelCount:currentChannel+1;
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
}
function canvasMouseUp(e,touch) {
  previewingShape = false;
  if (zooming || !painting) return;
  renderSpritesTable();
  
  minCol = Infinity; maxCol = -Infinity;
  visited = null;
  painting = false;
  if(currentTool==="cloner"){changingClonerPos=false;updateBrushPreview();const ccp = document.getElementById("changeClonerPosBtn"); ccp.innerText ="Change Reference Point";ccp.classList.toggle('moving', false);}
  paintedPixels = null;
  mouseDown = false;
  if (changingNoiseProfile) {document.getElementById("setNoiseProfile").click();return;}
  if (!hasSetNoiseProfile) autoSetNoiseProfile();
  stopSource();
  if (sineOsc) {
    sineOsc.stop();
    sineOsc.disconnect();
    sineOsc = null;
    sineGain = null;
  }
  const { cx, cy } = getCanvasCoords(e,touch);
  if (movingSprite) handleMoveSprite(cx,cy);
  const overlayCanvas = document.getElementById("overlay-"+currentChannel);
  const overlayCtx = overlayCanvas.getContext("2d");
  if (currentShape === "rectangle" || (document.getElementById("dragToDraw").checked&&(currentShape === "stamp"||currentShape === "image")) || currentShape === "line") {
    commitShape(cx, cy); 
    overlayCtx.clearRect(0,0,overlayCanvas.width,overlayCanvas.height);
  }
  if (alignTime && currentTool === "fill") {
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
  simpleRestartRender();
}

//Restarts render without resetting all canvases
function simpleRestartRender(min=-1,max=-1){
  startX=startY=null;
  startTime = performance.now();
  audioProcessed = 0;
  if (!movingSprite) {
    autoRecomputePCM(min,max);
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
  if (minCol !== Infinity && maxCol !== -Infinity) return {minCol,maxCol};
  const mags = channels[currentChannel].mags, phases = channels[currentChannel].phases, snapshotMags = channels[currentChannel].snapshotMags, snapshotPhases = channels[currentChannel].snapshotPhases;//CHANGE LATER
  if (snapshotMags === null || snapshotMags.length !== mags.length) {minCol = 0;maxCol=specWidth;return {minCol,maxCol};}
  const epsMag = 1e-2;
  const epsPhase = 1e-1;
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
    const oldP = snapshotPhases[idx];
    const newP = phases[idx];
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
  if (dontChangeSprites) {dontChangeSprites=false; return;}
  let $s = syncChannels?0:currentChannel, $e = syncChannels?channelCount:currentChannel+1;
  for (let ch=$s;ch<$e;ch++){
    let mags = channels[ch].mags, phases = channels[ch].phases;
    let snapshotMags = channels[ch].snapshotMags, snapshotPhases = channels[ch].snapshotPhases;
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
        addPixelToSprite(currentSprite, Math.floor(idx/(fftSize/2)), idx%(fftSize/2), oldM, oldP, newM, newP, ch);
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

function updateCursorLoop() {
  const specCanvas = document.getElementById("spec-"+currentChannel);
  const specCtx = specCanvas.getContext("2d");
  if (playing && !painting && channels[currentChannel].pcm && sourceNode) {
    const elapsed = audioCtx.currentTime - sourceStartTime; 
    let samplePos = elapsed * sampleRate;

    if (sourceNode.loop) {
      samplePos = samplePos % channels[currentChannel].pcm.length; 
    }

    const frame = Math.floor(samplePos / hop);
    currentCursorX = Math.min(frame, specWidth - 1);

    specCtx.putImageData(imageBuffer[currentChannel], 0, 0);
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
  ensureAudioCtx();

  stopSource(true);

  if (!channels || channels.length === 0) {
    console.warn("No channels to play.");
    return;
  }

  // Determine total length (use longest channel)
  const totalSamples = channels.reduce((max, ch) => {
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

  // We mix all logical channels into a stereo output buffer according to channels[ch].audioDevice
  const outChannels = 2; // stereo: 0 = left, 1 = right
  const buffer = audioCtx.createBuffer(outChannels, totalSamples, sampleRate);

  // get direct access to channel arrays
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Mix channels into left/right
  const nCh = channels.length;
  for (let ch = 0; ch < nCh; ch++) {
    const chObj = channels[ch];
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
    sourceNode.connect(targetNode);
  } catch (e) {
    try { sourceNode.connect(audioCtx.destination); } catch (e2) { console.warn("connect fallback failed", e2); }
  }

  const offsetSec = startSample / sampleRate;
  sourceStartTime = audioCtx.currentTime - offsetSec;

  try {
    sourceNode.start(0, offsetSec);
  } catch (e) {
    // Fallback for when start with offset fails (create a shorter buffer that starts from startSample)
    const remaining = Math.max(0, totalSamples - startSample);
    if (remaining <= 0) {
      console.warn("No remaining samples to play after start offset.");
      return;
    }

    try { sourceNode.stop(); } catch(_) {}
    try { sourceNode.disconnect(); } catch(_) {}

    // Create a stereo short buffer and copy each channel's remaining samples according to audioDevice
    const shortBuf = audioCtx.createBuffer(outChannels, remaining, sampleRate);
    const sLeft = shortBuf.getChannelData(0);
    const sRight = shortBuf.getChannelData(1);

    for (let ch = 0; ch < nCh; ch++) {
      const chObj = channels[ch];
      if (!chObj || !chObj.pcm) continue;

      const pcm = chObj.pcm;
      const device = (chObj.audioDevice || "both").toLowerCase();
      let vol = (typeof chObj.volume === "number") ? chObj.volume : 1;
      if (vol < 0) vol = 0;
      else if (vol > 1) vol = 1;

      if (device === "none") continue;
      if (startSample >= pcm.length) continue; // nothing left to copy

      const slice = pcm.subarray(startSample, Math.min(pcm.length, startSample + remaining));
      for (let i = 0; i < slice.length; i++) {
        const s = slice[i] * vol;
        if (device === "left") {
          sLeft[i] += s;
        } else if (device === "right") {
          sRight[i] += s;
        } else {
          sLeft[i] += s;
          sRight[i] += s;
        }
      }
    }

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
  ensureAudioCtx();

  if (!channels || channels.length === 0) {
    console.warn("No channels available to play.");
    return;
  }

  if (audioCtx.state === 'suspended') {
    try { await audioCtx.resume(); } catch (e) { console.warn("audioCtx.resume() failed:", e); }
  }

  stopSource(true);

  const start = Math.floor(frameX * hop);

  // Compute how many samples are available per channel after start, and use the maximum (so we don't cut off any channel).
  const maxRemaining = channels.reduce((max, ch) => {
    const len = (ch && ch.pcm) ? Math.max(0, ch.pcm.length - start) : 0;
    return Math.max(max, len);
  }, 0);

  // frame length limited by fftSize and what's remaining
  const frameLen = Math.min(fftSize, maxRemaining);
  if (frameLen <= 0) return;

  const buffer = audioCtx.createBuffer(channelCount, frameLen, sampleRate);

  // Copy each channel's slice (or leave as silence if not available)
  for (let ch = 0; ch < channelCount; ch++) {
    const pcm = (channels[ch] && channels[ch].pcm) ? channels[ch].pcm : null;
    if (!pcm || pcm.length <= start) {
      // leave channel silent
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
function updateNoiseProfile(){
  document.getElementById("setNoiseProfileMin").value = noiseProfileMin;
  document.getElementById("setNoiseProfileMax").value = noiseProfileMax;
}