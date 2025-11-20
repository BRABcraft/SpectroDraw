function syncNumberAndRange(numberInput, rangeInput) {

    numberInput.addEventListener('input', () => {
      let val = parseInt(numberInput.value);
      if (val < rangeInput.min) val = rangeInput.min;
      if (val > rangeInput.max) val = rangeInput.max;
      rangeInput.value = val;
      numberInput.value = val; 
    });

    rangeInput.addEventListener('input', () => {
      numberInput.value = rangeInput.value;
    });
  }

  const sliders = [[document.getElementById('emptyAudioLength'), document.getElementById('emptyAudioLengthInput'),true],
                   [document.getElementById('brushSize'), document.getElementById('brushSizeInput')],
                   [document.getElementById('brushColor'), document.getElementById('brushColorInput')],
                   [document.getElementById('penPhase'), document.getElementById('penPhaseInput')],
                   [document.getElementById('brushOpacity'), document.getElementById('brushOpacityInput')],
                   [document.getElementById('phaseOpacity'), document.getElementById('phaseOpacityInput')],
                   [document.getElementById('npo'), document.getElementById('npoInput')],
                   [document.getElementById('noiseFloorCutoff'), document.getElementById('noiseFloorCutoffInput'), true],
                   [document.getElementById('bpm'), document.getElementById('bpmInput')],
                   [document.getElementById('startOnPitch'), document.getElementById('startOnPitchInput'), true],
                   [document.getElementById('durationCutoff'), document.getElementById('durationCutoffInput'), true],
                   [document.getElementById('globalGain'), document.getElementById('globalGainInput'), true],
                   [document.getElementById('midiBpm'), document.getElementById('midiBpmInput'), true],
                   [document.getElementById('subBeat'), document.getElementById('subBeatInput'), true],
                   [document.getElementById('tQs'), document.getElementById('tQsInput'), true],
                   [document.getElementById('tQt'), document.getElementById('tQtInput'), true],
                   [document.getElementById('blurRadius'), document.getElementById('blurRadiusInput')],
                   [document.getElementById('amp'), document.getElementById('ampInput')],
                   [document.getElementById('noiseRemoveFloor'), document.getElementById('noiseRemoveFloorInput'),true],
                   [document.getElementById('channels'), document.getElementById('channelsInput'),true]];
  sliders.forEach(pair => {if (!pair[2]) syncNumberAndRange(pair[1], pair[0])});
sliders[0][0].addEventListener('input', () =>{sliders[0][1].value = sliders[0][0].value;});
sliders[0][1].addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    let val = parseFloat(sliders[0][1].value);
    const min = parseFloat(sliders[0][0].min);
    const max = parseFloat(sliders[0][0].max);
    if (isNaN(val)) val = 0;      
    if (val < min) val = min;
    if (val > max) val = max;
    sliders[0][1].value = val;      
    sliders[0][0].value = val;
    initEmptyPCM();
  }
});
sliders[1][0].addEventListener("input", ()=>{brushSize   =parseInt  (sliders[1][0].value); updateBrushPreview();});
sliders[1][1].addEventListener("input", ()=>{brushSize   =parseInt  (sliders[1][1].value); updateBrushPreview();});
sliders[2][0].addEventListener("input", ()=>{brushColor  =parseInt  (sliders[2][0].value); updateBrushPreview();});
sliders[2][1].addEventListener("input", ()=>{brushColor  =parseInt  (sliders[2][1].value); updateBrushPreview();});
sliders[3][0].addEventListener("input", ()=>{penPhase    =parseFloat(sliders[3][0].value); updateBrushPreview();});
sliders[3][1].addEventListener("input", ()=>{penPhase    =parseFloat(sliders[3][1].value); updateBrushPreview();});
sliders[4][0].addEventListener("input", ()=>{brushOpacity=parseInt  (sliders[4][0].value)/100; updateBrushPreview();});
sliders[4][1].addEventListener("input", ()=>{brushOpacity=parseInt  (sliders[4][1].value)/100; updateBrushPreview();});
sliders[5][0].addEventListener("input", ()=>{phaseOpacity=parseInt  (sliders[5][0].value)/100; updateBrushPreview();});
sliders[5][1].addEventListener("input", ()=>{phaseOpacity=parseInt  (sliders[5][1].value)/100; updateBrushPreview();});
sliders[6][0].addEventListener("input", ()=>{npo         =parseInt  (sliders[6][0].value);});
sliders[6][1].addEventListener("input", ()=>{if (!isNaN(sliders[6][1].value)) npo=parseInt  (sliders[6][1].value);});
sliders[7][0].addEventListener('input', () =>{noiseFloor=parseFloat(sliders[7][0].value); sliders[7][1].value = noiseFloor;});
sliders[7][1].addEventListener('keydown', (e) => {if (e.key === 'Enter') {let val = parseFloat(sliders[7][1].value);const min = parseFloat(sliders[7][0].min);const max = parseFloat(sliders[7][0].max);
    if (isNaN(val)) val = noiseFloor;      if (val < min) val = min;if (val > max) val = max;sliders[7][1].value = val;sliders[7][0].value = val;noiseFloor = val;}});
