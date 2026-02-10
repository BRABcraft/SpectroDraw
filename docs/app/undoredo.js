
function recomputePCMForCols(colStart, colEnd, opts = {}) {
  if (!pcm || !mags || !phases) return;

  colStart = Math.max(0, Math.floor(colStart));
  colEnd   = Math.min(specWidth - 1, Math.floor(colEnd));
  if (colEnd < colStart) return;

  const marginCols = Math.ceil(fftSize / hop) + 2; 
  const colFirst = Math.max(0, colStart - marginCols);
  const colLast  = Math.min(specWidth - 1, colEnd + marginCols);

  const sampleStart = Math.max(0, colFirst * hop);
  const sampleEnd   = Math.min(pcm.length, (colLast * hop) + fftSize);
  const segmentLen  = sampleEnd - sampleStart;
  if (segmentLen <= 0) return;

  const h = specHeight;

  const window = (typeof win !== 'undefined' && win && win.length === fftSize)
                ? win
                : (function buildLocalWin() {
                    const w = new Float32Array(fftSize);
                    for (let i = 0; i < fftSize; i++) w[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (fftSize - 1)));
                    return w;
                  })();

  const newSegment = new Float32Array(segmentLen);
  const overlapCount = new Float32Array(segmentLen);
  const re = new Float32Array(fftSize);
  const im = new Float32Array(fftSize);

  for (let xCol = colFirst; xCol <= colLast; xCol++) {
    re.fill(0); im.fill(0);
    for (let bin = 0; bin < h && bin < fftSize; bin++) {
      const idx = xCol * h + bin;
      const mag = mags[idx] || 0;
      const phase = phases[idx] || 0;
      re[bin] = mag * Math.cos(phase);
      im[bin] = mag * Math.sin(phase);
      if (bin > 0 && bin < fftSize / 2) {
        const sym = fftSize - bin;
        re[sym] = re[bin];
        im[sym] = -im[bin];
      }
    }

    im[0] = 0;
    if (fftSize % 2 === 0) im[fftSize / 2] = 0;

    ifft_inplace(re, im);

    const baseSample = xCol * hop;
    for (let i = 0; i < fftSize; i++) {
      const globalSample = baseSample + i;
      if (globalSample < sampleStart || globalSample >= sampleEnd) continue;
      const segIndex = globalSample - sampleStart;
      newSegment[segIndex] += re[i] * window[i];
      overlapCount[segIndex] += window[i] * window[i];
    }
  }

  const EPS = 1e-8;
  for (let i = 0; i < segmentLen; i++) {
    if (overlapCount[i] > EPS) newSegment[i] /= overlapCount[i];
    else newSegment[i] = 0;
  }

  const oldSegment = pcm.slice(sampleStart, sampleEnd);
  const fadeLen = Math.min(Math.max(1, hop), 128);
  for (let i = 0; i < fadeLen; i++) {
    const t = i / fadeLen;
    newSegment[i] = newSegment[i] * t + oldSegment[i] * (1 - t);
    const j = segmentLen - 1 - i;
    if (j >= 0 && j < segmentLen) {
      const oldIdx = oldSegment.length - 1 - i;
      newSegment[j] = newSegment[j] * t + oldSegment[oldIdx] * (1 - t);
    }
  }

  pcm.set(newSegment, sampleStart);

  renderSpectrogramColumnsToImageBuffer(colFirst, colLast);

  if (playing) {
    stopSource(true);
    playPCM(true);
  }
}

function renderSpectrogramColumnsToImageBuffer(colStart, colEnd) {
  colStart = Math.max(0, Math.floor(colStart));
  colEnd = Math.min(specWidth - 1, Math.floor(colEnd));
  if (!imageBuffer || !specCtx) return;
  const h = specHeight;
  const w = specWidth;

  for (let xx = colStart; xx <= colEnd; xx++) {
    for (let yy = 0; yy < h; yy++) {
      const bin = displayYToBin(yy, h);
      const idx = xx * h + bin;
      const mag = mags[idx] || 0;
      const phase = phases[idx] || 0;
      const [r,g,b] = magPhaseToRGB(mag, phase);
      const pix = (yy * w + xx) * 4;
      imageBuffer.data[pix] = r;
      imageBuffer.data[pix+1] = g;
      imageBuffer.data[pix+2] = b;
      imageBuffer.data[pix+3] = 255;
    }
  }

  specCtx.putImageData(imageBuffer, 0, 0, colStart, 0, (colEnd-colStart+1), specHeight);
  renderView();
  drawCursor();
}

