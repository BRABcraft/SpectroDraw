const __hopTemplateCache = new Map(); 
const __hopFrameCache = new Map();    
const __hopTemplateMax = 64;
const __hopFrameMax = 256; 
function __makeTemplateKey(srcBins, fftSize) {
  return srcBins + '|' + fftSize;
}
function __makeFrameKey(srcBins, frameIndex, fftSize) {
  return srcBins + '|' + frameIndex + '|' + fftSize;
}
function __evictOldest(map, maxEntries) {
  if (map.size > maxEntries) {
    const k = map.keys().next().value;
    map.delete(k);
  }
}
function __buildHopTemplate(srcBins, fftSize, specH) {
  const key = __makeTemplateKey(srcBins, fftSize);
  if (__hopTemplateCache.has(key)) return __hopTemplateCache.get(key);
  const interpI0 = new Uint32Array(specH);   
  const interpW1 = new Float32Array(specH);  
  const invFFT = 1 / Math.max(1, fftSize);
  const scale = srcBins * invFFT; 
  const checker = new Float64Array(srcBins);
  const tilt = new Float64Array(srcBins);
  const edgeTerm = new Float64Array(srcBins);
  const invSrcMinus1 = 1 / Math.max(1, srcBins - 1);
  const edgeBoost = Math.PI * 0.9;
  for (let j = 0; j < srcBins; ++j) {
    checker[j] = (j & 1) === 0 ? 0 : Math.PI * 0.5;
    tilt[j] = (j * invSrcMinus1) * 0.25;
    edgeTerm[j] = (j === 0 || j === srcBins - 1) ? edgeBoost : 0;
  }
  for (let k = 0; k < specH; ++k) {
    const pos = k * scale;
    let i0 = Math.floor(pos);
    let t = pos - i0;
    if (i0 < 0) { i0 = 0; t = 0; }
    if (i0 >= srcBins - 1) { 
      i0 = Math.max(0, srcBins - 2);
      t = 1.0;
    }
    interpI0[k] = i0;
    interpW1[k] = t;
  }
  const tpl = { interpI0, interpW1, checker, tilt, edgeTerm, srcBins, fftSize };
  if (__hopTemplateCache.size >= __hopTemplateMax) __evictOldest(__hopTemplateCache, __hopTemplateMax - 1);
  __hopTemplateCache.set(key, tpl);
  return tpl;
}
function __unwrapPhaseVectorFast(arr) {
  const n = arr.length;
  const out = new Float64Array(n);
  if (n === 0) return out;
  out[0] = arr[0];
  for (let i = 1; i < n; ++i) {
    let delta = arr[i] - arr[i - 1];
    if (delta <= -Math.PI) delta += 2 * Math.PI * Math.ceil((Math.PI - delta) / (2 * Math.PI));
    else if (delta > Math.PI) delta -= 2 * Math.PI * Math.ceil((delta - Math.PI) / (2 * Math.PI));
    out[i] = out[i - 1] + delta;
  }
  return out;
}
function wrapPhase(phi) {
  phi = ((phi + Math.PI) % (2 * Math.PI)) - Math.PI;
  if (phi <= -Math.PI) phi += 2 * Math.PI;
  return phi;
}
function binFreq(k, fftSizeLocal, sampleRateLocal) {
  return (k * sampleRateLocal) / fftSizeLocal;
}
function computePhaseTexture(type, bin, frameIndex, basePhase) {
  const FFT = fftSize;
  const fs = sampleRate;
  const hopLocal = hop;
  const twoPi = 2 * Math.PI;
  const k = bin | 0; 
  const fk = (k * fs) / FFT; 
  let phi = 0;
  switch (type) {
    case 'Harmonics':
      phi = k;
      break;
    case 'Static':
      phi = Math.random() * 2 * Math.PI;
      break;
    case 'Flat':
      phi = 0;
      break;
    case 'ImpulseAlign':
      phi = -twoPi * fk * t0;
      break;
    case 'FrameAlignedImpulse': {
      const frameTime = (frameIndex * hopLocal) / fs;
      const t0f = frameTime + (hopLocal / (2 * fs));
      phi = -twoPi * fk * t0f;
    } break;
    case 'ExpectedAdvance':
      phi = twoPi * fk * (frameIndex * hopLocal) / fs;
      break;
    case 'PhasePropagate': {
      const prevIdx = (frameIndex - 1) * specHeight + k;
      let prevPhase = null;
      if (frameIndex > 0 && phases[prevIdx] !== undefined) {
        prevPhase = phases[prevIdx];
      }
      if (prevPhase !== null && isFinite(prevPhase)) {
        const expected = prevPhase + twoPi * fk * (hopLocal / fs);
        phi = expected + userDelta;
      } else {
        phi = twoPi * fk * (frameIndex * hopLocal) / fs;
      }
    } break;
    case 'RandomSmall':
      phi = (Math.random() * 2 - 1) * sigma;
      break;
    case 'HarmonicStack': {
      const center = Math.max(1, harmonicCenter);
      phi = -twoPi * fk * t0 + ((k % center) * 0.12);
    } break;
    case 'LinearDelay':
      phi = -twoPi * fk * tau;
      break;
    case 'Chirp':
      phi = - twoPi * fk * ((frameIndex * hopLocal) / fs) - Math.pow(k, 1.05) * chirpRate;
      break;
    case 'CopyFromRef': {
      const refIx = (refPhaseFrame * specHeight + k) | 0;
      phi = phases[refIx];
    } break;
    case 'HopArtifact': {
      const srcBins = Math.max(1, hopLocal | 0);
      const FFT = fftSize;
      const fs = sampleRate;
      const frameTime = (frameIndex * hopLocal) / fs;
      const tpl = __buildHopTemplate(srcBins, FFT, specHeight);
      const fkey = __makeFrameKey(srcBins, frameIndex, FFT);
      let entry = __hopFrameCache.get(fkey);
      if (!entry) {
        const coarse = new Float64Array(srcBins);
        const baselineStep = - (2 * Math.PI) * fs * frameTime / srcBins;
        const a = frameIndex * 0.6;            
        const b = 0.25;                        
        const cb = Math.cos(b), sb = Math.sin(b);
        let sinCurr = Math.sin(a);
        let cosCurr = Math.cos(a);
        const frameMod = 0.8;
        const checker = tpl.checker;
        const tilt = tpl.tilt;
        const edgeTerm = tpl.edgeTerm;
        for (let j = 0; j < srcBins; ++j) {
          const base = j * baselineStep;
          const fm = sinCurr * frameMod;
          coarse[j] = base + checker[j] + tilt[j] + fm + edgeTerm[j];
          const nextSin = sinCurr * cb + cosCurr * sb;
          const nextCos = cosCurr * cb - sinCurr * sb;
          sinCurr = nextSin;
          cosCurr = nextCos;
        }
        const unwrapped = __unwrapPhaseVectorFast(coarse);
        entry = { unwrapped };
        if (__hopFrameCache.size >= __hopFrameMax) __evictOldest(__hopFrameCache, __hopFrameMax - 1);
        __hopFrameCache.set(fkey, entry);
      }
      const i0 = tpl.interpI0[k];
      const w1 = tpl.interpW1[k];
      let sampled;
      if (tpl.srcBins === 1) sampled = entry.unwrapped[0] || 0;
      else {
        const u = entry.unwrapped;
        sampled = u[i0] * (1 - w1) + u[i0 + 1] * w1;
      }
      phi = sampled;
    } break;
    default:
      phi = 0;
      break;
  }
  phi += basePhase;
  return wrapPhase(phi);
}
function syncOverlaySize() {
  overlayCanvas.width = canvas.width;
  overlayCanvas.style.width = canvas.style.width;
  overlayCanvas.height = canvas.height;
  overlayCanvas.style.height = canvas.style.height;
}

