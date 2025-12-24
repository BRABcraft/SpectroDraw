// --- Frame-gains cache & pending bookkeeping (per-channel) ---
const frameGainsCache = Array.from({ length: channelCount }, () => new Map()); // Map<frameIndex, Float32Array gains>
const frameGainsPromises = Array.from({ length: channelCount }, () => new Map()); // Map<frameIndex, Promise>
const pendingBins = Array.from({ length: channelCount }, () => new Map()); // Map<frameIndex, Map<bin, boScaled>>
const frameMagsViewIdx = new Int32Array(channelCount).fill(-1); // last cached frame index per channel
const frameMagsView = Array.from({ length: channelCount }, () => null); // last cached subarray per channel

// optional global options for computeFrameGains
const denoiserOpts = {
  binFreqs: window.binFreqs || null,
  sampleRate: window.sampleRate || 48000,
  fftSize: window.fftSize || 4096,
  normalizeRef: 128.0,
  minGain: 0.02,
  maxGain: 1.0,
  kneeDb: 6.0
};

// Ensure frame gains are being computed (non-blocking). Returns Promise resolving to gains.
function ensureFrameGains(ch, xFrame) {
  const cache = frameGainsCache[ch];
  if (cache.has(xFrame)) return Promise.resolve(cache.get(xFrame));
  const promMap = frameGainsPromises[ch];
  if (promMap.has(xFrame)) return promMap.get(xFrame);

  // create promise and start async compute
  const p = (async () => {
    try {
      // get a snapshot mags view if available (prefer snapshot to avoid incremental edits compounding)
      const channel = channels[ch];
      const snapshot = channel && channel.snapshotMags ? channel.snapshotMags : null;
      const start = xFrame * specHeight;
      const end = start + specHeight;
      const magsView = snapshot ? snapshot.subarray(start, end) : channel.mags.subarray(start, end);

      // call computeFrameGains (user-provided earlier) with modelSession and magsView
      const gains = await computeFrameGains(denoiseModelSession, magsView, Object.assign({ binFreqs: denoiserOpts.binFreqs, sampleRate: denoiserOpts.sampleRate, fftSize: denoiserOpts.fftSize }, denoiserOpts));

      // store in cache
      frameGainsCache[ch].set(xFrame, gains);

      // if there are pending bins painted while computing, apply them now
      const pendingForFrame = pendingBins[ch].get(xFrame);
      if (pendingForFrame && pendingForFrame.size > 0) {
        applyFrameGainsToPendingBins(ch, xFrame, gains);
      }
      return gains;
    } catch (err) {
      console.warn('computeFrameGains failed for', ch, xFrame, err);
      // remove pending promise so we can retry later
      promMap.delete(xFrame);
      return null;
    } finally {
      // clear the promise entry
      promMap.delete(xFrame);
    }
  })();

  promMap.set(xFrame, p);
  return p;
}

// Record a painted bin as pending (so we can repaint it when gains arrive).
function markPendingBin(ch, xFrame, bin, boScaled) {
  let map = pendingBins[ch].get(xFrame);
  if (!map) {
    map = new Map();
    pendingBins[ch].set(xFrame, map);
  }
  // keep the maximum boScaled if multiple paints hit the same bin (stronger paint wins)
  const prev = map.get(bin);
  if (prev === undefined || boScaled > prev) map.set(bin, boScaled);
}

