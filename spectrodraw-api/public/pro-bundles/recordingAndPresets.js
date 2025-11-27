async function initEmptyPCM() {
  if (channels === null) channels = new Array(channelCount);
  const sampleRateLocal = 48000;
  let duration = parseFloat(emptyAudioLengthEl.value);
  if (duration < 0.01) duration = 10;

  const length = Math.floor(sampleRateLocal * duration);
  const tinyNoiseAmplitude = 0.0001;
  let p = channels[0] ? channels[0].pcm : [];
  if (length>p.length) {
    for (let ch =0; ch<channelCount;ch++){
      const newPCM = new Float32Array(length);
      newPCM.set(p);
      for (let i = p.length; i < length; i++) {
        newPCM[i] = (Math.random() * 2 - 1) * tinyNoiseAmplitude;
      }
      channels[ch] = {
        pcm: newPCM,
        mags: [],
        phases: [],
        snapshotMags: [],
        snapshotPhases: [],
        enabled: true,
        volume: 1,
        brushPressure: 1,
        audioDevice: channelCount==1?"both":(ch==0?"left":(ch==1?"right":"none"))
      };
    }
  }
  
  // If pcm is already long enough, leave it as-is

  sampleRate = sampleRateLocal;
  iLow = 0; iHigh = framesTotal;
  restartRender(false);
  minCol = 0; 
  maxCol = framesTotal;
  // await waitFor(() => !rendering);
  // for(let ch=0;ch<channelCount;ch++)renderSpectrogramColumnsToImageBuffer(0,maxCol,ch);
}

async function onReset() {
  for (let ch=0;ch<channelCount;ch++){
    channels[ch].snapshotMags=channels[ch].mags;
    channels[ch].snapshotPhases=channels[ch].phases;
  }
  await initEmptyPCM();
  minCol = 0; maxCol = sampleRate/hop*emptyAudioLengthEl.value;
  sprites = []; movingSprite=false;mvsbtn.classList.toggle('moving', movingSprite);renderSpritesTable('reset');
}
function drawLogScale() {
  for (let ch=0;ch<channelCount;ch++){
    const logscaleEl = document.getElementById("logscale-"+ch);
    const lctx = logscaleEl.getContext("2d");

    const w = 40, h = 40;
    lctx.clearRect(0, 0, w, h);

    lctx.beginPath();
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const x = i / steps;              
      const y = 1-Math.pow(0-(x-1), Math.pow(logScaleVal[ch],2)); 
      const px = x * w;                 
      const py = h - y * h;             
      if (i === 0) lctx.moveTo(px, py);
      else lctx.lineTo(px, py);
    }
    lctx.strokeStyle = "white";
    lctx.lineWidth = 3;
    lctx.stroke();
  }
}
let changingLogScale = false;
function getMouseXY(e,touch) {
  if (touch) {
    return [e.touches[0].clientX, e.touches[0].clientY];
  } else {
    return [e.clientX, e.clientY];
  }
}

function logScaleMouseDown(e,touch,logscaleEl) {
  if (e.button !== 0) return;
  changingLogScale = true;
  [startX, startY] = getMouseXY(e,touch);
  buildBinDisplayLookup();
  renderFullSpectrogramToImage();
  drawLogScale();
}

