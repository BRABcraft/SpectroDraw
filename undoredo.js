function recomputePCMForCols(colStart, colEnd) {
  if (!pcm || !mags || !phases) return;

  colStart = Math.max(0, Math.floor(colStart));
  colEnd   = Math.min(specWidth - 1, Math.floor(colEnd));
  if (colEnd < colStart) return;

  const marginCols = Math.ceil(fftSize / hop) + 1;

  const colFirst = Math.max(0, colStart - marginCols);
  const colLast  = Math.min(specWidth - 1, colEnd + marginCols);

  const sampleStart = Math.max(0, colFirst * hop);
  const sampleEnd   = Math.min(pcm.length, (colLast * hop) + fftSize);
  const segmentLen  = sampleEnd - sampleStart;
  if (segmentLen <= 0) return;

  const newSegment = new Float32Array(segmentLen);
  const overlapCount = new Float32Array(segmentLen);

  const h = specHeight;
  const window = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++) window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (fftSize - 1)));

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

  for (let i = 0; i < segmentLen; i++) {
    if (overlapCount[i] > 0) newSegment[i] /= overlapCount[i];
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

async function doUndo() {
  if (historyStack.length === 0) { console.log("Nothing to undo"); return; }
  const entry = historyStack.pop();

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

    const minCol = Math.max(0, entry.minCol);
    const maxCol = Math.min(specWidth - 1, entry.maxCol);
    renderSpectrogramColumnsToImageBuffer(minCol, maxCol);
    recomputePCMForCols(minCol, maxCol);

    while (redoStack.length >= MAX_HISTORY_ENTRIES) redoStack.shift();
    redoStack.push({
      type: 'paint',
      indices: indices,           
      nextMags: postMags,        
      nextPhases: postPhases,
      minCol: minCol,
      maxCol: maxCol
    });

    if (playing) {
      stopSource(true);
      playPCM(true);
    }
  } else {
    console.warn("Unknown history entry type:", entry.type);
  }
}

async function doRedo() {
  if (redoStack.length === 0) { console.log("Nothing to redo"); return; }
  const rentry = redoStack.pop();

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

    const minCol = Math.max(0, rentry.minCol);
    const maxCol = Math.min(specWidth - 1, rentry.maxCol);
    renderSpectrogramColumnsToImageBuffer(minCol, maxCol);
    recomputePCMForCols(minCol, maxCol);

    pushHistory({
      type: 'paint',
      indices: indices,
      prevMags: prevMags,
      prevPhases: prevPhases,
      minCol: minCol,
      maxCol: maxCol
    },  false);

    if (playing) {
      stopSource(true);
      playPCM(true);
    }
  } else {
    console.warn("Unknown redo entry type:", rentry.type);
  }
}