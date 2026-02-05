let timelineWidth = framesTotal; 
let timelineHeight = 20;
let timelineCursorX = 0;
let draggingTimeline = false;
let draggingBounds = false;
let tDmode = -1;
let oldX = null;
let iWidth = iHigh - iLow;


function drawTimeline() {
  for (let ch =0 ; ch<layerCount;ch++) {
    const timeline = document.getElementById("timeline-"+ch);
    const tctx = timeline.getContext("2d");
    tctx.clearRect(0, 0, timeline.width, timeline.height);

    tctx.fillStyle = "#333";
    tctx.fillRect(0, 0, timeline.width, timeline.height);

    const ts = 20; 
    const tx = (timelineCursorX-iLow) * timeline.width / (iHigh-iLow);
    const tx2 = timelineCursorX * timeline.width / framesTotal;

    tctx.fillStyle = "#0f0";
    tctx.beginPath();
    tctx.moveTo(tx, ts+10);
    tctx.lineTo(tx - ts, 10);
    tctx.lineTo(tx + ts, 10);
    tctx.closePath();
    tctx.fill();

    iWidth = iHigh - iLow;
    const totalSeconds = iWidth*hop / sampleRate;

    let interval = 0.01; 
    if (totalSeconds > 0.3) interval = 0.1;
    if (totalSeconds > 1) interval = 0.3;
    if (totalSeconds > 3) interval = 1;
    if (totalSeconds > 10) interval = 3;
    if (totalSeconds > 30) interval = 10;
    if (totalSeconds > 100) interval = 30;

    tctx.fillStyle = "#eee";
    tctx.font = "15px sans-serif";
    tctx.textAlign = "center";
    tctx.textBaseline = "top";
    const factor = timeline.width / framesTotal;
    const visibleFrames = iHigh - iLow;
    const secondsPerFrame = hop / sampleRate;

    const sLow = iLow * secondsPerFrame;
    const sHigh = iHigh * secondsPerFrame;

    let tStart = Math.ceil(sLow / interval) * interval;

    for (let t = tStart; t <= sHigh; t += interval) {
      const frame = t / secondsPerFrame; 
      const markerX = (frame - iLow) / visibleFrames * timeline.width;
      
      const xFactor = timeline.width / timeline.getBoundingClientRect().width;
      tctx.save();
      tctx.scale(xFactor, 1.0);
      tctx.fillText(
        t.toFixed(interval < 1 ? 2 : interval < 10 ? 1 : 0),
        markerX/xFactor,
        25
      );
      tctx.restore();
    }

    tctx.fillStyle = "#222";
    tctx.fillRect(0, 0, timeline.width, 20);
    tctx.fillStyle = "#555";
    tctx.fillRect(iLow*factor, 0, (iHigh-iLow)*factor, 20);
    tctx.strokeStyle = "#777";
    tctx.strokeRect(iLow*factor, 0, (iHigh-iLow)*factor, 20);
    tctx.fillStyle = "#af0";
    tctx.fillRect(tx2-1,0,2,20); 
  }
  if (layers && layers[0] && layers[0].pcm[0]) {
    const startSample = Math.max(0, Math.floor(iLow * hop));
    const endSample = Math.min(layers[0].pcm[0].length, Math.ceil(iHigh * hop));
    combineAndDraw(startSample, endSample);
  }

}


