function syncOverlaySize() {
  overlayCanvas.width = canvas.width;
  overlayCanvas.style.width = canvas.style.width;
  overlayCanvas.height = canvas.height;
  overlayCanvas.style.height = canvas.style.height;
}

let pendingPreview = false;
let lastPreviewCoords = null;
// Build summed-area (integral) tables for mags and phases.
// Note: this builds for the whole image. If you want a smaller memory/time footprint,
// you can adapt to only build for a bounding rectangle (see notes below).
function buildIntegral(fullW, fullH, magsArr, phasesArr) {
  const W = fullW, H = fullH;
  const iw = W + 1; // stride in x direction for integral indexing
  const ih = H + 1; // stride in y direction; we'll use index = x*ih + y
  const size = iw * ih;
  const intMag = new Float64Array(size);
  const intPhase = new Float64Array(size);

  // integral origin (0,*) and (*,0) are zeros already
  for (let x = 1; x <= W; x++) {
    const srcX = x - 1;
    const baseSrc = srcX * H;
    const baseIntX = x * ih;
    const baseIntXminus1 = (x - 1) * ih;
    for (let y = 1; y <= H; y++) {
      const srcY = y - 1;
      const vMag = magsArr[baseSrc + srcY] || 0;
      const vPhase = phasesArr[baseSrc + srcY] || 0;
      // standard 2D integral recurrence
      const idx = baseIntX + y;
      intMag[idx] = vMag + intMag[baseIntXminus1 + y] + intMag[baseIntX + (y - 1)] - intMag[baseIntXminus1 + (y - 1)];
      intPhase[idx] = vPhase + intPhase[baseIntXminus1 + y] + intPhase[baseIntX + (y - 1)] - intPhase[baseIntXminus1 + (y - 1)];
    }
  }

  return { intMag, intPhase, iw, ih, W, H };
}

