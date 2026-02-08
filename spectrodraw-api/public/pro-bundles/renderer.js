if (lockHop) {hopSizeKnob.setValue(fftSizeKnob.getValue());}
function restartRender(autoPlay){
  autoPlayOnFinish = !!playing || !!autoPlay;
  fftSize = fftSizeKnob.getValue();
  hop = Math.floor(hopSizeKnob.getValue());
  win = hann(fftSize);

  framesTotal = Math.max(1, Math.floor((emptyAudioLength*sampleRate - fftSize) / hop) + 1);
  iLow = 0;
  iHigh = framesTotal;
  const freqBins = Math.floor(fftSize / 2);
  
  const offsetY = trueScaleVal ? specHeight*Math.min(document.getElementById("canvas-0").parentElement.clientWidth / framesTotal, (getLayerHeight()) / freqBins, 1) : layerHeight;
  if (trueScaleVal) {
    document.getElementById("chdiv").setAttribute('disabled', 'disabled');
  } else {
    document.getElementById("chdiv").removeAttribute('disabled');
  }
  if (imageBuffer === null) imageBuffer = new Array(layerCount);
  if (currentLayer >= layerCount) currentLayer = layerCount-1;
  for (let ch = 0; ch < layers.length; ch++){
    let timeline, canvas, overlayCanvas, yAxis, specCanvas, logscaleEl;
    if (!layers[ch].hasCanvases) {
      let w = document.getElementById("canvasWrapper-"+ch);
      const wrapper = (w!==null)?w:document.createElement("div");
      wrapper.innerHTML = "";
      wrapper.id = "canvasWrapper-"+ch;
      timeline = document.createElement("canvas");
      timeline.id = `timeline-${ch}`;
      wrapper.appendChild(timeline);

      // main canvas
      canvas = document.createElement("canvas");
      canvas.id = `canvas-${ch}`;
      // prefer pixelated rendering at DOM-level (extra protection)
      canvas.style.imageRendering = "pixelated";
      canvas.style.webkitImageRendering = "pixelated";
      wrapper.appendChild(canvas);

      // overlay
      overlayCanvas = document.createElement("canvas");
      overlayCanvas.id = `overlay-${ch}`;
      // overlay should also be pixelated
      overlayCanvas.style.imageRendering = "pixelated";
      wrapper.appendChild(overlayCanvas);

      // freq bar
      yAxis = document.createElement("canvas");
      yAxis.id = `freq-${ch}`;
      wrapper.appendChild(yAxis);
      
      // logscale
      logscaleEl = document.createElement("canvas");
      logscaleEl.id = `logscale-${ch}`;logscaleEl.width=40;logscaleEl.height=40;
      wrapper.appendChild(logscaleEl);

      // specCanvas bar (hidden source canvas)
      specCanvas = document.createElement("canvas");
      specCanvas.style.display = "none";
      specCanvas.id = `spec-${ch}`;
      wrapper.appendChild(specCanvas);
      layers[ch].hasCanvases = true;
      document.getElementById("canvasWrapper").appendChild(wrapper);
      
      for (const prefix in handlers) {
        const id = prefix + ch;
        const el = document.getElementById(id);
        if (!el) continue;
        handlers[prefix](el);
      }
    } else {
      timeline = document.getElementById(`timeline-${ch}`);
      canvas = document.getElementById(`canvas-${ch}`);
      overlayCanvas = document.getElementById(`overlay-${ch}`);
      yAxis = document.getElementById(`freq-${ch}`);
      logscaleEl = document.getElementById(`logscale-${ch}`);
      specCanvas = document.getElementById(`spec-${ch}`);
    }
    timeline.style.cssText ="height:40px;background:#222;position:absolute;left:40px;z-index:9998;top:"+(0 + ch*offsetY)+"px";
    canvas.style.cssText = "cursor:"+(movingSprite?'grabbing':'crosshair')+";position:absolute;left:40px;top:"+(40 + ch*offsetY)+"px";
    overlayCanvas.style.cssText = "background:transparent;position:absolute;left:40px;pointer-events:none;z-index:10;top:"+(40 + ch*offsetY)+"px";
    yAxis.style.cssText ="width:40px;background:#222;position:absolute;left:0;top:"+(40 + ch*offsetY)+"px";
    logscaleEl.style.cssText ="position:absolute; top:0px; background: #111;z-index: 999; top:"+(ch*offsetY)+"px";
    timeline.style.display=(ch<layerCount)?"block":"none";
    canvas.style.display=(ch<layerCount)?"block":"none";
    overlayCanvas.style.display=(ch<layerCount)?"block":"none";
    yAxis.style.display=(ch<layerCount)?"block":"none";
    logscaleEl.style.display=(ch<layerCount)?"block":"none";
    if (ch>=layerCount) return;
    const specCtx = specCanvas.getContext("2d");
    // ----- IMPORTANT: keep backing store = data resolution (spec resolution) -----
    // This lets you use ImageData(specWidth,specHeight) without having to rewrite imageBuffer logic.
    canvas.width = framesTotal;
    canvas.height = freqBins; 

    // Choose CSS display size (how large the canvas appears on screen).
    // If trueScaleVal we scale down for display; otherwise we use full-width layout.
    let displayW, displayH;
    if (trueScaleVal) {
      const maxHeight = (getLayerHeight());
      const containerWidth = canvas.parentElement.clientWidth;
      const scaleX = containerWidth / framesTotal;
      const scaleY = maxHeight / freqBins;
      const scale = Math.min(scaleX, scaleY, 1);

      displayW = Math.max(1, Math.floor(canvas.width * scale));  // CSS px
      displayH = Math.max(1, Math.floor(canvas.height * scale)); // CSS px

      canvas.style.width = (displayW) + "px";
      canvas.style.height = (displayH) + "px";
    } else {
      // full width layout - make the canvas fill available width except left gutter (40px)
      // we compute CSS width from parent element
      const parentClientW = Math.max(1, canvas.parentElement.clientWidth - 40);
      displayW = parentClientW;
      displayH = Math.max(1, layerHeight - 40);

      canvas.style.width = "calc(100% - 40px)";
      canvas.style.height = displayH + "px";
    }

    // Make overlay sizing consistent with canvas (CSS-size)
    overlayCanvas.style.width = canvas.style.width;
    overlayCanvas.style.height = canvas.style.height;

    // Sync yAxis CSS height too
    yAxis.height = 1024; yAxis.width = 40;
    yAxis.style.height = canvas.style.height;

    // Keep specWidth/specHeight matching backing store (data resolution)
    specWidth = canvas.width;
    specHeight = canvas.height;

    syncOverlaySize(canvas,overlayCanvas);

    // timeline uses same CSS width as canvas
    timeline.width = window.innerWidth*1.2;
    timeline.style.width = canvas.style.width;
    timeline.height = 40;

    // create imageBuffer at backing store resolution (unchanged)
    imageBuffer[ch] = new ImageData(canvas.width, canvas.height);
    specWidth = canvas.width;
    specHeight = canvas.height;

    // specCanvas is the hidden pixel-perfect source: make sure its backing store matches spec size
    specCanvas.width = specWidth;
    specCanvas.height = specHeight;
    specCtx.clearRect(0, 0, specCanvas.width, specCanvas.height);
    specCtx.putImageData(imageBuffer[ch], 0, 0);

    if (!layers[ch].mags) layers[ch].mags = new Float32Array(specWidth * specHeight).fill(0);
    if (!layers[ch].phases) layers[ch].phases = new Float32Array(specWidth * specHeight).fill(0);
    if (!layers[ch].pans) layers[ch].pans = new Float32Array(specWidth * specHeight).fill(0);

    // IMPORTANT: after (re)setting canvas.width/height the context is reset, so re-obtain it
    const ctx = canvas.getContext("2d");
    // If you have a resize helper that might alter the canvas, call it, then re-disable smoothing again.
    resizeCanvasToDisplaySize(canvas, ctx); 

    // Ensure no smoothing on THIS destination context (must be set after any width/height reset)
    ctx.imageSmoothingEnabled = false;
    ctx.imageSmoothingQuality = "low";

    // Also set the overlay canvas backing store to match the backing store size so drawing coords map 1:1.
    overlayCanvas.width = canvas.width;
    overlayCanvas.height = canvas.height;
    // Make sure overlay ctx is also unsmoothed
    const overlayCtx = overlayCanvas.getContext("2d");
    overlayCtx.imageSmoothingEnabled = false;
    overlayCtx.imageSmoothingQuality = "low";

    // Fill background (operate on backing store)
    ctx.fillStyle = "black";
    ctx.fillRect(0,0,canvas.width,canvas.height);
  }
  buildBinDisplayLookup();
  minCol=0;startFrame=0;maxCol = framesTotal;
  // let startFrame = calcMinMaxCol().minCol;
  // if (startFrame == Infinity) startFrame = 0;
  pos = startFrame * hop;
  x = startFrame;
  rendering = true;

  startTime = performance.now();
  audioProcessed = 0;
  if (playing) stopSource(true);
  requestAnimationFrame(drawLoop);

  if (!autoPlay) {
    if (typeof drawTimeline === 'function') drawTimeline();
    if (typeof drawYAxis === 'function') drawYAxis();
    if (typeof drawLogScale === 'function') drawLogScale();
  }
}