document.addEventListener('keydown', (ev) => {
  const key = ev.key.toLowerCase();
  if ((ev.ctrlKey || ev.metaKey) && key === 'z') {
    ev.preventDefault();
    if (ev.shiftKey) doRedo();    
    else doUndo();                
  } else if ((ev.ctrlKey || ev.metaKey) && key === 'y') {
    ev.preventDefault();
    doRedo();                     
  }
});

document.getElementById('undoBtn').addEventListener('click', () => {
  doUndo();
});
document.getElementById('redoBtn').addEventListener('click', () => {
  doRedo();
});
// Ensure mags/phases (and related buffers) are sized to cover max flat index
function ensureMagsPhasesForSizeOrIndex(v, hopArg, fftSArg) {
  if (typeof v !== 'number' || v <= 0 || !specHeight) return;

  const h = specHeight;
  // decide whether v is columns or flat index:
  // if v * h equals current mags length, it's likely already columns.
  // otherwise if v appears larger than current mags length, assume it's columns.
  // else treat v as flat max index.
  let requiredCols;
  if (mags && v * h === mags.length) {
    requiredCols = v;
  } else if (v * h > (mags ? mags.length : 0) && Number.isInteger(v) && v <= 100000) {
    // heuristically treat as columns
    requiredCols = v;
  } else {
    // treat as flat index
    requiredCols = Math.ceil((v + 1) / h);
  }

  if (requiredCols <= 0) return;

  const requiredLen = requiredCols * h; // number of bins (mags/phases length)
  const curLen = (mags && mags.length) ? mags.length : 0;

  // Determine sample sizing using provided or global hop/fftSize
  const localHop = hop;
  const localFFT = fftSize;

  // Required PCM sample length to cover requiredCols:
  // last column index is requiredCols - 1, last sample = lastCol*hop + fftSize - 1
  const requiredPcmLen = Math.max(0, (requiredCols - 1) * localHop + localFFT);

  // --- Grow if necessary ---
  if (curLen < requiredLen) {
    const newMags = new Float32Array(requiredLen);
    const newPhases = new Float32Array(requiredLen);
    if (mags && mags.length) newMags.set(mags.subarray(0, Math.min(mags.length, requiredLen)));
    if (phases && phases.length) newPhases.set(phases.subarray(0, Math.min(phases.length, requiredLen)));
    mags = newMags;
    phases = newPhases;

    // Grow pcm to required sample length (preserve existing samples at start)
    if (typeof pcm !== 'undefined' && pcm) {
      if (pcm.length < requiredPcmLen) {
        const newPcm = new Float32Array(requiredPcmLen);
        newPcm.set(pcm.subarray(0, Math.min(pcm.length, requiredPcmLen)));
        pcm = newPcm;
      }
    } else {
      // ensure pcm exists
      pcm = new Float32Array(requiredPcmLen);
    }

    specWidth = Math.max(specWidth || 0, requiredCols);

    // Resize canvas / image buffer if present
    if (typeof specCanvas !== 'undefined' && specCanvas && specCtx) {
      specCanvas.width = specWidth;
      try { imageBuffer = specCtx.createImageData(specWidth, specHeight); } catch(e){}
    }
    framesTotal = specWidth;

    console.log("ensure: grown to", requiredCols, "cols,", requiredLen, "bins; pcm len:", pcm.length);
  }

  // --- Shrink (trim) if necessary ---
  if (curLen > requiredLen) {
    mags = mags.slice(0, requiredLen);
    phases = phases.slice(0, requiredLen);
    specWidth = requiredCols;

    // Resize PCM conservatively to match new size (samples)
    const newPcmLen = Math.max(0, (specWidth - 1) * localHop + localFFT);
    if (typeof pcm !== 'undefined' && pcm) {
      if (pcm.length > newPcmLen) {
        const tmp = new Float32Array(newPcmLen);
        tmp.set(pcm.subarray(0, newPcmLen));
        pcm = tmp;
      } else if (pcm.length < newPcmLen) {
        const tmp = new Float32Array(newPcmLen);
        tmp.set(pcm, 0);
        pcm = tmp;
      }
    } else {
      pcm = new Float32Array(newPcmLen);
    }

    if (typeof specCanvas !== 'undefined' && specCanvas && specCtx) {
      specCanvas.width = specWidth;
      try { imageBuffer = specCtx.createImageData(specWidth, specHeight); } catch(e){}
    }

    console.log("ensure: shrunk to", requiredCols, "cols,", requiredLen, "bins; pcm len:", pcm.length);
  }

  // done — caller should call recompute / render for the columns they need
}

