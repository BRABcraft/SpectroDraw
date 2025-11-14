
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
  // find most recent enabled sprite
  let idx = -1;
  for (let i = sprites.length - 1; i >= 0; i--) {
    if (sprites[i].enabled) { idx = i; break; }
  }
  if (idx === -1) { console.log("Nothing to undo (no enabled sprites)"); return; }
  const sprite = sprites[idx];
  console.log("Undoing sprite:", sprite);
  // restore sprite's prev values (iterate left->right, top->bottom)
  forEachSpritePixelInOrder(sprite, (x, y, prevMag, prevPhase) => {
    const id = x * specHeight + y;
    mags[id] = prevMag;
    phases[id] = prevPhase;
  });

  // mark disabled
  sprite.enabled = false;
  renderSpritesTable();

  // recompute/render only affected columns
  const minCol = Math.max(0, sprite.minCol);
  const maxCol = Math.min(specWidth - 1, sprite.maxCol);
  renderSpectrogramColumnsToImageBuffer(minCol, maxCol);
  recomputePCMForCols(minCol, maxCol);
  restartRender(false);

  // update UI scroll / view
  iLow = 0; iHigh = specWidth; updateCanvasScroll();

  // track disabled sprites (optional)
  spriteRedoQueue.push(sprite);

  if (playing) {
    stopSource(true);
    playPCM(true);
  }
}

/* ===== Sprite-based redo: enable the oldest disabled sprite by reapplying its next values =====
   (You specified "oldest disabled sprite" — this finds the earliest disabled entry in `sprites[]`.)
*/
function doRedo() {
  if (rendering) return;
  // find oldest disabled sprite
  let idx = -1;
  for (let i = 0; i < sprites.length; i++) {
    if (!sprites[i].enabled) { idx = i; break; }
  }
  if (idx === -1) { console.log("Nothing to redo (no disabled sprites)"); return; }
  const sprite = sprites[idx];

  // apply sprite's recorded "next" values
  forEachSpritePixelInOrder(sprite, (x, y, _prevMag, _prevPhase, nextMag, nextPhase) => {
    const id = x * specHeight + y;
    mags[id] = nextMag;
    phases[id] = nextPhase;
  });

  sprite.enabled = true;
  renderSpritesTable();

  // recompute/render only affected columns
  const minCol = Math.max(0, sprite.minCol);
  const maxCol = Math.min(specWidth - 1, sprite.maxCol);
  renderSpectrogramColumnsToImageBuffer(minCol, maxCol);
  recomputePCMForCols(minCol, maxCol);
  restartRender(false);

  // remove from redo queue if tracked
  const rqidx = spriteRedoQueue.indexOf(sprite);
  if (rqidx !== -1) spriteRedoQueue.splice(rqidx, 1);

  if (playing) {
    stopSource(true);
    playPCM(true);
  }
}