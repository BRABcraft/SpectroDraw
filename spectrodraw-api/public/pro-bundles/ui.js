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

const sliders = [
  [document.getElementById('emptyAudioLength'), document.getElementById('emptyAudioLengthInput'),true],
  [document.getElementById('brushSize'), document.getElementById('brushSizeInput')],
  [document.getElementById('brushColor'), document.getElementById('brushColorInput')],
  [document.getElementById('phaseShift'), document.getElementById('phaseShiftInput')],
  [document.getElementById('brushOpacity'), document.getElementById('brushOpacityInput')],
  [document.getElementById('phaseStrength'), document.getElementById('phaseStrengthInput')],
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
  [document.getElementById('channels'), document.getElementById('channelsInput'),true],
  [document.getElementById('channelHeight'), document.getElementById('channelHeightInput'),true],
  [document.getElementById('brushWidth'), document.getElementById('brushWidthInput')],
  [document.getElementById('brushHeight'), document.getElementById('brushHeightInput')],
  [document.getElementById('autoTuneStrength'), document.getElementById('autoTuneStrengthInput')],
  [document.getElementById('anpo'), document.getElementById('anpoInput')],
  [document.getElementById('astartOnPitch'), document.getElementById('astartOnPitchInput')],
  [document.getElementById('clonerScale'), document.getElementById('clonerScaleInput')],
  [document.getElementById('phaseSettings'), document.getElementById('phaseSettingsInput')],
];
  sliders.forEach(pair => {if (!pair[2]) syncNumberAndRange(pair[1], pair[0])});
sliders[0][0].addEventListener('input', () =>{sliders[0][1].value = sliders[0][0].value;});
sliders[0][0].addEventListener('mouseup', ()=>{initEmptyPCM(false);});
sliders[0][1].addEventListener('keydown', (e) => {if (e.key === 'Enter') {let val = parseFloat(sliders[0][1].value);const min = parseFloat(sliders[0][0].min);const max = parseFloat(sliders[0][0].max);
    if (isNaN(val)) val = 0;if (val < min) val = min;if (val > max) val = max;sliders[0][1].value = val;sliders[0][0].value = val;initEmptyPCM(false);}});
function rs_(i){const v = sliders[1][i].value; const f = v/brushSize; sliders[21][0].value=sliders[21][1].value=Math.round(brushWidth *= f); sliders[22][0].value=sliders[22][1].value=Math.round(brushHeight *= f); brushSize=v; updateBrushPreview();}
sliders[1][0].addEventListener("input", ()=>{rs_(0);});
sliders[1][1].addEventListener("input", ()=>{rs_(1);});
sliders[2][0].addEventListener("input", ()=>{brushColor  =parseInt  (sliders[2][0].value); updateBrushPreview();});
sliders[2][1].addEventListener("input", ()=>{brushColor  =parseInt  (sliders[2][1].value); updateBrushPreview();});
sliders[3][0].addEventListener("input", ()=>{phaseShift    =parseFloat(sliders[3][0].value); updateBrushPreview();});
sliders[3][1].addEventListener("input", ()=>{phaseShift    =parseFloat(sliders[3][1].value); updateBrushPreview();});
sliders[4][0].addEventListener("input", ()=>{brushOpacity=parseInt  (sliders[4][0].value)/100; updateBrushPreview();});
sliders[4][1].addEventListener("input", ()=>{brushOpacity=parseInt  (sliders[4][1].value)/100; updateBrushPreview();});
sliders[5][0].addEventListener("input", ()=>{phaseStrength=parseInt  (sliders[5][0].value)/100; updateBrushPreview();});
sliders[5][1].addEventListener("input", ()=>{phaseStrength=parseInt  (sliders[5][1].value)/100; updateBrushPreview();});
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
sliders[17][0].addEventListener("input", ()=>{val=(sliders[17][0].value); currentTool==="cloner" ? (cAmp = val) : (amp = val); updateBrushPreview();});
sliders[17][1].addEventListener("input", ()=>{val=(sliders[17][1].value); currentTool==="cloner" ? (cAmp = val) : (amp = val); updateBrushPreview();});
sliders[18][0].addEventListener('input', () => {noiseRemoveFloor = parseFloat(sliders[18][0].value); sliders[18][1].value = noiseRemoveFloor;updateBrushPreview();});
sliders[18][1].addEventListener('keydown', (e) => {if (e.key === 'Enter') {let val = parseFloat(sliders[18][1].value);const min = parseFloat(sliders[18][0].min);const max = parseFloat(sliders[18][0].max);
    if (isNaN(val)) val = noiseRemoveFloor;if (val < min) val = min;if (val > max) val = max;sliders[18][1].value = val;sliders[18][0].value = val;noiseRemoveFloor = val;updateBrushPreview();}});