sliders[8][0].addEventListener("input", ()=>{bpm         =parseFloat(sliders[8][0].value);drawCursor(true);});
sliders[8][1].addEventListener("input", ()=>{bpm         =parseFloat(sliders[8][1].value);drawCursor(true);});
sliders[9][0].addEventListener('input', () => {startOnP = parseFloat(sliders[9][0].value); sliders[9][1].value = startOnP;});
sliders[9][1].addEventListener('keydown', (e) => {if (e.key === 'Enter') {let val = parseFloat(sliders[9][1].value);const min = parseFloat(sliders[9][0].min);const max = parseFloat(sliders[9][0].max);
    if (isNaN(val)) val = startOnP;if (val < min) val = min;if (val > max) val = max;sliders[9][1].value = val;sliders[9][0].value = val;startOnP = val;}});
sliders[10][0].addEventListener('input', () => {dCutoff = parseFloat(sliders[10][0].value); sliders[10][1].value = dCutoff;});
sliders[10][1].addEventListener('keydown', (e) => {if (e.key === 'Enter') {let val = parseFloat(sliders[10][1].value);const min = parseFloat(sliders[10][0].min);const max = parseFloat(sliders[10][0].max);
    if (isNaN(val)) val = dCutoff;if (val < min) val = min;if (val > max) val = max;sliders[10][1].value = val;sliders[10][0].value = val;dCutoff = val;}});
sliders[11][0].addEventListener('input', () => {globalGain = parseFloat(sliders[11][0].value); sliders[11][1].value = globalGain; updateEQ();});
sliders[11][1].addEventListener('keydown', (e) => {if (e.key === 'Enter') {let val = parseFloat(sliders[11][1].value);const min = parseFloat(sliders[11][0].min);const max = parseFloat(sliders[11][0].max);
    if (isNaN(val)) val = globalGain;if (val < min) val = min;if (val > max) val = max;sliders[11][1].value = val;sliders[11][0].value = val;globalGain = val;updateEQ();}});
sliders[12][0].addEventListener('input', () => {midiBpm = parseFloat(sliders[12][0].value); sliders[12][1].value = midiBpm;});
sliders[12][1].addEventListener('keydown', (e) => {if (e.key === 'Enter') {let val = parseFloat(sliders[12][1].value);const min = parseFloat(sliders[12][0].min);const max = parseFloat(sliders[12][0].max);
    if (isNaN(val)) val = midiBpm;if (val < min) val = min;if (val > max) val = max;sliders[12][1].value = val;sliders[12][0].value = val;midiBpm = val;}}); 