// Apply a frame's gains to the recorded pending bins and repaint those bins in the imageBuffer + canvas.
function applyFrameGainsToPendingBins(ch, xFrame, gains) {
  if (!gains) return;
  const map = pendingBins[ch].get(xFrame);
  if (!map || map.size === 0) return;

  const channel = channels[ch];
  const magsArr = channel.mags;
  const phasesArr = channel.phases;
  const snapshot = channel && channel.snapshotMags ? channel.snapshotMags : null;
  const startIdx = xFrame * specHeight;
  const imgData = imageBuffer[ch].data;
  const width = specWidth;
  const H = specHeight;

  // For each pending bin, compute final magnitude using saved boScaled, apply to magsArr, update imageBuffer rows
  for (const [bin, boScaled] of map.entries()) {
    if (bin < 0 || bin >= H) continue;
    const idx = startIdx + bin;
    // make sure idx in bounds
    if (idx < 0 || idx >= magsArr.length) continue;
    // read snapshotMag to compute the denoised version (avoids compounding sequential paints)
    const snapMag = snapshot ? snapshot[idx] : magsArr[idx];
    const gain = gains[bin] !== undefined ? gains[bin] : 1.0;
    // mix between current displayed magnitude (magsArr[idx]) and denoised snapshot*gain according to boScaled:
    const oldMag = magsArr[idx] || 0;
    const denoisedMag = Math.min(255, Math.max(0, snapMag * gain));
    const newMag = oldMag * (1 - boScaled) + denoisedMag * boScaled;
    magsArr[idx] = newMag;

    // keep phase untouched (we don't recompute phase here to avoid complexity). This preserves the interactive phase update you already applied.
    const phase = phasesArr[idx] || 0;
    const [r, g, b] = magPhaseToRGB(newMag, phase);

    // update the rows in the imageBuffer for that bin (fast per-bin update)
    const yTopF = binToTopDisplay[ch][bin];
    const yBotF = binToBottomDisplay[ch][bin];
    const yStart = Math.max(0, Math.floor(Math.min(yTopF, yBotF)));
    const yEnd   = Math.min(H - 1, Math.ceil(Math.max(yTopF, yBotF)));
    for (let yPixel = yStart; yPixel <= yEnd; yPixel++) {
      const pix = (yPixel * width + xFrame) * 4;
      imgData[pix]     = r;
      imgData[pix + 1] = g;
      imgData[pix + 2] = b;
      imgData[pix + 3] = 255;
    }
  }

  // remove pending set for that frame and redraw the canvas for this channel
  pendingBins[ch].delete(xFrame);
  const specCanvas = document.getElementById("spec-" + ch);
  if (specCanvas) {
    const ctx = specCanvas.getContext("2d");
    ctx.putImageData(imageBuffer[ch], 0, 0);
  }
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
function computePhaseTexture(type, bin, frameIndex, basePhase) {
  const FFT = fftSize;
  const fs = sampleRate;
  const hopLocal = hop;
  const ch = currentChannel;
  const twoPi = 2 * Math.PI;
  const k = bin | 0; 
  const fk = (k * fs) / FFT; 
  let phi = 0;
  switch (type) {
    case 'Harmonics':
      phi = (k / specHeight * FFT / 2);
      break;
    case 'Static':
      phi = (Math.random() * 2 - 1) * Math.PI;
      break;
    case 'Flat':
      phi = basePhase;
      break;
    case 'ImpulseAlign':
      phi = -twoPi * fk * t0 + basePhase;
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
      if (frameIndex > 0 && channels[ch] && channels[ch].phases && channels[ch].phases[prevIdx] !== undefined) {
        prevPhase = channels[ch].phases[prevIdx];
      }
      if (prevPhase !== null && isFinite(prevPhase)) {
        const expected = prevPhase + twoPi * fk * (hopLocal / fs);
        phi = expected + userDelta;
      } else {
        phi = twoPi * fk * (frameIndex * hopLocal) / fs;
      }
    } break;
    case 'RandomSmall':
      phi = basePhase + (Math.random() * 2 - 1) * sigma;
      break;
    case 'HarmonicStack': {
      const center = Math.max(1, harmonicCenter);
      phi = -twoPi * fk * t0 + ((k % center) * 0.12);
    } break;
    case 'LinearDelay':
      phi = -twoPi * fk * tau + basePhase;
      break;
    case 'Chirp':
      phi = basePhase - twoPi * fk * ((frameIndex * hopLocal) / fs) - Math.pow(k, 1.05) * chirpRate;
      break;
    case 'CopyFromRef': {
      const refIx = (refPhaseFrame * specHeight + k) | 0;
      phi = (channels[ch] && channels[ch].phases) ? channels[ch].phases[refIx] || 0 : 0;
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
  let integral = (currentTool === "blur")?buildIntegral(fullW, fullH, channels[ch].mags, channels[ch].phases):null;
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
  const chPressure = (channels[ch] && channels[ch].brushPressure) ? channels[ch].brushPressure : 1;
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
      let mag, phase;
      if (currentTool === "eraser") {
        mag = 0;
        phase = 0;
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
      } else {
        [mag, phase] = rgbToMagPhase(r, g, b);
      }
      if (cxPix >= 0 && cyPix >= 0 && cxPix < fullW && cyPix < fullH) {
        const bo = brushOpacity * a * chPressure * boMult;
        const po = phaseStrength * a * poMult;
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
  let $s = spritePath.ch==="all"?0:spritePath.ch, $e = spritePath.ch==="all"?channelCount:spritePath.ch+1;
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
    const overlayCanvas = document.getElementById("overlay-"+currentChannel); 
    const ctx = overlayCanvas.getContext("2d"); 
    const canvas = document.getElementById("canvas-"+currentChannel); 
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
          drawPixel(px, py, brushMag, phaseShift, brushOpacity* channels[ch].brushPressure, phaseStrength, ch); 
        }
      }
      if (x0 === x1 && y0 === y1) break;
      const e2 = err;
      if (e2 > -dx) { err -= dy; x0 += sx; }
      if (e2 < dy)  { err += dx; y0 += sy; }
    }
  }
}
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
  const fullH = specHeight;
  const fullW = specWidth;
  const width = fullW;
  const height = fullH;
  const idxBase = xI * fullH;
  const imgData = imageBuffer[ch].data;
  const dbt = Math.pow(10, noiseRemoveFloor / 20) * 128;
  const magsArr = channels[ch].mags;
  const phasesArr = channels[ch].phases;
  let displayYFloat = yDisplay;
  const f = getSineFreq(yDisplay);
  if (alignPitch) {
    let nearestPitch = Math.round(npo * Math.log2(f / startOnP));
    nearestPitch = startOnP * Math.pow(2, nearestPitch / npo);
    displayYFloat = ftvsy(nearestPitch, ch);
  }
  function processBin(bin, boScaled) {
    if (!Number.isFinite(bin)) return;
    bin = Math.max(0, Math.min(fullH - 1, Math.round(bin)));
    const idx = idxBase + bin;
    if (idx < 0 || idx >= magsArr.length) return;
    if (visited && visited[ch][idx] === 1) return;
    if (visited) visited[ch][idx] = 1;
    const oldMag = magsArr[idx] || 0;
    const oldPhase = phasesArr[idx] || 0;
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
                ? (function() {
                    // fast threshold passthrough for strong bins
                    if (oldMag > dbt) return oldMag;

                    // compute / reuse cached frame view for this xFrame (avoid subarray allocations)
                    if (frameMagsViewIdx[ch] !== xFrame || !frameMagsView[ch]) {
                      const start = specHeight * xFrame;
                      const end = start + specHeight;
                      // prefer snapshot if available
                      const channelSnapshot = channels[ch] && channels[ch].snapshotMags ? channels[ch].snapshotMags : null;
                      frameMagsView[ch] = (channelSnapshot ? channelSnapshot.subarray(start, end) : channels[ch].mags.subarray(start, end));
                      frameMagsViewIdx[ch] = xFrame;
                    }
                    const magsFrameView = frameMagsView[ch];

                    // see if there's a ready gains mask for this frame
                    const gmap = frameGainsCache[ch];
                    const gains = gmap.get(xFrame);

                    if (gains) {
                      // fast path: model gains are ready -> apply them (mix with oldMag using boScaled)
                      const gain = gains[bin] !== undefined ? gains[bin] : 1.0;
                      // snapshot mag (the original frame mag captured at mouseDown if present)
                      const snapGlobal = channels[ch] && channels[ch].snapshotMags ? channels[ch].snapshotMags : channels[ch].mags;
                      const snapMag = snapGlobal[(xFrame * specHeight) + bin] || 0;
                      const denoisedMag = Math.min(255, Math.max(0, snapMag * gain));
                      return oldMag * (1 - boScaled) + denoisedMag * boScaled;
                    } else {
                      // not ready: start computing gains async (non-blocking) and use the fast heuristic immediately
                      // mark this bin as pending so when gains finish we repaint it
                      markPendingBin(ch, xFrame, bin, boScaled);
                      // kick off async compute if not already running
                      ensureFrameGains(ch, xFrame).catch(() => {/*ignore*/});

                      // fallback heuristic immediate preview (fast). Use your previous per-bin semitone heuristic:
                      return oldMag * (1 - boScaled);
                    }
                  })()
                : (currentTool === "cloner")
                ? channels[clonerCh].mags[clonerPos] * (((cAmp-1)*bo)+1)
                : (oldMag * (1 - boScaled) + mag * boScaled);

    const type = phaseTextureEl.value;
    let $phase; let newPhase;
    if (currentTool === "cloner") {
      $phase = channels[clonerCh].phases[clonerPos];
    } else {
      $phase = computePhaseTexture(type, bin, xI, phase);
    }
    newPhase = oldPhase * (1 - po) + po * ($phase + phase);
    const clampedMag = Math.min(newMag, 255);
    magsArr[idx] = clampedMag;
    phasesArr[idx] = newPhase;
    channels[ch].mags = magsArr;
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
  const binShift = (currentTool==="cloner")?displayYToBin(clonerY+(yDisplay-visibleToSpecY(startY))/clonerScale,specHeight,ch):null;
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
    phase=(tool === "eraser" ? 0 : (newEffect.phaseShift!== undefined) ? newEffect.phaseShift:  0);
  }
  const bo =  (tool === "eraser" ? 1 : (newEffect.brushOpacity   !== undefined) ? newEffect.brushOpacity   :  1)* channels[ch].brushPressure;
  const po =  (tool === "eraser" ? 0 : (newEffect.phaseStrength   !== undefined) ? newEffect.phaseStrength   :  0);
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
    const po = currentTool === "eraser" ? 1 : phaseStrength;
    const bo = (currentTool === "eraser" ? 1 : brushOpacity)* channels[ch].brushPressure;
    const brushMag = currentTool === "eraser" ? 0 : (brushColor / 255) * 128;
    const brushPhase = currentTool === "eraser" ? 0 : phaseShift;
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
                dp(px, py, brushMag, phaseShift, brushOpacity* channels[ch].brushPressure, phaseStrength,ch);
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
      }
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
  let $s = syncChannels?0:currentChannel, $e = syncChannels?channelCount:currentChannel+1;
  for (let ch=$s;ch<$e;ch++){
    const mags = channels[ch].mags, phases = channels[ch].phases;
    const canvas = document.getElementById("canvas-"+ch);
    const fullW = specWidth;
    const fullH = specHeight;
    const po = currentTool === "eraser" ? 1 : phaseStrength;
    const bo = (currentTool === "eraser" ? channels[ch].brushPressure : brushOpacity)* channels[ch].brushPressure;
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
      const brushMag = currentTool === "eraser" ? 0 : (brushColor / 255) * 128;
      const brushPhase = currentTool === "eraser" ? 0 : phaseShift;
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
          drawPixel(xx, yy, 1, phaseShift, bo, po, ch);
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
  const magsArr = channels[ch].mags;     
  const phasesArr = channels[ch].phases; 
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
  } 
}