let pendingPreview = false;
let lastPreviewCoords = null;
function buildIntegral(fullW, fullH, magsArr, phasesArr) {
  const W = fullW, H = fullH;
  const iw = W + 1;
  const ih = H + 1;
  const size = iw * ih;
  const intMag = new Float64Array(size);
  const intPhase = new Float64Array(size);
  for (let x = 1; x <= W; x++) {
    const srcX = x - 1;
    const baseSrc = srcX * H;
    const baseIntX = x * ih;
    const baseIntXminus1 = (x - 1) * ih;
    for (let y = 1; y <= H; y++) {
      const srcY = y - 1;
      const vMag = magsArr[baseSrc + srcY] || 0;
      const vPhase = phasesArr[baseSrc + srcY] || 0;
      const idx = baseIntX + y;
      intMag[idx] = vMag + intMag[baseIntXminus1 + y] + intMag[baseIntX + (y - 1)] - intMag[baseIntXminus1 + (y - 1)];
      intPhase[idx] = vPhase + intPhase[baseIntXminus1 + y] + intPhase[baseIntX + (y - 1)] - intPhase[baseIntXminus1 + (y - 1)];
    }
  }

  return { intMag, intPhase, iw, ih, W, H };
}

function queryIntegralSum(integral, x0, y0, x1, y1) {
  const { intMag, intPhase, ih } = integral;
  const sx0 = x0 + 1, sy0 = y0 + 1, sx1 = x1 + 1, sy1 = y1 + 1;
  const idxA = sx1 * ih + sy1;
  const idxB = (sx0 - 1) * ih + sy1;
  const idxC = sx1 * ih + (sy0 - 1);
  const idxD = (sx0 - 1) * ih + (sy0 - 1);
  const sumMag = intMag[idxA] - intMag[idxB] - intMag[idxC] + intMag[idxD];
  const sumPhase = intPhase[idxA] - intPhase[idxB] - intPhase[idxC] + intPhase[idxD];
  return { sumMag, sumPhase };
}