// ----------------- setup (run once) -----------------
const T_R  = 0, T_G  = 1, T_B  = 2, T_Y = 3, T_CR = 4, T_CB = 5;
const T_H  = 10, T_S = 11, T_V  = 12;

// inputTargets[0] = target for mag
// inputTargets[1] = target for phase
// inputTargets[2] = target for pan
const inputTargets = new Int8Array(3);

// fixed multipliers (very cheap)
const MUL_MAG   = 1 / 60;
const MUL_PHASE = 1 / (2 * Math.PI);
const MUL_PAN   = 1;

// map selection string to constant code
function selToCode(sel) {
  // fast switch (runs only on change)
  switch (sel) {
    case "r": return T_R;
    case "g": return T_G;
    case "b": return T_B;
    case "y": return T_Y;
    case "cr": return T_CR;
    case "cb": return T_CB;
    case "h": return T_H;
    case "s": return T_S;
    case "v": return T_V;
    default: return -1;
  }
}

// update inputTargets when a selector changes
function updateMagPhasePanMapping() {
  inputTargets[0] = selToCode(magCSEl.value);    // mag
  inputTargets[1] = selToCode(phaseCSEl.value);  // phase
  inputTargets[2] = selToCode(panCSEl.value);    // pan
  renderFullSpectrogramToImage();
}

