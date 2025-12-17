// Helper: draw an HTMLImageElement into spectrogram pixels for channel `ch`.
// - img: HTMLImageElement (must be loaded)
// - dstOx, dstOy: destination top-left in spectrogram (canvas) units
// - dstW, dstH: destination width/height in spectrogram (canvas) units
// boMult / poMult: optional multipliers to further scale bo/po (default 1)
function applyImageToChannel(ch, img, dstOx, dstOy, dstW, dstH, boMult = 1, poMult = 1) {
  if (!img || !img.complete || img.naturalWidth === 0) return;
  const fullW = specWidth;
  const fullH = specHeight;

  // Clip destination to spectrogram bounds
  const ox = Math.floor(dstOx);
  const oy = Math.floor(dstOy);
  const drawW = Math.max(0, Math.min(fullW - ox, Math.max(0, Math.round(dstW))));
  const drawH = Math.max(0, Math.min(fullH - oy, Math.max(0, Math.round(dstH))));
  if (drawW <= 0 || drawH <= 0) return;

  // Create temp canvas sized to the portion we are going to write (canvas units == spectrogram cells)
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = drawW;
  tempCanvas.height = drawH;
  const tctx = tempCanvas.getContext("2d");
  tctx.imageSmoothingEnabled = false;

  // Draw the whole source image scaled into drawW x drawH.
  // This mirrors the commitShape approach: scale the full stamp/image into the target rectangle.
  tctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, drawW, drawH);
  const imgData = tctx.getImageData(0, 0, drawW, drawH);

  // Loop pixels and push into spectrogram via drawPixel, applying brushOpacity & phaseOpacity
  const chPressure = (channels[ch] && channels[ch].brushPressure) ? channels[ch].brushPressure : 1;
  for (let yy = 0; yy < drawH; yy++) {
    for (let xx = 0; xx < drawW; xx++) {
      const pix = (yy * drawW + xx) * 4;
      const r = imgData.data[pix];
      const g = imgData.data[pix + 1];
      const b = imgData.data[pix + 2];
      const a = imgData.data[pix + 3] / 255;
      if (a <= 0) continue;
      const [mag, phase] = (currentTool==="eraser")?[0,0]:rgbToMagPhase(r, g, b);
      const cxPix = ox + xx;
      const cyPix = oy + yy;
      if (cxPix >= 0 && cyPix >= 0 && cxPix < fullW && cyPix < fullH) {
        const bo = brushOpacity * a * chPressure * boMult;
        const po = phaseOpacity * a * poMult;
        drawPixel(cxPix, cyPix, mag, phase, bo, po, ch);
      }
    }
  }
}

function syncOverlaySize(canvas,overlay) {
  overlay.width  = canvas.width;
  overlay.height = canvas.height;
  overlay.style.width  = canvas.style.width;
  overlay.style.height = canvas.style.height;
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

function drawSpriteOutline(useDelta,cx,cy){
  let $s = spritePath.ch==="all"?0:spritePath.ch, $e = spritePath.ch==="all"?channelCount:spritePath.ch+1;
  for (let ch=$s;ch<$e;ch++){
    const overlayCanvas = document.getElementById("overlay-"+ch);
    const canvas = document.getElementById("canvas-"+ch);
    const overlayCtx = overlayCanvas.getContext("2d");
    const framesVisible = Math.max(1, iHigh - iLow);
    const mapX = (frameX) => ((frameX - iLow) * canvas.width) / framesVisible;
    const mapY = (binY)   => (binY * canvas.height) / Math.max(1, specHeight);

    const pts = spritePath.points.map(p => ({ x: mapX(p.x), y: mapY(p.y) }));
    // Draw filled translucent shape + stroke
    const ctx = overlayCtx;
    ctx.save();
    ctx.beginPath();
    let dx = useDelta?(0.5 + (cx-startX)):0, dy = useDelta?(0.5+(cy-startY)):0;
    const yf = (sampleRate/2)/fWidth;
    function getY(i){
      return (pts[i].y + dy);
    }
    ctx.moveTo(pts[0].x + dx, getY(0));
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x + dx, getY(i));
    }
    ctx.closePath();

    // fill + stroke styles (tweak colors/alpha as you like)
    ctx.fillStyle = "rgba(255,200,0,0.08)"; // subtle fill
    ctx.fill();

    ctx.lineWidth = 4;
    ctx.strokeStyle = "#ff0000ff";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();

    ctx.restore();
  }
}

function drawSampleRegion(cx) {
  const framesVisible = Math.max(1, iHigh - iLow);
  let $s = syncChannels ? 0 : currentChannel;
  let $e = syncChannels ? channelCount : currentChannel + 1;
  for (let ch = $s; ch < $e; ch++) {
    const overlayCanvas = document.getElementById("overlay-" + ch);
    if (!overlayCanvas) continue;
    const ctx = overlayCanvas.getContext("2d");
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    const startFrame = Math.max(0, Math.min(framesTotal - 1, Math.round(cx)));
    const endFrame = Math.min(framesTotal, cx + Math.floor((draggingSample[0] && draggingSample[0].pcm ? draggingSample[0].pcm.length : 0) / (hop || 1)));
    const mapX = (frameX) => ((frameX - iLow) * overlayCanvas.width) / framesVisible;
    const xPixel = mapX(startFrame);
    const endPixel = mapX(endFrame);
    const width = Math.max(1, Math.round(endPixel - xPixel));
    ctx.save();
    ctx.fillStyle = dragInsert?"#0f0":"rgba(255,0,0,0.15)";
    if (dragInsert) ctx.fillRect(Math.round(xPixel), 0, 5, overlayCanvas.height);
    else            ctx.fillRect(Math.round(xPixel), 0, width, overlayCanvas.height);
    ctx.restore();
  }
}