function doUndo() {
  if (rendering) return;
  if (historyStack.length === 0) { console.log("Nothing to undo"); return; }
  const entry = historyStack.pop();

  // read maxCols from possible property names (maxCols, maxSize)
  const entryMaxCols = entry.maxCols ?? entry.maxSize ?? entry.maxSizeCols ?? null;
  if (typeof entryMaxCols === 'number') {
    // call helper with columns; pass hop/fft if available in the entry
    //ensureMagsPhasesForSizeOrIndex(entryMaxCols, entry.hopSize, entry.fftSize);
  }

  if (entry.type === 'paint') {
    const indices = entry.indices;
    const prevMags = entry.prevMags;
    const prevPhases = entry.prevPhases;
    const n = indices.length;
    const postMags = new Float32Array(n);
    const postPhases = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      const idx = indices[i];
      postMags[i] = mags[idx] || 0;
      postPhases[i] = phases[idx] || 0;
    }

    for (let i = 0; i < n; i++) {
      const idx = indices[i];
      mags[idx] = prevMags[i];
      phases[idx] = prevPhases[i];
    }

    // ensure recompute covers restored columns: use entry min/max and any newly restored columns
    const minCol = Math.max(0, entry.minCol ?? 0);
    const maxColCandidate = Math.max(entry.maxCol ?? 0, specWidth - 1);
    const maxCol = Math.min(specWidth - 1, maxColCandidate);

    recomputePCMForCols(minCol, maxCol);
    restartRender(false);
    
    iLow = 0; iHigh = specWidth; updateCanvasScroll();

    while (redoStack.length >= MAX_HISTORY_ENTRIES) redoStack.shift();
    redoStack.push({
      type: 'paint',
      indices: indices,
      nextMags: postMags,
      nextPhases: postPhases,
      minCol: minCol,
      maxCol: maxCol,
      maxCols: entryMaxCols,   // carry forward column count if present
      hopSize: entry.hopSize,
      fftSize: entry.fftSize
    });

    if (playing) {
      stopSource(true);
      playPCM(true);
    }
  } else {
    console.warn("Unknown history entry type:", entry.type);
  }
}


function doRedo() {
  
  if (rendering) return;
  if (redoStack.length === 0) { console.log("Nothing to redo"); return; }
  const rentry = redoStack.pop();

  const rentryMaxCols = rentry.maxCols ?? rentry.maxSize ?? null;
  if (typeof rentryMaxCols === 'number') {
    //ensureMagsPhasesForSizeOrIndex(rentryMaxCols, rentry.hopSize, rentry.fftSize);
  }

  if (rentry.type === 'paint') {
    const indices = rentry.indices;
    const nextMags = rentry.nextMags;
    const nextPhases = rentry.nextPhases;
    const n = indices.length;

    const prevMags = new Float32Array(n);
    const prevPhases = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const idx = indices[i];
      prevMags[i] = mags[idx] || 0;
      prevPhases[i] = phases[idx] || 0;
    }

    for (let i = 0; i < n; i++) {
      const idx = indices[i];
      mags[idx] = nextMags[i];
      phases[idx] = nextPhases[i];
    }

    const minCol = Math.max(0, rentry.minCol ?? 0);
    const maxCol = Math.min(specWidth - 1, rentry.maxCol ?? (specWidth - 1));
    renderSpectrogramColumnsToImageBuffer(minCol, maxCol);
    recomputePCMForCols(minCol, maxCol);

    // Push a history entry so user can undo this redo; include maxCols info
    pushHistory({
      type: 'paint',
      indices: indices,
      prevMags: prevMags,
      prevPhases: prevPhases,
      minCol: minCol,
      maxCol: maxCol,
      maxCols: rentryMaxCols ?? specWidth,
      hopSize: rentry.hopSize,
      fftSize: rentry.fftSize
    }, false);

    if (playing) {
      stopSource(true);
      playPCM(true);
    }
  } else {
    console.warn("Unknown redo entry type:", rentry.type);
  }
}