// attach listeners (run once)
magCSEl.addEventListener("change", updateMagPhasePanMapping);
phaseCSEl.addEventListener("change", updateMagPhasePanMapping);
panCSEl.addEventListener("change", updateMagPhasePanMapping);
// initialize mapping immediately
updateMagPhasePanMapping();

// cheap inline clamp to byte (inlined inside function for clarity)
// ----------------- hot function (called millions of times) -----------------
function magPhasePanToRGB(mag, phase, pan){
  // compute normalized values (cheap multiplications)
  let nMag   = magCSEl.value === "o"?1:mag   * MUL_MAG;      // used for hue/sat/val or direct channel
  let nPhase = phaseCSEl.value === "o"?0:phase * MUL_PHASE;
  let nPan   = panCSEl.value === "o"?0:pan   * MUL_PAN;

  // small locals to hold hue/sat/value (floats 0..1-ish)
  let hueVal = 0, satVal = 1, valueVal = 1;

  // assigned bytes (use -1 to mark "not assigned")
  let rAssigned = -1, gAssigned = -1, bAssigned = -1;
  let yAssigned = -1, crAssigned = -1, cbAssigned = -1;

  // map the three inputs according to precomputed targets (very small switch)
  // order: mag, then phase, then pan (later overwrites earlier for same channel)
  switch (inputTargets[0]) {
    case T_R:  rAssigned  = Math.round(Math.max(0, Math.min(255, nMag   * 255))); break;
    case T_G:  gAssigned  = Math.round(Math.max(0, Math.min(255, nMag   * 255))); break;
    case T_B:  bAssigned  = Math.round(Math.max(0, Math.min(255, nMag   * 255))); break;
    case T_Y:  yAssigned  = Math.round(Math.max(0, Math.min(255, nMag   * 255))); break;
    case T_CR: crAssigned = Math.round(Math.max(0, Math.min(255, nMag   * 255))); break;
    case T_CB: cbAssigned = Math.round(Math.max(0, Math.min(255, nMag   * 255))); break;
    case T_H:  hueVal     = nMag; break;
    case T_S:  satVal     = nMag; break;
    case T_V:  valueVal   = nMag; break;
    /* default: do nothing */
  }

  switch (inputTargets[1]) {
    case T_R:  rAssigned  = Math.round(Math.max(0, Math.min(255, nPhase * 255))); break;
    case T_G:  gAssigned  = Math.round(Math.max(0, Math.min(255, nPhase * 255))); break;
    case T_B:  bAssigned  = Math.round(Math.max(0, Math.min(255, nPhase * 255))); break;
    case T_Y:  yAssigned  = Math.round(Math.max(0, Math.min(255, nPhase * 255))); break;
    case T_CR: crAssigned = Math.round(Math.max(0, Math.min(255, nPhase * 255))); break;
    case T_CB: cbAssigned = Math.round(Math.max(0, Math.min(255, nPhase * 255))); break;
    case T_H:  hueVal     = nPhase; break;
    case T_S:  satVal     = nPhase; break;
    case T_V:  valueVal   = nPhase; break;
  }

  switch (inputTargets[2]) {
    case T_R:  rAssigned  = Math.round(Math.max(0, Math.min(255, nPan   * 255))); break;
    case T_G:  gAssigned  = Math.round(Math.max(0, Math.min(255, nPan   * 255))); break;
    case T_B:  bAssigned  = Math.round(Math.max(0, Math.min(255, nPan   * 255))); break;
    case T_Y:  yAssigned  = Math.round(Math.max(0, Math.min(255, nPan   * 255))); break;
    case T_CR: crAssigned = Math.round(Math.max(0, Math.min(255, nPan   * 255))); break;
    case T_CB: cbAssigned = Math.round(Math.max(0, Math.min(255, nPan   * 255))); break;
    case T_H:  hueVal     = nPan; break;
    case T_S:  satVal     = nPan; break;
    case T_V:  valueVal   = nPan; break;
  }

  // ----------------- HSV path (untouched logic) -----------------
  if (colorSchemeEl.value==="hsv") {
    const hp = ((hueVal + 1) % 1)*6; 
    const v = Math.min(valueVal,1);
    const x = v*(1-Math.abs(hp%2-1));
    let r,g,b;
    if     (hp < 1){ r=v; g=x; b=0; }
    else if(hp < 2){ r=x; g=v; b=0; }
    else if(hp < 3){ r=0; g=v; b=x; }
    else if(hp < 4){ r=0; g=x; b=v; }
    else if(hp < 5){ r=x; g=0; b=v; }
    else           { r=v; g=0; b=x; }
    const c = r => {return ((mag/60)*(1-satVal) + r*satVal);};
    r = c(r); g=c(g); b=c(b);
    return [Math.floor(r*255), Math.floor(g*255), Math.floor(b*255)];
  }

  // ----------------- non-HSV: compute missing Y/Cr/Cb and RGB -----------------
  // If any Y/Cr/Cb were assigned, we'll use YCrCb inverse. Default chroma neutral = 128.
  let yVal = (yAssigned !== -1 ? yAssigned : undefined);
  let crVal = (crAssigned !== -1 ? crAssigned : undefined);
  let cbVal = (cbAssigned !== -1 ? cbAssigned : undefined);

  // If no Y but at least one RGB direct provided, derive Y from them
  if (yVal === undefined && (rAssigned !== -1 || gAssigned !== -1 || bAssigned !== -1)) {
    const rtmp = rAssigned !== -1 ? rAssigned : 0;
    const gtmp = gAssigned !== -1 ? gAssigned : 0;
    const btmp = bAssigned !== -1 ? bAssigned : 0;
    yVal = Math.round(0.299 * rtmp + 0.587 * gtmp + 0.114 * btmp);
  }

  if (yVal === undefined) yVal = 128;
  if (crVal === undefined) crVal = 128;
  if (cbVal === undefined) cbVal = 128;

  // Inverse BT.601 (fast math)
  let rFromYCbCr = Math.round(yVal + 1.402   * (crVal - 128));
  let gFromYCbCr = Math.round(yVal - 0.344136 * (cbVal - 128) - 0.714136 * (crVal - 128));
  let bFromYCbCr = Math.round(yVal + 1.772   * (cbVal - 128));

  // clamp each to [0,255] (inline)
  if (rFromYCbCr < 0) rFromYCbCr = 0; else if (rFromYCbCr > 255) rFromYCbCr = 255;
  if (gFromYCbCr < 0) gFromYCbCr = 0; else if (gFromYCbCr > 255) gFromYCbCr = 255;
  if (bFromYCbCr < 0) bFromYCbCr = 0; else if (bFromYCbCr > 255) bFromYCbCr = 255;

  const finalR = (rAssigned !== -1) ? rAssigned : rFromYCbCr;
  const finalG = (gAssigned !== -1) ? gAssigned : gFromYCbCr;
  const finalB = (bAssigned !== -1) ? bAssigned : bFromYCbCr;

  return [finalR, finalG, finalB];
}