sliders[13][0].addEventListener('input', () => {mSubBeat = parseFloat(sliders[13][0].value); sliders[13][1].value = mSubBeat;});
sliders[13][1].addEventListener('keydown', (e) => {if (e.key === 'Enter') {let val = parseFloat(sliders[13][1].value);const min = parseFloat(sliders[13][0].min);const max = parseFloat(sliders[13][0].max);
    if (isNaN(val)) val = mSubBeat;if (val < min) val = min;if (val > max) val = max;sliders[13][1].value = val;sliders[13][0].value = val;mSubBeat = val;}});
sliders[14][0].addEventListener('input', () => {tQStrength = parseFloat(sliders[14][0].value); sliders[14][1].value = tQStrength; updateEQ();});
sliders[14][1].addEventListener('keydown', (e) => {if (e.key === 'Enter') {let val = parseFloat(sliders[14][1].value);const min = parseFloat(sliders[14][0].min);const max = parseFloat(sliders[14][0].max);
    if (isNaN(val)) val = tQStrength;if (val < min) val = min;if (val > max) val = max;sliders[14][1].value = val;sliders[11][0].value = val;tQStrength = val;}});
sliders[15][0].addEventListener('input', () => {tQTempo = parseFloat(sliders[15][0].value); sliders[15][1].value = tQTempo;});
sliders[15][1].addEventListener('keydown', (e) => {if (e.key === 'Enter') {let val = parseFloat(sliders[15][1].value);const min = parseFloat(sliders[15][0].min);const max = parseFloat(sliders[15][0].max);
    if (isNaN(val)) val = tQTempo;if (val < min) val = min;if (val > max) val = max;sliders[15][1].value = val;sliders[15][0].value = val;tQTempo = val;}});
sliders[16][0].addEventListener("input", ()=>{blurRadius  =parseInt  (sliders[16][0].value); updateBrushPreview();});
sliders[16][1].addEventListener("input", ()=>{blurRadius  =parseInt  (sliders[16][1].value); updateBrushPreview();});
sliders[17][0].addEventListener("input", ()=>{amp  =  (sliders[17][0].value); updateBrushPreview();});
sliders[17][1].addEventListener("input", ()=>{amp  =  (sliders[17][1].value); updateBrushPreview();});
sliders[18][0].addEventListener('input', () => {noiseRemoveFloor = parseFloat(sliders[18][0].value); sliders[18][1].value = noiseRemoveFloor;updateBrushPreview();});
sliders[18][1].addEventListener('keydown', (e) => {if (e.key === 'Enter') {let val = parseFloat(sliders[18][1].value);const min = parseFloat(sliders[18][0].min);const max = parseFloat(sliders[18][0].max);
    if (isNaN(val)) val = noiseRemoveFloor;if (val < min) val = min;if (val > max) val = max;sliders[18][1].value = val;sliders[18][0].value = val;noiseRemoveFloor = val;updateBrushPreview();}});
sliders[19][0].addEventListener('input', () => {channels = parseFloat(sliders[19][0].value); sliders[19][1].value = channels;});
sliders[19][1].addEventListener('keydown', (e) => {if (e.key === 'Enter') {let val = parseFloat(sliders[19][1].value);const min = parseFloat(sliders[19][0].min);const max = parseFloat(sliders[19][0].max);
    if (isNaN(val)) val = channels;if (val < min) val = min;if (val > max) val = max;sliders[19][1].value = val;sliders[19][0].value = val;channels = val;}});
recordBtn.innerHTML = micHTML;
lockHopBtn.innerHTML = unlockHTML;

function angleDiff(a, b) {
  const d = a - b;
  return Math.atan2(Math.sin(d), Math.cos(d));
}
function pushHistory(entry, clearRedo = true) {
  while (historyStack.length >= MAX_HISTORY_ENTRIES) historyStack.shift();
  historyStack.push(entry);
  if (clearRedo) redoStack.length = 0;
}