function simpleRestartRender(){
  startX=startY=null;
  startTime = performance.now();
  audioProcessed = 0;
  autoRecomputePCM(0,framesTotal);
  pendingPlayAfterRender = true; 
  maxCol = framesTotal;
  pos = 0;
  x = 0;
  rendering = true;
  requestAnimationFrame(() => drawLoop());
  startTime = performance.now();
  audioProcessed = 0;
}

function globalXStretch(xFactor) {
  const sign = xFactor>0;
  xFactor = Math.abs(xFactor);
  if (!g_useMags && !g_usePhases) return;
  sliders[0][0].value = sliders[0][1].value = Number(emptyAudioLengthEl.value)*xFactor;

  // compute old/new frame counts once
  const oldFrames = framesTotal;
  const newFrameLength = Math.floor(emptyAudioLengthEl.value*sampleRate/hop);
  const newArrLen = newFrameLength*specHeight;
  let newMags;
  if (!g_useMags) {
    newMags = new Float32Array(newArrLen).fill(0);
    if (newArrLen>mags.length)newMags.set(mags,0);
  } else {
    newMags = new Float32Array(newArrLen);
  }
  let newPhases;
  if (!g_usePhases) {
    newPhases = Float32Array.from({ length: newArrLen }, () => { return Math.random()*Math.PI*2;});
    if (newArrLen>phases.length)newPhases.set(phases,0);
  } else {
    newPhases = new Float32Array(newArrLen);
  }

  for(let f=0;f<newFrameLength;f++){
    const oldF = Math.floor((sign?f:newFrameLength-f-1)*oldFrames/newFrameLength);
    const setP = oldF*specHeight;
    const magsF = g_useMags?mags.slice(setP,setP+specHeight):null;
    const phasesF = g_usePhases?phases.slice(setP,setP+specHeight):null;
    if (g_useMags) newMags.set(magsF,f*specHeight);
    if (g_usePhases) newPhases.set(phasesF,f*specHeight);
  }
  if (g_useMags) mags = new Float32Array(newMags);
  if (g_usePhases) phases = new Float32Array(newPhases);
  pcm = new Float32Array(emptyAudioLengthEl.value*sampleRate);
  // finalize frame counts and re-render
  framesTotal = specWidth = newFrameLength;
  simpleRestartRender();
  restartRender(false, false);
}

function globalYStretch(yFactor) {
  if (!g_useMags && !g_usePhases) return;
  const newMags = g_useMags?new Float32Array(mags):null;
  const newPhases = g_usePhases?new Float32Array(phases):null;
  const f = sampleRate / fftSize, $s = sampleRate/2, $l = logScaleVal;
  for (let b=0;b<specHeight;b++){
    const newBin = Math.max(Math.min(Math.floor(invlsc(((lsc(b*f,$s,$l)/f-(specHeight/2))/yFactor+(specHeight/2))*f,$s,$l)/f),specHeight),0);
    for(let f=0;f<framesTotal;f++){
      const base = f*specHeight;
      if (g_useMags) newMags[base+b] = mags[base+newBin];
      if (g_usePhases) newPhases[base+b] = phases[base+newBin];
    }
  }
  if (g_useMags) mags = new Float32Array(newMags);
  if (g_usePhases) phases = new Float32Array(newPhases);
  simpleRestartRender();
}