function previewShape(__cx, __cy) {
  lastPreviewCoords = { __cx, __cy };
  if (pendingPreview) return;
  pendingPreview = true;
  
  requestAnimationFrame(() => {
    pendingPreview = false;
    const cx=lastPreviewCoords.__cx;
    const cy=lastPreviewCoords.__cy;
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
      const radiusX = (desiredScreenMax / 8) / pixelsPerFrame;
      const radiusY = (desiredScreenMax / 8) / pixelsPerBin;
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
  const brushMag = (brushBrightness / 255) * 128;

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
        drawPixelFrame(px, py, brushMag, phaseShift, brushOpacity, phaseStrength); 
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

    const oldMag = magsArr[idx] || 0;
    const oldPhase = phasesArr[idx] || 0;
    const newMag = (currentTool === "amplifier")
                 ? (oldMag * amp)
                 : (currentTool === "noiseRemover")
                 ? (oldMag > dbt?oldMag:(oldMag*(1-bo)))
                 :(oldMag * (1 - bo) + mag * bo);
    const type = phaseTextureEl.value;
    let $phase = computePhaseTexture(type, bin, xI, phase);
    const newPhase = oldPhase * (1-po) + po * ($phase);
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
  const po = currentTool === "eraser" ? 1 : phaseStrength;
  const bo = currentTool === "eraser" ? 1 : brushOpacity;
  const brushMag = currentTool === "eraser" ? 0 : (brushBrightness / 255) * 128;
  const brushPhase = currentTool === "eraser" ? 0 : phaseShift;

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

      while (true) {
          for (let dx = -half; dx <= half; dx++) {
            const px = x0 + dx;
            const py = y0;
            if (px >= 0 && px < specWidth && py >= 0 && py < specHeight) {
              dp(px, py, brushMag, phaseShift, brushOpacity, phaseStrength); 
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
    const po = currentTool === "eraser" ? 1 : phaseStrength;
    const bo = currentTool === "eraser" ? 1 : brushOpacity;
    const radiusY = Math.floor(brushSize/2/canvas.getBoundingClientRect().height*canvas.height);
    const radiusXFrames = Math.floor(brushSize/2/canvas.getBoundingClientRect().width*canvas.width);
    const minXFrame = Math.max(0, Math.floor(cx - radiusXFrames));
    const maxXFrame = Math.min(fullW - 1, Math.ceil(cx + radiusXFrames));
    const minY = Math.max(0, Math.floor(cy - radiusY));
    const maxY = Math.min(fullH - 1, Math.ceil(cy + radiusY));
    const radiusXsq = radiusXFrames * radiusXFrames;
    const radiusYsq = radiusY * radiusY;
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

            drawPixelFrame(cxPix, cyPix, mag, phase, brushOpacity * a, phaseStrength * a);
          }
        }
      }
    } else if (currentTool === "color" || currentTool === "eraser" || currentTool === "amplifier" || currentTool === "noiseRemover") {
        const brushMag = currentTool === "eraser" ? 0 : (brushBrightness / 255) * 128;
        const brushPhase = currentTool === "eraser" ? 0 : phaseShift;
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