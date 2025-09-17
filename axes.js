const timeline = document.getElementById('timeline');
const tctx = timeline.getContext('2d');

let timelineWidth = timeline.width; 
let timelineHeight = 20;
let timelineCursorX = 0;
let draggingTimeline = false;
let draggingBounds = false;
let tDmode = -1;
let oldX = null;
let iWidth = iHigh - iLow;

function drawTimeline() {
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

    if (!pcm) return;
    iWidth = iHigh - iLow;
    const totalSeconds = iWidth*hopSizeEl.value / sampleRate;

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
    const secondsPerFrame = hopSizeEl.value / sampleRate;

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

function timelineXToFrame(clientXLeft) {
    return iLow + clientXLeft/timeline.getBoundingClientRect().width*iWidth;
}
function timelineMousedown(e,touch) {
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
      drawCursor();
    } else {
      draggingBounds = true;
      oldX = (touch ? e.touches[0].clientX : e.clientX)- rect.left;
      iWidth = iHigh-iLow;
    }
}
timeline.addEventListener("mousedown", e => {
    timelineMousedown(e,false);
});
timeline.addEventListener("touchstart", e => {
    timelineMousedown(e,true);
});
function timelineMousemove(e,touch) {
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
      drawCursor();
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
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 20 20">
        <rect x="2" y="0" width="5" height="18" rx="2" ry="2"/>
        <rect x="12" y="0" width="5" height="18" rx="2" ry="2"/>
      </svg>
        `;
    } else {
        specCtx.putImageData(imageBuffer, 0, 0);
        renderView();
        drawCursor();
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
    if (yAxis.height <= 0 || yAxis.width <= 0) return;

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


function yAxisMousedown(e,touch) {
    const rect = yAxis.getBoundingClientRect();
    const x = touch ? e.touches[0].clientX : e.clientX;
    const y = touch ? e.touches[0].clientY : e.clientY;
    if (x - rect.left < 15) {
        draggingFreq = true;
        oldY = y - rect.top;
        fWidth = fHigh - fLow;
    }
}

yAxis.addEventListener("mousedown", e => {yAxisMousedown(e,false);});
yAxis.addEventListener("touchstart", e => {yAxisMousedown(e,true);});

function yAxisMousemove(e,touch) {
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
    }
    drawTimeline();
    drawYAxis();
    drawLogScale();
    drawCursor();
}
window.addEventListener("mousemove", e => {yAxisMousemove(e,false);});
window.addEventListener("touchmove", e => {yAxisMousemove(e,true);});

window.addEventListener("mouseup", e => {fDmode = -1;draggingFreq = false;});
window.addEventListener("touchend", e => {fDmode = -1;draggingFreq = false;});



const playPauseBtn = document.getElementById("playPause");
const stopBtn = document.getElementById("stop");
const playHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="9 8 16 16"><path d="M16 0 M14 22V10l8 6z"/></svg>`;
const pauseHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><rect x="2" y="0" width="5" height="18" rx="2" ry="2"/><rect x="12" y="0" width="5" height="18" rx="2" ry="2"/></svg>`;

function playPause() {
  ensureAudioCtx();
    if (playing) {
        const elapsed = audioCtx.currentTime - sourceStartTime;
        let samplePos = Math.floor(elapsed * sampleRate);
        if (sourceNode && sourceNode.loop) {
            samplePos = samplePos % pcm.length;
        }
        pausedAtSample = Math.max(0, Math.min(pcm.length - 1, samplePos));
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
  if (event.key === ' ') {
    playPause();
    event.preventDefault();
  }
});

stopBtn.addEventListener("click", () => {
    stopSource(false); 
    if (recording) {stopRecording(); recording = false;}
    timelineCursorX = 0;
    currentCursorX = 0;
    drawTimeline();
    drawYAxis();
    drawLogScale();
    specCtx.putImageData(imageBuffer, 0, 0);
    renderView();
    drawCursor();
    playPauseBtn.innerHTML = playHtml;
});

function updateTimelineCursor() {
    if (playing && !draggingTimeline && pcm && sourceNode) {
        const elapsed = audioCtx.currentTime - sourceStartTime;
        let samplePos = elapsed * sampleRate;

        if (sourceNode.loop) {
            samplePos = samplePos % pcm.length;
        }

        const frame = Math.floor(samplePos / hop);
        timelineCursorX = Math.min(frame, specWidth-1);
        currentCursorX = timelineCursorX;
        drawTimeline();
        drawYAxis();
        drawCursor();
    }
    requestAnimationFrame(updateTimelineCursor);
}