panelButtons.forEach(btn => {
  if(btn.dataset.tool === currentPanel) {
    btn.style.background = "#4af"; 
  }
});
panelButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    currentPanel = btn.dataset.tool;

    // Reset all button backgrounds
    panelButtons.forEach(b => b.style.background = "");
    btn.style.background = "#4af";

    // Hide all panels and show only the current one
    let i = 0;
    while (true) {
      const panel = document.getElementById("d" + i);
      if (!panel) break; // stop when no more panels
      panel.style.display = (i == currentPanel) ? "block" : "none";
      i++;
    }

    // Call drawEQ if panel 2 is active
    if (currentPanel == "2") drawEQ();
  });
});

toolButtons.forEach(btn => {
  if(btn.dataset.tool === currentTool) {
    btn.style.background = "#4af"; 
  }
});
toolButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    currentTool = btn.dataset.tool;
    toolButtons.forEach(b => b.style.background = "");
    btn.style.background = "#4af"; 
    if (currentTool === "blur") {
      document.getElementById("brushColorDiv").style.display="none";
      document.getElementById("blurRadiusDiv").style.display="flex";
      document.getElementById("amplifyDiv").style.display="none";
      document.getElementById("noiseFloorDiv").style.display="none";
    } else if (currentTool === "amplifier") {
      document.getElementById("brushColorDiv").style.display="none";
      document.getElementById("blurRadiusDiv").style.display="none";
      document.getElementById("amplifyDiv").style.display="flex";
      document.getElementById("noiseFloorDiv").style.display="none";
    } else if (currentTool === "noiseRemover") {
      document.getElementById("brushColorDiv").style.display="none";
      document.getElementById("blurRadiusDiv").style.display="none";
      document.getElementById("amplifyDiv").style.display="none";
      document.getElementById("noiseFloorDiv").style.display="flex";
    } else {
      document.getElementById("brushColorDiv").style.display="flex";
      document.getElementById("blurRadiusDiv").style.display="none";
      document.getElementById("amplifyDiv").style.display="none";
      document.getElementById("noiseFloorDiv").style.display="none";
    }
    if (currentTool === 'noiseRemover') {
      document.getElementById("ev").style.display="none";
      document.getElementById("phaseDiv").style.display="none";
      document.getElementById("phaseStrengthDiv").style.display="none";
    } else {
      document.getElementById("ev").style.display="flex";
      document.getElementById("phaseDiv").style.display="flex";
      document.getElementById("phaseStrengthDiv").style.display="flex";
    }
    document.getElementById("brushSizeDiv").style.display=(currentTool === 'rectangle')?"none":"flex";
    updateBrushPreview();
  });
});
shapeButtons.forEach(btn => {
  if(btn.dataset.shape === currentShape) {
    btn.style.background = "#4af"; 
  }
});
shapeButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    currentShape = btn.dataset.shape;
    shapeButtons.forEach(b => b.style.background = "");
    btn.style.background = "#4af"; 
    if(currentShape === "image") overlayFile.click();
    document.getElementById("brushSizeDiv").style.display=(currentShape === 'rectangle')?"none":"flex";
    updateBrushPreview();
  });
});
fileB.addEventListener("click", () => {
  file.click();
});
trueScale.addEventListener("click", () =>  {trueScaleVal = !trueScaleVal; trueScale.style.background = trueScaleVal?"#4af":"var(--accent-gradient)"; restartRender(false);});
yAxisMode.addEventListener("click", () =>  {useHz        = !useHz;        yAxisMode.style.background = useHz       ?"#4af":"var(--accent-gradient)"; drawYAxis();});
uvcb.addEventListener("click",()=>{useVolumeControllers=!useVolumeControllers;uvcb.style.background = useVolumeControllers?"#4af":"var(--accent-gradient)";});
alignPitchBtn.addEventListener("click",()=>{alignPitch=!alignPitch;alignPitchBtn.style.background = alignPitch?"#4af":"var(--accent-gradient)"; startOnPitchDiv.style.display=alignPitch?"block":"none";});
alignTimeBtn.addEventListener("click",()=>{alignTime=!alignTime;alignTimeBtn.style.background = alignTime?"#4af":"var(--accent-gradient)"; bpmDiv.style.display=alignTime?"block":"none";drawCursor(true);});
midiAlignTimeBtn.addEventListener("change",()=>{midiAlignTime=midiAlignTimeBtn.checked;midiAlignTimeBtn.style = midiAlignTime?"background:#4af;margin:none;":"background:var(--accent-gradient);margin-bottom:15px;";matOptions.style.display=midiAlignTime?"block":"none";});
useAIEl.addEventListener("change",()=>{useMidiAI=useAIEl.checked;nonAIMidiOptions.style.display=useMidiAI?"none":"block";AIMidiOptions.style.display=!useMidiAI?"none":"block";});
overlayFile.addEventListener("change", e => {
  const f = e.target.files[0];
  if (!f) return;
  const img = new Image();
  img.onload = () => {overlayImage = img; updateBrushPreview();}
  img.src = URL.createObjectURL(f);
});
let ogHSv = hopSizeEl.value;
function toggleLockHop() {
  if (lockHop) {
    lockHopBtn.innerHTML=unlockHTML;
    hopSize.classList.remove("disabled");
    hopSizeEl.value = ogHSv;
    iLow = 0; iHigh = Math.max(1, Math.floor((pcm.length - fftSize) / ogHSv) + 1);
    restartRender();
  } else {
    lockHopBtn.innerHTML=lockHTML;
    hopSize.classList.add("disabled");
    ogHSv = hopSizeEl.value;
    hopSizeEl.value = fftSizeEl.value;
    iLow = 0; iHigh = Math.max(1, Math.floor((pcm.length - fftSize) / fftSizeEl.value) + 1);
    restartRender();
  }
  lockHop = !lockHop;
}
document.addEventListener('mousemove', e=>{
  const {cx,cy,scaleX,scaleY} = getCanvasCoords(e,false);
  $x=cx;$y=cy;
  if (pressedN) {
    const realY = visibleToSpecY($y);
    if (sineOsc) {
      setSineFreq(realY);
    }
  }
});