function previewShape(cx, cy) {
  lastPreviewCoords = { cx, cy };
  if (pendingPreview) return;
  pendingPreview = true;

  requestAnimationFrame(() => {
    pendingPreview = false;
    const { cx, cy } = lastPreviewCoords;
    const overlayCanvas = document.getElementById("overlay-"+currentChannel); //CHANGE LATER
    const ctx = overlayCanvas.getContext("2d"); // local ref
    const canvas = document.getElementById("canvas-"+currentChannel); //CHANGE LATER

    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    if (draggingSample.length > 0) {
      drawSampleRegion(cx);
      return;
    }
    if (movingSprite) {
      drawSpriteOutline(true,cx,cy);
      return;
    }

    const dragToDraw = !!(document.getElementById("dragToDraw") && document.getElementById("dragToDraw").checked);

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
      // line shape isn't affected per your note — leave as-is
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

    // fallback: if new variables aren't available, fall back to brushSize for compatibility
    const bw = brushWidth;
    const bh = brushHeight;

    // IMAGE preview:
    if (currentShape === "image" && images[selectedImage] && images[selectedImage].img) {
      // If dragToDraw and we have a start point, show the drag-rect and draw the image in the rect
      if (dragToDraw && hasStart) {
        const x0 = Math.min(startX, cx);
        const y0 = Math.min(startY, cy);
        const w  = Math.max(1, Math.abs(cx - startX));
        const h  = Math.max(1, Math.abs(cy - startY));
        ctx.strokeRect(x0 + 0.5, y0 + 0.5, w, h);
        if (images[selectedImage].img.complete && images[selectedImage].img.naturalWidth !== 0) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(images[selectedImage].img, x0, y0, w, h);
        } else {
          ctx.fillStyle = "rgba(255,200,0,0.04)";
          ctx.fillRect(x0, y0, w, h);
        }
      } else {
        // existing centered-by-cursor preview (unchanged behavior)
        const screenW = Math.max(1, bw);
        const screenH = Math.max(1, bh);
        const overlayW = Math.max(1, Math.round(screenW / pixelsPerFrame));
        const overlayH = Math.max(1, Math.round(screenH / pixelsPerBin));
        ctx.strokeRect(cx - overlayW / 2, cy - overlayH / 2, overlayW, overlayH);
      }
      ctx.restore();
      return;
    }

    // STAMP preview:
    if (currentShape === "stamp" && currentStamp !== null) {
      // If dragToDraw and we have a start point, preview using startX/startY -> cx/cy (draw stamp in preview)
      if (dragToDraw && hasStart) {
        if (!currentStamp.img) {
          currentStamp.img = new Image();
          currentStamp.img.src = currentStamp.dataUrl;
        }
        const x0 = Math.min(startX, cx);
        const y0 = Math.min(startY, cy);
        const w  = Math.max(1, Math.abs(cx - startX));
        const h  = Math.max(1, Math.abs(cy - startY));
        ctx.strokeRect(x0 + 0.5, y0 + 0.5, w, h);
        if (currentStamp.img.complete && currentStamp.img.naturalWidth !== 0) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(currentStamp.img, x0, y0, w, h);
        } else {
          ctx.fillStyle = "rgba(255,200,0,0.04)";
          ctx.fillRect(x0, y0, w, h);
        }
      } else {
        // NOT dragToDraw: behave like image preview (centered outline), but *do not* draw stamp image in preview
        const screenW = Math.max(1, bw);
        const screenH = Math.max(1, bh);
        const overlayW = Math.max(1, Math.round(screenW / pixelsPerFrame));
        const overlayH = Math.max(1, Math.round(screenH / pixelsPerBin));
        ctx.strokeRect(cx - overlayW / 2, cy - overlayH / 2, overlayW, overlayH);
      }
      ctx.restore();
      return;
    }

    // BRUSH preview: ellipse sized by brushWidth / brushHeight (screen-space -> canvas coords)
    if (currentShape === "brush") {
      const radiusX = (bw / 2) / pixelsPerFrame; // in canvas x units (frames)
      const radiusY = (bh / 2) / pixelsPerBin;   // in canvas y units (bins)
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(0.5, radiusX), Math.max(0.5, radiusY), 0, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.restore();
      return;
    }

    // drawCursor(false);
  });
}



function line(startFrame, endFrame, startSpecY, endSpecY, lineWidth) {
  let $s = syncChannels?0:currentChannel, $e = syncChannels?channelCount:currentChannel+1;
  for (let ch=$s;ch<$e;ch++){
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
          drawPixel(px, py, brushMag, penPhase, brushOpacity* channels[ch].brushPressure, phaseOpacity, ch); 
        }
      }
      if (x0 === x1 && y0 === y1) break;
      const e2 = err;
      if (e2 > -dx) { err -= dy; x0 += sx; }
      if (e2 < dy)  { err += dx; y0 += sy; }
    }
  }
}

// call when spectrogram parameters change:
let binToTopDisplay = new Array(channelCount);
let binToBottomDisplay = new Array(channelCount);
function buildBinDisplayLookup() {
  for (let ch=0;ch<channelCount;ch++){
    binToTopDisplay[ch] = new Float32Array(specHeight);
    binToBottomDisplay[ch] = new Float32Array(specHeight);
    for (let b = 0; b < specHeight; b++) {
      binToTopDisplay[ch][b] = binToDisplayY(b - 0.5, specHeight,ch);
      binToBottomDisplay[ch][b] = binToDisplayY(b + 0.5, specHeight,ch);
    }
  }
}

