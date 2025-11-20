if (lockHop) {hopSizeEl.value = parseInt(fftSizeEl.value);}
fftSizeEl.addEventListener("change",()=>{if (lockHop) {hopSizeEl.value = parseInt(fftSizeEl.value);}restartRender();buildBinDisplayLookup();});
hopSizeEl.addEventListener("change",()=>{restartRender();buildBinDisplayLookup();});

function restartRender(autoPlay){
    if(!pcm) return;
    autoPlayOnFinish = !!playing || !!autoPlay;
    fftSize = parseInt(fftSizeEl.value);
    hop = Math.max(1, parseInt(hopSizeEl.value) || Math.floor(fftSize/2));
    win = hann(fftSize);

    framesTotal = Math.max(1, Math.floor((emptyAudioLengthEl.value*sampleRate - fftSize) / hop) + 1);
    iLow = 0;
    iHigh = framesTotal;
    const freqBins = Math.floor(fftSize / 2);
    canvas.width = framesTotal;
    canvas.height = freqBins;
    if (trueScaleVal) {
      const maxHeight = (window.innerHeight - 110);
      const containerWidth = canvas.parentElement.clientWidth;
      const scaleX = containerWidth / framesTotal;
      const scaleY = maxHeight / freqBins;
      const scale = Math.min(scaleX, scaleY, 1);

      canvas.style.width = (canvas.width * scale) + "px";
      canvas.style.height = (canvas.height * scale) + "px";
    } else {
      canvas.style.width = "calc(100% - 40px)";
      let h = window.innerHeight - 110;
      canvas.style.height = h+"px";
    }

    overlayCanvas.style.width = canvas.style.width;
    overlayCanvas.style.height = canvas.style.height;
    yAxis.height = 1024;
    yAxis.style.height = canvas.style.height;
    yAxis.width = 40;
    yAxis.style.height = canvas.style.height;

    specWidth = canvas.width;
    specHeight = canvas.height;

    syncOverlaySize();

    const timeline = document.getElementById('timeline');
    timeline.width = window.innerWidth*1.2;
    timeline.style.width = canvas.style.width;
    timeline.height = 40;

    imageBuffer = new ImageData(canvas.width, canvas.height);
    specWidth = canvas.width;
    specHeight = canvas.height;

    specCanvas.width = specWidth;
    specCanvas.height = specHeight;
    specCtx.clearRect(0, 0, specCanvas.width, specCanvas.height);
    specCtx.putImageData(imageBuffer, 0, 0);

    mags = new Float32Array(specWidth * specHeight);
    phases = new Float32Array(specWidth * specHeight);
    for(let i=0;i<specWidth*specHeight;i++){ mags[i]=0; phases[i]=0; }

    let startFrame = calcMinMaxCol().minCol;
    if (startFrame == Infinity) startFrame = 0;
    pos = startFrame * hop;
    x = startFrame;
    rendering = true;

    ctx.fillStyle = "black";
    ctx.fillRect(0,0,canvas.width,canvas.height);

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

function getLogScaleSlider() { return Math.max(1, parseFloat(logScaleVal) || 1); }

function binToDisplayY(bin, h) {
    if (!h) return 0;
    const s = getLogScaleSlider();
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

function displayYToBin(y, h) {
    if (!h) return 0;
    const s = getLogScaleSlider();
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
    if (pos + fftSize > pcm.length) { rendering = false; status.style.display = "none"; return false; }

    const re = new Float32Array(fftSize);
    const im = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) { re[i] = (pcm[pos + i] || 0) * win[i]; im[i] = 0; }
    fft_inplace(re, im);

    for (let bin = 0; bin < h; bin++) {
        const mag = Math.hypot(re[bin] || 0, im[bin] || 0);
        const phase = Math.atan2(im[bin] || 0, re[bin] || 0);
        const idx = x * h + bin; 
        mags[idx] = mag;
        phases[idx] = phase;
    }

    for (let yy = 0; yy < h; yy+=recording?4:1) {
        const mappedBin = displayYToBin(yy, h);
        const idx = x * h + mappedBin;
        const mag = mags[idx] || 0;
        const phase = phases[idx] || 0;
        const [r, g, b] = magPhaseToRGB(mag, phase);
        for (let i = 0; i < (recording?4:1); i++) {       
          const pix = ((yy+i) * w + x) * 4; 
          imageBuffer.data[pix]     = r;
          imageBuffer.data[pix + 1] = g;
          imageBuffer.data[pix + 2] = b;
          imageBuffer.data[pix + 3] = 255;
        }
    }
    pos += hop; x++;
    audioProcessed += hop;
    if (x >= (maxCol==0?w:maxCol)) {
      rendering = false;
      if (pendingHistory && snapshotMags && snapshotPhases && mags && phases) {
        pendingHistory = false; 

        newHistory(); 

        const lastEntry = historyStack.length ? historyStack[historyStack.length - 1] : null;
        if (!pendingRecomputeDone) {
          if (lastEntry) {
            recomputePCMForCols(lastEntry.minCol, lastEntry.maxCol, { oldMags: snapshotMags, oldPhases: snapshotPhases });
          }
        } else {

          pendingRecomputeDone = false;
          pendingRecomputeMinCol = pendingRecomputeMaxCol = null;
        }

        snapshotMags = null;
        snapshotPhases = null;
      }
      if (pendingPlayAfterRender) {
        pendingPlayAfterRender = false;
        try {
          playing = true;
          playPause.innerHTML = pauseHtml;
          playPCM(false,currentFrame<specWidth*0.8?minCol:0); 
        } catch (e) { console.warn("playPCM() failed after render:", e); }
        const playPauseEl = document.getElementById("playPause");
        if (playPauseEl) playPauseEl.innerHTML = pauseHtml;
      }

      if (!painting && autoPlayOnFinish) {
          autoPlayOnFinish = false;
          playing = true;
          playPause.innerHTML = pauseHtml;
          playPCM(true,currentFrame<specWidth*0.8?minCol:0);
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

    for (let f = 0; f < framesPerTick; f++) {
        if (!drawFrame(w,h)) break;
    }

    specCtx.putImageData(imageBuffer, 0, 0);
    renderView();
    drawCursor(true);

    if (requestSpecUpdate && typeof resolveSpecUpdate === 'function') {

      resolveSpecUpdate(true);

    }

    const elapsedMS = performance.now() - startTime;
    const elapsedSec = elapsedMS / 1000;
    const speed = audioProcessed / Math.max(1e-6, elapsedSec); 
    const audioSec = pcm.length / sampleRate; 
    const processedSec = audioProcessed / sampleRate;
    status.textContent = `Progress: ${(100*pos/pcm.length).toFixed(1)}% | ` 
        + `Elapsed: ${elapsedSec.toFixed(2)}s | `
        + `Audio processed: ${processedSec.toFixed(2)}/${audioSec.toFixed(2)}s | `
        + `Speed: ${(speed/sampleRate).toFixed(2)}x realtime`;
    if (rendering) {
      status.style.display = "block";
      requestAnimationFrame(() => drawLoop());
    }
}

function drawCursor(clear){
    if (previewingShape && clear) {
      previewShape($x, $y);
    } else {
      const x = (currentCursorX-iLow) * canvas.width / (iHigh-iLow);
      if (clear) overlayCtx.clearRect(0,0, canvas.width, canvas.height);
      overlayCtx.strokeStyle = "#0f0";
      overlayCtx.lineWidth = iWidth/500;
      overlayCtx.beginPath();
      overlayCtx.moveTo(x + 0.5, 0);
      overlayCtx.lineTo(x + 0.5, specHeight);
      overlayCtx.stroke();
      if (alignTime) {
        overlayCtx.strokeStyle = "#222";
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
    if (!imageBuffer || !specCanvas) return;

    const viewWidth = Math.max(1, Math.floor(iHigh - iLow));
    const fStart = Math.max(0, Math.floor(specHeight * (1 - fHigh / (sampleRate/2))));
    const fEnd = Math.min(specHeight, Math.floor(specHeight * (1 - fLow / (sampleRate/2))));
    const viewHeight = Math.max(1, fEnd - fStart);

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

    overlayCanvas.width = canvas.width;
    overlayCanvas.height = canvas.height;
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    drawCursor(true);
}

function renderView() {
    if (!specCanvas || !imageBuffer) return;

    const viewWidth = Math.max(1, Math.floor(iHigh - iLow));
    const fStart = Math.max(0, Math.floor(specHeight * (1 - fHigh / (sampleRate/2))));
    const fEnd = Math.min(specHeight, Math.floor(specHeight * (1 - fLow / (sampleRate/2))));
    const viewHeight = Math.max(1, fEnd - fStart);

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

    overlayCanvas.width = canvas.width;
    overlayCanvas.height = canvas.height;
    overlayCanvas.style.width = canvas.style.width;
    overlayCanvas.style.height = canvas.style.height;
}

let painting=false;
let paintedPixels=null;

function getCanvasCoords(e,touch){
    const rect=canvas.getBoundingClientRect();
    const scaleX=canvas.width/rect.width;
    const scaleY=canvas.height/rect.height;
    let x; let y;
    if (touch && e.touches.length === 0) {
        x = _cx; y = _cy;
    } else {
        x = touch ? e.touches[0].clientX : e.clientX;
        y = touch ? e.touches[0].clientY : e.clientY;
        _cx = x; _cy = y;
    }
    return {cx:(x-rect.left)*scaleX, cy:(y-rect.top)*scaleY, scaleX, scaleY};
}
function processPendingFramesLive(){

  if (!pcm || !fftSize) return;

  while (pos + fftSize <= emptyAudioLengthEl.value*sampleRate) {
    if (!drawFrame(specWidth, specHeight)) break;
  }

  if (imageBuffer && specCtx) specCtx.putImageData(imageBuffer, 0, 0);
  renderView();
  drawCursor(true);
}
function renderFullSpectrogramToImage() {
    if (!imageBuffer || !mags || !phases) return;
    const w = specWidth, h = specHeight;
    for(let xx=0; xx<w; xx++){

        for(let yy=0; yy<h; yy++){

            const bin = displayYToBin(yy, h);
            const idx = xx * h + bin;
            const mag = mags[idx] || 0;
            const phase = phases[idx] || 0;
            const [r,g,b] = magPhaseToRGB(mag, phase);
            const pix = (yy * w + xx) * 4;
            imageBuffer.data[pix] = r;
            imageBuffer.data[pix+1] = g;
            imageBuffer.data[pix+2] = b;
            imageBuffer.data[pix+3] = 255;
        }
    }
    specCtx.putImageData(imageBuffer, 0, 0);
    renderView();
}