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

    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    const x = (currentCursorX-iLow) * canvas.width / (iHigh-iLow);
    overlayCtx.strokeStyle = "#0f0";
    overlayCtx.lineWidth = framesTotal/500;
    overlayCtx.beginPath();
    overlayCtx.moveTo(x + 0.5, 0);
    overlayCtx.lineTo(x + 0.5, specHeight);
    overlayCtx.stroke();
    
    overlayCtx.strokeStyle = "#fff";
    overlayCtx.lineWidth = Math.max(1, Math.min(4, Math.floor(framesTotal / 500)));

    const hasStart = startX !== null && startY !== null;

    if (currentTool === "rectangle" && hasStart) {
      overlayCtx.strokeRect(startX + 0.5, startY + 0.5, cx - startX, cy - startY);
      return;
    }

    if (currentTool === "line" && hasStart) {
      overlayCtx.beginPath();
      overlayCtx.moveTo(startX + 0.5, startY + 0.5);
      overlayCtx.lineTo(cx + 0.5, cy + 0.5);
      overlayCtx.stroke();
      return;
    }

    // Precompute scaling info (used by both "image" and ellipse)
    const rect = canvas.getBoundingClientRect();
    const pixelsPerFrame = rect.width / Math.max(1, canvas.width);
    const pixelsPerBin   = rect.height / Math.max(1, canvas.height);
    const desiredScreenMax = brushSize * 4;

    if (currentTool === "image" && overlayImage) {
      const { width: imgW, height: imgH } = overlayImage;
      const imgAspect = imgW / imgH;

      // screen-space size
      const screenW = imgW >= imgH ? desiredScreenMax : Math.round(desiredScreenMax * imgAspect);
      const screenH = imgW >= imgH ? Math.round(desiredScreenMax / imgAspect) : desiredScreenMax;

      // convert to canvas space
      const overlayW = Math.max(1, Math.round(screenW / pixelsPerFrame));
      const overlayH = Math.max(1, Math.round(screenH / pixelsPerBin));

      overlayCtx.strokeRect(cx - overlayW / 2, cy - overlayH / 2, overlayW, overlayH);
      return;
    }

    // Default = ellipse
    const radiusX = (desiredScreenMax / 7) / pixelsPerFrame;
    const radiusY = desiredScreenMax / 7 / pixelsPerBin;

    overlayCtx.beginPath();
    overlayCtx.ellipse(cx, cy, radiusX, radiusY, 0, 0, 2 * Math.PI);
    overlayCtx.stroke();
  });
}