function rgbToMagPhasePan(r, g, b) {
  // normalized floats 0..1
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;

  // --- compute HSV (standard) ---
  const mx = Math.max(rf, gf, bf);
  const mn = Math.min(rf, gf, bf);
  const d  = mx - mn;
  let h = 0, s = 0, v = mx;
  if (mx !== 0) s = d === 0 ? 0 : d / mx;
  if (d !== 0) {
    if (mx === rf) h = ((gf - bf) / d) % 6;
    else if (mx === gf) h = (bf - rf) / d + 2;
    else h = (rf - gf) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }

  // --- compute Y / Cb / Cr ---
  const y  = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
  const cr =  0.5 * r - 0.418688 * g - 0.081312 * b + 128;

  // normalized channel map
  const channelNorm = [];
  channelNorm[T_R]  = clamp01(r / 255);
  channelNorm[T_G]  = clamp01(g / 255);
  channelNorm[T_B]  = clamp01(b / 255);
  channelNorm[T_Y]  = clamp01(y / 255);
  channelNorm[T_CR] = clamp01(cr / 255);
  channelNorm[T_CB] = clamp01(cb / 255);
  channelNorm[T_H]  = clamp01(h);
  channelNorm[T_S]  = clamp01(s);
  channelNorm[T_V]  = clamp01(v);

  let outMag = 0, outPhase = 0, outPan = 0;

  function rawFromNormForInput(inputIndex, normVal) {
    if (inputIndex === 0) return normVal / MUL_MAG;      // mag
    if (inputIndex === 1) return normVal / MUL_PHASE;    // phase
    return normVal / MUL_PAN;                            // pan
  }

  for (let i = 0; i < 3; ++i) {
    const code = inputTargets[i];
    if (code === undefined || code < 0) continue;
    const norm = clamp01(channelNorm[code] ?? 0);
    const raw  = rawFromNormForInput(i, norm);
    if (i === 0) outMag = raw;
    else if (i === 1) outPhase = raw;
    else outPan = raw;
  }

  // --------------------------------------------------
  // NEW FEATURE: HSV + "off" selector forces value = 1
  // --------------------------------------------------
  if (colorSchemeEl.value === "hsv") {
    if (magCSEl.value === "o")   outMag   = 1;
    if (phaseCSEl.value === "o") outPhase = 0;
    if (panCSEl.value === "o")   outPan   = 0;
  }

  return [outMag, outPhase, outPan];

  function clamp01(x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return x;
  }
}