function globalXTranslate(deltaX) {
  deltaX = -Math.floor(deltaX);
  if (!g_useMags && !g_usePhases) return;
  const newArrLen = framesTotal*specHeight;
  const newMags = g_useMags?new Float32Array(newArrLen):null;
  const newPhases = g_usePhases?new Float32Array(newArrLen):null;
  for(let f=0;f<framesTotal;f++){
    const oldF = f+deltaX;
    const setP = oldF*specHeight;
    const magsF = g_useMags?mags.slice(setP,setP+specHeight):new Float32Array(specHeight);
    const phasesF = g_usePhases?phases.slice(setP,setP+specHeight):new Float32Array(specHeight);
    if (g_useMags) newMags.set(magsF,f*specHeight);
    if (g_usePhases) newPhases.set(phasesF,f*specHeight);
  }
  if (g_useMags) mags = new Float32Array(newMags);
  if (g_usePhases) phases = new Float32Array(newPhases);
  maxCol = framesTotal;
  simpleRestartRender();
}

function globalYTranslate(deltaY) {
  deltaY = -Math.floor(deltaY);
  if (!g_useMags && !g_usePhases) return;
  const newMags = g_useMags?new Float32Array(mags):null;
  const newPhases = g_usePhases?new Float32Array(phases):null;
  const f = sampleRate / fftSize, $s = sampleRate/2, $l = logScaleVal;
  for (let b=0;b<specHeight;b++){
    const newBin = Math.max(Math.min(Math.floor(invlsc((lsc(b*f,$s,$l)/f+deltaY)*f,$s,$l)/f),specHeight),0);
    for(let f=0;f<framesTotal;f++){
      const base = f*specHeight;
      if (g_useMags) newMags[base+b] = mags[base+newBin];
      if (g_usePhases) newPhases[base+b] = phases[base+newBin];
    }
  }
  if (g_useMags) mags = new Float32Array(newMags);
  if (g_usePhases) phases = new Float32Array(newPhases);
  simpleRestartRender();
}

function xQuantize(columns) {console.log(703);
  if (!g_useMags && !g_usePhases) return;
  columns = Math.floor(framesTotal/Math.max(1, Math.floor(columns)));
  const totalFrames = framesTotal;
  const H = specHeight;
  const len = totalFrames * H;
  let newMags = g_useMags ? new Float32Array(len) : null;
  let newPhases = g_usePhases ? new Float32Array(len) : null;
  for (let start = 0; start < totalFrames; start += columns) {
    const end = Math.min(totalFrames, start + columns);
    const blockSize = end - start;
    for (let bin = 0; bin < H; bin++) {
      if (g_useMags) {
        let sum = 0;
        for (let f = start; f < end; f++) {
          sum += mags[f * H + bin];
        }
        const avg = sum / blockSize;
        for (let f = start; f < end; f++) {
          newMags[f * H + bin] = avg;
        }
      }
      if (g_usePhases) {
        let sumSin = 0;
        let sumCos = 0;
        for (let f = start; f < end; f++) {
          const a = phases[f * H + bin];
          sumSin += Math.sin(a);
          sumCos += Math.cos(a);
        }
        const meanAngle = Math.atan2(sumSin, sumCos);
        for (let f = start; f < end; f++) {
          newPhases[f * H + bin] = meanAngle;
        }
      }
    }
  }
  if (g_useMags) mags = new Float32Array(newMags);
  if (g_usePhases) phases = new Float32Array(newPhases);
  simpleRestartRender();
}

