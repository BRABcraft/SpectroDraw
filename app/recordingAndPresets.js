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

async function startRecording() {  
  ensureAudioCtx();
  fHigh = sampleRate/2;
  fWidth = fHigh;

  stopSource();
  const beep = new Audio("beep.mp3");
beep.load();

info.textContent = "Recording in 3";
beep.currentTime = 0; beep.play();
await countdown(1);
if (!recording) return;

info.textContent = "Recording in 2";
beep.currentTime = 0; beep.play();
await countdown(1);
if (!recording) return;

info.textContent = "Recording in 1";
beep.currentTime = 0; beep.play();
await countdown(1);
if (!recording) return;
  info.textContent = "Recording...";
  status.textContent = "Recording...";
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
      pcmChunks.push(chunk);

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
    ensureAudioCtx();
    fHigh = sampleRate/2;
    fWidth = fHigh;
    let ab;
    try {
      ab = await audioCtx.decodeAudioData(buf.slice(0));
      pcm = new Float32Array(ab.getChannelData(0));
      sampleRate = ab.sampleRate || 48000;

      status.textContent=`Loaded ${f.name}, ${pcm.length} samples @ ${sampleRate} Hz`;
      status.style.display = "block";
      restartRender(true);
      
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
    cave14: "presets/cave14.oga",
    sine: "presets/sine.wav",
    triangle: "presets/triangle.mp3",
    square: "presets/square.mp3",
    saw: "presets/saw.mp3"
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
    hopSizeEl.value = t<0.5?128:(t<5?512:1024);
    restartRender(true);
    iLow = 0;
    iHigh = framesTotal;

  } catch (err) {
    console.error("Preset load error:", err);
    status.textContent = "Error loading preset: " + (err.message || err);
  }
});