function commitShape(cx, cy) {
    if (!mags || !phases) return;

    const fullW = specWidth;
    const fullH = specHeight;
    const bo = brushOpacity;
    const po = phaseOpacity;
    const brushMag = (brushColor / 255) * 128;
    const brushPhase = penPhase;

    function drawPixelIntFrame(xFrame, yDisplay, mag, phase, bo, po) {
        const xI = Math.round(xFrame);
        const yI = Math.round(yDisplay);
        if (xI < 0 || xI >= fullW || yI < 0 || yI >= fullH) return;
        const bin = displayYToBin(yI, fullH);
        const idx = xI * fullH + bin;
        if (idx < 0 || idx >= mags.length) return;
        const oldMag = mags[idx] || 0;
        const oldPhase = phases[idx] || 0;
        const newMag = oldMag * (1 - bo) + mag * bo;
        const newPhase = oldPhase + po * (phase - oldPhase);
        mags[idx] = newMag;
        phases[idx] = newPhase;
        const displayY = binToDisplayY(bin, fullH);
        const pix = (displayY * fullW + xI) * 4;
        const [r, g, b] = magPhaseToRGB(newMag, newPhase);
        imageBuffer.data[pix]     = r;
        imageBuffer.data[pix + 1] = g;
        imageBuffer.data[pix + 2] = b;
        imageBuffer.data[pix + 3] = 255;
    }

    const startVisX = (startX === null ? cx : startX);
    const startVisY = (startY === null ? cy : startY);

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
        const minY = y0Spec;
        const maxY = y1Spec;
        for (let yy = minY; yy <= maxY; yy++) {
            for (let xx = minX; xx <= maxX; xx++) {
                drawPixelIntFrame(xx, yy, brushMag, brushPhase, bo, po);
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

        while (true) {
            drawPixelIntFrame(x0, y0, brushMag, brushPhase, bo, po);
            if (x0 === x1 && y0 === y1) break;
            const e2 = err;
            if (e2 > -dx) { err -= dy; x0 += sx; }
            if (e2 < dy)  { err += dx; y0 += sy; }
        }
    }

    specCtx.putImageData(imageBuffer, 0, 0);
    renderView();
}

function paint(cx, cy, scaleX, scaleY, startX_vis, startY_vis) {
    if (!mags || !phases) return;

    const fullW = specWidth;
    const fullH = specHeight;
    const po = currentTool === "eraser" ? 1 : phaseOpacity;
    const bo = currentTool === "eraser" ? 1 : brushOpacity;
    function drawPixelFrame(xFrame, yDisplay, mag, phase, bo, po) {
        const xI = Math.round(xFrame);
        const yI = Math.round(yDisplay);
        if (xI < 0 || xI >= fullW || yI < 0 || yI >= fullH) return;
        const bin = displayYToBin(yI, fullH);
        const idx = xI * fullH + bin;
        if (idx < 0 || idx >= mags.length) return;
        if (visited && visited[idx] == 1) return;
        if (visited) visited[idx] = 1;
        const oldMag = mags[idx] || 0;
        const oldPhase = phases[idx] || 0;
        const newMag = (currentTool==="amplifier")?(oldMag*(mag/64 * bo)):(oldMag * (1 - bo) + mag * bo);
        const newPhase = oldPhase + po * (phase - oldPhase);
        mags[idx] = Math.min(newMag,255);
        phases[idx] = newPhase;
        const displayY = binToDisplayY(bin, fullH);
        const pix = (displayY * fullW + xI) * 4;
        const [r, g, b] = magPhaseToRGB(newMag, newPhase);
        imageBuffer.data[pix] = r;
        imageBuffer.data[pix + 1] = g;
        imageBuffer.data[pix + 2] = b;
        imageBuffer.data[pix + 3] = 255;
    }
    const radiusY = brushSize *(fWidth/(sampleRate/2));
    const rect = canvas.getBoundingClientRect();
    const radiusXFrames = Math.floor(radiusY * iWidth / 512/2/(rect.width/rect.height));
    if (currentTool === "brush" || currentTool === "eraser" || currentTool === "amplifier") {

        const minXFrame = Math.max(0, Math.floor(cx - radiusXFrames));
        const maxXFrame = Math.min(fullW - 1, Math.ceil(cx + radiusXFrames));
        const minY = Math.max(0, Math.floor(cy - radiusY*(fftSize/2048)));
        const maxY = Math.min(fullH - 1, Math.ceil(cy + radiusY*(fftSize/2048)));

        const brushMag = currentTool === "eraser" ? 0 : (brushColor / 255) * 128;
        const brushPhase = currentTool === "eraser" ? 0 : penPhase;

        for (let yy = minY; yy <= maxY; yy++) {
            for (let xx = minXFrame; xx <= maxXFrame; xx++) {
                const dx = xx - cx;
                const dy = yy - cy;

                if ((dx * dx) / (radiusXFrames * radiusXFrames) + (dy * dy) / Math.pow(radiusY*(fftSize/2048),2) > 1) continue;
                drawPixelFrame(xx, yy, brushMag, brushPhase, bo, po);
            }
        }
    } else if (currentTool === "blur") {
        const radius = brushSize;

        const minXFrame = Math.max(0, Math.floor(cx - radiusXFrames));
        const maxXFrame = Math.min(fullW - 1, Math.ceil(cx + radiusXFrames));
        const minY = Math.max(0, Math.floor(cy - radiusY*(fftSize/2048)));
        const maxY = Math.min(fullH - 1, Math.ceil(cy + radiusY*(fftSize/2048)));

        for (let yy = minY; yy <= maxY; yy++) {
            for (let xx = minXFrame; xx <= maxXFrame; xx++) {
                const dx = xx - cx;
                const dy = yy - cy;
                if ((dx * dx) / (radiusXFrames * radiusXFrames) + (dy * dy) / Math.pow(radiusY*(fftSize/2048),2) > 1) continue;
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