function addPixelToSprite(sprite, x, y, prevMag, prevPhase, nextMag, nextPhase,ch) {
  if (!sprite) return;
  let col;
  try{col=sprite.pixels[ch].get(x);}catch(e){col=null};
  if (!col) {
    col = {
      ys: [],
      prevMags: [],
      prevPhases: [],
      nextMags: [],
      nextPhases: []
    };
    if (sprite.pixels[ch]) sprite.pixels[ch].set(x, col);
  }
  if (col.ys.includes(y)){
    const idx = col.ys.indexOf(y);
    col.prevMags[idx]=prevMag;
    col.prevPhases[idx]=prevPhase;
    col.nextMags[idx]=nextMag;
    col.nextPhases[idx]=nextPhase;
  } else {
    col.ys.push(y);
    col.prevMags.push(prevMag);
    col.prevPhases.push(prevPhase);
    col.nextMags.push(nextMag);
    col.nextPhases.push(nextPhase);
  }
  

  if (x < sprite.minCol) sprite.minCol = x;
  if (x > sprite.maxCol) sprite.maxCol = x;
}

function drawPixel(xFrame, yDisplay, mag, phase, bo, po, ch) {
  const xI = (xFrame + 0.5) | 0;
  if (xI < 0 || xI >= specWidth) return;

  // locals for perf
  const fullH = specHeight;
  const fullW = specWidth;
  const width = fullW;
  const height = fullH;
  const idxBase = xI * fullH;
  const imgData = imageBuffer[ch].data;
  const dbt = Math.pow(10, noiseRemoveFloor / 20) * 128;

  const magsArr = channels[ch].mags;
  const phasesArr = channels[ch].phases;

  // optional pitch-align
  let displayYFloat = yDisplay;
  const f = getSineFreq(yDisplay);
  if (alignPitch) {
    let nearestPitch = Math.round(npo * Math.log2(f / startOnP));
    nearestPitch = startOnP * Math.pow(2, nearestPitch / npo);
    displayYFloat = ftvsy(nearestPitch, ch);
  }

  // helper: process a single bin (reused by both flows)
  function processBin(bin, boScaled) {
    if (!Number.isFinite(bin)) return;
    bin = Math.max(0, Math.min(fullH - 1, Math.round(bin)));
    const idx = idxBase + bin;
    if (idx < 0 || idx >= magsArr.length) return;
    if (visited && visited[ch][idx] === 1) return;
    if (visited) visited[ch][idx] = 1;

    const oldMag = magsArr[idx] || 0;
    const oldPhase = phasesArr[idx] || 0;
    const newMag = (currentTool === "amplifier")
                ? (oldMag * amp)
                : (currentTool === "noiseRemover")
                ? (oldMag > dbt ? oldMag : (oldMag * (1 - boScaled)))
                : (oldMag * (1 - boScaled) + mag * boScaled);
    const type = phaseTextureEl.value;
    let $phase;
    if (type === 'Harmonics') {
      $phase = (bin / specHeight * fftSize / 2);
    } else if (type === 'Static') {
      $phase = Math.random() * Math.PI;
    } else { // Flat or others
      $phase = phase;
    }
    const newPhase = oldPhase * (1 - po) + po * ($phase + phase * 2);
    const clampedMag = Math.min(newMag, 255);
    magsArr[idx] = clampedMag;
    phasesArr[idx] = newPhase;
    channels[ch].mags = magsArr;

    // draw pixel(s) for this bin (use bin's display bounds to pick rows)
    const yTopF = binToTopDisplay[ch][bin];
    const yBotF = binToBottomDisplay[ch][bin];
    const yStart = Math.max(0, Math.floor(Math.min(yTopF, yBotF)));
    const yEnd   = Math.min(fullH - 1, Math.ceil(Math.max(yTopF, yBotF)));
    const [r, g, b] = magPhaseToRGB(clampedMag, newPhase);
    for (let yPixel = yStart; yPixel <= yEnd; yPixel++) {
      const pix = (yPixel * width + xI) * 4;
      imgData[pix]     = r;
      imgData[pix + 1] = g;
      imgData[pix + 2] = b;
      imgData[pix + 3] = 255;
    }
  }

  // NOTE shape: draw one bin per harmonic (frequency * (i+1)), with bo scaled by harmonics[i]
  if (currentShape === "note" || currentShape === "line") {
    const harmArr = harmonics;
    let i = 0, binF = 0;
    while (binF<specHeight && i<400) {
      const harmVal = Math.max(0, Math.min(1, ((i>=harmArr.length)?(harmArr[harmArr.length-1]):(harmArr[i]))));
      if (harmVal < 0.001) {i++; continue;}
      const freqI = getSineFreq(displayYFloat) * (i + 1);
      const displayY_i = ftvsy(freqI, ch);
      binF = displayYToBin(displayY_i, fullH, ch);
      const velFactor = (currentShape==="note")?(20/(mouseVelocity===Infinity?20:mouseVelocity)):1;
      processBin(binF, bo * harmVal * velFactor);
      i++;
    }
    return;
  }

  // default shape: original behavior (range of bins around displayYFloat)
  const topBinF = displayYToBin(displayYFloat - 0.5, fullH, ch);
  const botBinF = displayYToBin(displayYFloat + 0.5, fullH, ch);

  let binStart = Math.floor(Math.min(topBinF, botBinF));
  let binEnd   = Math.ceil (Math.max(topBinF, botBinF));
  if (!Number.isFinite(binStart)) binStart = 0;
  if (!Number.isFinite(binEnd))   binEnd   = 0;
  binStart = Math.max(0, binStart);
  binEnd   = Math.min(fullH - 1, binEnd);

  for (let bin = binStart; bin <= binEnd; bin++) {
    const velFactor = (currentShape==="note")?(20/(mouseVelocity===Infinity?20:mouseVelocity)):1;
    processBin(bin, bo*velFactor);
  }
}