function logScaleMouseMove(e,touch) {
  const logscaleEl = document.getElementById("logscale-"+currentChannel);
  logscaleEl.style.cursor = "n-resize";
  if (!changingLogScale) return;
  logScaleVal[currentChannel] -= (getMouseXY(e,touch)[1] - startY - (getMouseXY(e,touch)[0] - startX))/400;
  if (logScaleVal[currentChannel] < 1) logScaleVal[currentChannel] = 1;
  if (logScaleVal[currentChannel] > 2) logScaleVal[currentChannel] = 2;
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

// Add near your other globals
let workletRegistered = false;  // <- new
let workletNode = null;         // you already had this
let silentGain = null;          // make silentGain global so you can disconnect it
let updatingChannel = false;

/* -------- startRecording (updated) -------- */
async function startRecording() {
  updatingChannel = true;
  channelCount++;
  sliders[19][0].value = sliders[19][1].value = channelCount;
  updateChannels();
  currentChannel = channelCount-1;
  let ch = currentChannel;
  await waitFor(() => x>=maxCol && !updatingChannel);
  recording = true;

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
  channels[ch].pcm = new Float32Array(0);
  pos = 0;
  x = 0;
  rendering = false;


  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaSource = audioCtx.createMediaStreamSource(mediaStream);

    await audioCtx.resume();
    sampleRate = audioCtx.sampleRate || sampleRate;

    // Register the worklet module only once
    if (!workletRegistered) {
      const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      await audioCtx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      workletRegistered = true;
    }

    // create a fresh node every recording
    workletNode = new AudioWorkletNode(audioCtx, 'recorder-processor', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 1
    });

    // message handler
    workletNode.port.onmessage = (ev) => {
      const chunk = ev.data;
      if (!(chunk instanceof Float32Array)) return;
      pcmChunks.push(chunk);

      // quick merged view for live display
      let total = 0;
      for (let c of pcmChunks) total += c.length;
      const merged = new Float32Array(total);
      let off = 0;
      for (let c of pcmChunks) { merged.set(c, off); off += c.length; }
      channels[ch].pcm = merged;
      
      if (Math.floor(merged.length/hop) != Math.floor((merged.length-chunk.length)/hop)) processPendingFramesLive();
      iLow = 0;
      const framesSoFar = Math.max(1, Math.floor((merged.length - fftSize) / hopSizeEl.value) + 1);
      iHigh = Math.max(Math.floor(emptyAudioLengthEl.value*sampleRate/hopSizeEl.value), framesSoFar);
      info.innerHTML = `Recording...<br>${(framesSoFar/(sampleRate/hopSizeEl.value)).toFixed(1)} secs<br>Press record or ctrl+space to stop`;
    };

    // keep silentGain global so we can disconnect later
    silentGain = audioCtx.createGain();
    silentGain.gain.value = 0.0;

    // connect graph
    mediaSource.connect(workletNode);
    workletNode.connect(silentGain);
    silentGain.connect(audioCtx.destination);

  } catch (err) {
    console.error("Mic error:", err);
    status.textContent = "Microphone access denied.";
    stopRecording();
  }
}

/* -------- stopRecording (updated) -------- */
function stopRecording() {
  recordBtn.innerHTML = micHTML;
  recording = false;
  status.textContent = "Recording stopped.";
  info.textContent = "";
  mediaSource.disconnect();
  mediaSource = null;
  mediaStream.getTracks().forEach(t => t.stop());
  mediaStream = null;
  workletNode.port.onmessage = null;
  workletNode.port.close();
  workletNode.disconnect();
  workletNode = null;
  silentGain.disconnect();
  silentGain = null;
  let ch = currentChannel;

  if (channels[ch].pcm.length>emptyAudioLengthEl.value*sampleRate) {
    emptyAudioLengthEl.value = Math.floor(channels[ch].pcm.length/sampleRate);
    for (let c=0;c<channelCount;c++){
      if (c==ch) continue;
      const addon = new Float32Array(channels[ch].pcm.length-channels[c].pcm.length);
      for (let i = 0; i < addon.length; i++) {
        addon[i] = (Math.random() * 2 - 1) * 0.0001;
      }
      channels[c].pcm = Float32Array.from([...channels[c].pcm, ...addon]);
    }
  } else {
    const addon = new Float32Array(Math.floor(emptyAudioLengthEl.value*sampleRate)-channels[ch].pcm.length);
    for (let i = 0; i < addon.length; i++) {
      addon[i] = (Math.random() * 2 - 1) * 0.0001;
    }
    channels[ch].pcm = Float32Array.from([...channels[ch].pcm, ...addon]);
  }
  //restartRender(false);
}