sliders[19][0].addEventListener('input', () => {channelCount = parseFloat(sliders[19][0].value); sliders[19][1].value = channelCount;updateChannels();});
sliders[19][1].addEventListener('keydown', (e) => {if (e.key === 'Enter') {let val = parseFloat(sliders[19][1].value);const min = parseFloat(sliders[19][0].min);const max = parseFloat(sliders[19][0].max);
    if (isNaN(val)) val = channelCount;if (val < min) val = min;if (val > max) val = max;sliders[19][1].value = val;sliders[19][0].value = val;channelCount = val;updateChannels();}});
sliders[20][0].addEventListener('input', () => {channelHeight = parseFloat(sliders[20][0].value); sliders[20][1].value = channelHeight;updateChannelHeight();});
sliders[20][1].addEventListener('keydown', (e) => {if (e.key === 'Enter') {let val = parseFloat(sliders[20][1].value);const min = parseFloat(sliders[20][0].min);const max = parseFloat(sliders[20][0].max);
    if (isNaN(val)) val = channelHeight;if (val < min) val = min;if (val > max) val = max;sliders[20][1].value = val;sliders[20][0].value = val;channelHeight = val;updateChannelHeight();}});
function rs(){sliders[1][0].value = sliders[1][1].value = brushSize = Math.max(brushWidth, brushHeight);updateBrushPreview();}
sliders[21][0].addEventListener("input", ()=>{brushWidth   =parseInt  (sliders[21][0].value); rs(); updateBrushPreview();});
sliders[21][1].addEventListener("input", ()=>{brushWidth   =parseInt  (sliders[21][1].value); rs(); updateBrushPreview();});
sliders[22][0].addEventListener("input", ()=>{brushHeight  =parseInt  (sliders[22][0].value); rs(); updateBrushPreview();});
sliders[22][1].addEventListener("input", ()=>{brushHeight  =parseInt  (sliders[22][1].value); rs(); updateBrushPreview();});
sliders[23][0].addEventListener("input", ()=>{autoTuneStrength=(sliders[23][0].value); updateBrushPreview();});
sliders[23][1].addEventListener("input", ()=>{autoTuneStrength=(sliders[23][1].value); updateBrushPreview();});
sliders[24][0].addEventListener("input", ()=>{anpo=(sliders[24][0].value); updateBrushPreview();});
sliders[24][1].addEventListener("input", ()=>{anpo=(sliders[24][1].value); updateBrushPreview();});
sliders[25][0].addEventListener("input", ()=>{aStartOnPitch=(sliders[25][0].value); updateBrushPreview();});
sliders[25][1].addEventListener("input", ()=>{aStartOnPitch=(sliders[25][1].value); updateBrushPreview();});
sliders[26][0].addEventListener("input", ()=>{clonerScale=(sliders[26][0].value); updateBrushPreview();});
sliders[26][1].addEventListener("input", ()=>{clonerScale=(sliders[26][1].value); updateBrushPreview();});
function onPhaseSettingsChange(idx) {
  const v = sliders[27][idx].valueAsNumber;

  switch (phaseTextureEl.value) {
    case "ImpulseAlign":      t0 = v; break;
    case "LinearDelay":       tau = v; break;
    case "RandomSmall":       sigma = v; break;
    case "HarmonicStack":     harmonicCenter = v; break;
    case "CopyFromRef":       refPhaseFrame = v; break;
    case "PhasePropagate":    userDelta = v; break;
    case "Chirp":             chirpRate = v; break;
  }

  updateBrushPreview();
}
sliders[27][0].addEventListener("input", ()=>{onPhaseSettingsChange(0);});
sliders[27][1].addEventListener("input", ()=>{onPhaseSettingsChange(1);});
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
    if (movingSprite)document.getElementById('moveSpriteBtn').click();
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
    if (currentPanel == "5") drawEQ();
    if (currentPanel == "3") renderUploads();
  });
});