function applyEffectToPixel(oldMag, oldPhase, x, bin, newEffect, integral) {
  const tool = newEffect.tool || currentTool;
  let mag, phase;
  if (tool === "blur") {
    const binCenter = Math.round(displayYToBin(bin, specHeight, currentChannel));
    const r = newEffect.blurRadius;
    const x0 = Math.max(0, x - r);
    const x1 = Math.min(specWidth - 1, x + r);
    const y0 = Math.max(0, binCenter - r);
    const y1 = Math.min(specHeight - 1, binCenter + r);

    const { sumMag, sumPhase } = queryIntegralSum(integral, x0, y0, x1, y1);
    const count = (x1 - x0 + 1) * (y1 - y0 + 1) || 1;
    mag = sumMag / count; phase = sumPhase / count;
  } else {
    mag = (tool === "eraser" ? 0 : (newEffect.brushColor  !== undefined) ? newEffect.brushColor  :128);
    phase=(tool === "eraser" ? 0 : (newEffect.penPhase!== undefined) ? newEffect.penPhase:  0);
  }
  const bo =  (tool === "eraser" ? 1 : (newEffect.brushOpacity   !== undefined) ? newEffect.brushOpacity   :  1)* channels[ch].brushPressure;
  const po =  (tool === "eraser" ? 0 : (newEffect.phaseOpacity   !== undefined) ? newEffect.phaseOpacity   :  0);
  const _amp = newEffect.amp || amp;
  const dbt = Math.pow(10, newEffect.noiseRemoveFloor / 20)*128;
  const newMag =  (tool === "amplifier" || tool === "sample")    ? (oldMag * _amp)
                : (tool === "noiseRemover") ? (oldMag > dbt?oldMag:(oldMag*(1-bo)))
                :                             (oldMag * (1 - bo) + mag * bo);
  const type = newEffect.phaseTexture;
  let $phase;
  if (type === 'Harmonics') {
    $phase = (bin / specHeight * fftSize / 2);
  } else if (type === 'Static') {
    $phase = Math.random()*Math.PI;
  } else if (type === 'Flat') {
    $phase = phase;
  }
  const newPhase = (tool === "sample")?(oldPhase+phase):(oldPhase * (1-po) + po * ($phase + phase*2));
  const clampedMag = Math.min(newMag, 255);
  return { mag: clampedMag, phase: newPhase};
}

