function combineAndDraw(startSample, endSample) {
  if (!layers || layers.length === 0) return;

  // figure out maximum length present in pcm[0] across layers
  let maxLen = 0;
  for (let ch = 0; ch < layers.length; ch++) {
    const layer = layers[ch];
    if (layer && layer.pcm && layer.pcm[0]) {
      maxLen = Math.max(maxLen, layer.pcm[0].length);
    }
  }
  if (maxLen === 0) return;

  // accumulate sums and counts for left and right channels
  const sumL = new Float32Array(maxLen);
  const sumR = new Float32Array(maxLen);
  const countL = new Uint16Array(maxLen);
  const countR = new Uint16Array(maxLen);

  for (let ch = 0; ch < layers.length; ch++) {
    const layer = layers[ch];
    if (!layer || !layer.pcm || !layer.pcm[0]) continue;
    const Larr = layer.pcm[0];
    const Rarr = layer.pcm[1]; // may be undefined
    const L = Larr.length;
    for (let i = 0; i < L; i++) {
      const lv = Larr[i];
      if (isFinite(lv)) {
        sumL[i] += lv;
        countL[i] += 1;
      }
      if (Rarr && i < Rarr.length) {
        const rv = Rarr[i];
        if (isFinite(rv)) {
          sumR[i] += rv;
          countR[i] += 1;
        }
      }
    }
  }

  // build averaged arrays for left and right
  const avgL = new Float32Array(maxLen);
  const avgR = new Float32Array(maxLen);
  for (let i = 0; i < maxLen; i++) {
    avgL[i] = countL[i] > 0 ? sumL[i] / countL[i] : 0;
    avgR[i] = countR[i] > 0 ? sumR[i] / countR[i] : 0;
  }

  // defaults for start/end
  if (typeof startSample === 'undefined' || startSample === null) startSample = 0;
  if (typeof endSample === 'undefined' || endSample === null) endSample = maxLen;
  startSample = Math.max(0, Math.floor(startSample));
  endSample = Math.min(maxLen, Math.ceil(endSample));
  if (endSample <= startSample) {
    startSample = 0;
    endSample = maxLen;
  }

  const WIDTH = 1000;
  const HEIGHT = 35;
  const canvas = document.getElementById('waveform');
  if (!canvas || !canvas.getContext) return;
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  const halfH = HEIGHT / 2;
  const scale = halfH / 1.5;
  const sampleRange = Math.max(1, endSample - startSample);
  const samplesPerPixel = sampleRange / WIDTH;

  // background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const sampleCount = endSample - startSample;

  // helper: map pan (0..1) to color from white -> blue
  function panToColor(pan) {
    // pan=0 => white (255,255,255); pan=1 => blue (0,0,255)
    const r = Math.round(255 * (1 - pan));
    const g = Math.round(255 * (1 - pan));
    const b = 255;
    return `rgb(${r},${g},${b})`;
  }

  // Sparse case: draw a smooth polyline, color each short segment according to pan at segment midpoint
  if (sampleCount < WIDTH * 12) {
    // draw per-sample line segments with color per segment
    let prevX = null;
    let prevY = null;
    for (let i = 0; i < sampleCount - 1; i++) {
      const si = startSample + i;
      const sNext = startSample + i + 1;
      const x = (i / (sampleCount - 1 || 1)) * WIDTH;
      const x2 = ((i + 1) / (sampleCount - 1 || 1)) * WIDTH;

      // combined amplitude is average of left and right
      const l = avgL[si] || 0;
      const r = avgR[si] || 0;
      const combined = (l + r) * 0.5;
      const y = halfH - combined * scale;

      const ln = avgL[sNext] || 0;
      const rn = avgR[sNext] || 0;
      const combinedNext = (ln + rn) * 0.5;
      const y2 = halfH - combinedNext * scale;

      // pan for this segment: compute using midpoint magnitudes (more stable)
      const denom = Math.abs(l) + Math.abs(r);
      const pan = denom > 0 ? Math.abs(r) / denom : 0.5;
      ctx.strokeStyle = panToColor(pan);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, y);
      ctx.lineTo(x2 + 0.5, y2);
      ctx.stroke();
      prevX = x2;
      prevY = y2;
    }
    return;
  }

  // Dense case: per-pixel aggregation (faster). For each pixel compute min/max combined amplitude
  // and a weighted average pan (weighted by magnitude).
  for (let x = 0; x < WIDTH; x++) {
    const start = Math.floor(startSample + x * samplesPerPixel);
    const end = Math.min(endSample, Math.floor(startSample + (x + 1) * samplesPerPixel));
    let min = Infinity, max = -Infinity;
    let panWeighted = 0;
    let magSum = 0;

    if (end <= start) {
      const l = avgL[start] || 0;
      const r = avgR[start] || 0;
      const v = (l + r) * 0.5;
      min = max = v;
      const denom = Math.abs(l) + Math.abs(r);
      const pan = denom > 0 ? Math.abs(r) / denom : 0.5;
      const mag = Math.abs(l) + Math.abs(r);
      panWeighted += pan * mag;
      magSum += mag;
    } else {
      for (let i = start; i < end; i++) {
        const l = avgL[i] || 0;
        const r = avgR[i] || 0;
        const v = (l + r) * 0.5;
        if (v < min) min = v;
        if (v > max) max = v;

        const denom = Math.abs(l) + Math.abs(r);
        const pan = denom > 0 ? Math.abs(r) / denom : 0.5;
        const mag = Math.abs(l) + Math.abs(r);
        panWeighted += pan * mag;
        magSum += mag;
      }
    }

    if (min === Infinity) { min = 0; max = 0; }

    const y1 = halfH - max * scale;
    const y2 = halfH - min * scale;
    const height = Math.max(1, Math.abs(y2 - y1));

    const pan = magSum > 0 ? (panWeighted / magSum) : 0.5;
    ctx.fillStyle = panToColor(pan);

    // draw a 1px vertical bar representing min->max for that pixel
    ctx.fillRect(x + 0.5, Math.min(y1, y2), 1, height);
  }
}