recordBtn.addEventListener("click", async () => {
  if (!recording) {
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

fileEl.addEventListener("change", async e => {
  const f = e.target.files[0];
  if (!f) return;

  const buf = await f.arrayBuffer();

  ensureAudioCtx();

  let ab;
  try {
    ab = await audioCtx.decodeAudioData(buf.slice(0));
    const nChannels = ab.numberOfChannels || 1;
    channelCount = nChannels; updateChannels();
    sampleRate = ab.sampleRate || 48000;
    fHigh = sampleRate / 2;
    fWidth = fHigh;

    minCol = 0;
    maxCol = ab.getChannelData(0).length/hop;

    // build channels[] where each channel holds its own pcm/mags/phases/snapshots
    channels = new Array(nChannels);
    for (let ch = 0; ch < nChannels; ch++) {
      channels[ch] = {
        pcm: new Float32Array(ab.getChannelData(ch)),
        mags: [],
        phases: [],
        snapshotMags: [],
        snapshotPhases: [],
        enabled:true,
        audioDevice: nChannels==1?"both":(ch==0?"left":(ch==1?"right":"none")),
        volume: 1,
        brushPressure: 1
      };
    }

    status.textContent = `Loaded ${f.name}, ${channels[0].pcm.length} samples @ ${sampleRate} Hz (${nChannels} channel${nChannels>1 ? "s" : ""})`;
    status.style.display = "block";

    restartRender(false);
    await waitFor(() => channels[0].mags.length > 0);
    const ft = Math.ceil(ab.getChannelData(0).length/hop);
    for(let ch=0;ch<nChannels;ch++)renderSpectrogramColumnsToImageBuffer(0,ft,ch);

    const t = channels[0].pcm.length / sampleRate;
    hopSizeEl.value = t < 0.5 ? 128 : (t < 5 ? 512 : 1024);

    iLow = 0;
    iHigh = framesTotal;

  } catch (err) {
    alert("Error decoding audio. Please try a different file.");
    console.error(err);
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
async function updateChannels(){
  while (channelCount > channels.length) {
    let length = Math.floor(sampleRate * emptyAudioLengthEl.value);
    let pcm = new Float32Array(length);
    const tinyNoiseAmplitude = 0.0001;
    for (let i = 0; i < length; i++) {
      pcm[i] = (Math.random() * 2 - 1) * tinyNoiseAmplitude;
    }

    // create channel object and push
    channels.push({
      pcm,
      mags: [],
      phases: [],
      snapshotMags: [],
      snapshotPhases: [],
      enabled: true,           // default props we will sync with UI
      volume: 1,
      brushPressure: 1,
      audioDevice: channelCount==1?"both":(ch==0?"left":(ch==1?"right":"none"))
    });
    logScaleVal.push(1.12);
  }
  document.getElementById('channelsMixerDiv').innerHTML="";
  for (let ch=0;ch<channelCount;ch++){
    const mixerDiv = document.getElementById('channelsMixerDiv');
    if (!mixerDiv) {
      console.warn('channelsMixerDiv not found in DOM');
      continue;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'channelWrapper';
    wrapper.dataset.channel = ch;
    wrapper.innerHTML = `
      <div style="display:flex;gap:10px;margin-top:5px;">
        <b>Channel ${ch}</b>
        <input id="channelEnable-${ch}" type="checkbox" checked aria-label="Enable channel ${ch}">
        <label class="h2" style="margin-left:60px;" id="speakerLabel${ch}">Speaker</label>
        <select id="audioDevices-${ch}" class="channel-audio-devices" aria-label="Audio device for channel ${ch}">
          <option value="left"${channels[ch].audioDevice=="left"?"selected":""}>Left</option>
          <option value="right"${channels[ch].audioDevice=="right"?"selected":""}>Right</option>
          <option value="both"${channels[ch].audioDevice=="both"?"selected":""}>Both</option>
          <option value="none"${channels[ch].audioDevice=="none"?"selected":""}>None</option>
        </select>
      </div>
      <div id="chsliders${ch}">
        <div class="slider-row" title="Channel Volume">
          <label class="h2">Volume</label>
          <input id="channelVolume-${ch}" type="range" min="0" max="1.25" step="0.01" value="${channels[ch].volume}">
          <input id="channelVolumeInput-${ch}" type="number" value="${channels[ch].volume}" min="0" max="1.25" step="0.01">
        </div>
        <div class="slider-row" title="Channel Brush Pressure">
          <label class="h2">Brush Pressure</label>
          <input id="channelBrushPressure-${ch}" type="range" min="0" max="1" step="0.01" value="${channels[ch].brushPressure}">
          <input id="channelBrushPressureInput-${ch}" type="number" value="${channels[ch].brushPressure}" min="0" max="1" step="0.01">
        </div>
      </div>
    `;

    mixerDiv.appendChild(wrapper);

    // === Wire up controls ===
    const enableEl = wrapper.querySelector(`#channelEnable-${ch}`);
    const audioSelect = wrapper.querySelector(`#audioDevices-${ch}`);
    const volRange = wrapper.querySelector(`#channelVolume-${ch}`);
    const volInput = wrapper.querySelector(`#channelVolumeInput-${ch}`);
    const brushRange = wrapper.querySelector(`#channelBrushPressure-${ch}`);
    const brushInput = wrapper.querySelector(`#channelBrushPressureInput-${ch}`);
    const speakerLabel = document.getElementById("speakerLabel"+ch);
    const chsliders = document.getElementById("chsliders"+ch);

    // keep channel object in sync
    enableEl.addEventListener('change', e => {
      channels[ch].enabled = !!e.target.checked;
      if (enableEl.checked){
        audioSelect.classList.remove("disabled");
        speakerLabel.classList.remove("disabled");
        chsliders.classList.remove("disabled");
      } else {
        audioSelect.classList.add("disabled");
        speakerLabel.classList.add("disabled");
        chsliders.classList.add("disabled");
      }
    });
    audioSelect.addEventListener('change', e => {
      channels[ch].audioDevice = audioSelect.value;
    });

    // Volume sync
    const setVolume = v => {
      v = Math.max(0, Math.min(1.25, Number(v) || 0));
      channels[ch].volume = v;
      volRange.value = v;
      volInput.value = v;
    };
    volRange.addEventListener('input', e => setVolume(e.target.value));
    volInput.addEventListener('change', e => setVolume(e.target.value));

    // Brush pressure sync
    const setBrush = v => {
      v = Math.max(0, Math.min(1, Number(v) || 0));
      channels[ch].brushPressure = v;
      brushRange.value = v;
      brushInput.value = v;
    };
    brushRange.addEventListener('input', e => setBrush(e.target.value));
    brushInput.addEventListener('change', e => setBrush(e.target.value));

    // ensure initial values were applied to the channel object
    setVolume(channels[ch].volume);
    setBrush(channels[ch].brushPressure);
  }
  const wrappers = document.querySelectorAll('.channelWrapper');

  wrappers.forEach((wrapper, index) => {
    if (index < channelCount) {
      wrapper.style.display = "block";
    } else {
      wrapper.style.display = "none";
    }
  });
  const selectElement0 = document.getElementById("midiSingleChannel");
  const selectElement1 = document.getElementById("spriteChannel");
  document.getElementById("midiChannelSettings").style.display = document.getElementById("spriteChannelDiv").style.display = (channelCount>1)?"block":"none";
  selectElement0.innerHTML = selectElement1.innerHTML = "";
  for (let ch = 0; ch<channelCount;ch++) {
    const newOption = document.createElement("option");
    newOption.textContent = "Channel "+ch;
    newOption.value = ch;
    selectElement0.appendChild(newOption);
    newOption.textContent = ch;
    selectElement1.appendChild(newOption);
  }
  const newOption = document.createElement("option");
  newOption.textContent = "All";
  newOption.value = "all";
  selectElement1.appendChild(newOption);
  channelHeight = (window.innerHeight - 70)/channelCount;
  updateChannelHeightInputs();
  minCol = 0; maxCol = framesTotal;
  restartRender(false);
  await waitFor(() => !channels[0].mags.every(item => item == 0));
  for (let ch=0;ch<channelCount;ch++) renderSpectrogramColumnsToImageBuffer(0,framesTotal,ch);
  //renderFullSpectrogramToImage();
  updatingChannel = false;
}

function updateChannelHeightInputs(){
  const channelHeightEl = document.getElementById('channelHeight');
  channelHeightEl.value = channelHeight; channelHeightEl.max = window.innerHeight - 70;
  const channelHeightElInput = document.getElementById('channelHeightInput');
  channelHeightElInput.value = channelHeight; channelHeightElInput.max = window.innerHeight - 70;
}

channelHeight = window.innerHeight - 70;
updateChannelHeightInputs();
function updateChannelHeight(newch = null){
  if (newch !== null) channelHeight = newch;
  function doChangeHeight(name,ch) {
    let style = document.getElementById(name+ch).style;
    style.top = ((channelHeight*ch)+((name==="timeline-"||name==="logscale-")?0:40)) + "px"; if (name==="canvas-"||name==="freq-"||name==="overlay-")style.height = (channelHeight-40) + "px";
  }
  for (let ch=0;ch<channelCount;ch++){
    doChangeHeight("canvas-",ch);
    doChangeHeight("timeline-",ch);
    doChangeHeight("overlay-",ch);
    doChangeHeight("freq-",ch);
    doChangeHeight("logscale-",ch);
  }
  drawYAxis();
}