// Query box sum (inclusive coordinates) using integral tables.
// x0..x1 and y0..y1 are inclusive and in the same coordinate system as mags (x in [0..W-1], y in [0..H-1]).
function queryIntegralSum(integral, x0, y0, x1, y1) {
  const { intMag, intPhase, ih } = integral;
  // convert to integral indices (shift by +1)
  const sx0 = x0 + 1, sy0 = y0 + 1, sx1 = x1 + 1, sy1 = y1 + 1;
  const idxA = sx1 * ih + sy1;
  const idxB = (sx0 - 1) * ih + sy1;
  const idxC = sx1 * ih + (sy0 - 1);
  const idxD = (sx0 - 1) * ih + (sy0 - 1);
  const sumMag = intMag[idxA] - intMag[idxB] - intMag[idxC] + intMag[idxD];
  const sumPhase = intPhase[idxA] - intPhase[idxB] - intPhase[idxC] + intPhase[idxD];
  return { sumMag, sumPhase };
}

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

    if (currentShape === "rectangle" && hasStart) {
      ctx.strokeRect(startX + 0.5, startY + 0.5, cx - startX, cy - startY);
      ctx.restore();
      return;
    }

    if (currentShape === "line" && hasStart) {
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

    if (currentShape === "image" && overlayImage) {
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

    if (currentShape === "brush") {
      const radiusX = (desiredScreenMax / 7) / pixelsPerFrame;
      const radiusY = (desiredScreenMax / 7) / pixelsPerBin;
      ctx.beginPath();
      ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // drawCursor(false);
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
  const dbt = Math.pow(10, noiseRemoveFloor / 20)*128;

  // optional pitch-align (keep this branch but hoist helpers)
  let displayYFloat = yDisplay;
  const f = getSineFreq(yDisplay);
  if (alignPitch) {
    let nearestPitch = Math.round(npo * Math.log2(f / startOnP));
    nearestPitch = startOnP * Math.pow(2, nearestPitch / npo);
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
                 ? (oldMag * amp)
                 : (currentTool === "noiseRemover")
                 ? (oldMag > dbt?oldMag:0)
                 :(oldMag * (1 - bo) + mag * bo);
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
  const po = currentTool === "eraser" ? 1 : phaseOpacity;
  const bo = currentTool === "eraser" ? 1 : brushOpacity;
  const brushMag = currentTool === "eraser" ? 0 : (brushColor / 255) * 128;
  const brushPhase = currentTool === "eraser" ? 0 : penPhase;

  const visitedLocal = new Uint8Array(fullW * fullH);
  const savedVisited = visited;
  visited = visitedLocal;
  let integral = null;
  if (currentTool === "blur") {
    // You can instead compute a sub-rectangle bounding box and build integral only for that
    // to save time/memory. For simplicity we build full-image integral here:
    integral = buildIntegral(fullW, fullH, mags, phases);
  }
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

    function dp(xFrame, yDisplay, mag, phase, bo, po){
      if (currentTool === "blur") {
        // map displayY to the nearest bin once
        const binCenter = Math.round(displayYToBin(yDisplay, fullH));
        const r = blurRadius | 0;
        const x0 = Math.max(0, xFrame - r);
        const x1 = Math.min(fullW - 1, xFrame + r);
        const y0 = Math.max(0, binCenter - r);
        const y1 = Math.min(fullH - 1, binCenter + r);

        const { sumMag, sumPhase } = queryIntegralSum(integral, x0, y0, x1, y1);
        const count = (x1 - x0 + 1) * (y1 - y0 + 1) || 1;
        drawPixelFrame(xFrame, yDisplay, sumMag / count, sumPhase / count, bo, po);
      } else {
        drawPixelFrame(xFrame, yDisplay, mag, phase, bo, po);
      }
    }

    if (currentShape === "rectangle") {

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
          dp(xx, displayY, brushMag, brushPhase, bo, po);
        }
      }

    } else if (currentShape === "line") {
      let x0=startFrame;x1=endFrame;
      const startWasLeft = (x0Frame <= x1Frame);
      let yStartSpec = startSpecY;
      let yEndSpec   = endSpecY;
      const brushMag = (brushColor / 255) * 128;

      x0 = Math.max(0, Math.min(specWidth - 1, Math.round(x0)));
      x1 = Math.max(0, Math.min(specWidth - 1, Math.round(x1)));
      let y0 = Math.max(0, Math.min(specHeight - 1, Math.round(yStartSpec)));
      let y1 = Math.max(0, Math.min(specHeight - 1, Math.round(yEndSpec)));

      const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
      const dy = Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
      let err = (dx > dy ? dx : -dy) / 2;

      const half = Math.floor(brushSize / 8);

      while (true) {
          for (let dx = -half; dx <= half; dx++) {
            const px = x0 + dx;
            const py = y0;
            if (px >= 0 && px < specWidth && py >= 0 && py < specHeight) {
              dp(px, py, brushMag, penPhase, brushOpacity, phaseOpacity); 
            }
          }
          if (x0 === x1 && y0 === y1) break;
          const e2 = err;
          if (e2 > -dx) { err -= dy; x0 += sx; }
          if (e2 < dy)  { err += dx; y0 += sy; }
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
    const scaleY = fftSize/2*Math.min(canvas.parentElement.clientWidth/framesTotal, (window.innerHeight - 110) / Math.floor(fftSize / 2), 1);
    const bothRatio = (window.innerHeight - 110)/scaleY;
    const XRatio = trueScaleVal? canvas.getBoundingClientRect().width/scaleY:document.getElementById("canvasWrapper").offsetWidth/(window.innerHeight - 110);
    const radiusY = brushSize *(fWidth/(sampleRate/2))*bothRatio;
    const radiusXFrames = Math.floor(brushSize * iWidth / 1024/XRatio)*bothRatio;
    const minXFrame = Math.max(0, Math.floor(cx - radiusXFrames));
    const maxXFrame = Math.min(fullW - 1, Math.ceil(cx + radiusXFrames));
    const minY = Math.max(0, Math.floor(cy - radiusY*(fftSize/2048)));
    const maxY = Math.min(fullH - 1, Math.ceil(cy + radiusY*(fftSize/2048)));
    const radiusYpix = radiusY * (fftSize / 2048);
    const radiusXsq = radiusXFrames * radiusXFrames;
    const radiusYsq = radiusYpix * radiusYpix;
    if (currentShape === "image" && overlayImage) {
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
    } else if (currentTool === "color" || currentTool === "eraser" || currentTool === "amplifier" || currentTool === "noiseRemover") {
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
        // Build integral for whole image (or a bounding region) once
        const integral = buildIntegral(fullW, fullH, mags, phases);
        for (let yy = minY; yy <= maxY; yy++) {
            for (let xx = minXFrame; xx <= maxXFrame; xx++) {
                const dx = xx - cx;
                const dy = yy - cy;
                if ((dx * dx) / radiusXsq + (dy * dy) / radiusYsq > 1) continue;

                // map display Y to bin center (rounded)
                const binCenter = Math.round(displayYToBin(yy, fullH));
                const r = blurRadius | 0;
                const x0 = Math.max(0, xx - r);
                const x1 = Math.min(fullW - 1, xx + r);
                const y0 = Math.max(0, binCenter - r);
                const y1 = Math.min(fullH - 1, binCenter + r);

                const { sumMag, sumPhase } = queryIntegralSum(integral, x0, y0, x1, y1);
                const count = (x1 - x0 + 1) * (y1 - y0 + 1) || 1;
                drawPixelFrame(xx, yy, sumMag / count, sumPhase / count, bo, po);
            }
        }
    }
    specCtx.putImageData(imageBuffer, 0, 0);
    renderView();
}