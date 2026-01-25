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
      timeline.style.cssText ="height:40px;background:#222;position:absolute;left:40px;z-index:9998;top:"+(0 + ch*offsetY)+"px";
      wrapper.appendChild(timeline);

      // main canvas
      canvas = document.createElement("canvas");
      canvas.id = `canvas-${ch}`;
      canvas.style.cssText = "cursor:"+(movingSprite?'grabbing':'crosshair')+";position:absolute;left:40px;top:"+(40 + ch*offsetY)+"px";
      // prefer pixelated rendering at DOM-level (extra protection)
      canvas.style.imageRendering = "pixelated";
      canvas.style.webkitImageRendering = "pixelated";
      wrapper.appendChild(canvas);

      // overlay
      overlayCanvas = document.createElement("canvas");
      overlayCanvas.id = `overlay-${ch}`;
      overlayCanvas.style.cssText = "background:transparent;position:absolute;left:40px;pointer-events:none;z-index:10;top:"+(40 + ch*offsetY)+"px";
      // overlay should also be pixelated
      overlayCanvas.style.imageRendering = "pixelated";
      wrapper.appendChild(overlayCanvas);

      // freq bar
      yAxis = document.createElement("canvas");
      yAxis.id = `freq-${ch}`;
      yAxis.style.cssText ="width:40px;background:#222;position:absolute;left:0;top:"+(40 + ch*offsetY)+"px";
      wrapper.appendChild(yAxis);
      
      // logscale
      logscaleEl = document.createElement("canvas");
      logscaleEl.id = `logscale-${ch}`;logscaleEl.width=40;logscaleEl.height=40;
      logscaleEl.style.cssText ="position:absolute; top:0px; background: #111;z-index: 999; top:"+(ch*offsetY)+"px";
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

  let startFrame = calcMinMaxCol().minCol;
  if (startFrame == Infinity) startFrame = 0;
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


function magPhaseToRGB(mag, phase){
  const hp = ((phase / (2*Math.PI) + 1) % 1)*6; 
  const v = Math.min(mag/60,1);
  const x = v*(1-Math.abs(hp%2-1));
  let r,g,b;
  if     (hp < 1){ r=v; g=x; b=0; }
  else if(hp < 2){ r=x; g=v; b=0; }
  else if(hp < 3){ r=0; g=v; b=x; }
  else if(hp < 4){ r=0; g=x; b=v; }
  else if(hp < 5){ r=x; g=0; b=v; }
  else           { r=v; g=0; b=x; }
  return [Math.floor(r*255), Math.floor(g*255), Math.floor(b*255)];
}

function rgbToMagPhase(r, g, b) {
  let rf=r/255,gf=g/255,bf=b/255;
  const mx=Math.max(rf,gf,bf), mn=Math.min(rf,gf,bf);
  const d=mx-mn;
  let h=0,s=0,v=mx;
  s=mx===0?0:d/mx;
  if(d!==0){
    if(mx===rf) h=((gf-bf)/d)%6;
    else if(mx===gf) h=(bf-rf)/d+2;
    else h=(rf-gf)/d+4;
    h/=6; if(h<0) h+=1;
  }
  const phase=h*2*Math.PI;
  const mag=v*60;
  return [mag, phase];
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
  if (pos + fftSize > layers[0].pcm.length) { rendering = false; status.style.display = "none"; return false; }
  let _s = recording?currentLayer:0; _e = recording?currentLayer+1:layerCount;
  for (let ch = _s; ch<_e; ch++){
    const c = layers[ch];
    let mags = c.mags, phases = c.phases, pcm = c.pcm;
    const re = new Float32Array(fftSize);
    const im = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) { re[i] = (pcm[pos + i] || 0) * win[i]; im[i] = 0; }
    fft_inplace(re, im);
    
    let max=0;
    for (let bin = 0; bin < h; bin++) {
      const mag = Math.hypot(re[bin] || 0, im[bin] || 0);
      const phase = Math.atan2(im[bin] || 0, re[bin] || 0);
      const idx = x * h + bin; 
      mags[idx] = mag;
      phases[idx] = phase;
      if (mag>max) max=mag;
    }
    if (uploadingSprite){
      const s = sprites[sprites.length-1];
      if (x>=s.minCol && x<=s.maxCol){
        for (let i=x * h;i<(x+1) * h;i++){
          addPixelToSprite(s, Math.floor(i / specHeight), i%specHeight, Math.random()*0.00001, Math.random()*6.315, mags[i], phases[i], s.ch);
        }
      }
    }
    const skipY = (recording?8:1)*layerCount;
    for (let yy = 0; yy < h; yy+=skipY) {
      const mappedBin = displayYToBin(yy, h, ch);
      const idx = x * h + mappedBin;
      const mag = mags[idx] || 0;
      const phase = phases[idx] || 0;
      const [r, g, b] = magPhaseToRGB(mag, phase);
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
  let pcm = layers[currentLayer].pcm;
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

function getCanvasCoords(e,touch){
  const canvas = document.getElementById("canvas-"+currentLayer);
  const rect=canvas.getBoundingClientRect();
  const scaleX=canvas.width/rect.width;
  const scaleY=canvas.height/rect.height;
  let X; let Y;
  if (touch && e.touches.length === 0) {
      X = _cx; Y = _cy;
  } else {
      X = touch ? e.touches[0].clientX : e.clientX;
      Y = touch ? e.touches[0].clientY : e.clientY;
      _cx = X; _cy = Y;
  }
  return {cx:(X-rect.left)*scaleX, cy:(Y-rect.top)*scaleY, scaleX, scaleY};
}
function processPendingFramesLive(){
  let count=0;
  while (pos + fftSize <= layers[currentLayer].pcm.length) {
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
  const specCtx = specCanvas.getContext("2d");
  let mags = layers[currentLayer].mags, phases = layers[currentLayer].phases;
  if (!imageBuffer[currentLayer] || !mags || !phases) return;
  const w = specWidth, h = specHeight;
  for(let xx=0; xx<w; xx++){
    for(let yy=0; yy<h; yy++){
      const bin = displayYToBin(yy, h, currentLayer);
      const idx = xx * h + bin;
      const mag = mags[idx] || 0;
      const phase = phases[idx] || 0;
      const [r,g,b] = magPhaseToRGB(mag, phase);
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