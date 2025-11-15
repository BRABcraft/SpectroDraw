function initEmptyPCM() {
    const sampleRateLocal = 48000;
    let duration = emptyAudioLengthEl.value; 
    if (duration  < 0.01) duration = 10;
    const type = phaseTextureEl.value;
    const length = sampleRateLocal * duration; 
    const tinyNoiseAmplitude = 0.0001; 

    const pcmArray = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      pcmArray[i] = (Math.random() * 2 - 1) * tinyNoiseAmplitude;
    }
    pcm = pcmArray;
    sampleRate = sampleRateLocal;

    iLow = null;
    minCol = 0; maxCol = 
    restartRender(false);
}
async function onReset() {
  snapshotMags=mags;
  snapshotPhases=phases;
  await initEmptyPCM();
  minCol = 0; maxCol = sampleRate/hop*emptyAudioLengthEl.value;
  sprites = []; movingSprite=false;mvsbtn.classList.toggle('moving', movingSprite);renderSpritesTable('reset');
}
function drawLogScale() {
  const lctx = logscaleEl.getContext("2d");

  const w = 40, h = 40;
  lctx.clearRect(0, 0, w, h);

  lctx.beginPath();
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const x = i / steps;              
    const y = 1-Math.pow(0-(x-1), Math.pow(logScaleVal,2)); 
    const px = x * w;                 
    const py = h - y * h;             
    if (i === 0) lctx.moveTo(px, py);
    else lctx.lineTo(px, py);
  }
  lctx.strokeStyle = "white";
  lctx.lineWidth = 3;
  lctx.stroke();
}
let changingLogScale = false;
function getMouseXY(e,touch) {
  if (touch) {
    return [e.touches[0].clientX, e.touches[0].clientY];
  } else {
    return [e.clientX, e.clientY];
  }
}
logscaleEl.addEventListener("mousedown", e=> {
  logScaleMouseDown(e,false);
});
logscaleEl.addEventListener("touchstart", e=> {
  logScaleMouseDown(e.true);
});
function logScaleMouseDown(e,touch) {
  if (e.button !== 0) return;
  const rect= logscaleEl.getBoundingClientRect();
  changingLogScale = true;
  [startX, startY] = getMouseXY(e,touch);
  buildBinDisplayLookup();
  renderFullSpectrogramToImage();
  drawLogScale();
}
logscaleEl.addEventListener("mousedown", e=> {
  logScaleMouseDown(e,false);
});
logscaleEl.addEventListener("touchstart", e=> {
  logScaleMouseDown(e,true);
});

function logScaleMouseMove(e,touch) {
  logscaleEl.style.cursor = "n-resize";
  if (!changingLogScale) return;
  const rect= logscaleEl.getBoundingClientRect();
  logScaleVal -= (getMouseXY(e,touch)[1] - startY - (getMouseXY(e,touch)[0] - startX))/400;
  if (logScaleVal < 1) logScaleVal = 1;
  if (logScaleVal > 2) logScaleVal = 2;
  [startX, startY] = getMouseXY(e,touch);
  buildBinDisplayLookup();
  renderFullSpectrogramToImage();
  drawLogScale();
  drawYAxis();
}

document.addEventListener("mousemove", e=> {
  logScaleMouseMove(e,false);
});
document.addEventListener("touchmove", e=> {
  logScaleMouseMove(e,true);
});

logscaleEl.addEventListener("mousemove", e=> {
  logscaleEl.title = "Log scale: " + logScaleVal;
});

document.addEventListener("mouseup", e=>{changingLogScale=false;})
document.addEventListener("touchend", e=>{changingLogScale=false;})

emptyAudioLengthEl.addEventListener("input", ()=> {
  initEmptyPCM();
  iLow = 0;
  iHigh = framesTotal;
});
let recording = false;
let mediaStream = null;
let mediaSource = null;
let processor = null;
let workletNode = null;