function getLogScaleSlider(ch) { return Math.max(1, parseFloat(logScaleVal[ch]) || 1); }

function binToDisplayY(bin, h,ch) {
    if (!h) return 0;
    const s = getLogScaleSlider(ch);
    if (s <= 1.0000001) {
        return Math.round(h - 1 - bin); 
    } else {
        const a = s - 1;
        const denom = Math.log(1 + a * (h - 1));
        if (!isFinite(denom) || denom === 0) return Math.round(h - 1 - bin);
        const t = Math.log(1 + a * bin) / denom; 
        const y = (1 - t) * (h - 1);
        return Math.round(y);
    }
}

function displayYToBin(y, h, ch) {
    if (!h) return 0;
    const s = getLogScaleSlider(ch);
    if (s <= 1.0000001) {
        return Math.max(0, Math.min(h - 1, Math.round(h - 1 - y)));
    } else {
        const a = s - 1;
        const denom = Math.log(1 + a * (h - 1));
        if (!isFinite(denom) || denom === 0) return Math.max(0, Math.min(h - 1, Math.round(h - 1 - y)));
        const t = 1 - (y / (h - 1));
        const raw = (Math.exp(t * denom) - 1) / a;
        const clamped = Math.max(0, Math.min(h - 1, Math.round(raw)));
        return clamped;
    }
}