toolButtons.forEach(btn => {
  if(btn.dataset.tool === currentTool) {
    btn.style.background = "#4af"; 
  }
});
document.getElementById("changeClonerPosBtn").addEventListener("click",()=>{
  changingClonerPos = (!changingClonerPos || clonerX===null || clonerY===null);
  document.getElementById("changeClonerPosBtn").innerText = changingClonerPos?"Changing Reference Point...":"Change Reference Point";
  document.getElementById("changeClonerPosBtn").classList.toggle('moving', changingClonerPos);
  updateBrushPreview();
});
function updateBrushSettingsDisplay(){
  function c(b){return currentTool===b;}
  function d(b){return currentShape===b;}
  if (c("cloner")&&(d("image")||d("stamp"))) currentTool = "fill";
  if (c("autotune")&&(d("image")||d("note"))) currentTool = "fill";
  if (c("noiseRemover")&&d("image")) currentTool = "fill";
  if (showEffectSettings) {
    document.getElementById("amplifyDiv")   .style.display=(c("amplifier")||c("cloner"))?"flex":"none";
    document.getElementById("noiseFloorDiv").style.display=(c("noiseRemover"))?"flex":"none";
    document.getElementById("blurRadiusDiv").style.display=(c("blur"))?"flex":"none";
    document.getElementById("autoTuneStrengthDiv").style.display=(c("autotune"))?"flex":"none";
    document.getElementById("anpoDiv").style.display=(c("autotune"))?"flex":"none";
    document.getElementById("astartOnPitchDiv").style.display=(c("autotune"))?"flex":"none";
    document.getElementById("brushColorDiv").style.display=(c("amplifier") || c("noiseRemover") || c("blur") || c("autotune") || c("cloner"))?"none":"flex";
    document.getElementById("ev").style.display=(c("noiseRemover")||c("autotune")||c("cloner"))?"none":"flex";
    updatePhaseTextureSettings();
    document.getElementById("phaseDiv").style.display=(c("noiseRemover")||c("autotune")||c("cloner"))?"none":"flex";
    document.getElementById("phaseStrengthDiv").style.display=(c("noiseRemover")||c("autotune"))?"none":"flex";
    document.getElementById("changeClonerPosDiv").style.display=c("cloner")?"flex":"none";
    document.getElementById("clonerScaleDiv").style.display=c("cloner")?"flex":"none";
    sliders[17][0].value=sliders[17][1].value=c("cloner")?cAmp:amp;
  }
  const bw = document.getElementById("brushWidthDiv");
  const bh = document.getElementById("brushHeightDiv");
  const bs = document.getElementById("brushSizeDiv");

  const dragToDraw = document.getElementById("dragToDraw").checked;
  bs.style.display = (showToolSettings && (((d('line') || d('image') && !dragToDraw)) || (!(d('line') || d('image')) && !(d('rectangle') || d('note')))))?"flex":"none";

  let disp = showToolSettings?"flex":"none";
  if (d("line") || d("rectangle") || d("note")) disp = "none";
  if (d("image")) disp="flex";
  if (dragToDraw) disp="none";
  bw.style.display = disp;
  bh.style.display = disp;
  const showHarmonics = d("note") || d("line");
  document.getElementById("harmonicsPresetSelectDiv").style.display = showHarmonics?"block":"none";
  document.getElementById("brushHarmonisEditorDiv").style.display = showHarmonics?"block":"none";
  if (showHarmonics) renderHarmonicsCanvas();
  document.getElementById("stampsDiv").style.display = d("stamp")?"block":"none";
  if (currentShape==='stamp') {renderStamps();}
  document.getElementById("dragToDrawDiv").style.display = (d("stamp") || d("image"))?"flex":"none";

  
  document.getElementById("brushEffectSelect").innerHTML = `
          <option value="fill">Fill</option> 
          ${d("image")?"":'<option value="noiseRemover">AI Noise Remover</option>'}
          ${(d("image")||d("stamp"))?"":'<option value="cloner">Cloner</option>'}
          ${(d("image")||d("note"))?"":'<option value="autotune">Autotune</option>'}
          <option value="amplifier">Amplifier</option>
          <option value="eraser">Eraser</option>
          <option value="blur">Blur</option>
  `;
  document.getElementById("brushEffectSelect").value = currentTool;

}
document.getElementById("dragToDraw").addEventListener("input",()=>{updateBrushSettingsDisplay();});
//if image: Hide cloner, autotune, and noiseremover
//if stamp: hide cloner
//if note: hide autotune
//document.getElementById("clonerBtn").style.background = (d("image")||d("stamp"))?"#333":""
function onToolChange(tool){
  function c(b){return tool===b;}
  function d(b){return currentShape===b;}
  if (c("cloner")&&(d("image")||d("stamp"))) tool = "fill";
  else if (c("autotune")&&(d("image")||d("note"))) tool = "fill";
  else if (c("noiseRemover")&&d("image")) tool = "fill";
  else document.getElementById("toolEditBtn").click();
  currentTool = tool;
  toolButtons.forEach(b => {
    const t = b.dataset.tool;
    const shouldHide = 
      (t==="cloner"      &&(d("image")||d("stamp")))
    ||(t==="autotune"    &&(d("image")||d("note" )))
    ||(t==="noiseRemover"&& d("image"))
    b.style.background =(t===tool)?"#4af":(shouldHide)?"#999":""});
  document.getElementById("brushEffectSelect").value=tool;
  updateBrushSettingsDisplay();
  updateBrushPreview();
}
toolButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    onToolChange(btn.dataset.tool);
  });
});
document.getElementById("brushEffectSelect").addEventListener("input",()=>{
  onToolChange(document.getElementById("brushEffectSelect").value);
});
shapeButtons.forEach(btn => {
  if(btn.dataset.shape === currentShape) {
    btn.style.background = "#4af"; 
  }
});
function onShapeChange(shape){
  if (shape!=="image" || images.length>0) {
    document.getElementById("toolEditBtn").click();
    document.getElementById("brushToolSelect").value=currentShape = shape;
    shapeButtons.forEach(b => b.style.background = (b.dataset.shape===shape)?"#4af":"");
    document.getElementById("brushSizeDiv").style.display=(currentShape === 'rectangle')?"none":"flex";
    updateBrushWH();
    updateBrushPreview();
  } else if (images.length === 0){
    overlayFile.click();
  }
  
  function c(b){return currentTool===b;}
  function d(b){return shape===b;}
  if (c("cloner")&&(d("image")||d("stamp"))) onToolChange('fill');
  else if (c("autotune")&&(d("image")||d("note"))) onToolChange('fill');
  else if (c("noiseRemover")&&d("image")) onToolChange('fill');
  else onToolChange(currentTool);
  updateBrushSettingsDisplay();
}
shapeButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    onShapeChange(btn.dataset.shape);
  });
});
document.getElementById("brushToolSelect").addEventListener("input",()=>{
  onShapeChange(document.getElementById("brushToolSelect").value);
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
  img.onload = () => {
    document.getElementById("brushToolSelect").value=currentShape="image";onToolChange(currentTool);
    updateBrushSettingsDisplay();
    shapeButtons.forEach(b => b.style.background = "");
    document.getElementById("imageBtn").style.background = "#4af";
    selectedImage = images.length;
    images.push({img, name:f.name, src: URL.createObjectURL(f)});
    renderUploads();
    updateBrushWH();
    updateBrushPreview();
  }
  img.src = URL.createObjectURL(f);
});
let ogHSv = hopSizeEl.value;
async function toggleLockHop() {
  const len = emptyAudioLengthEl.value*sampleRate;
  if (lockHop) {
    lockHopBtn.innerHTML=unlockHTML;
    hopSize.classList.remove("disabled");
    hopSizeEl.value = ogHSv;
    iLow = 0; iHigh = Math.max(1, Math.floor((len - fftSize) / ogHSv) + 1);
  } else {
    lockHopBtn.innerHTML=lockHTML;
    hopSize.classList.add("disabled");
    ogHSv = hopSizeEl.value;
    hopSizeEl.value = fftSizeEl.value;
    iLow = 0; iHigh = Math.max(1, Math.floor((len - fftSize) / fftSizeEl.value) + 1);
  }
  minCol = 0; maxCol = Math.floor(len/hopSizeEl.value);
  restartRender(false);
  await waitFor(() => !rendering);
  for(let ch=0;ch<channelCount;ch++)renderSpectrogramColumnsToImageBuffer(0,maxCol,ch);
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
let pressedN=false;document.addEventListener('keydown', (e) => {
  if (e.key === 'n') {
    pressedN = true;

    if (!sineOsc) {
      const realY = visibleToSpecY($y);

      sineOsc = audioCtx.createOscillator();
      sineGain = audioCtx.createGain();
      sineGain.gain.value = 0.2;

      // ===== USE HARMONICS LIST =====
      const harmonicCount = 101; // index 0 unused
      const real = new Float32Array(harmonicCount);
      const imag = new Float32Array(harmonicCount);
      for (let i = 0; i < 100; i++) imag[i + 1] = harmonics[i];
      const wave = audioCtx.createPeriodicWave(real, imag, {disableNormalization: false});
      sineOsc.setPeriodicWave(wave);
      // ============================

      sineOsc.connect(sineGain).connect(audioCtx.destination);
      setSineFreq(realY);
      sineOsc.start();
    }
  }
});

document.addEventListener('keyup', (e) => {
  if (e.key === 'n') {
    pressedN = false;

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

// --- saveProject (updated) ---
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

  // Build channels array to save. Prefer existing global `channels` if present,
  // otherwise fall back to using top-level mags/phases for channel 0.
  const outChannels = new Array(Math.max(0, channelCount || 0));
  const srcChannels = (typeof channels !== "undefined" && Array.isArray(channels)) ? channels : null;

  for (let i = 0; i < outChannels.length; ++i) {
    let src = null;
    if (srcChannels && srcChannels[i]) {
      src = srcChannels[i];
    } else {
      // fallback: place top-level mags/phases into channel 0
      if (i === 0 && typeof mags !== "undefined" && (mags || phases)) {
        src = { mags: mags || null, phases: phases || null };
      } else {
        src = { mags: null, phases: null };
      }
    }

    // Quantize & delta-encode per-channel (keep only mags & phases in saved file)
    const encoded = {
      mags: src.mags ? deltaEncode(src.mags, 8) : null,
      phases: src.phases ? deltaEncode(src.phases, 3) : null,
      volume: src.volume,
      enabled: src.enabled,
      brushPressure: src.brushPressure,
      audioDevice: src.audioDevice
    };
    outChannels[i] = encoded;
  }

  const project = {
    name: document.getElementById("projectName").value,
    channelCount,
    fftSize,
    hop: hopSizeEl.value,
    bufferLength: emptyAudioLengthEl.value,
    previewWhileDrawing: document.getElementById("previewWhileDrawing").checked,
    logScaleVal,
    trueScaleVal,
    useHz,
    iLow, iHigh, fLow, fHigh,
    uploads,             // if uploads contains only metadata / pcm it's fine
    // images will be replaced with metadata below
    images: null,
    currentTool,
    currentShape,
    channels: outChannels,
    deltaEncoded: true,
    sprites: serializeSprites(sprites)
  };

  const zip = new JSZip();

  // Add images into the zip and create a metadata list for JSON
  const imageMeta = [];
  if (Array.isArray(images) && images.length > 0) {
    for (let i = 0; i < images.length; i++) {
      const it = images[i];
      // prefer original File if you stored it earlier (it.file)
      let blob = null;
      if (it && it.file instanceof Blob) {
        blob = it.file;
      } else if (it && typeof it.src === "string") {
        // fetch the objectURL or remote URL to get a blob
        try {
          const resp = await fetch(it.src);
          blob = await resp.blob();
        } catch (err) {
          console.warn("Could not fetch image src for saving:", it.src, err);
        }
      }

      if (!blob) {
        // skip this image (or push metadata with no file)
        imageMeta.push({ name: it && it.name ? it.name : `image_${i}`, file: null });
        continue;
      }

      const safeName = `${i}_${sanitizeFilename(it.name || "image")}`;
      const path = `images/${safeName}`;
      zip.file(path, blob);
      imageMeta.push({ name: it && it.name ? it.name : safeName, file: path });
    }
  }

  project.images = imageMeta;

  // Store the project.json
  const json = JSON.stringify(project);
  zip.file("project.json", json);

  // optionally you could add uploads/audio files as well (not shown)

  // generate zip
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


// --- openProject (updated) ---
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
      if (parsed.channelCount !== undefined) channelCount = parsed.channelCount;
      if (parsed.hop !== undefined) hopSizeEl.value = parsed.hop;
      if (parsed.bufferLength !== undefined) emptyAudioLengthEl.value = parsed.bufferLength;
      if (parsed.previewWhileDrawing !== undefined) {
        const pEl = document.getElementById("previewWhileDrawing");
        if (pEl) pEl.checked = !!parsed.previewWhileDrawing;
      }
      if (parsed.logScaleVal !== undefined) logScaleVal = parsed.logScaleVal;
      if (parsed.trueScaleVal !== undefined) window.trueScaleVal = parsed.trueScaleVal;
      if (parsed.useHz !== undefined) {
        const uEl = document.getElementById("useHz");
        if (uEl) uEl.checked = !!parsed.useHz;
        useHz = !!parsed.useHz;
      }
      if (parsed.iLow !== undefined) iLow = parsed.iLow;
      if (parsed.iHigh !== undefined) iHigh = parsed.iHigh;
      if (parsed.fLow !== undefined) fLow = parsed.fLow;
      if (parsed.fHigh !== undefined) fHigh = parsed.fHigh;
      if (parsed.currentTool !== undefined) currentTool = parsed.currentTool;
      if (parsed.currentShape !== undefined) currentShape = parsed.currentShape;
      shapeButtons.forEach(btn => {
        if(btn.dataset.shape === currentShape) {
          btn.style.background = "#4af"; 
        } else {
          btn.style.background = "";
        }
      });updateBrushPreview();
      if (parsed.uploads !== undefined) uploads = parsed.uploads;

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

      // Reconstruct channels from parsed data
      const reconstructedChannels = [];

      if (Array.isArray(parsed.channels)) {
        // New format: channels array present
        for (let i = 0; i < parsed.channels.length; i++) {
          const src = parsed.channels[i];
          reconstructedChannels[i] = {
            mags: deltaDecodeToFloat32(src.mags),
            phases: deltaDecodeToFloat32(src.phases),
            pcm: new Float32Array(parsed.bufferLength * sampleRate),
            snapshotMags: [],
            snapshotPhases: [],
            volume: src.volume,
            enabled: src.enabled,
            brushPressure: src.brushPressure,
            samplePos: 0,
            sampleRate,
            audioDevice: src.audioDevice
          };
        }
      }

      // Ensure reconstructedChannels length matches parsed.channelCount (fill with empty channels if needed)
      const desiredCount = parsed.channelCount || reconstructedChannels.length || 1;
      while (reconstructedChannels.length < desiredCount) {
        reconstructedChannels.push({ mags: null, phases: null, pcm: [], snapshotMags: [], snapshotPhases: [] });
      }
      if (reconstructedChannels.length > desiredCount) {
        reconstructedChannels.length = desiredCount;
      }

      // Expose reconstructed channels to app globals
      channels = reconstructedChannels;
      if (parsed.sprites !== undefined) sprites = deserializeSprites(parsed.sprites);
      recomputePCMForCols(0, Math.floor(parsed.bufferLength * sampleRate / parsed.hop));
      updateChannels();

      images = []; // reset local images array

      if (Array.isArray(parsed.images) && parsed.images.length > 0) {
        for (let i = 0; i < parsed.images.length; i++) {
          const meta = parsed.images[i]; // { name, file } from saveProject
          if (!meta || !meta.file) {
            // push placeholder
            images.push({ img: null, name: meta && meta.name ? meta.name : `image_${i}`, src: null });
            continue;
          }
          // try to read the blob from the zip
          const fileEntry = zip.file(meta.file);
          if (!fileEntry) {
            console.warn("Image file not found in ZIP:", meta.file);
            images.push({ img: null, name: meta.name || `image_${i}`, src: null });
            continue;
          }
          try {
            const blob = await fileEntry.async("blob");
            const url = URL.createObjectURL(blob);
            const img = new Image();
            // push temporarily with null img; only push after onload to ensure ready to use
            await new Promise((res, rej) => {
              img.onload = () => {
                images.push({ img, name: meta.name || `image_${i}`, src: url, file: null });
                res();
              };
              img.onerror = (err) => {
                console.warn("Image failed to load from ZIP entry", meta.file, err);
                // still push something so UI won't break
                images.push({ img: null, name: meta.name || `image_${i}`, src: url, file: null });
                res(); // treat as resolved so openProject continues
              };
              img.src = url;
            });
          } catch (err) {
            console.warn("Failed to extract image blob from zip for", meta.file, err);
            images.push({ img: null, name: meta.name || `image_${i}`, src: null });
          }
        }
      }
      if (images.length >0) selectedImage = 0;







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

document.getElementById("saveProject").addEventListener('click', () => {
  saveProject();
});
document.getElementById("saveAndOpenProject").addEventListener('click', () => {
  document.getElementById("openProject").click();
});
document.getElementById("openProject").addEventListener('change',(e)=>{
  openProject(e.target.files[0]);
});
const modal = document.getElementById('presetsModal');
// Close modal
document.getElementById('closeProjectModalBtn').addEventListener('click', () => {
  modal.style.display = 'none';
});

document.getElementById("startNewProjectBtn").addEventListener('click', () => {
  modal.style.display = 'flex';
});

document.getElementById("saveAndStart").addEventListener('click', async () => {
  saveProject();
  const val = document.getElementById('presets').value;
  modal.style.display = 'none';

  if (val === "silence") {
    initEmptyPCM(true);
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
    channels[0].pcm = new Float32Array(decoded.getChannelData(0));
    sampleRate = decoded.sampleRate || sampleRate;

    status.textContent = `Loaded preset "${val}", ${channels[0].pcm.length} samples @ ${sampleRate} Hz`;
    let t = channels[0].pcm.length / sampleRate;
    hopSizeEl.value = lockHop?Math.pow(2,fftSizeEl.value):(t<0.5?128:(t<5?512:1024));
    emptyAudioLengthEl.value = Math.ceil(t);
    document.getElementById("emptyAudioLengthInput").value = Math.ceil(t);
    minCol = 0; maxCol = Math.floor(channels[0].pcm.length/hopSizeEl.value);
    iLow = 0;
    iHigh = framesTotal;
    channelCount = 1;
    updateChannels();
    await waitFor(() => !rendering);
    renderSpectrogramColumnsToImageBuffer(0,framesTotal,0);
    uploads=[]; images=[]; sprites=[]; renderUploads(); renderSpritesTable();
    movingSprite = false; selectedImage = null; selectedSpriteId = null; 
    document.getElementById("canvas-0").style.cursor = 'crosshair'; 
  } catch (err) {
    console.error("Preset load error:", err);
    status.textContent = "Error loading preset: " + (err.message || err);
  }
});

// Close modal if clicking outside modal content
window.addEventListener('click', e => {
  if (e.target === modal) modal.style.display = 'none';
});
midiChannelMode.addEventListener("change",(e)=>{
  midiSingleChannelDiv.style.display = (midiChannelMode.value === "single") ? "block" : "none";
});

document.getElementById("syncChannels").addEventListener("change", (e)=>{
  syncChannels = document.getElementById("syncChannels").checked;
});







function renderStamps() {
  const wrap = document.getElementById("stampsWrapper");
  wrap.innerHTML = "";

  stamps.forEach((stamp) => {
    const tile = document.createElement("div");
    tile.title = stamp.name;
    tile.className="stamp-tile";

    if (stamp.dataUrl) {
      const img = document.createElement("img");
      img.src = stamp.dataUrl;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      tile.appendChild(img);
    }
    if (currentStamp === stamp) {
      document.querySelectorAll(".stamp-tile").forEach((s)=>{s.style.border="1px solid #555"});
      tile.style.border = "2px solid #4af";
    }
    tile.addEventListener('click', (ev) => {
      if (currentStamp !== stamp) {
        currentStamp = stamp;
        document.querySelectorAll(".stamp-tile").forEach((s)=>{s.style.border="1px solid #555"});
        tile.style.border = "2px solid #4af";
      } else {
        currentStamp = null;
        tile.style.border = "2px solid #555";
      }
      updateBrushPreview();
    });

    // also re-emit on key activation for accessibility (Enter/Space)
    tile.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        tile.click();
      }
    });

    wrap.appendChild(tile);
  });
}
updatePhaseTextureSettings();
function updatePhaseTextureSettings(){
  const t = document.getElementById("phaseSettings");
  const u = document.getElementById("phaseSettingsInput");
  const div = document.getElementById("phaseSettingsDiv");
  div.style.display = "none";
  function c(v) {return phaseTextureEl.value === v}
  function d(variable,min,max,step,label) {
    t.min = min; t.max = max; t.step = step; t.value = variable;
    u.min = min; u.max = max; u.value = variable;
    document.getElementById("phaseSettingsLabel").innerText = label;
    div.style.display = "flex";
  }
       if (c("ImpulseAlign")) d(t0,0,channels[0].pcm.length/sampleRate,0.001,"t0");
  else if (c("LinearDelay")) d(tau,0,10,0.01,"tau");
  else if (c("RandomSmall")) d(sigma,0,1,0.01,"sigma");
  else if (c("HarmonicStack")) d(harmonicCenter,0,128,0.01,"Harmonic Center");
  else if (c("PhasePropagate")) d(userDelta,0,1,0.01,"Delta");
  else if (c("CopyFromRef")) d(refPhaseFrame,0,framesTotal,1,"Reference Frame");
  else if (c("Chirp")) d(chirpRate,0,0.1,0.0001,"Chirp Rate");
}
phaseTextureEl.addEventListener("input",()=>{
  updatePhaseTextureSettings();
  updateBrushPreview();
});