function countdown(seconds) {
  return new Promise(resolve => {
    let remaining = seconds;
    function tick() {
      status.textContent = `Recording starts in ${remaining}...`;
      if (remaining === 0) {
        resolve();
      } else {
        remaining--;
        setTimeout(tick, 1000);
      }
    }
    tick();
  });
}

function showCountdownOverlay(number) {
  let overlay = document.getElementById("countdown-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "countdown-overlay";
    document.body.appendChild(overlay);
    Object.assign(overlay.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      fontSize: "10rem",
      fontWeight: "bold",
      color: "white",
      textAlign: "center",
      pointerEvents: "none",
      zIndex: 9999,
      opacity: 1,
      transition: "opacity 0.3s ease-out"
    });
  }
  overlay.textContent = number;
  overlay.style.opacity = 1;
  setTimeout(() => overlay.style.opacity = 0, 700);
}

function countdown(seconds) {
  return new Promise(resolve => {
    let remaining = seconds;
    const beep = new Audio("beep.mp3");
    beep.load();

    function tick() {
      if (!recording) return resolve(); // stop if recording canceled

      if (remaining > 0) {
        // show overlay and play beep only if > 0
        showCountdownOverlay(remaining);
        info.innerHTML = `Recording in ${remaining}<br><br>`;
        beep.currentTime = 0;
        beep.play();

        remaining--;
        setTimeout(tick, 1000);
      } else {
        // countdown finished
        resolve();
      }
    }
    tick();
  });
}

async function startRecording() { 
  ensureAudioCtx();
  fHigh = sampleRate/2;
  fWidth = fHigh;

  stopSource();
  const beep = new Audio("beep.mp3");
  beep.load();

  await countdown(3);
  status.textContent = "Recording...";
  recordBtn.innerHTML = recHTML; 
  if (!recording) return;
  pcmChunks = [];        
  pcm = new Float32Array(0);
  pos = 0;
  x = 0;
  rendering = false;

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaSource = audioCtx.createMediaStreamSource(mediaStream);

    await audioCtx.resume();
    sampleRate = audioCtx.sampleRate || sampleRate;

    const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await audioCtx.audioWorklet.addModule(url);

    workletNode = new AudioWorkletNode(audioCtx, 'recorder-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 1
    });

    pcmChunks = [];
    pcm = new Float32Array(0);

    workletNode.port.onmessage = (ev) => {
      const chunk = ev.data;
      if (!(chunk instanceof Float32Array)) return;
      try {pcmChunks.push(chunk);} catch(e) {}

      let total = 0;
      for (let c of pcmChunks) total += c.length;
      const merged = new Float32Array(total);
      let off = 0;
      for (let c of pcmChunks) { merged.set(c, off); off += c.length; }
      pcm = merged;

      processPendingFramesLive();
      iLow = 0;
      const framesSoFar = Math.max(1, Math.floor((pcm.length - fftSize) / hop) + 1);
      iHigh = Math.max(1000, framesSoFar);
      updateCanvasScroll();
      info.innerHTML = `Recording...<br>${(framesSoFar/(sampleRate/hopSizeEl.value)).toFixed(1)} secs<br>Press record or ctrl+space to stop`;
    };

    const silentGain = audioCtx.createGain();
    silentGain.gain.value = 0.0;
    mediaSource.connect(workletNode);
    workletNode.connect(silentGain);
    silentGain.connect(audioCtx.destination);

  } catch (err) {
    console.error("Mic error:", err);
    status.textContent = "Microphone access denied.";
    stopRecording();
  }
}

function stopRecording() {  
  recordBtn.innerHTML = micHTML;
  recording = false;
  status.textContent = "Recording stopped.";
  info.textContent = "";

  if (processor) {
    processor.disconnect();
    processor.onaudioprocess = null;
    processor = null;
  }
  if (mediaSource) {
    mediaSource.disconnect();
    mediaSource = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }

  if (pcm && Array.isArray(pcm)) {
    let length = pcm.reduce((sum, arr) => sum + arr.length, 0);
    let merged = new Float32Array(length);
    let offset = 0;
    for (let chunk of pcm) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    pcm = merged;
  }
  iLow = null;
  pcmChunks = null;

    let t = pcm.length / sampleRate;
    hopSizeEl.value = t<0.5?128:(t<5?512:1024);
  restartRender(true);
    
}

