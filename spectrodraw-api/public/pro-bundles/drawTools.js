function computeNoiseProfileFromFrames(ch, startFrame, endFrame) {
  const mags = layers[ch].mags;
  const frameCount = Math.max(1, endFrame - startFrame);

  // median per-bin (robust)
  const noiseProfile = new Float32Array(specHeight);
  const temp = new Float32Array(frameCount);

  for (let bin = 0; bin < specHeight; bin++) {
    let ti = 0;
    for (let frame = startFrame; frame < endFrame; frame++) {
      temp[ti++] = mags[frame * specHeight + bin] || 0;
    }
    // sort only the used portion
    const part = Array.from(temp.subarray(0, frameCount));
    part.sort((a, b) => a - b);
    noiseProfile[bin] = part[(frameCount / 2) | 0];
  }

  // small frequency smoothing (3-tap) to avoid narrow spikes
  if (specHeight > 2) {
    const sm = new Float32Array(specHeight);
    sm[0] = (noiseProfile[0] * 0.75 + noiseProfile[1] * 0.25);
    for (let i = 1; i < specHeight - 1; i++) {
      sm[i] = noiseProfile[i - 1] * 0.25 + noiseProfile[i] * 0.5 + noiseProfile[i + 1] * 0.25;
    }
    sm[specHeight - 1] = (noiseProfile[specHeight - 2] * 0.25 + noiseProfile[specHeight - 1] * 0.75);
    return sm;
  }

  return noiseProfile;
}

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
function computePhaseTexture(type, bin, frameIndex, basePhase, isSprite) {
  const fx = isSprite?getSpriteById(selectedSpriteId).effect:null;
  const e = {
    t0:isSprite?fx.t0:t0,
    tau:isSprite?fx.tau:tau,
    sigma:isSprite?fx.sigma:sigma,
    harmonicCenter:isSprite?fx.harmonicCenter:harmonicCenter,
    userDelta:isSprite?fx.userDelta:userDelta,
    refPhaseFrame:isSprite?fx.refPhaseFrame:refPhaseFrame,
    chirpRate:isSprite?fx.chirpRate:chirpRate
  }
  const FFT = fftSize;
  const fs = sampleRate;
  const hopLocal = hop;
  const ch = currentLayer;
  const twoPi = 2 * Math.PI;
  const k = bin | 0; 
  const fk = (k * fs) / FFT; 
  let phi = 0;
  switch (type) {
    case 'Harmonics':
      phi = (k / specHeight * FFT / 2);
      break;
    case 'Static':
      phi = Math.random()*Math.PI*2;
      break;
    case 'Flat':
      phi = basePhase;
      break;
    case 'ImpulseAlign':
      phi = -twoPi * fk * e.t0 + basePhase;
      break;
    case 'FrameAlignedImpulse': {
      const frameTime = (frameIndex * hopLocal) / fs;
      const t0f = frameTime + (hopLocal / (2 * fs));
      phi = -twoPi * fk * t0f + basePhase;
    } break;
    case 'ExpectedAdvance':
      phi = basePhase + twoPi * fk * (frameIndex * hopLocal) / fs;
      break;
    case 'PhasePropagate': {
      const prevIdx = (frameIndex - 1) * specHeight + k;
      let prevPhase = null;
      if (frameIndex > 0 && layers[ch] && layers[ch].phases && layers[ch].phases[prevIdx] !== undefined) {
        prevPhase = layers[ch].phases[prevIdx];
      }
      if (prevPhase !== null && isFinite(prevPhase)) {
        const expected = prevPhase + twoPi * fk * (hopLocal / fs);
        phi = expected + e.userDelta;
      } else {
        phi = twoPi * fk * (frameIndex * hopLocal) / fs;
      }
    } break;
    case 'RandomSmall':
      phi = basePhase + (Math.random() * 2 - 1) * e.sigma;
      break;
    case 'HarmonicStack': {
      const center = Math.max(1, e.harmonicCenter);
      phi = -twoPi * fk * e.t0 + ((k % center) * 0.12);
    } break;
    case 'LinearDelay':
      phi = -twoPi * fk * e.tau + basePhase;
      break;
    case 'Chirp':
      phi = basePhase - twoPi * fk * ((frameIndex * hopLocal) / fs) - Math.pow(k, 1.05) * e.chirpRate;
      break;
    case 'CopyFromRef': {
      const refIx = (e.refPhaseFrame * specHeight + k) | 0;
      phi = (layers[ch] && layers[ch].phases) ? layers[ch].phases[refIx] || 0 : 0;
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
      phi = basePhase;
      break;
  }
  return wrapPhase(phi);
}
function applyImageToChannel(ch, img, dstOx, dstOy, dstW, dstH, boMult = 1, poMult = 1) {
  if (!img || !img.complete || img.naturalWidth === 0) return;
  const fullW = specWidth;
  const fullH = specHeight;
  let integral = (currentTool === "blur")?buildIntegral(fullW, fullH, layers[ch].mags, layers[ch].phases):null;
  const ox = Math.floor(dstOx);
  const oy = Math.floor(dstOy);
  const drawW = Math.max(0, Math.min(fullW - ox, Math.max(0, Math.round(dstW))));
  const drawH = Math.max(0, Math.min(fullH - oy, Math.max(0, Math.round(dstH))));
  if (drawW <= 0 || drawH <= 0) return;
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = drawW;
  tempCanvas.height = drawH;
  const tctx = tempCanvas.getContext("2d");
  tctx.imageSmoothingEnabled = false;
  tctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, drawW, drawH);
  const imgData = tctx.getImageData(0, 0, drawW, drawH);
  const chPressure = (layers[ch] && layers[ch].brushPressure) ? layers[ch].brushPressure : 1;
  for (let yy = 0; yy < drawH; yy++) {
    for (let xx = 0; xx < drawW; xx++) {
      const pix = (yy * drawW + xx) * 4;
      const r = imgData.data[pix];
      const g = imgData.data[pix + 1];
      const b = imgData.data[pix + 2];
      const a = imgData.data[pix + 3] / 255;
      if (a <= 0) continue;
      const cxPix = ox + xx;
      const cyPix = oy + yy;
      let mag, phase, pan;
      if (currentTool === "eraser") {
        mag = 0;
        phase = 0;
        pan = 0.5;
      } else if (currentTool === "blur") {
        const binCenter = Math.round(displayYToBin(cyPix, fullH, ch));
        const rB = blurRadius | 0;
        const x0 = Math.max(0, cxPix - rB);
        const x1 = Math.min(fullW - 1, cxPix + rB);
        const y0 = Math.max(0, binCenter - rB);
        const y1 = Math.min(fullH - 1, binCenter + rB);
        const { sumMag, sumPhase } = queryIntegralSum(integral, x0, y0, x1, y1);
        const count = (x1 - x0 + 1) * (y1 - y0 + 1) || 1;
        mag   = sumMag   / count;
        phase = sumPhase / count;
        pan = layers[ch].pans[xx*specHeight+yy];
      } else {
        [mag, phase, pan] = rgbToMagPhasePan(r, g, b);
      }
      if (cxPix >= 0 && cyPix >= 0 && cxPix < fullW && cyPix < fullH) {
        const bo = brushOpacity * a * chPressure * boMult;
        const po = phaseStrength * a * poMult;
        drawPixel(cxPix, cyPix, mag, phase, pan, bo, po, ch);
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
function drawSpriteOutline(useDelta,cx,cy){
  let $s = spritePath.ch==="all"?0:spritePath.ch, $e = spritePath.ch==="all"?layerCount:spritePath.ch+1;
  for (let ch=$s;ch<$e;ch++){
    const overlayCanvas = document.getElementById("overlay-"+ch);
    const canvas = document.getElementById("canvas-"+ch);
    const overlayCtx = overlayCanvas.getContext("2d");
    const framesVisible = Math.max(1, iHigh - iLow);
    const mapX = (frameX) => ((frameX - iLow) * canvas.width) / framesVisible;
    const mapY = (binY)   => (binY * canvas.height) / Math.max(1, specHeight);
    const pts = spritePath.points.map(p => ({ x: mapX(p.x), y: mapY(p.y) }));
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
    ctx.fillStyle = "rgba(255,200,0,0.08)"; 
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
  let ch = currentLayer;
  const overlayCanvas = document.getElementById("overlay-" + ch);
  if (!overlayCanvas) return;
  const ctx = overlayCanvas.getContext("2d");
  ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  const startFrame = Math.max(0, Math.min(framesTotal - 1, Math.round(cx)));
  const endFrame = Math.min(framesTotal, cx + Math.floor((draggingSample ? draggingSample.pcm[0].length : 0) / (hop || 1)));
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
function previewShape(cx, cy) {
  lastPreviewCoords = { cx, cy };
  if (pendingPreview) return;
  pendingPreview = true;
  requestAnimationFrame(() => {
    pendingPreview = false;
    const { cx, cy } = lastPreviewCoords;
    const overlayCanvas = document.getElementById("overlay-"+currentLayer); 
    const ctx = overlayCanvas.getContext("2d"); 
    const canvas = document.getElementById("canvas-"+currentLayer); 
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    drawCursor(true);
    if (changingNoiseProfile) {
      if (currentPanel!=="2"){
        noiseProfileMin = Math.min(noiseProfileMin,Math.floor(cx));
        noiseProfileMax = Math.max(noiseProfileMax,Math.floor(cx));
      } else {
        const e = getSpriteById(selectedSpriteId).effect;
        e.noiseProfileMin = Math.min(e.noiseProfileMin,Math.floor(cx));
        e.noiseProfileMax = Math.max(e.noiseProfileMax,Math.floor(cx));
      }
      updateNoiseProfile(false);
      const framesVisible = Math.max(1, iHigh - iLow);
      const overlayCanvas = document.getElementById("overlay-" + currentLayer);
      const ctx = overlayCanvas.getContext("2d");
      const mapX = (frameX) => ((frameX - iLow) * overlayCanvas.width) / framesVisible;
      let xPixel;
      let endPixel; 
      if (currentPanel==="2"){
        const e = getSpriteById(selectedSpriteId).effect;
        xPixel= mapX(e.noiseProfileMin);
        endPixel= mapX(e.noiseProfileMax);
      } else {
        xPixel= mapX(noiseProfileMin);
        endPixel= mapX(noiseProfileMax);
      }
      const width = Math.max(1, Math.round(endPixel - xPixel));
      ctx.save();
      ctx.fillStyle = "rgba(255,0,0,0.15)";
      ctx.fillRect(Math.round(xPixel), 0, width, overlayCanvas.height);
      ctx.restore();
      return;
    }
    if (draggingSample !== null) {
      drawSampleRegion(cx);
      return;
    }
    if (movingSprite) {
      drawSpriteOutline(true,cx,cy);
      return;
    }
    if (currentShape==="select"){
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = Math.max(1, Math.min(4, Math.floor(framesTotal / 100)));
      ctx.setLineDash([40, 40]);
      ctx.lineDashOffset = 0;
      ctx.strokeRect(startX + 0.5, startY + 0.5, cx - startX, cy - startY);
      ctx.restore();
      ctx.setLineDash([0, 0]);
      return;
    }
    const dragToDraw = !!(document.getElementById("dragToDraw") && document.getElementById("dragToDraw").checked);
    const x = (currentCursorX - iLow) * canvas.width / (iHigh - iLow);
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
    const rect = canvas.getBoundingClientRect();
    const pixelsPerFrame = rect.width  / Math.max(1, canvas.width);
    const pixelsPerBin   = rect.height / Math.max(1, canvas.height);
    const bw = brushWidth;
    const bh = brushHeight;
    if (currentShape === "image" && images[selectedImage] && images[selectedImage].img) {
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
        const screenW = Math.max(1, bw);
        const screenH = Math.max(1, bh);
        const overlayW = Math.max(1, Math.round(screenW / pixelsPerFrame));
        const overlayH = Math.max(1, Math.round(screenH / pixelsPerBin));
        ctx.strokeRect(cx - overlayW / 2, cy - overlayH / 2, overlayW, overlayH);
      }
      ctx.restore();
      return;
    }
    if (currentShape === "stamp" && currentStamp !== null) {
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
        const screenW = Math.max(1, bw);
        const screenH = Math.max(1, bh);
        const overlayW = Math.max(1, Math.round(screenW / pixelsPerFrame));
        const overlayH = Math.max(1, Math.round(screenH / pixelsPerBin));
        ctx.strokeRect(cx - overlayW / 2, cy - overlayH / 2, overlayW, overlayH);
      }
      ctx.restore();
      return;
    }
    if (currentShape === "brush") {
      const radiusX = (bw / 2) / pixelsPerFrame; 
      const radiusY = (bh / 2) / pixelsPerBin;   
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(0.5, radiusX), Math.max(0.5, radiusY), 0, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.restore();
      return;
    }
  });
}
function line(startFrame, endFrame, startSpecY, endSpecY, lineWidth) {
  let $s = syncLayers?0:currentLayer, $e = syncLayers?layerCount:currentLayer+1;
  for (let ch=$s;ch<$e;ch++){
    let x0 = (startFrame <= endFrame) ? startFrame : endFrame;
    let x1 = (startFrame <= endFrame) ? endFrame : startFrame;
    const startWasLeft = (startFrame <= endFrame);
    let yStartSpec = startWasLeft ? startSpecY : endSpecY;
    let yEndSpec   = startWasLeft ? endSpecY   : startSpecY;
    const brushMag = (parseExpression(getExpressionById("brushBrightnessDiv")) / 255) * 128;
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
          drawPixel(px, py, brushMag, phaseShift, brushOpacity* layers[ch].brushPressure, phaseStrength, ch); 
        }
      }
      if (x0 === x1 && y0 === y1) break;
      const e2 = err;
      if (e2 > -dx) { err -= dy; x0 += sx; }
      if (e2 < dy)  { err += dx; y0 += sy; }
    }
  }
}
let binToTopDisplay = new Array(layerCount);
let binToBottomDisplay = new Array(layerCount);
function buildBinDisplayLookup() {
  for (let l=0;l<layerCount;l++){
    binToTopDisplay[l] = new Float32Array(specHeight);
    binToBottomDisplay[l] = new Float32Array(specHeight);
    for (let b = 0; b < specHeight; b++) {
      binToTopDisplay[l][b] = binToDisplayY(b - 0.5, specHeight,l);
      binToBottomDisplay[l][b] = binToDisplayY(b + 0.5, specHeight,l);
    }
  }
}
function addPixelToSprite(sprite, x, y, prevMag, prevPhase, prevPan, nextMag, nextPhase, nextPan,l) {
  let col;
  try{col=sprite.pixels[l].get(x);}catch(e){col=null};
  if (!col) {
    col = {
      ys: [],
      prevMags: [],
      prevPhases: [],
      prevPans: [],
      nextMags: [],
      nextPhases: [],
      nextPans: [],
    };
    if (sprite.pixels[l]) sprite.pixels[l].set(x, col);
  }
  //console.log(col);
  if (col.ys.includes(y)){
    const idx = col.ys.indexOf(y);
    col.prevMags[idx]=prevMag;
    col.prevPhases[idx]=prevPhase;
    col.prevPans[idx]=prevPan;
    col.nextMags[idx]=nextMag;
    col.nextPhases[idx]=nextPhase;
    col.nextPans[idx]=nextPan;
  } else {
    col.ys.push(y);
    col.prevMags.push(prevMag);
    col.prevPhases.push(prevPhase);
    col.prevPans.push(prevPan);
    col.nextMags.push(nextMag);
    col.nextPhases.push(nextPhase);
    col.nextPans.push(nextPan);
  }
  if (x < sprite.minCol) sprite.minCol = x;
  if (x > sprite.maxCol) sprite.maxCol = x;
  if (sprite.effect.shape!=="select")updateSelections(x,y,l,prevMag,prevPhase,prevPan,nextMag,nextPhase,nextPan);
}
function updateSelections(x,y,ch,prevMag,prevPhase,prevPan,nextMag,nextPhase,nextPan){
  for (let s of sprites){
    if (s.effect.shape==="select" && s.ch===ch && x>=s.minCol && x<=s.maxCol && y>=s.minY && y<=s.maxY){
      addPixelToSprite(s,x,y,prevMag,prevPhase,prevPan,nextMag,nextPhase,nextPan,ch);
    }
  }
}
function computePanTexture(type,initialPan,panStrength,x,y,pan,useExpressions,useAmplifier,band){
  if (useAmplifier) {
    return initialPan*panStrength;
  }
  if (useExpressions) {
    const expr = getExpressionById("brushPanTextureDiv");
    if (expr.hasChanged || type==="Custom") return parseExpression(expr);
  }
  const $pan = ((pan, x, y) => {
    switch (type) {
      case 'Flat':
        return pan;
      case 'Random':
        return (Math.random() + pan) % 1;
      case 'XCircles':
        return (Math.sin(x/(sampleRate*0.63661/hop))/2+0.5 + pan) % 1;
      case 'YCircles':
        return (Math.sin(y/(sampleRate*0.63661/hop))/2+0.5 + pan) % 1;
      case 'Band':
        return (Math.pow((1/(specHeight*10)+1),(0-Math.pow(y-band),2)) + pan) % 1;
    }
  })(pan, x, y);
  return initialPan*(1-panStrength) + $pan*panStrength;
}
function pseudoRand(seed) {
  // simple xorshift-ish
  let x = (seed * 1664525 + 1013904223) | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 4294967295;
}
function drawPixel(xFrame, yDisplay, mag, phase, pan, bo, po, ch) {
  const xI = (xFrame + 0.5) | 0;
  if (xI < 0 || xI >= specWidth) return;
  const idxBase = xI * specHeight;
  const imgData = imageBuffer[ch].data;
  const phasesArr = layers[ch].phases;
  let displayYFloat = yDisplay;
  const f = getSineFreq(yDisplay);
  if (alignPitch) {
    let nearestPitch = Math.round(npo * Math.log2(f / startOnP));
    while (notesCircle._notes[nearestPitch % npo] === 0) nearestPitch++;
    nearestPitch = startOnP * Math.pow(2, nearestPitch / npo);
    displayYFloat = ftvsy(nearestPitch, ch);
  }
  function processBin(bin, boScaled,opts={}) {
    bin = Math.max(0, Math.min(specHeight - 1, Math.round(bin)));
    const idx = idxBase + bin;
    if (idx < 0 || idx >= layers[ch].mags.length) return;
    if (visited && visited[ch][idx] === 1) return;
    if (visited) visited[ch][idx] = 1;
    const oldMag = layers[ch].mags[idx] || 0;
    const oldPhase = phasesArr[idx] || 0;
    const panToUse = (typeof opts.panOverride !== 'undefined') ? opts.panOverride : pan;
    const phaseToUse = (typeof opts.phaseOverride !== 'undefined') ? opts.phaseOverride : phase;
    const magToUse = (typeof opts.magOverride !== 'undefined') ? opts.magOverride : mag;
    function mod(n, m) {
      return ((n % m) + m) % m;
    }
    const clonerPos = (currentTool === "cloner")?
    (Math.floor(mod(clonerX + (xFrame-startX)/clonerScale ,framesTotal)+iLow)*specHeight+
     Math.floor(mod(binShift, specHeight ))
    ):null;
    const newMag = (currentTool === "amplifier")
                ? (oldMag * amp)
                : (currentTool === "noiseRemover")
                ? Math.max(oldMag * (1 - boScaled) + (oldMag*(1 - (noiseAgg * noiseProfile[bin]) / oldMag)) * boScaled,0)
                : (currentTool === "cloner")
                ? (oldMag * (1 - bo) + (layers[clonerCh].mags[clonerPos] * cAmp) * bo)
                : (oldMag * (1 - boScaled) + magToUse * boScaled);
    const type = phaseTextureEl.value;
    parseExpression.vars["pixel.frame"]= xI;
    parseExpression.vars["pixel.bin"]= bin;

    if (currentTool === "fill" || currentTool === "eraser"|| currentTool === "cloner") {
      let $phase;
      if (currentTool === "cloner") {
        $phase = layers[clonerCh].phases[clonerPos];
      } else {
        if (type==="HopArtifact") {
          $phase = computePhaseTexture(type, bin, xI, phaseToUse, false);
        } else {
          const expr = getExpressionById("phaseTextureDiv");
          if (expr.hasChanged || type==="Custom") {$phase = parseExpression(expr);}
          else {$phase = computePhaseTexture(type, bin, xI, phaseToUse, false);}
        }
      }
      layers[ch].phases[idx] = oldPhase * (1 - po) + po * ($phase);
    }
    const clampedMag = Math.min(newMag, 255);
    layers[ch].pans[idx] = computePanTexture(document.getElementById("brushPanTexture").value,layers[ch].pans[idx],panStrength,xI,bin,panToUse,true,currentTool==="amplifier",panBand);
    layers[ch].mags[idx] = oldMag*(1-magStrength)+clampedMag*magStrength;
    const yTopF = binToTopDisplay[ch][bin];
    const yBotF = binToBottomDisplay[ch][bin];
    const yStart = Math.max(0, Math.floor(Math.min(yTopF, yBotF)));
    const yEnd   = Math.min(specHeight - 1, Math.ceil(Math.max(yTopF, yBotF)));
    const [r, g, b] = magPhasePanToRGB(clampedMag, layers[ch].phases[idx], pan);
    for (let yPixel = yStart; yPixel <= yEnd; yPixel++) {
      const pix = (yPixel * specWidth + xI) * 4;
      imgData[pix]     = r;
      imgData[pix + 1] = g;
      imgData[pix + 2] = b;
      imgData[pix + 3] = 255;
    }
  }
  const binShift = (currentTool==="cloner")?displayYToBin(clonerY+(yDisplay-visibleToSpecY(startY))/clonerScale,specHeight,ch):null;
  if (currentShape === "note" || currentShape === "line") {
    const harmArr = harmonics;
    let i = 0, binF = 0;
    while (binF<specHeight && i<400) {
      const harmVal = Math.max(0, Math.min(1, ((i>=harmArr.length)?(harmArr[harmArr.length-1]):(harmArr[i]))));
      if (harmVal < 0.001) {i++; continue;}
      const freqI = getSineFreq(displayYFloat) * (i + 1);
      const displayY_i = ftvsy(freqI, ch);
      binF = displayYToBin(displayY_i, specHeight, ch);
      const velFactor = (currentShape==="note")?(20/(mouseVelocity===Infinity?20:mouseVelocity)):1;
      if (document.getElementById("enableChorus").checked && chorusVoices > 1) {
        // split harmonic energy across voices; preserve approximate total energy:
        // main voice gets some portion, others get (chorusWet / voices) each.
        const baseMag = mag * harmVal * 1;
        const perVoiceMag = baseMag * (chorusVoiceStrength / chorusVoices);
        const mainMagRemain = baseMag * (1 - chorusVoiceStrength);

        // main (center) voice - write the central (unshifted) bin
        processBin(binF, bo * (mainMagRemain / mag), { panOverride: pan, magOverride: mainMagRemain });

        // voices
        for (let v = 0; v < chorusVoices; v++) {
          // spread voices across [-detune, +detune] linearly, plus some randomness
          const t = (chorusVoices === 1) ? 0.5 : (v / (chorusVoices - 1)); // 0..1
          const detuneBase = (t - 0.5) * 2 * chorusDetune; // range [-detune, +detune] cents
          const r = pseudoRand((xI << 16) ^ (i << 8) ^ v);
          const detuneJ = (r - 0.5) * 2 * chorusRandomness * chorusDetune; // jitter in cents
          const detuneCents = detuneBase + detuneJ;
          const freqVoice = freqI * Math.pow(2, detuneCents / 1200);
          const displayY_voice = ftvsy(freqVoice, ch);
          const binVoice = displayYToBin(displayY_voice, specHeight, ch);

          // pan per voice: linearly map across spread, plus jitter
          const panBase = pan + (t - 0.5) * (chorusPanSpread*2-1);
          const panJ = (r - 0.5) * 2 * chorusRandomness * (chorusPanSpread*2-1);
          const panVoice = Math.max(-1, Math.min(1, panBase + panJ));

          const phaseJ = (r - 0.5) * 2 * chorusRandomness * Math.PI * 0.4; // small phase jitter
          const phaseVoice = phase + phaseJ;

          // call processBin for this voice with its own pan and mag
          processBin(binVoice, bo * (perVoiceMag), { panOverride: panVoice, phaseOverride: phaseVoice, magOverride: perVoiceMag });
        }
      } else {
        // no chorus: normal single harmonic
        processBin(binF, bo * harmVal * velFactor);
      }
      i++;
    }
    return;
  }
  const topBinF = displayYToBin(displayYFloat - 0.5, specHeight, ch);
  const botBinF = displayYToBin(displayYFloat + 0.5, specHeight, ch);
  let binStart = Math.floor(Math.min(topBinF, botBinF));
  let binEnd   = Math.ceil (Math.max(topBinF, botBinF));
  if (!Number.isFinite(binStart)) binStart = 0;
  if (!Number.isFinite(binEnd))   binEnd   = 0;
  binStart = Math.max(0, binStart);
  binEnd   = Math.min(specHeight - 1, binEnd);
  for (let bin = binStart; bin <= binEnd; bin++) {
    const velFactor = (currentShape==="note")?(20/(mouseVelocity===Infinity?20:mouseVelocity)):1;
    processBin(bin, bo*velFactor);
  }
}
function applyEffectToPixel(oldMag, oldPhase, oldPan, x, bin, newEffect, integral) {
  const tool = newEffect.tool || currentTool;
  let mag, phase;
  if (tool === "blur") {
    const binCenter = Math.round(displayYToBin(bin, specHeight, currentLayer));
    const r = newEffect.blurRadius;
    const x0 = Math.max(0, x - r);
    const x1 = Math.min(specWidth - 1, x + r);
    const y0 = Math.max(0, binCenter - r);
    const y1 = Math.min(specHeight - 1, binCenter + r);
    const { sumMag, sumPhase } = queryIntegralSum(integral, x0, y0, x1, y1);
    const count = (x1 - x0 + 1) * (y1 - y0 + 1) || 1;
    mag = sumMag / count; phase = sumPhase / count;
  } else {
    mag = (tool === "eraser" ? 0 : (newEffect.brushBrightness  !== undefined) ? newEffect.brushBrightness  :128);
    phase=(tool === "eraser" ? 0 : (newEffect.phaseShift!== undefined) ? newEffect.phaseShift:  0);
  }
  const bo =  (tool === "eraser" ? 1 : (newEffect.brushOpacity   !== undefined) ? newEffect.brushOpacity   :  1)* layers[ch].brushPressure;
  const po =  (tool === "eraser" ? 0 : (newEffect.phaseStrength  !== undefined) ? newEffect.phaseStrength  :  0);
  const _amp = newEffect.amp || amp;
  const newMag =  (tool === "amplifier" || tool === "sample")
                ? (oldMag * _amp)
                : (currentTool === "noiseRemover")
                ? Math.max(oldMag * (1 - bo) + (oldMag*(1 - (newEffect.noiseAgg * newEffect.noiseProfile[bin]) / oldMag)) * bo,0)
                : (oldMag * (1 - bo) + mag * bo);
  const type = newEffect.phaseTexture;
  let $phase = computePhaseTexture(type, bin, x+0.5, phase, true);
  const newPhase = (tool === "sample")?(oldPhase+phase):(oldPhase * (1-po) + po * ($phase + phase*2));
  const clampedMag = Math.min(newMag, 255);

  const newPan = computePanTexture(newEffect.panTexture,0.5,newEffect.panStrength,x+0.5,bin,newEffect.panShift,false,newEffect.tool==="amplifier",newEffect.panBand);
  return { mag: oldMag*(1-newEffect.magStrength)+clampedMag*newEffect.magStrength, phase: newPhase, pan: newPan};
}
function commitShape(cx, cy) {
  let $s = syncLayers?0:currentLayer, $e = syncLayers?layerCount:currentLayer+1;
  for (let ch=$s;ch<$e;ch++){
    let mags = layers[ch].mags, phases = layers[ch].phases;
    if (!mags || !phases) return;
    const fullW = specWidth;
    const fullH = specHeight;
    const gpo = currentTool === "eraser" ? 1 : phaseStrength;
    const expressionpo = getExpressionById("phaseStrengthDiv");
    function po() { return expressionpo.expression.includes("pixel.")?(currentTool === "eraser" ? 1 : parseExpression(expressionpo)):gpo; }
    const gbo = (currentTool === "eraser" ? 1 : brushOpacity)* layers[ch].brushPressure;
    const expressionbo = getExpressionById("opacityDiv");
    function bo(){return expressionbo.expression.includes("pixel.")?(currentTool === "eraser" ? 1 : parseExpression(expressionbo)* layers[ch].brushPressure):gbo;}
    const gBrushMag = (currentTool === "eraser" ? 0 : (brushBrightness / 255) * 128);
    const expressionBrushMag = getExpressionById("brushBrightnessDiv");
    function brushMag(){return expressionBrushMag.expression.includes("pixel.")?(currentTool === "eraser" ? 0 : (parseExpression(expressionBrushMag) / 255) * 128):gBrushMag;}
    const brushPhase = currentTool === "eraser" ? 0 : phaseShift;
    const brushPan = currentTool === "eraser" ? 0.5 : panShift;
    const visitedLocal = Array.from({ length: layerCount }, () => new Uint8Array(fullW * fullH));
    const savedVisited = visited;
    visited = visitedLocal;
    let integral = null;
    if (currentTool === "blur") {
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
      function dp(xFrame, yDisplay, mag, phase, pan, bo, po, ch){
        if (currentTool === "blur") {
          const binCenter = Math.round(displayYToBin(yDisplay, fullH, ch));
          const r = blurRadius | 0;
          const x0 = Math.max(0, xFrame - r);
          const x1 = Math.min(fullW - 1, xFrame + r);
          const y0 = Math.max(0, binCenter - r);
          const y1 = Math.min(fullH - 1, binCenter + r);
          const { sumMag, sumPhase } = queryIntegralSum(integral, x0, y0, x1, y1);
          const count = (x1 - x0 + 1) * (y1 - y0 + 1) || 1;
          drawPixel(xFrame, yDisplay, sumMag / count, sumPhase / count, pan, bo, po, ch);
        } else {
          drawPixel(xFrame, yDisplay, mag, phase, pan, bo, po, ch);
        }
      }
      if (currentShape === "rectangle") {
        let binA = displayYToBin(y0Spec, fullH, ch);
        let binB = displayYToBin(y1Spec, fullH, ch);
        if (binA > binB) { const t = binA; binA = binB; binB = t; }
        binA = Math.max(0, Math.min(fullH - 1, Math.round(binA)));
        binB = Math.max(0, Math.min(fullH - 1, Math.round(binB)));
        if (currentTool === "autotune"){
          let pixels = [];
          for (let xx = x0Frame; xx <= x1Frame; xx++) {
            for (let bin = binA; bin <= binB; bin++) {
              pixels.push([xx,bin]);
            }
          }
          applyAutotuneToPixels(ch,pixels);
        } else {
          for (let xx = x0Frame; xx <= x1Frame; xx++) {
            for (let bin = binA; bin <= binB; bin++) {
              const displayY = binToBottomDisplay[ch][bin];
              dp(xx, displayY, brushMag(), brushPhase, brushPan, bo(), po(), ch);
            }
          }
        }
        return;
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
        const half = (document.getElementById("enableChorus").checked&&chorusVoices>1)?0.5:Math.floor(brushSize / 8);
        let pixels = [];
        while (true) {
          for (let dx = -half; dx <= half; dx++) {
            const px = x0 + dx;
            const py = y0;
            if (px >= 0 && px < specWidth && py >= 0 && py < specHeight) {
              if (currentTool !== "autotune") {
                dp(px, py, brushMag(), brushPhase, brushPan, bo(), po(), ch);
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
        if (currentTool === "autotune") applyAutotuneToPixels(ch,pixels,opts={expand:5});
        return;
      }
      const dragToDraw = document.getElementById("dragToDraw").checked;
      if (currentShape === "image") {
        if (!images[selectedImage] || !images[selectedImage].img) {
        } else {
          const canvas = document.getElementById("canvas-"+ch);
          const screenRect = canvas.getBoundingClientRect();
          const pixelsPerFrame = screenRect.width  / Math.max(1, canvas.width);
          const pixelsPerBin   = screenRect.height / Math.max(1, canvas.height);
          if (dragToDraw && startX !== null && startY !== null) {
            const left   = Math.floor(Math.min(startVisX, cx));
            const top    = Math.floor(Math.min(startVisY, cy));
            const overlayW = Math.max(1, Math.round(Math.abs(cx - startVisX)));
            const overlayH = Math.max(1, Math.round(Math.abs(cy - startVisY)));
            applyImageToChannel(ch, images[selectedImage].img, left, top, overlayW, overlayH);
          } else {
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
function ftvsy(f,ch,l) {
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
  let $s = syncLayers?0:currentLayer, $e = syncLayers?layerCount:currentLayer+1;
  for (let ch=$s;ch<$e;ch++){
    const mags = layers[ch].mags, phases = layers[ch].phases;
    const canvas = document.getElementById("canvas-"+ch);
    const fullW = specWidth;
    const fullH = specHeight;
    const po = currentTool === "eraser" ? 1 : parseExpression(getExpressionById("phaseStrengthDiv"));
    const bo = (currentTool === "eraser") ? layers[ch].brushPressure : parseExpression(getExpressionById("opacityDiv"))*layers[ch].brushPressure;
    vr = ((currentShape==="brush"&&currentTool!=="cloner")?(Math.max( Math.min(1/Math.pow(mouseVelocity,0.5), Math.min(vr+0.01,1)) ,Math.max(vr-0.01,0.6) )):1);
    const radiusY = Math.floor((brushHeight/2/canvas.getBoundingClientRect().height*canvas.height)*vr);
    const radiusXFrames = Math.floor((brushWidth/2/canvas.getBoundingClientRect().width*canvas.width)*vr);
    const z = (currentShape==="note")
    const dx = (z?0:radiusXFrames), dy = (z?0:radiusY);
    const minXFrame = Math.max(0, Math.floor(Math.min(cx,prevMouseX) - dx));
    const maxXFrame = Math.min(fullW - 1, Math.ceil(Math.max(cx,prevMouseX) + dx));
    const prevRealY = visibleToSpecY(prevMouseY);
    const minY = Math.max(0, Math.floor(Math.min(cy,prevRealY) - dy));
    const maxY = Math.min(fullH - 1, Math.ceil((Math.max(cy,prevRealY)) + dy));
    const radiusXsq = radiusXFrames * radiusXFrames;
    const radiusYsq = radiusY * radiusY;
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
      const brushMag = currentTool === "eraser" ? 0 : (parseExpression(getExpressionById("brushBrightnessDiv")) / 255) * 128;
      const brushPhase = currentTool === "eraser" ? 0 : phaseShift;
      const brushPan = currentTool === "eraser" ? 0.5 : panShift;
      const p0x = prevMouseX + iLow;
      const p0y = visibleToSpecY(prevMouseY);
      const p1x = cx;   
      const p1y = cy;   
      const vx = p1x - p0x;
      const vy = p1y - p0y;
      const lenSq = vx * vx + vy * vy;
      const EPS = 1e-9;
      for (let yy = minY; yy <= maxY; yy++) {
        for (let xx = minXFrame; xx <= maxXFrame; xx++) {
          let t = 0;
          if (lenSq > EPS) {
            t = ((xx - p0x) * vx + (yy - p0y) * vy) / lenSq;
            if (t < 0) t = 0;
            else if (t > 1) t = 1;
          }
          const nearestX = p0x + t * vx;
          const nearestY = p0y + t * vy;
          const dx = xx - nearestX;
          const dy = yy - nearestY;
          if ((dx * dx) / radiusXsq + (dy * dy) / radiusYsq > (currentShape==="note"?0.001:1)) continue;
          drawPixel(xx, yy, brushMag, brushPhase, brushPan, bo, po, ch);
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
          const pan = layers[currentLayer].pans[xx*specHeight+yy];
          drawPixel(xx, yy, sumMag / count, sumPhase / count, pan, bo, po, ch);
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
    } else if (currentTool === "cloner") {
      const p0x = prevMouseX + iLow;
      const p0y = visibleToSpecY(prevMouseY);
      const p1x = cx;
      const p1y = cy;
      const vx = p1x - p0x;
      const vy = p1y - p0y;
      const lenSq = vx * vx + vy * vy;
      const EPS = 1e-9;
      for (let yy = minY; yy <= maxY; yy++) {
        for (let xx = minXFrame; xx <= maxXFrame; xx++) {
          let t = 0;
          if (lenSq > EPS) {
            t = ((xx - p0x) * vx + (yy - p0y) * vy) / lenSq;
            if (t < 0) t = 0;
            else if (t > 1) t = 1;
          }
          const nearestX = p0x + t * vx;
          const nearestY = p0y + t * vy;
          const dx = xx - nearestX;
          const dy = yy - nearestY;
          if ((dx * dx) / radiusXsq + (dy * dy) / radiusYsq > (currentShape==="note"?0.1:1)) continue;
          drawPixel(xx, yy, 1, phaseShift, 1, bo, po, ch);
        }
      }
    }
    const specCanvas = document.getElementById("spec-" + ch);
    const specCtx = specCanvas.getContext("2d");
    specCtx.putImageData(imageBuffer[ch], 0, 0);
  }
  renderView();
}
function applyAutotuneToPixels(ch, pixels, opts = {}) {
  if (!Array.isArray(pixels) || pixels.length === 0) return;
  const strength = opts.strength ?? autoTuneStrength;
  if (strength <= 0) return;
  const fullH = opts.fullH ?? specHeight;
  const fullW = opts.fullW ?? specWidth;
  const sampleRateLocal = opts.sampleRate ?? sampleRate;
  const fftSizeLocal = opts.fftSize ?? fftSize;
  const npoLocal = opts.npo ?? anpo;
  const startOnPLocal = opts.startOnP ?? aStartOnP;
  const binFreqStep = sampleRateLocal / fftSizeLocal;
  const pixBuf = imageBuffer[ch].data; 
  const magsArr = layers[ch].mags;     
  const phasesArr = layers[ch].phases; 
  const visitedArr = visited;
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
  const pixelWeights = new Array(fullH).fill(0);
  {
    const semitoneStep = 0.1;
    const mul = Math.pow(2, semitoneStep / npoLocal);
    let b = minBin;
    let pb = -1;
    while (b < maxBin) {
      pb = b;
      b = (b + 0.5) * mul - 0.5;
      const start = Math.max(0, Math.round(pb));
      const end = Math.min(fullH, Math.round(b));
      const denom = (b - pb) || 1;
      for (let i = start; i < end; i++) pixelWeights[i] = 1 / denom;
      if (end >= maxBin) break;
    }
    for (let i = minBin; i <= maxBin; i++) if (pixelWeights[i] === 0) pixelWeights[i] = 1;
  }
  const pxByX = new Map();
  for (let i = 0; i < pixels.length; i++) {
    const [xx, bin] = pixels[i];
    if (bin < 0 || bin >= fullH) continue;
    if (!pxByX.has(xx)) pxByX.set(xx, []);
    pxByX.get(xx).push(bin);
  }
  if (pxByX.size === 0) return;
  const xKeys = Array.from(pxByX.keys()).sort((a, b) => a - b);
  let processedColumns = 0;
  let processedPixelsCount = 0;
  for (const xx of xKeys) {
    const binsForX = pxByX.get(xx);
    if (!binsForX || binsForX.length === 0) continue;
    let sumW = 0;
    let sumWSemitone = 0;
    for (let j = 0; j < binsForX.length; j++) {
      const bin = binsForX[j];
      const idx = xx * fullH + bin;
      if (visitedArr&&visitedArr[ch][idx] === 1) continue; 
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
    const tMag = new Float64Array(fullH);
    let minBinTouched = fullH - 1;
    let maxBinTouched = 0;
    let anyWritten = false;
    for (let j = 0; j < binsForX.length; j++) {
      const srcBin = binsForX[j];
      const srcIdx = xx * fullH + srcBin;
      if (visitedArr&&visitedArr[ch][srcIdx] === 1) continue;
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
    for (let j = 0; j < binsForX.length; j++) {
      const srcBin = binsForX[j];
      const srcIdx = xx * fullH + srcBin;
      if (visitedArr&&visitedArr[ch][srcIdx] === 1) continue;
      if ((magsArr[srcIdx] || 0) > 0) {
        magsArr[srcIdx] = 0;
        if (visitedArr) visitedArr[ch][srcIdx] = 1;
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
    const fromBin = Math.max(0, minBinTouched - 1);
    const toBin = Math.min(fullH - 1, maxBinTouched + 1);
    for (let b = fromBin; b <= toBin; b++) {
      const dstIdx = xx * fullH + b;
      const newMag = Math.min(255, tMag[b] || 0);
      if (newMag > 0) {
        magsArr[dstIdx] = newMag;
        if (visitedArr) visitedArr[ch][dstIdx] = 1;
        processedPixelsCount++;
      } else {
        magsArr[dstIdx] = magsArr[dstIdx] || 0;
      }
      const yTopF = binToTopDisplay[ch][b];
      const yBotF = binToBottomDisplay[ch][b];
      const yStart = Math.max(0, Math.floor(Math.min(yTopF, yBotF)));
      const yEnd = Math.min(fullH - 1, Math.ceil(Math.max(yTopF, yBotF)));
      const [r, g, bl] = magPhasePanToRGB(magsArr[dstIdx], phasesArr[dstIdx], layers[ch].pans[dstIdx]);
      for (let yPixel = yStart; yPixel <= yEnd; yPixel++) {
        const pix = (yPixel * fullW + xx) * 4;
        pixBuf[pix] = r;
        pixBuf[pix + 1] = g;
        pixBuf[pix + 2] = bl;
        pixBuf[pix + 3] = 255;
      }
    }
    processedColumns++;
  } 
}