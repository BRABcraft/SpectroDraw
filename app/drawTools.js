function syncOverlaySize() {
  overlayCanvas.width = canvas.width;
  overlayCanvas.style.width = canvas.style.width;
  overlayCanvas.height = canvas.height;
  overlayCanvas.style.height = canvas.style.height;
}

let pendingPreview = false;
let lastPreviewCoords = null;

function previewShape(cx, cy) {
  lastPreviewCoords = { cx, cy };
  if (pendingPreview) return;
  pendingPreview = true;

  requestAnimationFrame(() => {
    pendingPreview = false;
    const { cx, cy } = lastPreviewCoords;
    const ctx = overlayCtx; // local ref

    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    const x = (currentCursorX - iLow) * canvas.width / (iHigh - iLow);
    // vertical guide
    ctx.save();
    ctx.strokeStyle = "#0f0";
    ctx.lineWidth = framesTotal / 500;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, specHeight);
    ctx.stroke();

    ctx.strokeStyle = "#fff";
    ctx.lineWidth = Math.max(1, Math.min(4, Math.floor(framesTotal / 500)));

    const hasStart = startX !== null && startY !== null;

    if (currentTool === "rectangle" && hasStart) {
      ctx.strokeRect(startX + 0.5, startY + 0.5, cx - startX, cy - startY);
      ctx.restore();
      return;
    }

    if (currentTool === "line" && hasStart) {
      ctx.lineWidth = brushSize / 4;
      ctx.beginPath();
      ctx.moveTo(startX + 0.5, startY + 0.5);
      ctx.lineTo(cx + 0.5, cy + 0.5);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // compute expensive rect stuff only if needed (image or ellipse)
    const rect = canvas.getBoundingClientRect();
    const pixelsPerFrame = rect.width  / Math.max(1, canvas.width);
    const pixelsPerBin   = rect.height / Math.max(1, canvas.height);
    const desiredScreenMax = brushSize * 4;

    if (currentTool === "image" && overlayImage) {
      const imgW = overlayImage.width;
      const imgH = overlayImage.height;
      const imgAspect = imgW / imgH;
      let screenW, screenH;
      if (imgW >= imgH) {
        screenW = desiredScreenMax;
        screenH = Math.max(1, Math.round(desiredScreenMax / imgAspect));
      } else {
        screenH = desiredScreenMax;
        screenW = Math.max(1, Math.round(desiredScreenMax * imgAspect));
      }
      overlayW = Math.max(1, Math.round(screenW / pixelsPerFrame));
      overlayH = Math.max(1, Math.round(screenH / pixelsPerBin));
      ctx.strokeRect(cx - overlayW / 2, cy - overlayH / 2, overlayW, overlayH);
      ctx.restore();
      return;
    }

    const radiusX = (desiredScreenMax / 7) / pixelsPerFrame;
    const radiusY = (desiredScreenMax / 7) / pixelsPerBin;
    ctx.beginPath();
    ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.restore();
    drawCursor(false);
  });
}


function line(startFrame, endFrame, startSpecY, endSpecY, lineWidth) {
  let x0 = (startFrame <= endFrame) ? startFrame : endFrame;
  let x1 = (startFrame <= endFrame) ? endFrame : startFrame;
  const startWasLeft = (startFrame <= endFrame);
  let yStartSpec = startWasLeft ? startSpecY : endSpecY;
  let yEndSpec   = startWasLeft ? endSpecY   : startSpecY;
  const brushMag = (brushColor / 255) * 128;

  x0 = Math.max(0, Math.min(specWidth - 1, Math.round(x0)));
  x1 = Math.max(0, Math.min(specWidth - 1, Math.round(x1)));
  let y0 = Math.max(0, Math.min(specHeight - 1, Math.round(yStartSpec)));
  let y1 = Math.max(0, Math.min(specHeight - 1, Math.round(yEndSpec)));

  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = (dx > dy ? dx : -dy) / 2;

  const half = Math.floor(lineWidth / 2);

 while (true) {
    for (let dy = -half; dy <= half; dy++) {
      const px = x0;
      const py = y0 + dy;
      if (px >= 0 && px < specWidth && py >= 0 && py < specHeight) {
        drawPixelFrame(px, py, brushMag, penPhase, brushOpacity, phaseOpacity); 
      }
    }
    if (x0 === x1 && y0 === y1) break;
    const e2 = err;
    if (e2 > -dx) { err -= dy; x0 += sx; }
    if (e2 < dy)  { err += dx; y0 += sy; }
  }
}