function keyBind(event) {
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT' || event.target.tagName === 'TEXTAREA') {
    return; 
  }
  const key = event.key.toLowerCase();
  if (key === 'b') {
    document.getElementById("brushBtn").click();
  } else if (key === 'e') {
    document.getElementById("eraserBtn").click();
  } else if (key === 'p') {
    document.getElementById("pianoBtn").click();
  } else if (key === 'g') {
    document.getElementById("settingsBtn").click();
  } else if (key === 'q') {
    document.getElementById("eqBtn").click();
  } else if (key === 'r') {
    document.getElementById("rectBtn").click();
  } else if (key === 'a') {
    document.getElementById("amplifierBtn").click();
  } else if (key === 'u') {
    document.getElementById("blurBtn").click();
  } else if (key === 'i' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
    document.getElementById("imageBtn").click();
  } else if (key === 'l') {
    document.getElementById("lineBtn").click();
  } else if ((event.ctrlKey || event.metaKey) && key === 'o') {
    event.preventDefault();
    fileEl.click();
  } else if ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 's') {
    event.preventDefault();
    document.getElementById('downloadButton').click();
  } else if ((event.ctrlKey || event.metaKey) && key === 's') {
    event.preventDefault();
    document.getElementById('downloadWav').click();
  } else if ((event.ctrlKey || event.metaKey) && key === 'm') {
    exportMidi();
  } else if ((event.ctrlKey || event.metaKey) && key === ' ') {
    recordBtn.click();
  } else if (key === 'y' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
    yAxisMode.click();
  } else if (key === 'j') {
    alignPitchBtn.click();
  } else if (key === 'k') {
    alignTimeBtn.click();
  } else if (key === 'x') {
    document.getElementById("noiseRemoverBtn").click();
  }
}
document.addEventListener("keydown", (e) => {
  const active = document.activeElement;
  if (active && active.matches("input[type=range], .leftBtn")) {
    if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Tab"].includes(e.key)) {
      return; 
    }

    active.blur();
    setTimeout(() => {
      const evt = new KeyboardEvent('keydown', {
        key: e.key,
        code: e.code,
        keyCode: e.keyCode,
        bubbles: true,
        cancelable: true,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey
      });
      document.dispatchEvent(evt);
    }, 0);

    e.preventDefault();
    e.stopPropagation();
  }
});
document.addEventListener('keydown', (event) => {
  keyBind(event);
});
let pressedN=false;
document.addEventListener('keydown', (e)=>{
  if (e.key==='n') {
    pressedN=true;
    if (!sineOsc) {
      const realY = visibleToSpecY($y);
      sineOsc = audioCtx.createOscillator();
      sineOsc.type = "sine";
      sineGain = audioCtx.createGain();
      sineGain.gain.value = 0.2;
      sineOsc.connect(sineGain).connect(audioCtx.destination);
      setSineFreq(realY); 
      sineOsc.start();
    }
  }
});
document.addEventListener('keyup', (e)=>{
  if (e.key==='n'){
    pressedN=false;
    if (sineOsc) {
      sineOsc.stop();
      sineOsc.disconnect();
      sineOsc = null;
      sineGain = null;
    }
  }
});