function commitShape(cx, cy) {
  let $s = syncChannels?0:currentChannel, $e = syncChannels?channelCount:currentChannel+1;
  for (let ch=$s;ch<$e;ch++){
    let mags = channels[ch].mags, phases = channels[ch].phases;
    if (!mags || !phases) return;

    const fullW = specWidth;
    const fullH = specHeight;
    const po = currentTool === "eraser" ? 1 : phaseOpacity;
    const bo = (currentTool === "eraser" ? 1 : brushOpacity)* channels[ch].brushPressure;
    const brushMag = currentTool === "eraser" ? 0 : (brushColor / 255) * 128;
    const brushPhase = currentTool === "eraser" ? 0 : penPhase;

    const visitedLocal = Array.from({ length: channelCount }, () => new Uint8Array(fullW * fullH));
    const savedVisited = visited;
    visited = visitedLocal;
    let integral = null;
    if (currentTool === "blur") {
      integral = buildIntegral(fullW, fullH, mags, phases);
    }
    try {
      const dragToDraw = !!(document.getElementById("dragToDraw") && document.getElementById("dragToDraw").checked);

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

      function dp(xFrame, yDisplay, mag, phase, bo, po, ch,opts={}){
        if (currentTool === "blur") {
          // map displayY to the nearest bin once
          const binCenter = Math.round(displayYToBin(yDisplay, fullH, ch));
          const r = blurRadius | 0;
          const x0 = Math.max(0, xFrame - r);
          const x1 = Math.min(fullW - 1, xFrame + r);
          const y0 = Math.max(0, binCenter - r);
          const y1 = Math.min(fullH - 1, binCenter + r);

          const { sumMag, sumPhase } = queryIntegralSum(integral, x0, y0, x1, y1);
          const count = (x1 - x0 + 1) * (y1 - y0 + 1) || 1;
          drawPixel(xFrame, yDisplay, sumMag / count, sumPhase / count, bo, po, ch);
        } else {
          drawPixel(xFrame, yDisplay, mag, phase, bo, po, ch);
        }
      }

      if (currentShape === "rectangle") {
        // ... (unchanged rectangle code) ...
        const minX = x0Frame;
        const maxX = x1Frame;

        let binA = displayYToBin(y0Spec, fullH, ch);
        let binB = displayYToBin(y1Spec, fullH, ch);
        if (binA > binB) { const t = binA; binA = binB; binB = t; }

        binA = Math.max(0, Math.min(fullH - 1, Math.round(binA)));
        binB = Math.max(0, Math.min(fullH - 1, Math.round(binB)));
        let pixels = [];
        for (let xx = minX; xx <= maxX; xx++) {
          for (let bin = binA; bin <= binB; bin++) {
            if (currentTool !== "autotune") {
              const displayY = binToDisplayY(bin, fullH,ch);
              dp(xx, displayY, brushMag, brushPhase, bo, po, ch,{minBin:binA,maxBin:binB});
            } else {
              pixels.push([xx,bin]);
            }
          }
        }
        if (currentTool === "autotune") applyAutotuneToPixels(ch,pixels);

      } else if (currentShape === "line") {
        // ... (unchanged line code; uses brushSize as before) ...
        let x0=startFrame;x1=endFrame;
        let yStartSpec = startSpecY;
        let yEndSpec   = endSpecY;

        x0 = Math.max(0, Math.min(specWidth - 1, Math.round(x0)));
        x1 = Math.max(0, Math.min(specWidth - 1, Math.round(x1)));
        let y0 = Math.max(0, Math.min(specHeight - 1, Math.round(yStartSpec)));
        let y1 = Math.max(0, Math.min(specHeight - 1, Math.round(yEndSpec)));

        const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
        const dy = Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
        let err = (dx > dy ? dx : -dy) / 2;

        const half = Math.floor(brushSize / 8);
        let pixels = [];
        while (true) {
          for (let dx = -half; dx <= half; dx++) {
            const px = x0 + dx;
            const py = y0;
            if (px >= 0 && px < specWidth && py >= 0 && py < specHeight) {
              if (currentTool !== "autotune") {
                dp(px, py, brushMag, penPhase, brushOpacity* channels[ch].brushPressure, phaseOpacity,ch);
              } else {
                pixels.push([px,py]);
              }
            }
          }
          if (x0 === x1 && y0 === y1) break;
          const e2 = err;
          if (e2 > -dx) { err -= dy; x0 += sx; }
          if (e2 < dy)  { err += dx; y0 += sy; }
        }
        console.log(pixels);
        if (currentTool === "autotune") applyAutotuneToPixels(ch,pixels,opts={expand:5});
      }
      if (currentShape === "image") {
        if (!images[selectedImage] || !images[selectedImage].img) {
          // nothing to commit
        } else {
          const canvas = document.getElementById("canvas-"+ch);
          const screenRect = canvas.getBoundingClientRect();
          const pixelsPerFrame = screenRect.width  / Math.max(1, canvas.width);
          const pixelsPerBin   = screenRect.height / Math.max(1, canvas.height);

          if (dragToDraw && startX !== null && startY !== null) {
            // Use drag rect: startVisX/Y -> cx,cy (canvas units)
            const left   = Math.floor(Math.min(startVisX, cx));
            const top    = Math.floor(Math.min(startVisY, cy));
            const overlayW = Math.max(1, Math.round(Math.abs(cx - startVisX)));
            const overlayH = Math.max(1, Math.round(Math.abs(cy - startVisY)));
            applyImageToChannel(ch, images[selectedImage].img, left, top, overlayW, overlayH);
          } else {
            // Centered by cursor using brushWidth / brushHeight (screen-space -> canvas units)
            const bw = brushWidth;
            const bh = brushHeight;
            const screenW = Math.max(1, bw);
            const screenH = Math.max(1, bh);
            const overlayW = Math.max(1, Math.round(screenW / pixelsPerFrame));
            const overlayH = Math.max(1, Math.round(screenH / pixelsPerBin));
            const ox = Math.floor(cx - overlayW / 2);
            const oy = Math.floor(cy - overlayH / 2);
            applyImageToChannel(ch, images[selectedImage].img, ox, oy, overlayW, overlayH);
          }
        }
      }
      if (currentShape === "stamp") {
        if (!currentStamp || !currentStamp.dataUrl) {
          // nothing to commit
        } else {
          if (!currentStamp.img) {
            currentStamp.img = new Image();
            currentStamp.img.src = currentStamp.dataUrl;
          }
          if (!currentStamp.img.complete || currentStamp.img.naturalWidth === 0) {
            console.warn("Stamp image not yet loaded — commit skipped. Preload currentStamp.img before committing.");
          } else {
            if (dragToDraw && startX !== null && startY !== null) {
              const left   = Math.floor(Math.min(startVisX, cx));
              const top    = Math.floor(Math.min(startVisY, cy));
              const overlayW = Math.max(1, Math.round(Math.abs(cx - startVisX)));
              const overlayH = Math.max(1, Math.round(Math.abs(cy - startVisY)));
              applyImageToChannel(ch, currentStamp.img, left, top, overlayW, overlayH);
            } else {
              // center by cursor using brushWidth/brushHeight
              const canvas = document.getElementById("canvas-"+ch);
              const screenRect = canvas.getBoundingClientRect();
              const pixelsPerFrame = screenRect.width  / Math.max(1, canvas.width);
              const pixelsPerBin   = screenRect.height / Math.max(1, canvas.height);

              const bw = brushWidth;
              const bh = brushHeight;
              const screenW = Math.max(1, bw);
              const screenH = Math.max(1, bh);
              const overlayW = Math.max(1, Math.round(screenW / pixelsPerFrame));
              const overlayH = Math.max(1, Math.round(screenH / pixelsPerBin));
              const ox = Math.floor(cx - overlayW / 2);
              const oy = Math.floor(cy - overlayH / 2);
              applyImageToChannel(ch, currentStamp.img, ox, oy, overlayW, overlayH);
            }
          }
        }
      }
    } finally {
      visited = savedVisited;
    }
    const specCanvas = document.getElementById("spec-"+ch);
    const specCtx = specCanvas.getContext("2d");

    specCtx.putImageData(imageBuffer[ch], 0, 0);
  }
  renderView();
}