// call when spectrogram parameters change:
let binToTopDisplay = null;
let binToBottomDisplay = null;
function buildBinDisplayLookup() {
  binToTopDisplay = new Float32Array(specHeight);
  binToBottomDisplay = new Float32Array(specHeight);
  for (let b = 0; b < specHeight; b++) {
    binToTopDisplay[b] = binToDisplayY(b - 0.5, specHeight);
    binToBottomDisplay[b] = binToDisplayY(b + 0.5, specHeight);
  }
}

function drawPixelFrame(xFrame, yDisplay, mag, phase, bo, po) {
  const xI = (xFrame + 0.5) | 0;
  if (xI < 0 || xI >= specWidth) return;

  // locals for perf
  const fullH = specHeight;
  const fullW = specWidth;
  const magsArr = mags;
  const phasesArr = phases;
  const imgData = imageBuffer.data;
  const width = fullW;
  const height = fullH;
  const idxBase = xI * fullH;

  // optional pitch-align (keep this branch but hoist helpers)
  let displayYFloat = yDisplay;
  const f = getSineFreq(yDisplay);
  if (alignPitch) {
    let nearestPitch = Math.round(npo * Math.log2(f / a4p));
    nearestPitch = a4p * Math.pow(2, nearestPitch / npo);
    displayYFloat = ftvsy(nearestPitch);
  }

  // get float bin boundaries using lookup tables
  const topBinF = displayYToBin(displayYFloat - 0.5, fullH);
  const botBinF = displayYToBin(displayYFloat + 0.5, fullH);

  let binStart = Math.floor(Math.min(topBinF, botBinF));
  let binEnd   = Math.ceil (Math.max(topBinF, botBinF));
  if (!Number.isFinite(binStart)) binStart = 0;
  if (!Number.isFinite(binEnd))   binEnd   = 0;
  if (binStart < 0) binStart = 0;
  if (binEnd > fullH - 1) binEnd = fullH - 1;

  for (let bin = binStart; bin <= binEnd; bin++) {
    const idx = idxBase + bin;
    // bounds check not needed if idxBase/bin clamped, but keep safe:
    if (idx < 0 || idx >= magsArr.length) continue;
    if (visited && visited[idx] === 1) continue;
    if (visited) visited[idx] = 1;
    
    let pd = (bin%2<1)?1:1-po;

    const oldMag = magsArr[idx] || 0;
    const oldPhase = phasesArr[idx] || 0;
    const newMag = (currentTool === "amplifier")
                 ? (oldMag * (mag / 64 * bo))
                 : (oldMag * (1 - bo) + mag * bo);
    const type = phaseTextureEl.value;
    let $phase;
    if (type === 'Harmonics') {
      $phase = (bin / specHeight * fftSize / 2);
    } else if (type === 'Static') {
      $phase = Math.random()*Math.PI;
    } else if (type === 'Flat') {
      $phase = phase;
    }
    const newPhase = oldPhase * (1-po) + po * ($phase + phase*2);
    const clampedMag = Math.min(newMag, 255);
    magsArr[idx] = clampedMag;
    phasesArr[idx] = newPhase;

    // use lookup tables to avoid recomputing bin->display bounds
    const yTopF = binToTopDisplay[bin];
    const yBotF = binToBottomDisplay[bin];
    const yStart = Math.max(0, Math.floor(Math.min(yTopF, yBotF)));
    const yEnd   = Math.min(fullH - 1, Math.ceil(Math.max(yTopF, yBotF)));

    // RGB conversion - this may still be expensive; could cache per (idx) or per mag/phase pair
    const [r, g, b] = magPhaseToRGB(clampedMag, newPhase);

    // write rows
    for (let yPixel = yStart; yPixel <= yEnd; yPixel++) {
      const pix = (yPixel * width + xI) * 4;
      imgData[pix]     = r;
      imgData[pix + 1] = g;
      imgData[pix + 2] = b;
      imgData[pix + 3] = 255;
    }
  }
}