recordBtn.addEventListener("click", async () => {
  if (!recording) {
    recording = true;
    await startRecording();
  } else {
    stopRecording();
  }
});

let audioCtx = null;
function ensureAudioCtx(){
  if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  sampleRate = audioCtx.sampleRate || sampleRate;
}


let startTime=0; 
let audioProcessed=0; 

fileEl.addEventListener("change", async e=>{
    const f=e.target.files[0]; if(!f)return;
    const buf=await f.arrayBuffer();
    snapshotMags = mags; snapshotPhases = phases;
    ensureAudioCtx();
    fHigh = sampleRate/2;
    fWidth = fHigh;
    let ab;
    try {
      ab = await audioCtx.decodeAudioData(buf.slice(0));
      pcm = new Float32Array(ab.getChannelData(0));
      sampleRate = ab.sampleRate || 48000;
      minCol=Infinity;maxCol=0;

      status.textContent=`Loaded ${f.name}, ${pcm.length} samples @ ${sampleRate} Hz`;
      status.style.display = "block";
      await restartRender(true);

    //   newHistory();
      
    let t = pcm.length / sampleRate;
    hopSizeEl.value = t<0.5?128:(t<5?512:1024);
      iLow = 0;
      iHigh = framesTotal;

    } catch (err){
      alert("Error decoding video. Please try a different video.");
    }
});
preset.addEventListener("change", async (e) => {
  const val = e.target.value;

  if (val === "silence") {
    initEmptyPCM();
    return;
  }

  const presetMap = {
    dog: "presets/dog.wav",
    flute: "presets/flute.wav",
    trumpet: "presets/trumpet.wav",
    bomb: "presets/bomb.wav",
    male: "presets/male.wav",
    female: "presets/female.wav",
    birdChirp: "presets/birdChirp.mp3",
    lionRoar: "presets/lionRoar.wav",
    seaLion: "presets/seaLion.mp3",
    violin: "presets/violin.mp3",
    timpani: "presets/timpani.wav",
    piano: "presets/piano.ogg",
    cymbal: "presets/cymbal.wav",
    computerBeeps: "presets/computerBeeps.mp3",
    scream: "presets/scream.mp3",
    engine: "presets/engine.mp3",
    fullSpectra: "presets/fullSpectra.wav",
    bass808: "presets/808bass.wav",
    hardstyle: "presets/hardstyle.wav",
    kick: "presets/kick.wav",
    hihat: "presets/hihat.wav",
    clap: "presets/clap.wav",
    cave14: "presets/cave14.mp3",
    sine: "presets/sine.wav",
    triangle: "presets/triangle.wav",
    square: "presets/square.wav",
    saw: "presets/saw.wav"
  };

  const url = presetMap[val];
  if (!url) {
    console.warn("No URL defined for preset:", val);
    return;
  }

  try {
    status.textContent = `Loading preset "${val}"…`;
    ensureAudioCtx(); 

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);

    const ab = await resp.arrayBuffer();

    const decoded = await audioCtx.decodeAudioData(ab.slice(0));

    pcm = new Float32Array(decoded.getChannelData(0));
    sampleRate = decoded.sampleRate || sampleRate;

    status.textContent = `Loaded preset "${val}", ${pcm.length} samples @ ${sampleRate} Hz`;
    let t = pcm.length / sampleRate;
    hopSizeEl.value = lockHop?Math.pow(2,fftSizeEl.value):(t<0.5?128:(t<5?512:1024));
    minCol = 0; maxCol = Math.floor(pcm.length/hopSizeEl.value);
    restartRender(true);
    iLow = 0;
    iHigh = framesTotal;

  } catch (err) {
    console.error("Preset load error:", err);
    status.textContent = "Error loading preset: " + (err.message || err);
  }
});