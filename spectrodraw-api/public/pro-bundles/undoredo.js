
function recomputePCMForCols(colStart, colEnd, opts = {}) {
  if (!channels || channels.length === 0) {
    console.warn("No channels available.");
    return;
  }

  colStart = Math.max(0, Math.floor(colStart));
  colEnd   = Math.min(specWidth - 1, Math.floor(colEnd));
  if (colEnd < colStart) return;
  
  const marginCols = Math.ceil(fftSize / hop) + 2;
  const colFirst = Math.max(0, colStart - marginCols);
  const colLast  = Math.min(specWidth - 1, colEnd + marginCols);

  const h = specHeight;

  const window = (typeof win !== 'undefined' && win && win.length === fftSize)
                ? win
                : (function buildLocalWin() {
                    const w = new Float32Array(fftSize);
                    for (let i = 0; i < fftSize; i++) w[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (fftSize - 1)));
                    return w;
                  })();

  // Re / Im arrays reused across channels/columns to avoid repeated allocation
  const re = new Float32Array(fftSize);
  const im = new Float32Array(fftSize);

  const EPS = 1e-8;
  const fadeCap = Infinity;

  // Process each channel independently
  for (let ch = 0; ch < channelCount; ch++) {
    const channel = channels[ch];
    if (!channel) continue;
    const pcm = channel.pcm || new Float32Array(0);
    // compute sample range for this channel
    const sampleStart = Math.max(0, colFirst * hop);
    const sampleEnd   = Math.min(pcm.length, (colLast * hop) + fftSize);
    const segmentLen  = sampleEnd - sampleStart;
    if (segmentLen <= 0) continue;

    const newSegment = new Float32Array(segmentLen);
    const overlapCount = new Float32Array(segmentLen);

    // For each spectrogram column in range, build an IFFT frame from mags/phases for this channel
    for (let xCol = colFirst; xCol <= colLast; xCol++) {
      re.fill(0);
      im.fill(0);

      // populate frequency bins from this channel's mags/phases
      for (let bin = 0; bin < h && bin < fftSize; bin++) {
        const idx = xCol * h + bin;
        const mag = (channel.mags && channel.mags[idx]) ? channel.mags[idx] : 0;
        const phase = (channel.phases && channel.phases[idx]) ? channel.phases[idx] : 0;
        re[bin] = mag * Math.cos(phase);
        im[bin] = mag * Math.sin(phase);

        // mirror for negative frequencies (ensure conjugate symmetry)
        if (bin > 0 && bin < fftSize / 2) {
          const sym = fftSize - bin;
          re[sym] = re[bin];
          im[sym] = -im[bin];
        }
      }

      im[0] = 0;
      if (fftSize % 2 === 0) im[fftSize / 2] = 0;

      // perform in-place IFFT (assumes ifft_inplace is available globally)
      ifft_inplace(re, im);

      const baseSample = xCol * hop;
      for (let i = 0; i < fftSize; i++) {
        const globalSample = baseSample + i;
        if (globalSample < sampleStart || globalSample >= sampleEnd) continue;
        const segIndex = globalSample - sampleStart;
        newSegment[segIndex] += re[i] * window[i];
        overlapCount[segIndex] += window[i] * window[i];
      }
    } // end xCol loop

    // normalize overlap
    for (let i = 0; i < segmentLen; i++) {
      if (overlapCount[i] > EPS) newSegment[i] /= overlapCount[i];
      else newSegment[i] = 0;
    }

    // cross-fade edges with old PCM to smooth boundaries
    const oldSegment = pcm.slice(sampleStart, sampleEnd); // length == segmentLen
    const fadeLen = Math.min(Math.max(1, hop), fadeCap, segmentLen);
    for (let i = 0; i < fadeLen; i++) {
      const t = i / fadeLen;
      // start fade
      newSegment[i] = newSegment[i] * t + oldSegment[i] * (1 - t);
      // end fade
      const j = segmentLen - 1 - i;
      if (j >= 0 && j < segmentLen) {
        const oldIdx = oldSegment.length - 1 - i;
        newSegment[j] = newSegment[j] * t + oldSegment[oldIdx] * (1 - t);
      }
    }

    // write back into channel PCM
    channel.pcm.set(newSegment, sampleStart);
    // Re-render the spectrogram columns affected
    renderSpectrogramColumnsToImageBuffer(colFirst, colLast, ch);
  } // end channel loop


  // restart playback if currently playing (playPCM supports multi-channel)
  if (playing) {
    stopSource(true);
    playPCM(true);
  }
}