function yQuantize(rows) {
  if (!g_useMags && !g_usePhases) return;
  rows = Math.max(1, Math.floor(rows));

  const totalFrames = framesTotal;
  const H = specHeight;
  const freqPerBin = sampleRate / fftSize;
  const s = sampleRate / 2;

  const len = totalFrames * H;

  const newMags = g_useMags ? new Float32Array(len) : null;
  const newPhases = g_usePhases ? new Float32Array(len) : null;

  // log-scale parameter for this layer
  const lscVal = logScaleVal;

  // process frame-by-frame
  for (let fi = 0; fi < totalFrames; fi++) {
    const base = fi * H;

    // accumulators per region
    const magSums = g_useMags ? new Float32Array(rows) : null;
    const counts = new Uint16Array(rows);
    const sinSums = g_usePhases ? new Float32Array(rows) : null;
    const cosSums = g_usePhases ? new Float32Array(rows) : null;

    // first pass: accumulate sums for each region (region determined by lsc mapping)
    for (let b = 0; b < H; b++) {
      const displayY = lsc(b * freqPerBin, s, lscVal) / freqPerBin;
      let regionIndex = Math.floor(displayY * rows / H);
      if (regionIndex < 0) regionIndex = 0;
      if (regionIndex >= rows) regionIndex = rows - 1;

      if (g_useMags) magSums[regionIndex] += mags[base + b];
      counts[regionIndex]++;

      if (g_usePhases) {
        const a = phases[base + b];
        sinSums[regionIndex] += Math.sin(a);
        cosSums[regionIndex] += Math.cos(a);
      }
    }

    // second pass: compute averages and write them back into every bin that belongs to that region
    for (let b = 0; b < H; b++) {
      const displayY = lsc(b * freqPerBin, s, lscVal) / freqPerBin;
      let regionIndex = Math.floor(displayY * rows / H);
      if (regionIndex < 0) regionIndex = 0;
      if (regionIndex >= rows) regionIndex = rows - 1;

      if (g_useMags) {
        const cnt = counts[regionIndex];
        newMags[base + b] = cnt > 0 ? magSums[regionIndex] / cnt : mags[base + b];
      }

      if (g_usePhases) {
        const cnt = counts[regionIndex];
        if (cnt > 0) {
          newPhases[base + b] = Math.atan2(sinSums[regionIndex], cosSums[regionIndex]);
        } else {
          newPhases[base + b] = phases[base + b];
        }
      }
    }
  }

  if (g_useMags) mags = new Float32Array(newMags);
  if (g_usePhases) phases = new Float32Array(newPhases);

  simpleRestartRender();
}

let Gtarget = null, _gX = 0, _gY = 0, _xQuantize = 4, _yQuantize = 4;
document.querySelectorAll("#globalXYTools td").forEach(td=>{
    td.addEventListener("pointerdown",e=>{
      const v = td.querySelector("div");
      if (!v.id.includes("stretch")&&!v.id.includes("translate")) return;
      snapshotMags = new Float32Array(mags);
      snapshotPhases = new Float32Array(phases);
      v.style.color = "#4af";
      Gtarget = v.id;
      _gX = e.clientX; _gY = e.clientY;
    });
    document.addEventListener("pointermove",e=>{
      const v = td.querySelector("div").id;
      if (Gtarget!==v) return;
      if (v==="x-stretch") {
        const xFactor = ((e.clientX-_gX)-(e.clientY-_gY))/100+1;
        globalXStretch(xFactor);
      } else if (v==="y-stretch") {
        const yFactor = ((e.clientX-_gX)-(e.clientY-_gY))/500+1;
        globalYStretch(yFactor);
      } else if (v==="x-translate") {
        const deltaX = ((e.clientX-_gX)-(e.clientY-_gY))/(window.innerWidth-550)*framesTotal;
        globalXTranslate(deltaX);
      } else if (v==="y-translate") {
        const deltaY = ((e.clientX-_gX)-(e.clientY-_gY))/(window.innerHeight-150)*specHeight;
        globalYTranslate(deltaY);
      }

      _gX = e.clientX; _gY = e.clientY;
    });
    document.addEventListener("pointerup",()=>{
      const v = td.querySelector("div").id;
      if (Gtarget===v) newHistory();
      Gtarget=null;
      td.querySelector("div").style.color = "#fff";
    });
    td.addEventListener("click",e=>{
      if (e.button !== 0) return;
      const v = td.querySelector("div").id;
      if (v.includes("stretch") || v.includes("translate")) return;
      snapshotMags=new Float32Array(mags);
      snapshotPhases=new Float32Array(phases);
             if (v === "x-x2") {
        globalXStretch(2);
      } else if (v === "y-x2") {
        globalYStretch(2);
      } else if (v === "x-/2") {
        globalXStretch(0.5);
      } else if (v === "y-/2") {
        globalYStretch(0.5);
      } else if (v === "x-flip") {
        globalXStretch(-1);
      } else if (v === "y-flip") {
        globalYStretch(-1);
      } else if (v === "x-quantize") {
        xQuantize(_xQuantize);
      } else if (v === "y-quantize") {
        yQuantize(_yQuantize);
      }
      newHistory();
    });
  }
);