function ftvsy(f,ch,l) {// frequency to visible spectrogram Y
  const h = specHeight;
  const s = (ch!==null)?parseFloat(logScaleVal[ch]):l;
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
let vr = 1;
function paint(cx, cy) {
  let $s = syncChannels?0:currentChannel, $e = syncChannels?channelCount:currentChannel+1;
  for (let ch=$s;ch<$e;ch++){
    const mags = channels[ch].mags, phases = channels[ch].phases;
    const canvas = document.getElementById("canvas-"+ch);
    const fullW = specWidth;
    const fullH = specHeight;
    const po = currentTool === "eraser" ? 1 : phaseOpacity;
    const bo = (currentTool === "eraser" ? channels[ch].brushPressure : brushOpacity)* channels[ch].brushPressure;
    vr = ((currentShape==="brush")?(Math.max( Math.min(1/Math.pow(mouseVelocity,0.5), Math.min(vr+0.01,1)) ,Math.max(vr-0.01,0.6) )):1);
    const radiusY = Math.floor((brushHeight/2/canvas.getBoundingClientRect().height*canvas.height)*vr);
    const radiusXFrames = Math.floor((brushWidth/2/canvas.getBoundingClientRect().width*canvas.width)*vr);
    const dx = (currentShape==="note"?0:radiusXFrames), dy = (currentShape==="note"?0:radiusY);
    const minXFrame = Math.max(0, Math.floor(Math.min(cx,prevMouseX) - dx));
    const maxXFrame = Math.min(fullW - 1, Math.ceil(Math.max(cx,prevMouseX) + dx));
    const prevRealY = visibleToSpecY(prevMouseY);
    const minY = Math.max(0, Math.floor(Math.min(cy,prevRealY) - (currentShape==="note"?0:dy)));
    const maxY = Math.min(fullH - 1, Math.ceil((Math.max(cy,prevRealY)) + (currentShape==="note"?0:dy)));
    const radiusXsq = radiusXFrames * radiusXFrames;
    const radiusYsq = radiusY * radiusY;
        // inside paint(), replace the image block with:
    if (currentShape === "image" && images[selectedImage] && images[selectedImage].img) {
      const canvas = document.getElementById("canvas-"+ch);
      const rect = canvas.getBoundingClientRect();
      const pixelsPerFrame = rect.width  / Math.max(1, canvas.width);
      const pixelsPerBin   = rect.height / Math.max(1, canvas.height);

      const dragToDraw = !!(document.getElementById("dragToDraw") && document.getElementById("dragToDraw").checked);
      const hasStart = startX !== null && startY !== null;

      if (dragToDraw && hasStart) {
        const left = Math.floor(Math.min(startX, cx));
        const top  = Math.floor(Math.min(startY, cy));
        const overlayW = Math.max(1, Math.round(Math.abs(cx - startX)));
        const overlayH = Math.max(1, Math.round(Math.abs(cy - startY)));
        applyImageToChannel(ch, images[selectedImage].img, left, top, overlayW, overlayH);
      } else {
        // centered by cursor (screen-space -> canvas units)
        const bw = (typeof brushWidth === "number") ? brushWidth : brushSize;
        const bh = (typeof brushHeight === "number") ? brushHeight : brushSize;
        const screenW = Math.max(1, bw);
        const screenH = Math.max(1, bh);
        const overlayW = Math.max(1, Math.round(screenW / pixelsPerFrame));
        const overlayH = Math.max(1, Math.round(screenH / pixelsPerBin));
        const ox = Math.floor(cx - overlayW / 2);
        const oy = Math.floor(cy - overlayH / 2);
        applyImageToChannel(ch, images[selectedImage].img, ox, oy, overlayW, overlayH);
      }
    }
    else if (currentShape === "stamp" && currentStamp && currentStamp.dataUrl) {
      if (!currentStamp.img) {
        currentStamp.img = new Image();
        currentStamp.img.src = currentStamp.dataUrl;
      }
      if (!currentStamp.img.complete || currentStamp.img.naturalWidth === 0) {
      } else {
        const canvas = document.getElementById("canvas-"+ch);
        const rect = canvas.getBoundingClientRect();
        const pixelsPerFrame = rect.width  / Math.max(1, canvas.width);
        const pixelsPerBin   = rect.height / Math.max(1, canvas.height);

        const dragToDraw = !!(document.getElementById("dragToDraw") && document.getElementById("dragToDraw").checked);
        const hasStart = startX !== null && startY !== null;

        if (dragToDraw && hasStart) {
          const left = Math.floor(Math.min(startX, cx));
          const top  = Math.floor(Math.min(startY, cy));
          const overlayW = Math.max(1, Math.round(Math.abs(cx - startX)));
          const overlayH = Math.max(1, Math.round(Math.abs(cy - startY)));
          applyImageToChannel(ch, currentStamp.img, left, top, overlayW, overlayH);
        } else {
          // centered by cursor using brushWidth/brushHeight
          const bw = (typeof brushWidth === "number") ? brushWidth : brushSize;
          const bh = (typeof brushHeight === "number") ? brushHeight : brushSize;
          const screenW = Math.max(1, bw);
          const screenH = Math.max(1, bh);
          const overlayW = Math.max(1, Math.round(screenW / pixelsPerFrame));
          const overlayH = Math.max(1, Math.round(screenH / pixelsPerBin));
          const ox = Math.floor(cx - overlayW / 2);
          const oy = Math.floor(cy - overlayH / 2);
          applyImageToChannel(ch, currentStamp.img, ox, oy, overlayW, overlayH);
        }
      }
    } else if (currentTool === "fill" || currentTool === "eraser" || currentTool === "amplifier" || currentTool === "noiseRemover") {
      const brushMag = currentTool === "eraser" ? 0 : (brushColor / 255) * 128;
      const brushPhase = currentTool === "eraser" ? 0 : penPhase;
      // endpoints of the segment (make sure these are in the same coordinate space)
      const p0x = prevMouseX + iLow;
      const p0y = visibleToSpecY(prevMouseY);
      const p1x = cx;   // current brush center x
      const p1y = cy;   // current brush center y

      const vx = p1x - p0x;
      const vy = p1y - p0y;
      const lenSq = vx * vx + vy * vy;
      const EPS = 1e-9;

      for (let yy = minY; yy <= maxY; yy++) {
        for (let xx = minXFrame; xx <= maxXFrame; xx++) {

          // find t for projection of pixel onto the line segment p0->p1 (clamped 0..1)
          let t = 0;
          if (lenSq > EPS) {
            t = ((xx - p0x) * vx + (yy - p0y) * vy) / lenSq;
            if (t < 0) t = 0;
            else if (t > 1) t = 1;
          }
          // nearest point on the segment to this pixel
          const nearestX = p0x + t * vx;
          const nearestY = p0y + t * vy;

          // elliptical distance test centered on the nearest point
          const dx = xx - nearestX;
          const dy = yy - nearestY;
          if ((dx * dx) / radiusXsq + (dy * dy) / radiusYsq > (currentShape==="note"?0.1:1)) continue;

          drawPixel(xx, yy, brushMag, brushPhase, bo, po, ch);
        }
      }
    } else if (currentTool === "blur") {
      const integral = buildIntegral(fullW, fullH, mags, phases);
      for (let yy = minY; yy <= maxY; yy++) {
        for (let xx = minXFrame; xx <= maxXFrame; xx++) {
          const dx = xx - cx;
          const dy = yy - cy;
          if ((dx * dx) / radiusXsq + (dy * dy) / radiusYsq > 1) continue;

          const binCenter = Math.round(displayYToBin(yy, fullH, ch));
          const r = blurRadius | 0;
          const x0 = Math.max(0, xx - r);
          const x1 = Math.min(fullW - 1, xx + r);
          const y0 = Math.max(0, binCenter - r);
          const y1 = Math.min(fullH - 1, binCenter + r);

          const { sumMag, sumPhase } = queryIntegralSum(integral, x0, y0, x1, y1);
          const count = (x1 - x0 + 1) * (y1 - y0 + 1) || 1;
          drawPixel(xx, yy, sumMag / count, sumPhase / count, bo, po, ch);
        }
      }
    } else if (currentTool === "autotune") {
      const fullH = specHeight;
      const binB = Math.max(0,Math.ceil(displayYToBin(minY, fullH, ch))); 
      const binA = Math.min(fullH - 1,Math.floor(displayYToBin(maxY, fullH, ch)));
      const pixels = [];
      for (let xx = minXFrame; xx <= maxXFrame; xx++) {
        for (let bin = binA; bin <= binB; bin++) {
          const centerY = (binToTopDisplay[ch][bin] + binToBottomDisplay[ch][bin]) * 0.5;
          const dxF = xx - cx;
          const dyF = centerY - cy;
          if ((dxF*dxF)/radiusXsq + (dyF*dyF)/radiusYsq > 1) continue;
          const idx = xx * specHeight + bin;
          if (visited[ch][idx] === 1) continue;
          pixels.push([xx, bin]);
        }
      }
      applyAutotuneToPixels(ch, pixels,{});
    }


    const specCanvas = document.getElementById("spec-" + ch);
    const specCtx = specCanvas.getContext("2d");
    specCtx.putImageData(imageBuffer[ch], 0, 0);
  }
  renderView();
}
/**
 * Apply autotune using a precomputed flat pixel list [[xx,bin],...]
 *
 * @param {number} ch - channel index
 * @param {Array.<Array.<number>>} pixels - flat list of [xx, bin] pairs to process
 * @param {Object} [opts] - optional overrides (strength, fullH, fullW, sampleRate, fftSize, npo, startOnP, etc.)
 * @returns {Object} summary {processedColumns, processedPixels}
 *
 * NOTE: If an option is not set here, the function falls back to variables from outer scope
 * (autoTuneStrength, specHeight, specWidth, sampleRate, fftSize, npo, startOnP, mags, phases,
 * visited, imageBuffer, binToTopDisplay, binToBottomDisplay, magPhaseToRGB, ftvsy, displayYToBin).
 */
function applyAutotuneToPixels(ch, pixels, opts = {}) {
  if (!Array.isArray(pixels) || pixels.length === 0) return;

  // options with fallbacks to outer-scope variables if not provided:
  const strength = opts.strength ?? autoTuneStrength;
  if (strength <= 0) return;
  const fullH = opts.fullH ?? specHeight;
  const fullW = opts.fullW ?? specWidth;
  const sampleRateLocal = opts.sampleRate ?? sampleRate;
  const fftSizeLocal = opts.fftSize ?? fftSize;
  const npoLocal = opts.npo ?? npo;
  const startOnPLocal = opts.startOnP ?? startOnP;
  const binFreqStep = sampleRateLocal / fftSizeLocal;

  const pixBuf = imageBuffer[ch].data; // assumes imageBuffer is available in scope
  const magsArr = channels[ch].mags;     // assumes mags is available
  const phasesArr = channels[ch].phases; // assumes phases is available
  const visitedArr = visited;

  // Determine min/max bins present in the pixels list (for pixelWeights computation)
  minBin = fullH; maxBin = 0;
  for (let i = 0; i < pixels.length; i++) {
    const b = pixels[i][1];
    if (b < minBin) minBin = b;
    if (b > maxBin) maxBin = b;
  }
  if (opts.expand) {minBin -= opts.expand; maxBin += opts.expand;}
  minBin = Math.max(0, Math.floor(minBin));
  maxBin = Math.min(fullH - 1, Math.ceil(maxBin));
  if (minBin > maxBin) return;
  // Precompute pixelWeights for the range [minBin, maxBin]
  const pixelWeights = new Array(fullH).fill(0);
  {
    const semitoneStep = 0.1;
    const mul = Math.pow(2, semitoneStep / npoLocal);
    let b = minBin;
    let pb = -1;
    // use the same growth logic as before
    while (b < maxBin) {
      pb = b;
      b = (b + 0.5) * mul - 0.5;
      const start = Math.max(0, Math.round(pb));
      const end = Math.min(fullH, Math.round(b));
      const denom = (b - pb) || 1;
      for (let i = start; i < end; i++) pixelWeights[i] = 1 / denom;
      if (end >= maxBin) break;
    }
    // fallback: if a bin didn't get a weight, give it 1
    for (let i = minBin; i <= maxBin; i++) if (pixelWeights[i] === 0) pixelWeights[i] = 1;
  }

  // Group pixels by xx for per-column processing
  const pxByX = new Map();
  for (let i = 0; i < pixels.length; i++) {
    const [xx, bin] = pixels[i];
    // skip out-of-range bins/columns
    if (bin < 0 || bin >= fullH) continue;
    if (!pxByX.has(xx)) pxByX.set(xx, []);
    pxByX.get(xx).push(bin);
  }

  if (pxByX.size === 0) return;
  console.log(pxByX);

  // iterate columns in ascending order for determinism
  const xKeys = Array.from(pxByX.keys()).sort((a, b) => a - b);

  let processedColumns = 0;
  let processedPixelsCount = 0;

  for (const xx of xKeys) {
    const binsForX = pxByX.get(xx);
    if (!binsForX || binsForX.length === 0) continue;

    // STEP 1: compute magnitude-weighted average semitone for this column
    let sumW = 0;
    let sumWSemitone = 0;
    for (let j = 0; j < binsForX.length; j++) {
      const bin = binsForX[j];
      const idx = xx * fullH + bin;
      if (visitedArr[ch][idx] === 1) continue; // keep safety re-check
      const mag = (magsArr[idx] || 0) * (pixelWeights[bin] || 1);
      if (mag <= 0) continue;
      const freq = (bin + 0.5) * binFreqStep;
      if (!isFinite(freq) || freq <= 0) continue;
      const semitone = npoLocal * Math.log2(freq / startOnPLocal);
      sumW += mag;
      sumWSemitone += mag * semitone;
    }

    if (sumW <= 0) continue;
    const avgSemitone = sumWSemitone / sumW;
    const targetSemitone = Math.round(avgSemitone);
    const semitoneDiff = (targetSemitone - avgSemitone) * strength;
    if (Math.abs(semitoneDiff) < 1e-9) continue;

    // STEP 2: accumulate shifted energy into tMag
    const tMag = new Float64Array(fullH);
    let minBinTouched = fullH - 1;
    let maxBinTouched = 0;
    let anyWritten = false;

    for (let j = 0; j < binsForX.length; j++) {
      const srcBin = binsForX[j];
      const srcIdx = xx * fullH + srcBin;
      if (visitedArr[ch][srcIdx] === 1) continue;
      const mag = magsArr[srcIdx] || 0;
      if (mag <= 1e-6) continue;

      const freqSrc = (srcBin + 0.5) * sampleRateLocal / fftSizeLocal;
      if (!isFinite(freqSrc) || freqSrc <= 0) continue;
      const semitoneSrc = npoLocal * Math.log2(freqSrc / startOnPLocal);
      const semitoneTarget = semitoneSrc + semitoneDiff;
      const freqTarget = startOnPLocal * Math.pow(2, semitoneTarget / npoLocal);
      const displayYTarget = ftvsy(freqTarget, ch);
      const dstBinFloat = displayYToBin(displayYTarget, fullH, ch);
      const dstBin = Math.max(0, Math.min(fullH - 1, Math.round(dstBinFloat)));

      tMag[dstBin] += mag;
      anyWritten = true;
      minBinTouched = Math.min(minBinTouched, dstBin);
      maxBinTouched = Math.max(maxBinTouched, dstBin);
    }

    if (!anyWritten) continue;

    // STEP 3: clear source bins (and mark visited + clear pixels on screen)
    for (let j = 0; j < binsForX.length; j++) {
      const srcBin = binsForX[j];
      const srcIdx = xx * fullH + srcBin;
      if (visitedArr[ch][srcIdx] === 1) continue;
      if ((magsArr[srcIdx] || 0) > 0) {
        magsArr[srcIdx] = 0;
        visitedArr[ch][srcIdx] = 1;
        processedPixelsCount++;

        const yTopF = binToTopDisplay[ch][srcBin];
        const yBotF = binToBottomDisplay[ch][srcBin];
        const yStart = Math.max(0, Math.floor(Math.min(yTopF, yBotF)));
        const yEnd = Math.min(fullH - 1, Math.ceil(Math.max(yTopF, yBotF)));

        for (let yPixel = yStart; yPixel <= yEnd; yPixel++) {
          const pix = (yPixel * fullW + xx) * 4;
          pixBuf[pix] = 0;
          pixBuf[pix + 1] = 0;
          pixBuf[pix + 2] = 0;
          pixBuf[pix + 3] = 255;
        }
      }
    }

    // STEP 4: write destination bins (clamp mags, mark visited, paint pixels)
    const fromBin = Math.max(0, minBinTouched - 1);
    const toBin = Math.min(fullH - 1, maxBinTouched + 1);

    for (let b = fromBin; b <= toBin; b++) {
      const dstIdx = xx * fullH + b;
      const newMag = Math.min(255, tMag[b] || 0);

      if (newMag > 0) {
        magsArr[dstIdx] = newMag;
        visitedArr[ch][dstIdx] = 1;
        processedPixelsCount++;
      } else {
        magsArr[dstIdx] = magsArr[dstIdx] || 0;
      }

      const yTopF = binToTopDisplay[ch][b];
      const yBotF = binToBottomDisplay[ch][b];
      const yStart = Math.max(0, Math.floor(Math.min(yTopF, yBotF)));
      const yEnd = Math.min(fullH - 1, Math.ceil(Math.max(yTopF, yBotF)));

      const [r, g, bl] = magPhaseToRGB(magsArr[dstIdx], phasesArr[dstIdx]);

      for (let yPixel = yStart; yPixel <= yEnd; yPixel++) {
        const pix = (yPixel * fullW + xx) * 4;
        pixBuf[pix] = r;
        pixBuf[pix + 1] = g;
        pixBuf[pix + 2] = bl;
        pixBuf[pix + 3] = 255;
      }
    }

    processedColumns++;
  } // end for each column
}