function commitShape(cx, cy) {
  if (!mags || !phases) return;

  const fullW = specWidth;
  const fullH = specHeight;
  const bo = brushOpacity;
  const po = phaseOpacity;
  const brushMag = (brushColor / 255) * 128;
  const brushPhase = penPhase;

  const visitedLocal = new Uint8Array(fullW * fullH);
  const savedVisited = visited;
  visited = visitedLocal;

  try {
    const startVisX = (startX == null ? cx : startX);
    const startVisY = (startY == null ? cy : startY);

    const startFrame = Math.round(startVisX + (iLow || 0));
    const endFrame   = Math.round(cx + (iLow || 0));
    let x0Frame = Math.max(0, Math.min(fullW - 1, Math.min(startFrame, endFrame)));
    let x1Frame = Math.max(0, Math.min(fullW - 1, Math.max(startFrame, endFrame)));

    const startSpecY = visibleToSpecY(startVisY);
    const endSpecY   = visibleToSpecY(cy);
    let y0Spec = Math.max(0, Math.min(fullH - 1, Math.min(startSpecY, endSpecY)));
    let y1Spec = Math.max(0, Math.min(fullH - 1, Math.max(startSpecY, endSpecY)));

    if (currentTool === "rectangle") {

      const minX = x0Frame;
      const maxX = x1Frame;

      let binA = displayYToBin(y0Spec, fullH);
      let binB = displayYToBin(y1Spec, fullH);
      if (binA > binB) { const t = binA; binA = binB; binB = t; }

      binA = Math.max(0, Math.min(fullH - 1, Math.round(binA)));
      binB = Math.max(0, Math.min(fullH - 1, Math.round(binB)));

      for (let xx = minX; xx <= maxX; xx++) {

        for (let bin = binA; bin <= binB; bin++) {
          const displayY = binToDisplayY(bin, fullH);
          drawPixelFrame(xx, displayY, brushMag, brushPhase, bo, po);
        }
      }

    } else if (currentTool === "line") {

      let x0 = (startFrame <= endFrame) ? startFrame : endFrame;
      let x1 = (startFrame <= endFrame) ? endFrame : startFrame;
      const startWasLeft = (startFrame <= endFrame);
      let yStartSpec = startWasLeft ? startSpecY : endSpecY;
      let yEndSpec   = startWasLeft ? endSpecY   : startSpecY;

      x0 = Math.max(0, Math.min(fullW - 1, Math.round(x0)));
      x1 = Math.max(0, Math.min(fullW - 1, Math.round(x1)));
      let y0 = Math.max(0, Math.min(fullH - 1, Math.round(yStartSpec)));
      let y1 = Math.max(0, Math.min(fullH - 1, Math.round(yEndSpec)));

      const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
      const dy = Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
      let err = (dx > dy ? dx : -dy) / 2;

      let prevBin = displayYToBin(y0, fullH);

      while (true) {
        const curBin = displayYToBin(y0, fullH);

        if (prevBin <= curBin) {
          for (let b = prevBin; b <= curBin; b++) {
            drawPixelFrame(x0, binToDisplayY(b, fullH), brushMag, brushPhase, bo, po);
          }
        } else {
          for (let b = prevBin; b >= curBin; b--) {
            drawPixelFrame(x0, binToDisplayY(b, fullH), brushMag, brushPhase, bo, po);
          }
        }

        if (x0 === x1 && y0 === y1) break;
        const e2 = err;
        if (e2 > -dx) { err -= dy; x0 += sx; }
        if (e2 <  dy) { err += dx; y0 += sy; }

        prevBin = curBin;
      }
    }

  } finally {

    visited = savedVisited;
  }

  specCtx.putImageData(imageBuffer, 0, 0);
  renderView();
}