function recomputePCMForCols(colStart, colEnd) {
  colStart = Math.max(0, Math.floor(colStart));
  colEnd   = Math.min(specWidth - 1, Math.floor(colEnd));
  if (colEnd < colStart) return;
  const marginCols = Math.ceil(fftSize / hop) + 2;
  const colFirst = Math.max(0, colStart - marginCols);
  const colLast  = Math.min(specWidth - 1, colEnd + marginCols);
  const h = specHeight;const EPS = 1e-8; const fadeCap = Infinity;

  // temporary buffers reused per-layer
  const reL = new Float32Array(fftSize);
  const reR = new Float32Array(fftSize);
  const imL = new Float32Array(fftSize);
  const imR = new Float32Array(fftSize);

  for (let ch = 0; ch < layerCount; ch++) {
    const layer = layers[ch];
    if (!layer) continue;

    // ensure pcm arrays exist
    //console.log(new Float32Array(layer.pcm[0]));
    if (!layer.pcm) layer.pcm = [new Float32Array(0), new Float32Array(0)];

    const pcmL = layer.pcm[0];
    const pcmR = layer.pcm[1];

    const sampleStart = Math.max(0, colFirst * hop);
    const sampleEnd   = Math.min(Math.max(pcmL.length, pcmR.length), (colLast * hop) + fftSize);
    const segmentLen  = sampleEnd - sampleStart;
    if (segmentLen <= 0) continue;

    const newSegmentL = new Float32Array(segmentLen);
    const newSegmentR = new Float32Array(segmentLen);
    const overlapCount = new Float32Array(segmentLen);

    for (let xCol = colFirst; xCol <= colLast; xCol++) {
      // clear buffers
      reL.fill(0);
      reR.fill(0);
      imL.fill(0);
      imR.fill(0);

      const mags = layer.mags;
      const phases = layer.phases;
      for (let bin = 0; bin < h && bin < fftSize; bin++) {
        const idx = xCol * h + bin;
        const mag = mags[idx] || 0;
        const phase = phases[idx] || 0;
        // assume pan in [0,1] where 0=left, 1=right; fallback to center if undefined
        // equal-power panning
        const panRaw = (layer.pans && layer.pans[idx]);
        const pan = Number.isFinite(panRaw) ? Math.max(0, Math.min(1, panRaw)) : 0.5;
        const gainL = Math.cos(pan * (Math.PI / 2));
        const gainR = Math.sin(pan * (Math.PI / 2));
        const reVal = mag * Math.cos(phase);
        const imVal = mag * Math.sin(phase);

        reL[bin] = reVal * gainL;
        imL[bin] = imVal * gainL;
        reR[bin] = reVal * gainR;
        imR[bin] = imVal * gainR;

        // symmetry for real IFFT
        if (bin > 0 && bin < fftSize / 2) {
          const sym = fftSize - bin;
          reL[sym] = reL[bin];
          imL[sym] = -imL[bin];
          reR[sym] = reR[bin];
          imR[sym] = -imR[bin];
        }
      }

      imL[0] = 0;
      imR[0] = 0;
      if (fftSize % 2 === 0) {
        imL[fftSize / 2] = 0;
        imR[fftSize / 2] = 0;
      }

      // inverse ffts: produces time-domain frames for left/right
      ifft_inplace(reL, imL);
      ifft_inplace(reR, imR);

      const baseSample = xCol * hop;
      for (let i = 0; i < fftSize; i++) {
        const globalSample = baseSample + i;
        if (globalSample < sampleStart || globalSample >= sampleEnd) continue;
        const segIndex = globalSample - sampleStart;
        const w = win[i];
        newSegmentL[segIndex] += reL[i] * w;
        newSegmentR[segIndex] += reR[i] * w;
        overlapCount[segIndex] += w * w;
      }
    }
    // normalize by overlap
    for (let i = 0; i < segmentLen; i++) {
      if (overlapCount[i] > EPS) {
        newSegmentL[i] /= overlapCount[i];
        newSegmentR[i] /= overlapCount[i];
      } else {
        newSegmentL[i] = 0;
        newSegmentR[i] = 0;
      }
    }

    // fetch old segments (safe slice even if pcm shorter)
    const oldSegmentL = pcmL.slice(sampleStart, sampleEnd);
    const oldSegmentR = pcmR.slice(sampleStart, sampleEnd);

    // fade at edges to avoid clicks
    const fadeLen = Math.min(Math.max(1, hop), fadeCap, segmentLen);
    for (let i = 0; i < fadeLen; i++) {
      const t = i / fadeLen;
      newSegmentL[i] = newSegmentL[i] * t + (oldSegmentL[i] || 0) * (1 - t);
      newSegmentR[i] = newSegmentR[i] * t + (oldSegmentR[i] || 0) * (1 - t);

      const j = segmentLen - 1 - i;
      if (j >= 0 && j < segmentLen) {
        const oldIdx = oldSegmentL.length - 1 - i;
        const oldValL = oldSegmentL[oldIdx] || 0;
        const oldValR = oldSegmentR[oldIdx] || 0;
        newSegmentL[j] = newSegmentL[j] * t + oldValL * (1 - t);
        newSegmentR[j] = newSegmentR[j] * t + oldValR * (1 - t);
      }
    }

    //write back into layer pcm buffers (ensure length)
    if (pcmL.length < sampleEnd) {
      const tmp = new Float32Array(sampleEnd);
      tmp.set(pcmL);
      layer.pcm[0] = tmp;
    }
    if (pcmR.length < sampleEnd) {
      const tmp = new Float32Array(sampleEnd);
      tmp.set(pcmR);
      layer.pcm[1] = tmp;
    }
    layer.pcm[0].set(newSegmentL, sampleStart);
    layer.pcm[1].set(newSegmentR, sampleStart);
    //console.log(new Float32Array(layer.pcm[0]));
  }
  if (layers && layers[0] && layers[0].pcm[0]) {
    const startSample = Math.max(0, Math.floor(iLow * hop));
    const endSample = Math.min(layers[0].pcm[0].length, Math.ceil(iHigh * hop));
    combineAndDraw(startSample, endSample);
  } else {
    combineAndDraw();
  }
  if (playing) {
    stopSource(true);
    playPCM(true);
  }
}