function drawFrame(w,h) {
  if (pos + fftSize > layers[0].pcm[0].length) { rendering = false; status.style.display = "none"; return false; }
  let _s = recording?currentLayer:0; _e = recording?currentLayer+1:layerCount;
  for (let ch = _s; ch<_e; ch++){
    const c = layers[ch];
    let mags = c.mags, phases = c.phases, pans = c.pans;
    const pcm0 = c.pcm[0];
    const pcm1 = c.pcm[1] || null; // fallback to mono if no second channel

    // allocate two FFT buffers (one per channel)
    const re0 = new Float32Array(fftSize);
    const im0 = new Float32Array(fftSize);
    const re1 = new Float32Array(fftSize);
    const im1 = new Float32Array(fftSize);

    for (let i = 0; i < fftSize; i++) {
      re0[i] = (pcm0[pos + i] || 0) * win[i];
      im0[i] = 0;
      re1[i] = (pcm1 ? (pcm1[pos + i] || 0) * win[i] : 0);
      im1[i] = 0;
    }

    // FFT each channel
    fft_inplace(re0, im0);
    if (pcm1) fft_inplace(re1, im1);

    let max = 0;
    const EPS = 1e-12;
    for (let bin = 0; bin < h; bin++) {
      const reL = re0[bin] || 0, imL = im0[bin] || 0;
      const magL = Math.hypot(reL, imL);

      const reR = pcm1 ? (re1[bin] || 0) : 0;
      const imR = pcm1 ? (im1[bin] || 0) : 0;
      const magR = pcm1 ? Math.hypot(reR, imR) : 0;

      // combined stereo vector (mix)
      const cre = reL + reR;
      const cim = imL + imR;
      const mag = Math.hypot(cre, cim);
      const phase = Math.atan2(cim, cre);

      const idx = x * h + bin;
      mags[idx] = mag;
      phases[idx] = phase;

      // pan: -1 = left, +1 = right. If mono (no pcm1) this becomes 0.
      pans[idx] = ((magR - magL) / (magR + magL + EPS) + 1) * 0.5;

      if (mag > max) max = mag;
    }

    if (uploadingSprite){
      const s = sprites[sprites.length-1];
      if (x>=s.minCol && x<=s.maxCol){
        for (let i=x * h;i<(x+1) * h;i++){
          addPixelToSprite(s, Math.floor(i / specHeight), i%specHeight, Math.random()*0.00001, Math.random()*6.315, 0.5, mags[i], phases[i], pans[i], s.ch);
        }
      }
    }

    const skipY = (recording?8:1)*layerCount;
    for (let yy = 0; yy < h; yy+=skipY) {
      const mappedBin = displayYToBin(yy, h, ch);
      const idx = x * h + mappedBin;
      const mag = mags[idx] || 0;
      const phase = phases[idx] || 0;
      const pan = pans[idx] || 0;
      const [r, g, b] = magPhasePanToRGB(mag, phase, pan);
      for (let i = 0; i < skipY; i++) {       
        const pix = ((yy+i) * w + x) * 4; 
        imageBuffer[ch].data[pix]     = r;
        imageBuffer[ch].data[pix + 1] = g;
        imageBuffer[ch].data[pix + 2] = b;
        imageBuffer[ch].data[pix + 3] = 255;
      }
    }
  }

  pos += hop; x++;
  audioProcessed += hop;
  ch = currentLayer;
  if (x >= (maxCol==0?w:maxCol)) {
    uploadingSprite = false;
    if (recording) return false;
    rendering = false;
    if (pendingHistory) {
      pendingHistory = false;
      newHistory();
      snapshotMags = null;
      snapshotPhases = null;
    }
    if (pendingPlayAfterRender) {
      pendingPlayAfterRender = false;
      try {
        playing = true;
        playPause.innerHTML = pauseHtml;
        playPCM(false,currentFrame<specWidth*0.8?minCol:specWidth*0.8);
      } catch (e) { console.warn("playPCM() failed after render:", e); }
      const playPauseEl = document.getElementById("playPause");
      if (playPauseEl) playPauseEl.innerHTML = pauseHtml;
    }

    if (!painting && autoPlayOnFinish) {
      autoPlayOnFinish = false;
      playing = true;
      playPause.innerHTML = pauseHtml;
      playPCM(true,currentFrame<specWidth*0.8?minCol:specWidth*0.8);
    }
    status.style.display = "none";
    minCol = Infinity;
    return false;
  }
  return true;
}


let requestSpecUpdate = false;      
let resolveSpecUpdate = null;       
const SPEC_UPDATE_TIMEOUT_MS = 2000; 

