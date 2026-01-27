async function initEmptyPCM(doReset) {
  if (layers === null) layers = new Array(layerCount);
  const sampleRateLocal = 48000;
  let duration = parseFloat(emptyAudioLength);
  if (duration < 0.01) duration = 10;

  const length = Math.floor(sampleRateLocal * duration);
  const tinyNoiseAmplitude = 0.0001;
  if (length>(layers[0] ? layers[0].pcm : []).length || doReset) {
    for (let ch =0; ch<layerCount;ch++){
      let p = layers[ch] ? layers[ch].pcm : [];
      const newPCM = new Float32Array(length);
      if (!doReset){
        newPCM.set(p);
        for (let i = p.length; i < length; i++) {
          newPCM[i] = (Math.random() * 2 - 1) * tinyNoiseAmplitude;
        }
      } else {
        for (let i = 0; i < length; i++) {
          newPCM[i] = (Math.random() * 2 - 1) * tinyNoiseAmplitude;
        }
      }
      layers[ch] = {
        pcm: newPCM,
        mags: new Float32Array(Math.floor(length/hop*specHeight)),
        phases: new Float32Array(Math.floor(length/hop*specHeight)),
        snapshotMags: new Float32Array(Math.floor(length/hop*specHeight)),
        snapshotPhases: new Float32Array(Math.floor(length/hop*specHeight)),
        enabled: true,
        volume: 1,
        brushPressure: 1,
        audioDevice: layerCount==1?"both":(ch==0?"left":(ch==1?"right":"none")),
        samplePos: 0,
        sampleRate: sampleRateLocal, _playbackBtn:null,_isPlaying:false,_wasPlayingDuringDrag:false,_startedAt:0,uuid:crypto.randomUUID(),
        hasCanvases:!!document.getElementById("spec-"+ch),
      };
    }
  }
  sampleRate = sampleRateLocal;
  iLow = 0; iHigh = framesTotal;
  restartRender(false);
  minCol = 0; 
  maxCol = framesTotal;
  await waitFor(() => !rendering);
  for(let ch=0;ch<layerCount;ch++)renderSpectrogramColumnsToImageBuffer(0,maxCol,ch);
}