function renderSpectrogramColumnsToImageBuffer(colStart, colEnd, ch) {
  let mags = channels[ch].mags, phases = channels[ch].phases;
  //console.log(channels[ch]);
  const specCanvas = document.getElementById("spec-"+ch);
  const specCtx = specCanvas.getContext("2d");
  colStart = Math.max(0, Math.floor(colStart));
  colEnd = Math.min(specWidth - 1, Math.floor(colEnd));
  if (!imageBuffer[ch] || !specCtx) return;
  const h = specHeight;
  const w = specWidth;
  for (let xx = colStart; xx <= colEnd; xx++) {
    for (let yy = 0; yy < h; yy++) {
      const bin = displayYToBin(yy, h, ch);
      const idx = xx * h + bin;
      const mag = mags[idx] || 0;
      const phase = phases[idx] || 0;
      const [r,g,b] = magPhaseToRGB(mag, phase);
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

function doUndo() {
  if (rendering) return;
  // find most recent enabled sprite
  let idx = -1;
  for (let i = sprites.length - 1; i >= 0; i--) {
    if (sprites[i].enabled) { idx = i; break; }
  }
  if (idx === -1) { console.log("Nothing to undo (no enabled sprites)"); return; }
  const sprite = sprites[idx];
  let $s = sprite.ch==="all"?0:sprite.ch, $e = sprite.ch==="all"?channelCount:sprite.ch+1;
  for (let ch=$s;ch<$e;ch++){
    let mags = channels[ch].mags, phases = channels[ch].phases;
    console.log("Undoing sprite:", sprite);
    // restore sprite's prev values (iterate left->right, top->bottom)
    forEachSpritePixelInOrder(sprite, ch, (x, y, prevMag, prevPhase) => {
      const id = x * specHeight + y;
      mags[id] = prevMag;
      phases[id] = prevPhase;
    });

    // mark disabled
    sprite.enabled = false;
    renderSpritesTable();
    console.log(sprite);
    // recompute/render only affected columns
    const minCol = Math.max(0, sprite.minCol);
    const maxCol = Math.min(specWidth - 1, sprite.maxCol);
    renderSpectrogramColumnsToImageBuffer(minCol, maxCol,ch);
  }

  recomputePCMForCols(minCol, maxCol);
  //restartRender(false);

  // update UI scroll / view
  if (iHigh>specWidth) {iHigh = specWidth; updateCanvasScroll();}

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

  let $s = sprite.ch==="all"?0:sprite.ch, $e = sprite.ch==="all"?channelCount:sprite.ch+1;
  for (let ch=$s;ch<$e;ch++){
    let mags = channels[ch].mags, phases = channels[ch].phases;

    // apply sprite's recorded "next" values
    forEachSpritePixelInOrder(sprite, ch, (x, y, _prevMag, _prevPhase, nextMag, nextPhase) => {
      const id = x * specHeight + y;
      mags[id] = nextMag;
      phases[id] = nextPhase;
    });

    sprite.enabled = true;
    renderSpritesTable();

    // recompute/render only affected columns
    const minCol = Math.max(0, sprite.minCol);
    const maxCol = Math.min(specWidth - 1, sprite.maxCol);
    renderSpectrogramColumnsToImageBuffer(minCol, maxCol,ch);
  }
  recomputePCMForCols(minCol, maxCol);

  // remove from redo queue if tracked
  const rqidx = spriteRedoQueue.indexOf(sprite);
  if (rqidx !== -1) spriteRedoQueue.splice(rqidx, 1);

  if (playing) {
    stopSource(true);
    playPCM(true);
  }
}