let pendingHistory = false;
let pendingPlayAfterRender = false;

let pendingRecomputeDone = false;
let pendingRecomputeMinCol = null;
let pendingRecomputeMaxCol = null;

function waitForSpecUpdate(timeout = SPEC_UPDATE_TIMEOUT_MS) {

  if (!rendering && !requestSpecUpdate) return Promise.resolve(true);

  return new Promise((resolve) => {

    resolveSpecUpdate = (ok = true) => {

      if (!resolveSpecUpdate) return;
      const r = resolve;
      resolveSpecUpdate = null;
      requestSpecUpdate = false;
      r(ok);
    };

    setTimeout(() => {
      if (resolveSpecUpdate) {
        resolveSpecUpdate(false); 
      }
    }, timeout);
  });
}

function drawLoop() {
  if (!rendering) return;
  const framesPerTick = 200;
  const h = specHeight;
  const w = specWidth;
  let $s = syncLayers?0:currentLayer, $e = syncLayers?layerCount:currentLayer+1;
  for (let f = 0; f < framesPerTick; f++) if (!drawFrame(w,h)) break;
  for (let ch=$s;ch<$e;ch++) {
    document.getElementById("spec-"+ch).getContext("2d").putImageData(imageBuffer[ch], 0, 0);
  }
  //drawCursor(true);
  renderView();


  const elapsedMS = performance.now() - startTime;
  const elapsedSec = elapsedMS / 1000;
  const speed = audioProcessed / Math.max(1e-6, elapsedSec); 
  let pcm = layers[currentLayer].pcm[0];
  const audioSec = pcm.length / sampleRate; 
  const processedSec = audioProcessed / sampleRate;
  status.textContent = `Progress: ${(100*pos/pcm.length).toFixed(1)}% | ` 
      + `Elapsed: ${elapsedSec.toFixed(2)}s | `
      + `Audio processed: ${processedSec.toFixed(2)}/${audioSec.toFixed(2)}s | `
      + `Speed: ${(speed/sampleRate).toFixed(2)}x realtime`;
  if (rendering) {
    status.style.display = "block";
    requestAnimationFrame(drawLoop);
  }
}

function drawCursor(clear){
  for (let ch=0;ch<layerCount;ch++){
    const canvas = document.getElementById("canvas-"+ch);
    const overlayCanvas = document.getElementById("overlay-"+ch);
    const overlayCtx = overlayCanvas.getContext("2d");
    const x = (currentCursorX-iLow) * canvas.width / (iHigh-iLow);
    if (clear) overlayCtx.clearRect(0,0, canvas.width, canvas.height);
    overlayCtx.strokeStyle = "#0f0";
    overlayCtx.lineWidth = iWidth/500;
    overlayCtx.beginPath();
    overlayCtx.moveTo(x + 0.5, 0);
    overlayCtx.lineTo(x + 0.5, specHeight);
    overlayCtx.stroke();
    if (alignTime) {
      overlayCtx.strokeStyle = "#444";
      for (let i = 0; i < specWidth; i += (sampleRate/fftSize)/subBeat * (120/bpm)) {
        const x = (i-iLow)* canvas.width / (iHigh-iLow);
        overlayCtx.beginPath();
        overlayCtx.moveTo(x,0);
        overlayCtx.lineTo(x,specHeight);
        overlayCtx.stroke();
      }
    }
  }
}