function timelineXToFrame(clientXLeft) {
  let timeline = document.getElementById("timeline-"+currentLayer);//CHANGE LATER
  return iLow + clientXLeft/timeline.getBoundingClientRect().width*iWidth;
}
function timelineMousedown(e,touch) {
    if (e.button !== 0) return;
    let timeline = document.getElementById("timeline-"+currentLayer);//CHANGE LATER
    const rect = timeline.getBoundingClientRect();
    if ((touch ? e.touches[0].clientY : e.clientY)- rect.top>20) {
      draggingTimeline = true;
      wasPlayingDuringDrag = playing;

      stopSource(true);
      timelineCursorX = timelineXToFrame(e.clientX - rect.left);

      currentCursorX = timelineCursorX;
      drawTimeline();
      drawYAxis();
      drawLogScale();
      drawCursor(true);
    } else {
      draggingBounds = true;
      oldX = (touch ? e.touches[0].clientX : e.clientX)- rect.left;
      iWidth = iHigh-iLow;
    }
}
function timelineMousemove(e,touch) {
  const beatSize = (sampleRate/hop)/iWidth;
  if (beatSize > 2) subBeat = 16;
  else if (beatSize > 1) subBeat = 8;
  else if (beatSize > 0.5) subBeat = 4;
  else if (beatSize > 1/4) subBeat = 2;
  else if (beatSize > 1/8) subBeat = 1;
  else subBeat = 1/2;
  const timeline = document.getElementById("timeline-"+currentLayer);//CHANGE LATER
  const rect = timeline.getBoundingClientRect();
  const mouseY = (touch ? e.touches[0].clientY : e.clientY)- rect.top;
  const mouseX = (touch ? e.touches[0].clientX : e.clientX)- rect.left;
  if (mouseY > 20 && tDmode == -1) {
    timeline.style.cursor = "pointer";
    if (!draggingTimeline) return;
    timelineCursorX = timelineXToFrame(mouseX);
    currentCursorX = timelineCursorX;
  } else {
    const sLow = iLow * rect.width/framesTotal;
    const sHigh = iHigh * rect.width/framesTotal;
    iWidth = iHigh-iLow;
    if ((Math.abs(mouseX - sLow)<15 && tDmode == -1) || tDmode === 0) {
      timeline.style.cursor = "e-resize";
      if (!draggingBounds) return;
      updateCanvasScroll();
      tDmode = 0;
      iLow = mouseX/rect.width*framesTotal;
      if (iLow < 0) {
        iLow = 0;
      }
      if (iLow > iHigh) iLow = iHigh - 1;
    } else if ((Math.abs(mouseX - sHigh)<15 && tDmode == -1) || tDmode == 1) {
      timeline.style.cursor = "w-resize";
      if (!draggingBounds) return;
      updateCanvasScroll();
      tDmode = 1;
      iHigh = mouseX/rect.width*framesTotal;
      if (iHigh > framesTotal) {
        iHigh = framesTotal;
      }
      if (iHigh < iLow) iHigh = iLow + 1;
    } else {
      timeline.style.cursor = "move";
      if (!draggingBounds) return;
      updateCanvasScroll();
      tDmode = 2;
      const inc = (mouseX-oldX)/rect.width*framesTotal
      iLow += inc;
      if (iLow < 0) {
        iLow = 0;
      }
      if (iHigh > framesTotal) {
        iLow = framesTotal - iWidth;
      }
      iHigh = iLow + iWidth;
      oldX = mouseX;
    }
  }
  
  drawTimeline();
  drawYAxis();
  drawLogScale();
  drawCursor(true);
}
window.addEventListener("mousemove", e => {
    timelineMousemove(e,false);
});
window.addEventListener("touchmove", e => {
    timelineMousemove(e,true);
});
function timelineMouseup(e) {
  tDmode = -1;
  draggingBounds = false;
  if (!draggingTimeline) return;
  draggingTimeline = false;
  const frame = timelineCursorX;

  pausedAtSample = frame * hop;

  if (wasPlayingDuringDrag) {
    playPCM(true, frame);
    document.getElementById("playPause").innerHtml = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="black" viewBox="0 0 20 20">
      <rect x="2" y="0" width="5" height="18" rx="2" ry="2"/>
      <rect x="12" y="0" width="5" height="18" rx="2" ry="2"/>
    </svg>
    `;
  } else {
    const specCanvas = document.getElementById("spec-"+currentLayer);
    const specCtx = specCanvas.getContext("2d");
    specCtx.putImageData(imageBuffer[currentLayer], 0, 0);
    renderView();
    drawCursor(true);
  }
  drawTimeline();
  drawLogScale();
  drawYAxis();
}
window.addEventListener("mouseup", e => {
    timelineMouseup(e);
});
window.addEventListener("touchend", e => {
    timelineMouseup(e);
});

fLow = 0;
fHigh = sampleRate/2;
let fWidth = fHigh-fLow;
let draggingFreq = false;
let fDmode = -1;
let oldY = null;

function drawYAxis() {
  for (let l=0;l<layerCount;l++){
    const yAxis = document.getElementById("freq-"+l);
    const yctx = yAxis.getContext("2d");

    if (yAxis.height <= 0 || yAxis.width <= 0) continue;
    yctx.clearRect(15, 0, 25, yAxis.height);
    yctx.fillStyle = "#333";
    yctx.fillRect(15, 0, 25, yAxis.height);

    let interval = 1000;
    if (fWidth <= 500) interval = 100;
    else if (fWidth <= 2000) interval = 250;
    else if (fWidth <= 5000) interval = 500;

    yctx.fillStyle = "#eee";
    yctx.font = "10px sans-serif";
    yctx.textAlign = "right";
    yctx.textBaseline = "middle";

    const labelX = Math.max(40, yAxis.width - 4);
    const yFactor = specHeight/parseInt(yAxis.style.height); 
    function fToVisY(f) {
      const h = specHeight;
      const s = parseFloat(logScaleVal[l]);
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
      const fStart = Math.max(0, Math.floor(h * (1 - fHigh / (sampleRate / 2))));
      const fEnd   = Math.min(h, Math.floor(h * (1 - fLow / (sampleRate / 2))));
      const viewHeight = fEnd - fStart;
      const visY = ((cy - fStart) / viewHeight) * h;
      return visY/yFactor/(fftSize/2048);
    }
    const rect = yAxis.getBoundingClientRect();
    if (useHz) {
      let lastDrawPos = 9999999;
      for (let f = 0.859375; f < sampleRate / 2; f *= (Math.pow(2, 1 / 12))) {
        visY = fToVisY(f);
        if (Math.abs(visY - lastDrawPos) < (100/fftSize*246)) continue;
        if (visY < 0 || visY > rect.height) continue;
        const label = hzToNoteName(f);
        yctx.save();
        yctx.scale(1.0, yFactor/(fftSize/2048));
        yctx.fillText(label, labelX, visY*(fftSize/2048));
        yctx.restore();
        lastDrawPos = visY;
      }
    } else {
      function drawHz(f, visY) {
        let label = (f / 1000).toFixed(1) + "k";
        if (f < 1000) label = f.toFixed(0);
        yctx.save();
        yctx.scale(1.0, yFactor/(fftSize/2048));
        yctx.fillText(label, labelX, visY*(fftSize/2048));
        yctx.restore();
      }
      let f = 0;
      let lastDrawPos = 9999999;
      let visY = 0;
      while (f < sampleRate/2) {
        if (Math.abs(visY-lastDrawPos)>(100/fftSize*4000)) {
          let e = f + interval;
          while (f<e) {
            visY = fToVisY(f);
            drawHz(f,visY);
            lastDrawPos=visY;
            f+=interval/8;
          }
        } else {
          lastDrawPos=visY;
          visY = fToVisY(f);
          drawHz(f,visY);
          f+=interval;
        }
      }
    }
    const factorVisible = yAxis.height / (sampleRate / 2);
    yctx.fillStyle = "#222";
    yctx.fillRect(0, 0, 15, yAxis.height);
    const fhVisible = (fHigh - fLow) * factorVisible;
    const topVisible = Math.max(0, Math.min(yAxis.height, yAxis.height - fhVisible - fLow * factorVisible));
    yctx.fillStyle = "#555";
    yctx.fillRect(0, topVisible, 15, Math.max(1, fhVisible));
    yctx.strokeStyle = "#777";
    yctx.strokeRect(0, topVisible, 15, Math.max(1, fhVisible));
  }
}


function yAxisMousedown(e,touch) {
  let yAxis = document.getElementById("freq-"+currentLayer);//CHANGE LATER
  if (e.button !== 0) return;
  const rect = yAxis.getBoundingClientRect();
  const x = touch ? e.touches[0].clientX : e.clientX;
  const y = touch ? e.touches[0].clientY : e.clientY;
  if (x - rect.left < 15) {
      draggingFreq = true;
      oldY = y - rect.top;
      fWidth = fHigh - fLow;
  }
}

function yAxisMousemove(e,touch) {
  const yAxis = document.getElementById("freq-"+currentLayer);
  const rect = yAxis.getBoundingClientRect();
  const mouseY = (touch ? e.touches[0].clientY : e.clientY) - rect.top;
  const mouseX = (touch ? e.touches[0].clientX : e.clientX) - rect.left;

  if (mouseX < 15) {
    const sLow = (fLow / (sampleRate/2)) * rect.height;
    const sHigh = (fHigh / (sampleRate/2)) * rect.height;
    fWidth = fHigh - fLow;
    if ((Math.abs(mouseY - (rect.height - sLow)) < 15 && fDmode == -1) || fDmode === 0) {
      yAxis.style.cursor = "s-resize";
      if (!draggingFreq) return;
      updateCanvasScroll();
      fDmode = 0;
      fLow = (1 - mouseY / rect.height) * (sampleRate/2);
      if (fLow < 0) fLow = 0;
      if (fLow > fHigh) fLow = fHigh - 1;
    } else if ((Math.abs(mouseY - (rect.height - sHigh)) < 15 && fDmode == -1) || fDmode == 1) {
      yAxis.style.cursor = "n-resize";
      if (!draggingFreq) return;
      updateCanvasScroll();
      fDmode = 1;
      fHigh = (1 - mouseY / rect.height) * (sampleRate/2);
      if (fHigh > sampleRate/2) fHigh = sampleRate/2;
      if (fHigh < fLow) fHigh = fLow + 1;
    } else {
      yAxis.style.cursor = "move";
      if (!draggingFreq) return;
      updateCanvasScroll();
      fDmode = 2;
      const inc = (oldY - mouseY) / rect.height * (sampleRate/2);
      fLow += inc;
      if (fLow < 0) fLow = 0;
      if (fHigh > sampleRate/2) fLow = sampleRate/2 - fWidth;
      fHigh = fLow + fWidth;
      oldY = mouseY;
    }
  } else {
      yAxis.style.cursor = "default";
  }
  drawTimeline();
  drawYAxis();
  drawLogScale();
  // drawCursor(true);
}
window.addEventListener("mousemove", e => {yAxisMousemove(e,false);});
window.addEventListener("touchmove", e => {yAxisMousemove(e,true);});

window.addEventListener("mouseup", e => {fDmode = -1;draggingFreq = false;});
window.addEventListener("touchend", e => {fDmode = -1;draggingFreq = false;});



const playPauseBtn = document.getElementById("playPause");
const ppohtml = `<svg xmlns="http://www.w3.org/2000/svg" fill="#333" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
          <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="6"/>
          <circle cx="50" cy="50" r="34" fill="none" stroke="rgba(0,0,0,0.3)" stroke-width="2" />`;
const playHtml = ppohtml + `<path d="M40 70 V30 l30 20z"/ fill="#fff"></svg>`
const pauseHtml = ppohtml+`<rect x="34" y="30" width="10" height="36" rx="2" ry="2" fill="#fff"/><rect x="54" y="30" width="10" height="36" rx="2" ry="2" fill="#fff"/></svg>`;

function playPause() {
  ensureAudioCtx();
  if (playing) {
      const elapsed = audioCtx.currentTime - sourceStartTime;
      let samplePos = Math.floor(elapsed * sampleRate);
      if (sourceNode && sourceNode.loop) {
          samplePos = samplePos % layers[0].pcm[0].length;
      }
      pausedAtSample = Math.max(0, Math.min(layers[0].pcm[0].length - 1, samplePos));
      stopSource(true);
      playPauseBtn.innerHTML = playHtml;
  } else {
      const startFrame = (pausedAtSample !== null) ? Math.floor(pausedAtSample / hop) : 0;
      playPCM(true, startFrame);
      playPauseBtn.innerHTML = pauseHtml;
  }
}

playPauseBtn.addEventListener("click", () => {
    playPause();
});

document.addEventListener('keydown', function(event) {
  if (event.key === ' ' && !event.ctrlKey && !event.metaKey && editingExpression===null) {
    playPause();
    event.preventDefault();
  }
});

function updateTimelineCursor() {
    if (playing && !draggingTimeline && layers[0].pcm[0] && sourceNode) {
        const elapsed = audioCtx.currentTime - sourceStartTime;
        let samplePos = elapsed * sampleRate;

        if (sourceNode.loop) {
            samplePos = samplePos % layers[0].pcm[0].length;
        }

        const frame = Math.floor(samplePos / hop);
        timelineCursorX = Math.min(frame, specWidth-1);
        currentCursorX = timelineCursorX;
        drawTimeline();
        drawYAxis();
        drawCursor(true);
    }
    requestAnimationFrame(updateTimelineCursor);
}

// --- Zoom-on-pinch / wheel handlers -------------------------
const WHEEL_SENSITIVITY = 0.004;   // higher = more sensitive for trackpad/mouse wheel
const PINCH_SENSITIVITY = 2.5;     // >1 amplifies pinch differences; 1.0 == 1:1
const INVERT_PINCH_FOR_TRACKPAD = false; // flip pinch direction for trackpad/gesture events
// small helper
function _clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

// Zoom timeline centered at clientX (relative to element rect)
function zoomTimelineAt(clientX, elem, scaleFactor){
  let canvas = document.getElementById("canvas-"+currentLayer);//CHANGE LATER
  zooming = true;
  const rect = canvas.getBoundingClientRect();
  const centerFrac = _clamp((clientX - rect.left) / rect.width, 0, 1);
  const centerFrame = iLow + centerFrac * iWidth;
  const newWidth = _clamp(iWidth / scaleFactor, 1, framesTotal);
  let newLow = centerFrame - centerFrac * newWidth;
  if (newLow < 0) newLow = 0;
  if (newLow + newWidth > framesTotal) newLow = framesTotal - newWidth;
  iLow = Math.round(newLow);
  iHigh = Math.round(iLow + newWidth);
  iWidth = iHigh - iLow;
  updateCanvasScroll();
  drawTimeline();
  drawCursor(true);
  renderView && renderView();
}

// Zoom y-axis centered at clientY (relative to element rect)
function zoomYAxisAt(clientY, elem, scaleFactor){
  let canvas = document.getElementById("canvas-"+currentLayer);//CHANGE LATER
  zooming = true;
  const yf = (sampleRate/specHeight/2);
  const rect = canvas.getBoundingClientRect();
  const cy = (clientY - rect.top) * canvas.height/rect.height;
  // console.log(getSineFreq(visibleToSpecY(0)))
  const centerFrame = (lsc(getSineFreq(visibleToSpecY(cy)),sampleRate/2,logScaleVal[currentLayer]))/yf;
  const centerFrac = centerFrame/specHeight;
  const newHeight = _clamp((fWidth)/yf / scaleFactor, 1, specHeight);
  let newLow = centerFrame - centerFrac * newHeight;
  if (newLow < 0) newLow = 0;
  if (newLow + newHeight > specHeight) newLow = specHeight - newHeight;
  fLow = ((newLow)*(sampleRate/specHeight/2));
  fHigh = ((newLow+newHeight)*(sampleRate/specHeight/2));
  fWidth = fHigh - fLow;
  updateCanvasScroll();
  drawYAxis();
  drawCursor(true);
  renderView && renderView();
}

// New: how aggressively swipes pan the view. Tune to taste.
const PAN_SENSITIVITY = 1.0; // >1 = pan more per swipe, <1 = pan less

// Generic wheel handler factory — attach to each element
// opts: {zoomTimeline:bool, zoomYAxis:bool}
function makeWheelZoomHandler(elem, opts){
  return function(e){
    // get some geometry early
    let timeline = document.getElementById("timeline-"+currentLayer);//CHANGE LATER
    let yAxis = document.getElementById("freq-"+currentLayer);//CHANGE LATER
    let canvas = document.getElementById("canvas-"+currentLayer);//CHANGE LATER
    const {cx,cy,scaleX,scaleY} = getCanvasCoords(e,false); $x=cx;$y=cy;
    const rectElem = elem.getBoundingClientRect();
    const rectTimeline = timeline ? timeline.getBoundingClientRect() : null;
    const rectYAxis = yAxis ? yAxis.getBoundingClientRect() : null;

    // should we treat this as a zoom gesture? (ctrl / meta held)
    const shouldZoom = e.ctrlKey || e.metaKey;
    const delta = e.deltaY;
    const sign = INVERT_PINCH_FOR_TRACKPAD ? 1 : -1;

    if (shouldZoom) {
      // Zoom path (existing behavior) — keep preventing default to block page zoom
      e.preventDefault();
      const scale = Math.exp(sign * delta * WHEEL_SENSITIVITY);

      if (opts.zoomTimeline && elem === canvas) {
        // canvas zooms both by default
        zoomTimelineAt(e.clientX, timeline, scale);
      } else if (opts.zoomTimeline) {
        zoomTimelineAt(e.clientX, timeline, scale);
      }
      if (opts.zoomYAxis) {
        zoomYAxisAt(e.clientY, yAxis, scale);
      }
      if (e.deltaY === 0) zooming = false;
      
      updateCanvasScroll();
      drawYAxis();
      drawCursor(true);
      renderView && renderView();
      return;
    }

    // --- PAN path for plain swipes (no ctrl/meta) ----------------
    // Only intercept when there is a meaningful delta (avoids weird small noise)
    const absDX = Math.abs(e.deltaX || 0);
    const absDY = Math.abs(e.deltaY || 0);
    if (absDX < 0.5 && absDY < 0.5) return; // ignore tiny events

    // If horizontal movement dominates -> pan timeline horizontally
    if (absDX >= absDY) {
      // if timeline panning is allowed for this handler
      if (!opts.zoomTimeline) return;
      e.preventDefault();

      // convert deltaX into frame offset
      // positive deltaX => move window right (iLow increases)
      const rect = rectTimeline || rectElem;
      if (!rect) return;
      const incFrames = (e.deltaX / rect.width) * 500 * PAN_SENSITIVITY;

      iLow = Math.round(_clamp(iLow + incFrames, 0, Math.max(1, framesTotal - iWidth)));
      iHigh = iLow + iWidth;

      updateCanvasScroll();
      drawTimeline();
      drawCursor(true);
      renderView && renderView();
      return;
    }

    // If vertical movement dominates -> pan frequency range (y-axis)
    if (absDY > absDX) {
      // prefer panning the yAxis if handler supports it
      if (opts.zoomYAxis) {
        e.preventDefault();
        const rect = rectYAxis || rectElem;
        if (!rect) return;

        // positive deltaY -> move visible band down (lower frequencies increase),
        // so increment fLow/fHigh accordingly
        const incHz = (e.deltaY / rect.height) * (sampleRate / 2) * PAN_SENSITIVITY;

        fLow = _clamp(fLow + incHz, 0, Math.max(1, (sampleRate / 2) - fWidth));
        fHigh = fLow + fWidth;

        updateCanvasScroll();
        drawYAxis();
        drawCursor(true);
        renderView && renderView();
        return;
      }

      // fallback: if handler is for canvas and not yAxis, treat vertical swipe as horizontal pan for timeline
      if (opts.zoomTimeline && elem === canvas) {
        e.preventDefault();
        const rect = rectTimeline || rectElem;
        if (!rect) return;
        const incFrames = (e.deltaY / rect.width) * framesTotal * PAN_SENSITIVITY;
        iLow = Math.round(_clamp(iLow + incFrames, 0, Math.max(1, framesTotal - iWidth)));
        iHigh = iLow + iWidth;

        updateCanvasScroll();
        drawTimeline();
        drawCursor(true);
        renderView && renderView();
        return;
      }
    }
  };
}

// --- Gesture events for Safari (optional) ---------------------------------
// Safari exposes gesturestart/gesturechange with event.scale. Handle gracefully when available.
function safariGestureHandler(e){
  e.preventDefault();
  // e.scale is relative to gesture; normalize and apply sensitivity & optional invert
  let raw = Number(e.scale) || 1;
  // apply pinch sensitivity curve and optionally invert
  let scale = Math.pow(raw, PINCH_SENSITIVITY);
  if (INVERT_PINCH_FOR_TRACKPAD) scale = 1 / scale;
  const cx = e.clientX || (window.innerWidth/2);
  const cy = e.clientY || (window.innerHeight/2);

  const el = e.target;
  if (el === timeline || (el.closest && el.closest('#timeline'))) {
    zoomTimelineAt(cx, timeline, scale);
  } else if (el === yAxis || (el.closest && el.closest('#yAxis'))) {
    zoomYAxisAt(cy, yAxis, scale);
  } else {
    zoomTimelineAt(cx, timeline, scale);
    zoomYAxisAt(cy, yAxis, scale);
  }
}
['gesturestart','gesturechange'].forEach(evt => {
  document.addEventListener(evt, safariGestureHandler, {passive:false});
});

// --- Touch pinch handling (generic and robust) ----------------------------

const _pinchState = {
  active: false,
  startDist: 0,
  startILow: 0, startIHigh: 0, startFLow: 0, startFHigh: 0,
  midX: 0, midY: 0,
  target: null // 'canvas' | 'timeline' | 'yAxis'
};

function touchDistance(t0, t1){
  const dx = t0.clientX - t1.clientX;
  const dy = t0.clientY - t1.clientY;
  return Math.hypot(dx, dy);
}

function getTouchMid(t0, t1){
  return { x: (t0.clientX + t1.clientX)/2, y: (t0.clientY + t1.clientY)/2 };
}

function touchStartHandler(e){
  if (!e.touches || e.touches.length !== 2) return;
  // start pinch
  const [t0, t1] = [e.touches[0], e.touches[1]];
  _pinchState.active = true;
  _pinchState.startDist = touchDistance(t0, t1);
  _pinchState.mid = getTouchMid(t0, t1);
  _pinchState.startILow = iLow; _pinchState.startIHigh = iHigh;
  _pinchState.startFLow = fLow; _pinchState.startFHigh = fHigh;

  // determine target area by testing midpoint element
  const el = document.elementFromPoint(_pinchState.mid.x, _pinchState.mid.y);
  if (!el) _pinchState.target = 'canvas';
  else if (el === timeline || el.closest && el.closest('#timeline')) _pinchState.target = 'timeline';
  else if (el === yAxis || el.closest && el.closest('#yAxis')) _pinchState.target = 'yAxis';
  else _pinchState.target = 'canvas';

  e.preventDefault();
}

function touchMoveHandler(e){
  if (!_pinchState.active) return;
  if (!e.touches || e.touches.length !== 2) return;
  const [t0, t1] = [e.touches[0], e.touches[1]];
  const curDist = touchDistance(t0, t1);
  if (_pinchState.startDist <= 0) return;

  // rawScale > 1 when fingers spread; apply sensitivity and optional invert
  let rawScale = curDist / _pinchState.startDist;
  let scale = Math.pow(rawScale, PINCH_SENSITIVITY);
  if (INVERT_PINCH_FOR_TRACKPAD) scale = 1 / scale;
  const mid = getTouchMid(t0, t1);

  if (_pinchState.target === 'canvas'){
    // zoom both
    iLow  = _pinchState.startILow;  iHigh = _pinchState.startIHigh; iWidth = iHigh - iLow;
    zoomTimelineAt(mid.x, timeline, scale);

    fLow  = _pinchState.startFLow;  fHigh = _pinchState.startFHigh; fWidth = fHigh - fLow;
    zoomYAxisAt(mid.y, yAxis, scale);
  } else if (_pinchState.target === 'timeline'){
    iLow  = _pinchState.startILow;  iHigh = _pinchState.startIHigh; iWidth = iHigh - iLow;
    zoomTimelineAt(mid.x, timeline, scale);
  } else if (_pinchState.target === 'yAxis'){
    fLow  = _pinchState.startFLow;  fHigh = _pinchState.startFHigh; fWidth = fHigh - fLow;
    zoomYAxisAt(mid.y, yAxis, scale);
  }
  e.preventDefault();
}

function touchEndHandler(e){
  zooming = false;
  if (!_pinchState.active) return;
  if (!e.touches || e.touches.length >= 1) {
    // still a touch remaining (not fully ended), keep active only if still 2 touches
    if (e.touches.length < 2) { _pinchState.active = false; }
    return;
  }
  _pinchState.active = false;
}

// attach touch listeners to the container elements (use capture on document to catch multi-touch)
document.addEventListener('touchstart', touchStartHandler, {passive:false});
document.addEventListener('touchmove', touchMoveHandler, {passive:false});
document.addEventListener('touchend', touchEndHandler, {passive:false});
document.addEventListener('touchcancel', touchEndHandler, {passive:false});

// -------------------------------------------------------------------------