function ftvsy(f) {
  const h = specHeight;
  const s = parseFloat(logScaleVal);
  let bin = f / (sampleRate / fftSize);
  let cy;
  if (s <= 1.0000001) {
      cy = h - 1 - bin;
  } else {
      const a = s - 1;
      const denom = Math.log(1 + a * (h - 1));
      const t = Math.log(1 + a * bin) / denom;
      cy = (1 - t) * (h - 1);
  }

  const visY = ((cy) / h) * h;

  return visY;
}
function paint(cx, cy) {
    if (!mags || !phases) return;

    const fullW = specWidth;
    const fullH = specHeight;
    const po = currentTool === "eraser" ? 1 : phaseOpacity;
    const bo = currentTool === "eraser" ? 1 : brushOpacity;
    const radiusY = brushSize *(fWidth/(sampleRate/2));
    const rect = canvas.getBoundingClientRect();
    const radiusXFrames = Math.floor(radiusY * iWidth / 512/2/(rect.width/rect.height));
    const minXFrame = Math.max(0, Math.floor(cx - radiusXFrames));
    const maxXFrame = Math.min(fullW - 1, Math.ceil(cx + radiusXFrames));
    const minY = Math.max(0, Math.floor(cy - radiusY*(fftSize/2048)));
    const maxY = Math.min(fullH - 1, Math.ceil(cy + radiusY*(fftSize/2048)));
    const radiusYpix = radiusY * (fftSize / 2048);
    const radiusXsq = radiusXFrames * radiusXFrames;
    const radiusYsq = radiusYpix * radiusYpix;
    if (currentTool === "brush" || currentTool === "eraser" || currentTool === "amplifier") {

        const brushMag = currentTool === "eraser" ? 0 : (brushColor / 255) * 128;
        const brushPhase = currentTool === "eraser" ? 0 : penPhase;
        for (let yy = minY; yy <= maxY; yy++) {
          for (let xx = minXFrame; xx <= maxXFrame; xx++) {
              const dx = xx - cx;
              const dy = yy - cy;
              if ((dx * dx) / radiusXsq + (dy * dy) / radiusYsq > 1) continue;
              drawPixelFrame(xx, yy, brushMag, brushPhase, bo, po);
          }
      } 
    } else if (currentTool === "blur") {
        for (let yy = minY; yy <= maxY; yy++) {
            for (let xx = minXFrame; xx <= maxXFrame; xx++) {
                const dx = xx - cx;
                const dy = yy - cy;
                if ((dx * dx) / radiusXsq + (dy * dy) / radiusYsq > 1) continue;
                let sumMag = 0, sumPhase = 0, count = 0;
                for (let oy = -1; oy <= 1; oy++) {
                    for (let ox = -1; ox <= 1; ox++) {
                        const nx = xx + ox, ny = yy + oy;
                        if (nx < 0 || ny < 0 || nx >= fullW || ny >= fullH) continue;
                        const nidx = nx * fullH + displayYToBin(ny, fullH);
                        sumMag += mags[nidx] || 0;
                        sumPhase += phases[nidx] || 0;
                        count++;
                    }
                }
                if (count > 0) drawPixelFrame(xx, yy, sumMag / count, sumPhase / count, bo, po);
            }
        }
    } else if (currentTool === "image" && overlayImage) {
      const screenSpace = true;
      const rect = canvas.getBoundingClientRect();
      const pixelsPerFrame = rect.width  / Math.max(1, canvas.width);
      const pixelsPerBin   = rect.height / Math.max(1, canvas.height);
      const desiredScreenMax = brushSize * 4;
      const imgW = overlayImage.width;
      const imgH = overlayImage.height;
      const imgAspect = imgW / imgH;
      let screenW, screenH;
      if (imgW >= imgH) {
        screenW = desiredScreenMax;
        screenH = Math.max(1, Math.round(desiredScreenMax / imgAspect));
      } else {
        screenH = desiredScreenMax;
        screenW = Math.max(1, Math.round(desiredScreenMax * imgAspect));
      }
      let overlayW, overlayH;
      if (screenSpace) {
        overlayW = Math.max(1, Math.round(screenW / pixelsPerFrame));
        overlayH = Math.max(1, Math.round(screenH / pixelsPerBin));
      } else {
        overlayH = Math.max(1, Math.round(brushSize));
        overlayW = Math.max(1, Math.round(overlayH * imgAspect));
      }
      const ox = Math.floor(cx - overlayW / 2);
      const oy = Math.floor(cy - overlayH / 2);
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = overlayW;
      tempCanvas.height = overlayH;
      const tctx = tempCanvas.getContext("2d");
      tctx.imageSmoothingEnabled = false;
      tctx.drawImage(overlayImage, 0, 0, overlayW, overlayH);
      const imgData = tctx.getImageData(0, 0, overlayW, overlayH);
      for (let yy = 0; yy < overlayH; yy++) {
        for (let xx = 0; xx < overlayW; xx++) {
          const pix = (yy * overlayW + xx) * 4;
          const r = imgData.data[pix];
          const g = imgData.data[pix + 1];
          const b = imgData.data[pix + 2];
          const a = imgData.data[pix + 3] / 255;
          if (a <= 0) continue; 
          const [mag, phase] = rgbToMagPhase(r, g, b);
          const cxPix = ox + xx;
          const cyPix = oy + yy;
          if (cxPix >= 0 && cyPix >= 0 && cxPix < fullW && cyPix < fullH) {

            drawPixelFrame(cxPix, cyPix, mag, phase, brushOpacity * a, phaseOpacity * a);
          }
        }
      }
    }
    specCtx.putImageData(imageBuffer, 0, 0);
    renderView();
}