function updateCanvasScroll() {

  const viewWidth = Math.max(1, Math.floor(iHigh - iLow));
  const fStart = Math.max(0, Math.floor(specHeight * (1 - fHigh / (sampleRate/2))));
  const fEnd = Math.min(specHeight, Math.floor(specHeight * (1 - fLow / (sampleRate/2))));
  const viewHeight = Math.max(1, fEnd - fStart);
  let _s = recording?currentLayer:0; _e = recording?currentLayer+1:layerCount;
  for (let ch = _s; ch<_e; ch++){
    const specCanvas=document.getElementById("spec-"+ch);
    if (!imageBuffer[currentLayer] || !specCanvas) return;
    const canvas = document.getElementById("canvas-"+ch);
    const ctx = canvas.getContext("2d");
    // always ensure nearest-neighbour for drawImage operations
    ctx.imageSmoothingEnabled = false;
    ctx.imageSmoothingQuality = "low";
    const overlayCanvas = document.getElementById("overlay-"+ch);
    const overlayCtx = overlayCanvas.getContext("2d");

    // Keep backing store matched to the view area (important for putImageData/drawImage source coordinates)
    canvas.width = viewWidth;
    canvas.height = viewHeight;

    // Keep overlay backing store matching
    overlayCanvas.width = canvas.width;
    overlayCanvas.height = canvas.height;

    // Keep CSS sizes in sync: preserve how it looked before (so DOM-scaling doesn't happen unexpectedly)
    // If you want CSS to remain the same visual size, leave canvas.style.width/height untouched.
    // Here we preserve existing style (do not change CSS size).
    // (If you intentionally want CSS size to reflect new backing store, set canvas.style.width here)

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
        specCanvas,
        Math.max(0, Math.floor(iLow)), fStart, 
        viewWidth, viewHeight,                 
        0, 0,                                  
        canvas.width, canvas.height            
    );

    overlayCanvas.style.width = canvas.style.width;
    overlayCanvas.style.height = canvas.style.height;
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
  }
  drawCursor(true);
}


function renderView() {
  const viewWidth = Math.max(1, Math.floor(iHigh - iLow));
  const fStart = Math.max(0, Math.floor(specHeight * (1 - fHigh / (sampleRate/2))));
  const fEnd = Math.min(specHeight, Math.floor(specHeight * (1 - fLow / (sampleRate/2))));
  const viewHeight = Math.max(1, fEnd - fStart);
  let _s = recording?currentLayer:0; _e = recording?currentLayer+1:layerCount;
  for (let ch = _s; ch<_e; ch++){
    const specCanvas=document.getElementById("spec-"+ch);
    if (!specCanvas || !imageBuffer[currentLayer]) continue;
    const canvas = document.getElementById("canvas-"+ch);
    const ctx = canvas.getContext("2d");
    // nearest-neighbor for drawImage
    ctx.imageSmoothingEnabled = false;
    ctx.imageSmoothingQuality = "low";
    const overlayCanvas = document.getElementById("overlay-"+ch);

    // Set backing store to the view (so drawImage src/dest map correctly)
    canvas.width = viewWidth;
    canvas.height = viewHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      specCanvas,
      Math.max(0, Math.floor(iLow)), fStart, 
      viewWidth, viewHeight,                 
      0, 0,                                  
      canvas.width, canvas.height            
    );

    // Keep overlay in sync (backing store and CSS)
    overlayCanvas.width = canvas.width;
    overlayCanvas.height = canvas.height;
    overlayCanvas.style.width = canvas.style.width;
    overlayCanvas.style.height = canvas.style.height;
  }
}


let painting=false;
let paintedPixels=null;

function processPendingFramesLive(){
  let count=0;
  while (pos + fftSize <= layers[currentLayer].pcm[0].length) {
    if (!drawFrame(specWidth, specHeight)) break;
  }
  
  const specCanvas=document.getElementById("spec-"+currentLayer);
  const specCtx = specCanvas.getContext("2d");
  specCtx.putImageData(imageBuffer[currentLayer], 0, 0);
  renderView();
  drawCursor(true);
}
function renderFullSpectrogramToImage() {
  const specCanvas=document.getElementById("spec-"+currentLayer);
  if (!specCanvas) return;
  const specCtx = specCanvas.getContext("2d");
  let mags = layers[currentLayer].mags, phases = layers[currentLayer].phases, pans = layers[currentLayer].pans;
  if (!imageBuffer[currentLayer] || !mags || !phases || !pans) return;
  const w = specWidth, h = specHeight;
  for(let xx=0; xx<w; xx++){
    for(let yy=0; yy<h; yy++){
      const bin = displayYToBin(yy, h, currentLayer);
      const idx = xx * h + bin;
      const mag = mags[idx] || 0;
      const phase = phases[idx] || 0;
      const pan = pans[idx] || 0;
      const [r,g,b] = magPhasePanToRGB(mag, phase, pan);
      const pix = (yy * w + xx) * 4;
      imageBuffer[currentLayer].data[pix] = r;
      imageBuffer[currentLayer].data[pix+1] = g;
      imageBuffer[currentLayer].data[pix+2] = b;
      imageBuffer[currentLayer].data[pix+3] = 255;
    }
  }
  specCtx.putImageData(imageBuffer[currentLayer], 0, 0);
  renderView();
}