function renderSpectrogramColumnsToImageBuffer(colStart, colEnd, ch) {
  let mags = layers[ch].mags, phases = layers[ch].phases, pans = layers[ch].pans;
  const specCanvas = document.getElementById("spec-"+ch);
  const specCtx = specCanvas.getContext("2d");
  colStart = Math.min(Math.max(0, Math.floor(colStart)),specWidth);
  colEnd = Math.min(specWidth - 1, Math.max(0,Math.floor(colEnd)));
  if (!imageBuffer[ch] || !specCtx) return;
  const h = specHeight;
  const w = specWidth;
  for (let xx = colStart; xx <= colEnd; xx++) {
    for (let yy = 0; yy < h; yy++) {
      const bin = displayYToBin(yy, h, ch);
      const idx = xx * h + bin;
      const mag = mags[idx] || 0;
      const phase = phases[idx] || 0;
      const pan = pans[idx] || 0;
      const [r,g,b] = magPhasePanToRGB(mag, phase, pan);
      const pix = (yy * w + xx) * 4;
      imageBuffer[ch].data[pix] = r;
      imageBuffer[ch].data[pix+1] = g;
      imageBuffer[ch].data[pix+2] = b;
      imageBuffer[ch].data[pix+3] = 255;
    }
  }
  specCtx.putImageData(imageBuffer[ch], 0, 0, colStart, 0, (colEnd-colStart+1), specHeight);
  renderView();
  drawCursor();
}
document.addEventListener('keydown', (ev) => {
  if (editingExpression !== null) return; 
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
function globalXYUpdateLayersAndSprites(h) {
  if (h.ch !== null) {
    const minCol = h.sprites.minCol;
    function setLayer(l,layer) {
      layers[l].mags.set(layer.mags,minCol*specHeight);
      layers[l].phases.set(layer.phases,minCol*specHeight);
      layers[l].pcm[0].set(layer.pcm[0],minCol*hop);
    }
    if (h.ch==="all") {
      for (let l=0;l<layerCount;l++) setLayer(l,h.layers[l]);
    } else {
      setLayer(h.ch,h.layers);
    }
    sprites[getSpriteIndexById(h.spriteIdx)] = h.sprites;
    if (selectedSpriteId === h.spriteIdx) {
      renderToolEditorSettings(getSpriteById(h.spriteIdx).effect);
      renderSpriteFade(true,h.spriteIdx);
    } else {
      sampleSpriteFade(50, 30, h.spriteIdx);
      processSpriteFade(h.spriteIdx);
    }
  } else {
    layers = h.layers;
    sprites = h.sprites;
  }
}
function doUndo() {
  if (historyIndex===0) return;
  const hType = historyStack[historyIndex].type;
  if (hType==="toggleSprite") {
    if (rendering) return;
    let idx = -1;
    for (let i = sprites.length - 1; i >= 0; i--) {
      if (sprites[i].enabled) { idx = i; break; }
    }
    if (idx === -1) { console.log("Nothing to undo (no enabled sprites)"); return; }
    const sprite = sprites[idx];
    const tr = document.getElementById('spriteTableBody').querySelector(`[data-sprite-id="${sprite.id}"]`);
    const cb = tr.querySelector('input[type="checkbox"]');
    if (cb.checked) cb.click();
    if (iHigh>specWidth) {iHigh = specWidth; updateCanvasScroll();}
    spriteRedoQueue.push(sprite);
    if (playing) {
      stopSource(true);
      playPCM(true);
    }
  } else if (hType==="knob") {
    const h = historyStack[historyIndex];
    h.command(h.knob,h.undoValue);
  } else if (hType==="globalXYTools") {
    const h = historyStack[historyIndex].undo;
    globalXYUpdateLayersAndSprites(h);
    bufferLengthKnob.setValue(h.emptyAudioLength,false);
    emptyAudioLength = bufferLengthKnob.getValue();
    simpleRestartRender(0,Math.floor(emptyAudioLength*sampleRate/hop));
    restartRender(false);
    renderSpritesTable();
  } else if (hType==="eq") {
    eqBands = historyStack[historyIndex].undoeqBands;
    ptsDirty = true;
    updateGlobalGain();
    drawEQ();
  } else {
    historyStack[historyIndex].undo.command();
  }
  historyIndex--;
}
function doRedo() {
  historyIndex++;
  if (historyIndex>=historyStack.length) return;
  const hType = historyStack[historyIndex].type;
  if (hType==="toggleSprite") {
    if (rendering) return;
    let idx = -1;
    for (let i = 0; i < sprites.length; i++) {
      if (!sprites[i].enabled) { idx = i; break; }
    }
    if (idx === -1) { console.log("Nothing to redo (no disabled sprites)"); return; }
    const sprite = sprites[idx];
    const tr = document.getElementById('spriteTableBody').querySelector(`[data-sprite-id="${sprite.id}"]`);
    const cb = tr.querySelector('input[type="checkbox"]');
    if (!cb.checked) cb.click();
    const rqidx = spriteRedoQueue.indexOf(sprite);
    if (rqidx !== -1) spriteRedoQueue.splice(rqidx, 1);
    if (playing) {
      stopSource(true);
      playPCM(true);
    }
  } else if (hType==="knob") {
    const h = historyStack[historyIndex];
    h.command(h.knob,h.redoValue);
  } else if (hType==="globalXYTools") {
    const h = historyStack[historyIndex].redo;
    globalXYUpdateLayersAndSprites(h);
    bufferLengthKnob.setValue(h.emptyAudioLength,false);
    emptyAudioLength = bufferLengthKnob.getValue();
    simpleRestartRender(0,Math.floor(emptyAudioLength*sampleRate/hop));
    restartRender(false);
    renderSpritesTable();
  } else if (hType==="eq") {
    eqBands = historyStack[historyIndex].redoeqBands;
    ptsDirty = true;
    updateGlobalGain();
    drawEQ();
  } else if (hType==="moveSprite") {
    eqBands = historyStack[historyIndex].redoeqBands;
    ptsDirty = true;
    updateGlobalGain();
    drawEQ();
  }
}