async function onReset() {
  for (let ch=0;ch<layerCount;ch++){
    layers[ch].snapshotMags=layers[ch].mags;
    layers[ch].snapshotPhases=layers[ch].phases;
  }
  await initEmptyPCM(true);
  minCol = 0; maxCol = sampleRate/hop*emptyAudioLength;
  sprites = []; movingSprite=false;mvsbtn.classList.toggle('moving', movingSprite);renderSpritesTable('reset');
}
function drawLogScale() {
  for (let ch=0;ch<layerCount;ch++){
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

async function logScaleMouseMove(e,touch) {
  const logscaleEl = document.getElementById("logscale-"+currentLayer);
  if (!logscaleEl) return;
  logscaleEl.style.cursor = "n-resize";
  if (!changingLogScale) return;
  logScaleVal[currentLayer] -= (getMouseXY(e,touch)[1] - startY - (getMouseXY(e,touch)[0] - startX))/400;
  if (logScaleVal[currentLayer] < 1) logScaleVal[currentLayer] = 1;
  if (logScaleVal[currentLayer] > 2) logScaleVal[currentLayer] = 2;
  [startX, startY] = getMouseXY(e,touch);
  buildBinDisplayLookup();
  
  await waitFor(()=>!rendering);
  renderFullSpectrogramToImage();
  drawLogScale();
  drawYAxis();
  renderHarmonicsCanvas();
  if (currentTool==="cloner")updateBrushPreview();
}

document.addEventListener("mousemove", e=> {
  logScaleMouseMove(e,false);
});
document.addEventListener("touchmove", e=> {
  logScaleMouseMove(e,true);
});

document.addEventListener("mouseup", e=>{changingLogScale=false;})
document.addEventListener("touchend", e=>{changingLogScale=false;})

// emptyAudioLengthEl.addEventListener("input", ()=> {
//   initEmptyPCM(false);
//   iLow = 0;
//   iHigh = framesTotal;
// });
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
    //beep.load();
    beep.preload="auto";

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
let updatingLayer = false;

/* -------- startRecording (updated) -------- */
async function startRecording() {
  updatingLayer = true;
  layerCount++;
  sliders[19][0].value = sliders[19][1].value = layerCount;
  updateLayers();
  await waitFor(() => x>=maxCol && !updatingLayer);
  recording = true;
  currentLayer = layerCount-1;
  let ch = currentLayer;

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
  layers[ch].pcm = new Float32Array(0);
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
      layerCount: 1
    });

    // message handler
    workletNode.port.onmessage = (ev) => {
      const chunk = ev.data;
      if (!(chunk instanceof Float32Array)) return;
      pcmChunks.push(...chunk);

      // quick merged view for live display
      layers[currentLayer].pcm = new Float32Array(pcmChunks);
      
      if (Math.floor(pcmChunks.length/hop) != Math.floor((pcmChunks.length-chunk.length)/hop)) processPendingFramesLive();
      iLow = 0;
      const framesSoFar = Math.max(1, Math.floor((pcmChunks.length - fftSize) / hop) + 1);
      iHigh = Math.max(Math.floor(emptyAudioLength*sampleRate/hop), framesSoFar);
      info.innerHTML = `Recording...<br>${(framesSoFar/(sampleRate/hop)).toFixed(1)} secs<br>Press record or ctrl+space to stop`;
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
  let l = currentLayer;

  uploads.push({name:"New recording", pcm:layers[l].pcm, samplePos: 0, sampleRate, _playbackBtn:null,_isPlaying:false,_wasPlayingDuringDrag:false,_startedAt:0,uuid:crypto.randomUUID()});
  if (document.getElementById("audioSamplesSection").getAttribute("aria-expanded")==="false") document.getElementById("audioSamplesToggle").click();
  layers.pop();
  layerCount--;
  layerHeight = (getLayerHeight())/layerCount;
  updateLayerHeightInputs();
  document.getElementById("canvasWrapper-"+layerCount).remove();
  renderUploads();
  restartRender(false);
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

document.getElementById("uploadBtn").addEventListener("click", () => {document.getElementById("samplesUpload").click();});
document.getElementById("samplesUpload").addEventListener("input", async e => {doUpload(e.target);});
document.getElementById("uploadsWindow").addEventListener("dragover", e => {e.preventDefault();});
document.getElementById("uploadsWindow").addEventListener("drop", e => {e.preventDefault();doUpload(e.dataTransfer);});

async function doUpload(e) {
  const f = e.files[0];
  if (!f) return;
  if (f.type.startsWith("image/")) {
    const url = URL.createObjectURL(f);   // create ONE URL
    const img = new Image();
    img.onload = () => {
      images.push({ img, name: f.name, src: url }); // reuse same url
      renderUploads();
      selectedImage = 0;
      updateBrushPreview && updateBrushPreview();
    };
    img.onerror = (err) => {
      console.error("image load failed", err);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  } else {
    const buf = await f.arrayBuffer();
    ensureAudioCtx();
    let ab;
    try {
      ab = await audioCtx.decodeAudioData(buf.slice(0));
      const nChannels = ab.numberOfChannels || 1;
      const uuid = crypto.randomUUID();
      for (let ch = 0; ch < nChannels; ch++) {
        uploads.push({name:(f.name+((nChannels>1)?("_layer"+ch):"")), pcm:ab.getChannelData(ch), samplePos: 0, sampleRate: ab.sampleRate, _playbackBtn:null,_isPlaying:false,_wasPlayingDuringDrag:false,_startedAt:0,uuid});
      }
      if (document.getElementById("audioSamplesSection").getAttribute('aria-expanded')==='false') {
        document.getElementById("audioSamplesToggle").click();
      }
      renderUploads();
    } catch (err) {
      alert("Error decoding audio. Please try a different file.");
      console.error(err);
    }
  }
}

async function updateLayers(){
  while (layerCount > layers.length) {
    let length = Math.floor(sampleRate * emptyAudioLength);
    let pcm = new Float32Array(length);
    const tinyNoiseAmplitude = 0.0001;
    for (let i = 0; i < length; i++) {
      pcm[i] = (Math.random() * 2 - 1) * tinyNoiseAmplitude;
    }
    if (layerCount>1&&layers.length===1)layers[0].audioDevice="left";
    let ch = layers.length;
    // create layer object and push
    layers.push({
      pcm,
      mags: [],
      phases: [],
      snapshotMags: [],
      snapshotPhases: [],
      enabled: true,           // default props we will sync with UI
      volume: 1,
      brushPressure: 1,
      audioDevice: layerCount==1?"both":(ch==0?"left":(ch==1?"right":"none")),
      samplePos: 0,
      sampleRate, _playbackBtn:null,_isPlaying:false,_wasPlayingDuringDrag:false,_startedAt:0,
      uuid:crypto.randomUUID(),
      hasCanvases:false,
      ch
    });
    logScaleVal.push(1.12);
  }
  document.getElementById('layersMixerDiv').innerHTML="";
  for (let ch=0;ch<layerCount;ch++){
    const mixerDiv = document.getElementById('layersMixerDiv');
    if (!mixerDiv) {
      console.warn('layersMixerDiv not found in DOM');
      continue;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'layerWrapper';
    wrapper.dataset.layer = ch;
    wrapper.innerHTML = `
      <div style="display:flex;gap:10px;margin-top:5px;">
        <b>Layer ${ch}</b>
        <input id="layerEnable-${ch}" type="checkbox" checked aria-label="Enable layer ${ch}">
        <label class="h2" style="margin-left:60px;" id="speakerLabel${ch}">Speaker</label>
        <select id="audioDevices-${ch}" class="layer-audio-devices" aria-label="Audio device for layer ${ch}">
          <option value="left"${layers[ch].audioDevice=="left"?"selected":""}>Left</option>
          <option value="right"${layers[ch].audioDevice=="right"?"selected":""}>Right</option>
          <option value="both"${layers[ch].audioDevice=="both"?"selected":""}>Both</option>
          <option value="none"${layers[ch].audioDevice=="none"?"selected":""}>None</option>
        </select>
      </div>
      <div id="chsliders${ch}">
        <div class="slider-row" title="Layer Volume">
          <label class="h2">Volume</label>
          <input id="layerVolume-${ch}" type="range" min="0" max="1.25" step="0.01" value="${layers[ch].volume}">
          <input id="layerVolumeInput-${ch}" type="number" value="${layers[ch].volume}" min="0" max="1.25" step="0.01">
        </div>
        <div class="slider-row" title="Layer Brush Pressure">
          <label class="h2">Brush Pressure</label>
          <input id="layerBrushPressure-${ch}" type="range" min="0" max="1" step="0.01" value="${layers[ch].brushPressure}">
          <input id="layerBrushPressureInput-${ch}" type="number" value="${layers[ch].brushPressure}" min="0" max="1" step="0.01">
        </div>
      </div>
    `;

    mixerDiv.appendChild(wrapper);

    // === Wire up controls ===
    const enableEl = wrapper.querySelector(`#layerEnable-${ch}`);
    const audioSelect = wrapper.querySelector(`#audioDevices-${ch}`);
    const volRange = wrapper.querySelector(`#layerVolume-${ch}`);
    const volInput = wrapper.querySelector(`#layerVolumeInput-${ch}`);
    const brushRange = wrapper.querySelector(`#layerBrushPressure-${ch}`);
    const brushInput = wrapper.querySelector(`#layerBrushPressureInput-${ch}`);
    const speakerLabel = document.getElementById("speakerLabel"+ch);
    const chsliders = document.getElementById("chsliders"+ch);

    // keep layer object in sync
    enableEl.addEventListener('change', e => {
      layers[ch].enabled = !!e.target.checked;
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
      layers[ch].audioDevice = audioSelect.value;
    });

    // Volume sync
    const setVolume = v => {
      v = Math.max(0, Math.min(1.25, Number(v) || 0));
      layers[ch].volume = v;
      volRange.value = v;
      volInput.value = v;
    };
    volRange.addEventListener('input', e => setVolume(e.target.value));
    volInput.addEventListener('change', e => setVolume(e.target.value));

    // Brush pressure sync
    const setBrush = v => {
      v = Math.max(0, Math.min(1, Number(v) || 0));
      layers[ch].brushPressure = v;
      brushRange.value = v;
      brushInput.value = v;
    };
    brushRange.addEventListener('input', e => setBrush(e.target.value));
    brushInput.addEventListener('change', e => setBrush(e.target.value));

    // ensure initial values were applied to the layer object
    setVolume(layers[ch].volume);
    setBrush(layers[ch].brushPressure);
  }
  const wrappers = document.querySelectorAll('.layerWrapper');

  wrappers.forEach((wrapper, index) => {
    if (index < layerCount) {
      wrapper.style.display = "block";
    } else {
      wrapper.style.display = "none";
    }
  });
  const selectElement0 = document.getElementById("midiSingleLayer");
  const selectElement1 = document.getElementById("spriteLayer");
  document.getElementById("midiLayerSettings").style.display = document.getElementById("spriteLayerDiv").style.display = (layerCount>1)?"block":"none";
  selectElement0.innerHTML = selectElement1.innerHTML = "";
  for (let l = 0; l<layerCount;l++) {
    const newOption = document.createElement("option");
    newOption.textContent = "Layer "+l;
    newOption.value = l;
    selectElement0.appendChild(newOption);
    newOption.textContent = l;
    selectElement1.appendChild(newOption);
  }
  const newOption = document.createElement("option");
  newOption.textContent = "All";
  newOption.value = "all";
  selectElement1.appendChild(newOption);
  layerHeight = (getLayerHeight())/layerCount;
  updateLayerHeightInputs();
  minCol = 0; maxCol = framesTotal;
  restartRender(false);
  await waitFor(() => !rendering);
  for (let l=0;l<layerCount;l++) renderSpectrogramColumnsToImageBuffer(0,framesTotal,l);
  //renderFullSpectrogramToImage();
  if (currentTool==="cloner")updateBrushPreview();
  updatingLayer = false;
}

function updateLayerHeightInputs(){
  const layerHeightEl = document.getElementById('layerHeight');
  layerHeightEl.value = layerHeight; layerHeightEl.max = getLayerHeight();
  const layerHeightElInput = document.getElementById('layerHeightInput');
  layerHeightElInput.value = layerHeight; layerHeightElInput.max = getLayerHeight();
}

layerHeight = getLayerHeight();
updateLayerHeightInputs();
function updateLayerHeight(newch = null){
  if (newch !== null) layerHeight = newch;
  function doChangeHeight(name,ch) {
    let style = document.getElementById(name+ch).style;
    style.top = ((layerHeight*ch)+((name==="timeline-"||name==="logscale-")?0:40)) + "px"; if (name==="canvas-"||name==="freq-"||name==="overlay-")style.height = (layerHeight-40) + "px";
  }
  for (let ch=0;ch<layerCount;ch++){
    doChangeHeight("canvas-",ch);
    doChangeHeight("timeline-",ch);
    doChangeHeight("overlay-",ch);
    doChangeHeight("freq-",ch);
    doChangeHeight("logscale-",ch);
  }
  drawYAxis();
}