window.addEventListener('beforeunload', function (e) {
    const confirmationMessage = "Changes may not be saved.";
    e.preventDefault();
    e.returnValue = confirmationMessage;
});

// Make sure you include JSZip in your HTML:
// <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>

async function saveProject() {
  // helper to delta-encode a Float32Array with quantization
  function deltaEncode(typedArr, decimals) {
    if (!typedArr) return null;
    const len = typedArr.length;
    const out = new Array(len);
    if (len === 0) return out;
    let prev = 0;
    const factor = Math.pow(10, decimals);
    for (let i = 0; i < len; ++i) {
      const v = typedArr[i];
      const delta = v - prev;
      // quantize
      out[i] = Math.round(delta * factor) / factor;
      prev = v;
    }
    return out;
  }

  const project = {
    name: document.getElementById("projectName").value,
    channels,
    fftSize,
    hop: hopSizeEl.value,
    bufferLength: emptyAudioLengthEl.value,
    previewWhileDrawing: document.getElementById("previewWhileDrawing").checked,
    logScale: logscaleEl.value,
    trueScaleVal,
    useHz,
    iLow,
    iHigh,
    fLow,
    fHigh,
    currentTool,
    currentShape,
    mags: mags ? deltaEncode(mags, 8) : null,     // 8 decimals
    phases: phases ? deltaEncode(phases, 3) : null, // 3 decimals
    deltaEncoded: true,
    sprites
  };

  const json = JSON.stringify(project);

  const zip = new JSZip();
  zip.file("project.json", json);

  const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(zipBlob);
  const safeName = (project.name || "spectro_project").replace(/[^\w\-]+/g, "_");
  a.download = `${safeName}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}


function openProject(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const zip = await JSZip.loadAsync(ev.target.result);
      const jsonFile = zip.file("project.json");
      if (!jsonFile) throw new Error("project.json not found in ZIP");

      const jsonText = await jsonFile.async("string");
      const parsed = JSON.parse(jsonText);

      // Apply to DOM & global state (same as your current code)
      if (parsed.name !== undefined) {
        const nameEl = document.getElementById("projectName");
        if (nameEl) nameEl.value = parsed.name;
      }
      if (parsed.fftSize !== undefined) fftSize = parsed.fftSize;
      if (parsed.channels !== undefined) channels = parsed.channels;
      if (parsed.hop !== undefined) hopSizeEl.value = parsed.hop;
      if (parsed.bufferLength !== undefined) emptyAudioLengthEl.value = parsed.bufferLength;
      if (parsed.previewWhileDrawing !== undefined) {
        const pEl = document.getElementById("previewWhileDrawing");
        if (pEl) pEl.checked = !!parsed.previewWhileDrawing;
        window.previewWhileDrawing = !!parsed.previewWhileDrawing;
      }
      if (parsed.logScale !== undefined) {
        if (typeof logscaleEl !== "undefined") logscaleEl.value = parsed.logScale;
        window.logScale = parsed.logScale;
      }
      if (parsed.trueScaleVal !== undefined) window.trueScaleVal = parsed.trueScaleVal;
      if (parsed.useHz !== undefined) {
        const uEl = document.getElementById("useHz");
        if (uEl) uEl.checked = !!parsed.useHz;
        window.useHz = !!parsed.useHz;
      }

      if (parsed.iLow !== undefined) iLow = parsed.iLow;
      if (parsed.iHigh !== undefined) iHigh = parsed.iHigh;
      if (parsed.fLow !== undefined) fLow = parsed.fLow;
      if (parsed.fHigh !== undefined) fHigh = parsed.fHigh;

      if (parsed.currentTool !== undefined) currentTool = parsed.currentTool;
      if (parsed.currentShape !== undefined) currentShape = parsed.currentShape;

      // helper to decode delta-encoded arrays into Float32Array
      function deltaDecodeToFloat32(arr) {
        if (!arr) return null;
        const len = arr.length;
        const out = new Float32Array(len);
        if (len === 0) return out;
        let acc = 0;
        for (let i = 0; i < len; ++i) {
          acc += arr[i];
          out[i] = acc;
        }
        return out;
      }

      // If file was saved with delta encoding (new format), decode.
      // If not deltaEncoded, assume mags/phases are raw arrays and just convert to Float32Array.
      if (parsed.mags !== undefined) {
        if (parsed.deltaEncoded) {
          mags = deltaDecodeToFloat32(parsed.mags);
        } else {
          // older format: raw numeric array
          mags = parsed.mags ? new Float32Array(parsed.mags) : null;
        }
      }

      if (parsed.phases !== undefined) {
        if (parsed.deltaEncoded) {
          phases = deltaDecodeToFloat32(parsed.phases);
        } else {
          phases = parsed.phases ? new Float32Array(parsed.phases) : null;
        }
      }

      if (parsed.sprites !== undefined) sprites = parsed.sprites;

      recomputePCMForCols(0, Math.floor(parsed.bufferLength*sampleRate/parsed.hop));

      window.dispatchEvent(new CustomEvent("projectLoaded", { detail: parsed }));

      if (typeof applyProject === "function") {
        try { applyProject(parsed); } catch (err) { console.warn("applyProject failed", err); }
      }
    } catch (err) {
      console.error("Failed to open project", err);
      alert("Invalid or corrupted project ZIP.");
    }
  };

  reader.onerror = (err) => {
    console.error("File read error", err);
    alert("Failed to read project file.");
  };

  reader.readAsArrayBuffer(file);
}



const saveBtn = document.getElementById("saveProject");
const newProjectBtn = document.getElementById("startNewProjectBtn");
const openProjectBtn = document.getElementById("saveAndOpenProject");
const modal = document.getElementById('presetsModal');
const closeBtn = document.getElementById('closeProjectModalBtn');

saveBtn.addEventListener('click', () => {
  saveProject();
  console.log('hi');
});
// Open modal on button click
newProjectBtn.addEventListener('click', () => {
  saveProject();
  modal.style.display = 'flex';
});
openProjectBtn.addEventListener('click', () => {
  document.getElementById("openProject").click();
});
document.getElementById("openProject").addEventListener('change',(e)=>{
  openProject(e.target.files[0]);
});

// Close modal
closeBtn.addEventListener('click', () => {
  modal.style.display = 'none';
});

// Optionally start new project with selected preset
newProjectBtn.addEventListener('click', () => {
  const preset = document.getElementById('presets').value;
  console.log('Starting new project with preset:', preset);
  modal.style.display = 'none';
  // call your existing logic to actually start a new project here
});

// Close modal if clicking outside modal content
window.addEventListener('click', e => {
  if (e.target === modal) modal.style.display = 'none';
});