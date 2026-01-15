function updateAllVariables(keyWord){
  const p = keyWord===null;
  function conditionalEvaluateExpression(expressionId, setValue) {
    const exprObj = getExpressionById(expressionId);
    if (!exprObj) return;
    const expr = exprObj.expression;
    if (p || expr.includes(keyWord)) {
      let result = parseExpression(exprObj);
      if (exprObj.isError) {
        const errorEl = document.getElementById(`error-${expressionId}`);
        if (errorEl) {
          errorEl.style.display = "block";
          errorEl.innerText = result;
        } else {
          console.log(result);
        }
        setValue(parseExpression(exprObj,defaultExpressions[expressionId]));
      } else {
        setValue(result);
      }
      if (expressionId==="eqPresetsDiv") {updateGlobalGain(); updateEQ(); drawEQ();} else {updateBrushPreview();}
    }
  }
  conditionalEvaluateExpression("brushBrightnessDiv", v => {sliders[2][0].value = sliders[2][1].value = brushBrightness = v;});
  conditionalEvaluateExpression("blurRadiusDiv",      v => {sliders[16][0].value = sliders[16][1].value = blurRadius = v});
  conditionalEvaluateExpression("amplifyDiv",         v => {sliders[17][0].value = sliders[17][1].value = amp = v});
  conditionalEvaluateExpression("noiseAggDiv",        v => {sliders[18][0].value = sliders[18][1].value = noiseAgg = v});
  conditionalEvaluateExpression("autoTuneStrengthDiv",v => {sliders[23][0].value = sliders[23][1].value = autoTuneStrength = v});
  conditionalEvaluateExpression("astartOnPitchDiv",   v => {sliders[25][0].value = sliders[25][1].value = astartOnPitch = v});
  conditionalEvaluateExpression("anpoDiv",            v => {sliders[24][0].value = sliders[24][1].value = anpo = v});
  conditionalEvaluateExpression("phaseDiv",           v => {sliders[3][0].value = sliders[3][1].value = phaseShift = v});
  conditionalEvaluateExpression("phaseStrengthDiv",   v => {sliders[5][0].value = sliders[5][1].value = phaseStrength = v});
  conditionalEvaluateExpression("brushWidthDiv",      v => {sliders[21][0].value = sliders[21][1].value = brushWidth = v});
  conditionalEvaluateExpression("brushHeightDiv",     v => {sliders[22][0].value = sliders[22][1].value = brushHeight = v});
  conditionalEvaluateExpression("opacityDiv",         v => {sliders[4][0].value = sliders[4][1].value = brushOpacity = v});
  conditionalEvaluateExpression("clonerScaleDiv",     v => {sliders[26][0].value = sliders[26][1].value = clonerScale = Math.max(v,0.001)});
  conditionalEvaluateExpression("brushHarmonicsEditorh3",v => {harmonics = v});
  conditionalEvaluateExpression("eqPresetsDiv",       v => {eqBands = v});

}
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
  [document.getElementById('emptyAudioLength'), document.getElementById('emptyAudioLengthInput'),true],//0
  [document.getElementById('brushSize'), document.getElementById('brushSizeInput')],
  [document.getElementById('brushBrightness'), document.getElementById('brushBrightnessInput')],
  [document.getElementById('phaseShift'), document.getElementById('phaseShiftInput')],
  [document.getElementById('brushOpacity'), document.getElementById('brushOpacityInput')],
  [document.getElementById('phaseStrength'), document.getElementById('phaseStrengthInput')],//5
  [document.getElementById('npo'), document.getElementById('npoInput')],
  [document.getElementById('noiseFloorCutoff'), document.getElementById('noiseFloorCutoffInput'), true],
  [document.getElementById('bpm'), document.getElementById('bpmInput')],
  [document.getElementById('startOnPitch'), document.getElementById('startOnPitchInput'), true],
  [document.getElementById('durationCutoff'), document.getElementById('durationCutoffInput'), true],//10
  [document.getElementById('globalGain'), document.getElementById('globalGainInput'), true],
  [document.getElementById('midiBpm'), document.getElementById('midiBpmInput'), true],
  [document.getElementById('subBeat'), document.getElementById('subBeatInput'), true],
  [document.getElementById('tQs'), document.getElementById('tQsInput'), true],
  [document.getElementById('tQt'), document.getElementById('tQtInput'), true],//15
  [document.getElementById('blurRadius'), document.getElementById('blurRadiusInput')],
  [document.getElementById('amp'), document.getElementById('ampInput')],
  [document.getElementById('noiseAgg'), document.getElementById('noiseAggInput'),true],
  [document.getElementById('layers'), document.getElementById('layersInput'),true],
  [document.getElementById('layerHeight'), document.getElementById('layerHeightInput'),true],//20
  [document.getElementById('brushWidth'), document.getElementById('brushWidthInput')],
  [document.getElementById('brushHeight'), document.getElementById('brushHeightInput')],
  [document.getElementById('autoTuneStrength'), document.getElementById('autoTuneStrengthInput')],
  [document.getElementById('anpo'), document.getElementById('anpoInput')],
  [document.getElementById('astartOnPitch'), document.getElementById('astartOnPitchInput')],//25
  [document.getElementById('clonerScale'), document.getElementById('clonerScaleInput')],
  [document.getElementById('phaseSettings'), document.getElementById('phaseSettingsInput')],
  [document.getElementById('drawVolume'), document.getElementById('drawVolumeInput')],
  [document.getElementById('playbackVolume'), document.getElementById('playbackVolumeInput')],
  [document.getElementById('masterVolume'), document.getElementById('masterVolumeInput')],
];
  sliders.forEach(pair => {if (!pair[2]) syncNumberAndRange(pair[1], pair[0])});
sliders[0][0].addEventListener('input', () =>{sliders[0][1].value = sliders[0][0].value;});
sliders[0][0].addEventListener('mouseup', ()=>{/*for(let ch=0;ch<layerCount;ch++){layers[ch].hasCanvases=false;}*/initEmptyPCM(false);});
sliders[0][1].addEventListener('keydown', (e) => {if (e.key === 'Enter') {let val = parseFloat(sliders[0][1].value);const min = parseFloat(sliders[0][0].min);const max = parseFloat(sliders[0][0].max);
    if (isNaN(val)) val = 0;if (val < min) val = min;if (val > max) val = max;sliders[0][1].value = val;sliders[0][0].value = val;initEmptyPCM(false);}});
function rs_(i){const v = sliders[1][i].value; const f = v/brushSize; sliders[21][0].value=sliders[21][1].value=Math.round(brushWidth *= f); sliders[22][0].value=sliders[22][1].value=Math.round(brushHeight *= f); brushSize=v; updateBrushPreview();}
sliders[1][0].addEventListener("input", ()=>{rs_(0);updateAllVariables(null);});
sliders[1][1].addEventListener("input", ()=>{rs_(1);updateAllVariables(null);});
sliders[2][0].addEventListener("input",()=>{updateAllVariables(null);updateBrushPreview();});
sliders[2][1].addEventListener("input",()=>{updateAllVariables(null);updateBrushPreview();});
sliders[3][0].addEventListener("input", ()=>{updateAllVariables(null); updateBrushPreview();});
sliders[3][1].addEventListener("input", ()=>{updateAllVariables(null); updateBrushPreview();});
sliders[4][0].addEventListener("input", ()=>{updateAllVariables(null); updateBrushPreview();});
sliders[4][1].addEventListener("input", ()=>{updateAllVariables(null); updateBrushPreview();});
sliders[5][0].addEventListener("input", ()=>{updateAllVariables(null); updateBrushPreview();});
sliders[5][1].addEventListener("input", ()=>{updateAllVariables(null); updateBrushPreview();});
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
sliders[18][0].addEventListener('input', () => {noiseAgg = parseFloat(sliders[18][0].value); sliders[18][1].value = noiseAgg;updateBrushPreview();});
sliders[18][1].addEventListener('keydown', (e) => {if (e.key === 'Enter') {let val = parseFloat(sliders[18][1].value);const min = parseFloat(sliders[18][0].min);const max = parseFloat(sliders[18][0].max);
    if (isNaN(val)) val = noiseAgg;if (val < min) val = min;if (val > max) val = max;sliders[18][1].value = val;sliders[18][0].value = val;noiseAgg = val;updateBrushPreview();}});
sliders[19][0].addEventListener('input', () => {layerCount = parseFloat(sliders[19][0].value); sliders[19][1].value = layerCount;updateLayers();});
sliders[19][1].addEventListener('keydown', (e) => {if (e.key === 'Enter') {let val = parseFloat(sliders[19][1].value);const min = parseFloat(sliders[19][0].min);const max = parseFloat(sliders[19][0].max);
    if (isNaN(val)) val = layerCount;if (val < min) val = min;if (val > max) val = max;sliders[19][1].value = val;sliders[19][0].value = val;layerCount = val;updateLayers();}});
sliders[20][0].addEventListener('input', () => {layerHeight = parseFloat(sliders[20][0].value); sliders[20][1].value = layerHeight;updateLayerHeight();});
sliders[20][1].addEventListener('keydown', (e) => {if (e.key === 'Enter') {let val = parseFloat(sliders[20][1].value);const min = parseFloat(sliders[20][0].min);const max = parseFloat(sliders[20][0].max);
    if (isNaN(val)) val = layerHeight;if (val < min) val = min;if (val > max) val = max;sliders[20][1].value = val;sliders[20][0].value = val;layerHeight = val;updateLayerHeight();}});
function rs(){sliders[1][0].value = sliders[1][1].value = brushSize = Math.max(brushWidth, brushHeight);updateBrushPreview();}
sliders[21][0].addEventListener("input", ()=>{updateAllVariables(null); rs(); updateBrushPreview();});
sliders[21][1].addEventListener("input", ()=>{updateAllVariables(null); rs(); updateBrushPreview();});
sliders[22][0].addEventListener("input", ()=>{updateAllVariables(null); rs(); updateBrushPreview();});
sliders[22][1].addEventListener("input", ()=>{updateAllVariables(null); rs(); updateBrushPreview();});
sliders[23][0].addEventListener("input", ()=>{updateAllVariables(null); updateBrushPreview();});
sliders[23][1].addEventListener("input", ()=>{updateAllVariables(null); updateBrushPreview();});
sliders[24][0].addEventListener("input", ()=>{updateAllVariables(null); updateBrushPreview();});
sliders[24][1].addEventListener("input", ()=>{updateAllVariables(null); updateBrushPreview();});
sliders[25][0].addEventListener("input", ()=>{updateAllVariables(null); updateBrushPreview();});
sliders[25][1].addEventListener("input", ()=>{updateAllVariables(null); updateBrushPreview();});
sliders[26][0].addEventListener("input", ()=>{updateAllVariables(null); updateBrushPreview();});
sliders[26][1].addEventListener("input", ()=>{updateAllVariables(null); updateBrushPreview();});
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
    if (currentPanel == "2") renderSpritesTable();
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
  function s(id, display, id2=null){
    if (id2===null) id2=id;
    if (typeof id2 === "string") {
      document.getElementById(id2).style.display=display?"flex":"none";
    }
    if (typeof id === "string") {
      const exprObj = getExpressionById(id);
      if (!exprObj.showing) return;
      if (!display) hideExpression(id);
    }
  }
  if (c("cloner")&&(d("image")||d("stamp"))) currentTool = "fill";
  if (c("autotune")&&(d("image")||d("note"))) currentTool = "fill";
  if (c("noiseRemover")&&d("image")) currentTool = "fill";
  if (showEffectSettings) {
    s("amplifyDiv",       c("amplifier")||c("cloner"));
    s("noiseAggDiv",      c("noiseRemover"));
    s(0                  ,c("noiseRemover"),"setNoiseProfileDiv");
    s("blurRadiusDiv",    c("blur"));
    s("autoTuneStrengthDiv",c("autotune"));
    s("anpoDiv",          c("autotune"));
    s("astartOnPitchDiv", c("autotune"));
    s("brushBrightnessDiv",!(c("amplifier") || c("noiseRemover") || c("blur") || c("autotune") || c("cloner")));
    s("phaseTextureDiv", !(c("noiseRemover")||c("autotune")||c("cloner")));
    updatePhaseTextureSettings();
    s("phaseDiv",          !(c("noiseRemover")||c("autotune")||c("cloner")));
    s("phaseStrengthDiv",  !(c("noiseRemover")||c("autotune")));
    s(0,                   c("cloner"),"changeClonerPosDiv");
    s("clonerScaleDiv",    c("cloner"));
    s("opacityDiv",        !c("autotune"));
    sliders[17][0].value=sliders[17][1].value=c("cloner")?cAmp:amp;
  }
  const bs = document.getElementById("brushSizeDiv");

  const dragToDraw = document.getElementById("dragToDraw").checked;
  bs.style.display = (showToolSettings && (((d('line') || d('image') && !dragToDraw)) || (!(d('line') || d('image')) && !(d('rectangle') || d('note')))))?"flex":"none";

  let disp = showToolSettings?true:false;;
  if (d("line") || d("rectangle") || d("note")) disp = false;
  if (d("image")) disp=true;
  if (dragToDraw) disp=false;
  s("brushWidthDiv", disp);
  s("brushHeightDiv", disp);
  const showHarmonics = d("note") || d("line");
  document.getElementById("harmonicsPresetSelectDiv").style.display = showHarmonics?"block":"none";
  document.getElementById("brushHarmonicsEditorDiv").style.display = showHarmonics?"block":"none";
  s("brushHarmonicsEditorh3", showHarmonics, 0);
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
function shouldHide(t){
  function d(b){return currentShape===b;}
  return (t==="cloner"      &&(d("image")||d("stamp")))
       ||(t==="autotune"    &&(d("image")||d("note" )))
       ||(t==="noiseRemover"&& d("image")
       ||(d("select")));
}
function onToolChange(tool){
  function c(b){return tool===b;}
  function d(b){return currentShape===b;}
  if (c("cloner")&&(d("image")||d("stamp"))) tool = "fill";
  else if (c("autotune")&&(d("image")||d("note"))) tool = "fill";
  else if (c("noiseRemover")&&d("image")) tool = "fill";
  else {if (currentShape==="select")document.getElementById("spritesBtn").click(); else document.getElementById("toolEditBtn").click();}
  currentTool = tool;
  toolButtons.forEach(b => {
    const t = b.dataset.tool;
    b.style.background =(t===tool&&!d("select"))?"#4af":(shouldHide(t))?"#999":""});
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
    if (shape==="select")document.getElementById("spritesBtn").click(); else document.getElementById("toolEditBtn").click();
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
  for(let ch=0;ch<layerCount;ch++)renderSpectrogramColumnsToImageBuffer(0,maxCol,ch);
  lockHop = !lockHop;
}
document.addEventListener('mousemove', e=>{
  const {cx,cy,scaleX,scaleY} = getCanvasCoords(e,false);
  $x=cx;$y=cy;
  updateAllVariables("mouse");
  updateAllVariables("Math.random()");
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
  const ctrl = (event.ctrlKey || event.metaKey);
  if (!ctrl) {
    if (!event.shiftKey) {
      if (key === 'b') {
        document.getElementById("brushBtn").click();
      } else if (key === 'e') {
        document.getElementById("eraserBtn").click();
      } else if (key === 'r') {
        document.getElementById("rectBtn").click();
      } else if (key === 'a') {
        document.getElementById("amplifierBtn").click();
      } else if (key === 'u') {
        document.getElementById("blurBtn").click();
      } else if (key === 'i') {
        document.getElementById("imageBtn").click();
      } else if (key === 'l') {
        document.getElementById("lineBtn").click();
      } else if (key === 'o') {
        document.getElementById("noteBtn").click();
      } else if (key === 's') {
        document.getElementById("stampBtn").click();
      } else if (key === 'x') {
        document.getElementById("noiseRemoverBtn").click();
      } else if (key === 'c') {
        document.getElementById("clonerBtn").click();
      } else if (key === 'f') {
        document.getElementById("colorBtn").click();
      } else if (key === 'y') {
        yAxisMode.click();
      } else if (key === 'j') {
        alignPitchBtn.click();
      } else if (key === 'k') {
        alignTimeBtn.click();
      }
    } else {
      if (key === 'a') {
        document.getElementById("autotuneBtn").click();
      }
    }
  } else {
    if (!event.shiftKey) {
      event.preventDefault();
      if (key === 'p') {
        document.getElementById("pianoBtn").click();
      } else if (key === 'd') {
        document.getElementById("settingsBtn").click();
      } else if (key === 'e') {
        document.getElementById("eqBtn").click();
      } else if (key === 'q') {
        document.getElementById("layersBtn").click();
      } else if (key === 'b') {
        document.getElementById("spritesBtn").click();
      } else if (key === 'u') {
        document.getElementById("uploadsBtn").click();
      } else if (key === 'o') {
        document.getElementById("uploadsBtn").click();
        fileEl.click();
      } else if (key === 's') {
        document.getElementById('downloadWav').click();
      } else if (key === 'm') {
        exportMidi();
      } else if (key === ' ') {
        recordBtn.click();
      }
    } else {
      if (key === 's') {
        document.getElementById('downloadSpectrogram').click();
      }
    }
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
  if (editingExpression===null) keyBind(event);
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

  // Build layers array to save. Prefer existing global `layers` if present,
  // otherwise fall back to using top-level mags/phases for layer 0.
  const outChannels = new Array(Math.max(0, layerCount || 0));
  const srcChannels = (typeof layers !== "undefined" && Array.isArray(layers)) ? layers : null;

  for (let i = 0; i < outChannels.length; ++i) {
    let src = null;
    if (srcChannels && srcChannels[i]) {
      src = srcChannels[i];
    } else {
      // fallback: place top-level mags/phases into layer 0
      if (i === 0 && typeof mags !== "undefined" && (mags || phases)) {
        src = { mags: mags || null, phases: phases || null };
      } else {
        src = { mags: null, phases: null };
      }
    }

    // Quantize & delta-encode per-layer (keep only mags & phases in saved file)
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
    layerCount,
    fftSize,
    hop: hopSizeEl.value,
    bufferLength: emptyAudioLengthEl.value,
    drawVolume: document.getElementById("drawVolume").value,
    masterVolume: document.getElementById("masterVolume").value,
    playbackVolume: document.getElementById("playbackVolume").value,
    logScaleVal,
    trueScaleVal,
    useHz,
    iLow, iHigh, fLow, fHigh,
    uploads,             // if uploads contains only metadata / pcm it's fine
    // images will be replaced with metadata below
    images: null,
    currentTool,
    currentShape,
    layers: outChannels,
    deltaEncoded: true,
    sprites: serializeSprites(sprites),
    expressions
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
      if (parsed.layerCount !== undefined) layerCount = parsed.layerCount;
      if (parsed.hop !== undefined) hopSizeEl.value = parsed.hop;
      if (parsed.bufferLength !== undefined) emptyAudioLengthEl.value = parsed.bufferLength;
      if (parsed.drawVolume !== undefined) document.getElementById("drawVolumeInput").value = document.getElementById("drawVolume").value = !!parsed.drawVolume;
      if (parsed.playbackVolume !== undefined) document.getElementById("playbackVolumeInput").value = document.getElementById("playbackVolume").value = !!parsed.playbackVolume;
      if (parsed.masterVolume !== undefined) document.getElementById("masterVolumeInput").value = document.getElementById("masterVolume").value = !!parsed.masterVolume;
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

      // Reconstruct layers from parsed data
      const reconstructedChannels = [];

      if (Array.isArray(parsed.layers)) {
        // New format: layers array present
        for (let i = 0; i < parsed.layers.length; i++) {
          const src = parsed.layers[i];
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
            audioDevice: src.audioDevice,
            hasCanvases: false
          };
        }
      }

      // Ensure reconstructedChannels length matches parsed.layerCount (fill with empty layers if needed)
      const desiredCount = parsed.layerCount || reconstructedChannels.length || 1;
      while (reconstructedChannels.length < desiredCount) {
        reconstructedChannels.push({ mags: null, phases: null, pcm: [], snapshotMags: [], snapshotPhases: []});
      }
      if (reconstructedChannels.length > desiredCount) {
        reconstructedChannels.length = desiredCount;
      }

      // Expose reconstructed layers to app globals
      layers = reconstructedChannels;
      if (parsed.sprites !== undefined) sprites = deserializeSprites(parsed.sprites);
      if (parsed.expressions !== undefined) expressions = parsed.expressions;
      recomputePCMForCols(0, Math.floor(parsed.bufferLength * sampleRate / parsed.hop));
      updateLayers();

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
    layers[0].pcm = new Float32Array(decoded.getChannelData(0));
    sampleRate = decoded.sampleRate || sampleRate;

    status.textContent = `Loaded preset "${val}", ${layers[0].pcm.length} samples @ ${sampleRate} Hz`;
    let t = layers[0].pcm.length / sampleRate;
    hopSizeEl.value = lockHop?Math.pow(2,fftSizeEl.value):(t<0.5?128:(t<5?512:1024));
    emptyAudioLengthEl.value = Math.ceil(t);
    document.getElementById("emptyAudioLengthInput").value = Math.ceil(t);
    minCol = 0; maxCol = Math.floor(layers[0].pcm.length/hopSizeEl.value);
    iLow = 0;
    iHigh = framesTotal;
    layerCount = 1;
    updateLayers();
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
midiLayerMode.addEventListener("change",(e)=>{
  midiSingleLayerDiv.style.display = (midiLayerMode.value === "single") ? "block" : "none";
});

document.getElementById("syncLayers").addEventListener("change", (e)=>{
  syncLayers = document.getElementById("syncLayers").checked;
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
  if (document.getElementById("phaseTextureDiv").style.display==="none")return;
  function c(v) {return phaseTextureEl.value === v}
  function d(variable,min,max,step,label) {
    t.min = min; t.max = max; t.step = step; t.value = variable;
    u.min = min; u.max = max; u.value = variable;
    document.getElementById("phaseSettingsLabel").innerText = label;
    div.style.display = "flex";
  }
       if (c("ImpulseAlign")) d(t0,0,layers[0].pcm.length/sampleRate,0.001,"t0");
  else if (c("LinearDelay")) d(tau,0,10,0.01,"tau");
  else if (c("RandomSmall")) d(sigma,0,1,0.01,"sigma");
  else if (c("HarmonicStack")) d(harmonicCenter,0,128,0.01,"Harmonic Center");
  else if (c("PhasePropagate")) d(userDelta,0,1,0.01,"Delta");
  else if (c("CopyFromRef")) d(refPhaseFrame,0,framesTotal,1,"Reference Frame");
  else if (c("Chirp")) d(chirpRate,0,0.1,0.0001,"Chirp Rate");
}
let customExpr = "brush.effect.phaseShift", prevPhaseTexture="Static";
function updatePhaseTextureExpression() {
  const exprObj = getExpressionById("phaseTextureDiv");
  if (phaseTextureEl.value=== "Custom" && !exprObj.showing) showExpression("phaseTextureDiv");
  if (prevPhaseTexture === "Custom") customExpr = exprObj.expression;
  prevPhaseTexture = phaseTextureEl.value;
  let expr = "";
  switch (phaseTextureEl.value) {
    case 'Harmonics':
      expr = "pixel.bin + brush.effect.phaseShift;";
      break;
    case 'Static':
      expr = "Math.random() * 2 * Math.PI + brush.effect.phaseShift;";
      break;
    case 'Flat':
      expr = "brush.effect.phaseShift;";
      break;
    case 'ImpulseAlign':
      expr = "brush.effect.phaseShift - (Math.PI * k * sampleRate * brush.effect.phaseSettings.t0) / specHeight;";
      break;
    case 'FrameAlignedImpulse': 
      expr=`const frameTime = (pixel.frame * hop) / sampleRate;
const t0f = frameTime + (hop / (2 * sampleRate));
return brush.effect.phaseShift - (Math.PI * k * sampleRate * t0f) / specHeight;`;
      break;
    case 'ExpectedAdvance':
      expr="brush.effect.phaseShift + (Math.PI * k * pixel.frame * hop) / specHeight";
      break;
    case 'PhasePropagate':
      expr=`const prevIdx = (pixel.frame - 1) * specHeight + k;
let prevPhase = null;
if (pixel.frame > 0 && layers[currentLayer].phases[prevIdx] !== undefined) {
  prevPhase = layers[currentLayer].phases[prevIdx];
}
if (prevPhase !== null && isFinite(prevPhase)) {
  const expected = prevPhase + (Math.PI * k * hop) / specHeight;
  phi = expected + brush.effect.phaseSettings.userDelta;
} else {
  phi = (Math.PI * k * pixel.frame * hop) / specHeight;
}`;
      break;
    case 'RandomSmall':
      expr = "brush.effect.phaseShift + (Math.random() * 2 - 1) * brush.effect.phaseSettings.sigma;";
      break;
    case 'HarmonicStack': 
      expr = `const center = Math.max(1, brush.effect.phaseSettings.harmonicCenter);
return brush.effect.phaseShift - (Math.PI * k * sampleRate * brush.effect.phaseSettings.t0) / specHeight + (k % center) * 0.12;`;
      break;
    case 'LinearDelay':
      expr = "brush.effect.phaseShift - (Math.PI * k * sampleRate * brush.effect.phaseSettings.tau) / specHeight;";
      break;
    case 'Chirp':
      expr = "brush.effect.phaseShift - (Math.PI * k * pixel.frame * hop) / specHeight - Math.pow(k, 1.05) * brush.effect.phaseSettings.chirpRate;";
      break;
    case 'CopyFromRef': 
      expr = `const refIx = (brush.effect.phaseSettings.refPhaseFrame * specHeight + k) | 0;
phi = layers[currentLayer].phases[refIx];`;
      break;
    case 'HopArtifact':
      expr = "//Expressions disabled for HopArtifact";
      break;
    case 'Custom':
      expr = customExpr;
      break;
  }
  exprObj.expression = expr;
  exprObj.lines = expr.split(/\r\n|\r|\n/);
}
phaseTextureEl.addEventListener("input",()=>{
  updatePhaseTextureSettings();
  updateBrushPreview();
  updatePhaseTextureExpression();
});
document.getElementById("amp").addEventListener("input",()=>{
  updateBrushPreview();
});
document.getElementById("setNoiseProfile").addEventListener("click",()=>{
  changingNoiseProfile = !changingNoiseProfile;
  hasSetNoiseProfile = true;
  document.getElementById("setNoiseProfile").classList.toggle('moving', changingNoiseProfile);
  document.getElementById("setNoiseProfile").innerText = changingNoiseProfile?"Setting noise profile frames":"Set noise profile frames";
  if (!changingNoiseProfile) {
    noiseProfile = computeNoiseProfileFromFrames(currentLayer, noiseProfileMin, noiseProfileMax);
  }
});
const noprmi = document.getElementById("setNoiseProfileMin")
noprmi.addEventListener("input",()=>{noprmi.value = noiseProfileMin = Math.floor(noprmi.value);});
const noprma = document.getElementById("setNoiseProfileMax")
noprma.addEventListener("input",()=>{noprma.value = noiseProfileMax = Math.floor(noprma.value);});

function autoSetNoiseProfile() {
  if (currentTool !== "noiseRemover") return;
  const mags = layers[currentLayer].mags;

  const BIN_STEP = 8; // skip bins for speed
  const MIN_REGION_FRAMES = 8; // don't accept tiny regions

  // ----------------------------------------------------
  // 1) Compute global average magnitude
  // ----------------------------------------------------
  let sum = 0;
  let count = 0;

  for (let frame = 0; frame < framesTotal; frame+=Math.floor(framesTotal/20)) {
    const base = frame * specHeight;
    for (let bin = 0; bin < specHeight; bin += BIN_STEP) {
      const v = mags[base + bin];
      if (v > 0) {
        sum += v;
        count++;
      }
    }
  }

  if (count === 0) return;

  const globalAvg = sum / count;

  // ----------------------------------------------------
  // 2) Try progressively lower thresholds
  // ----------------------------------------------------
  for (let pct = 0.9; pct >= 0.1; pct -= 0.1) {
    const threshold = globalAvg * pct;

    let bestStart = -1;
    let bestLen = 0;

    let curStart = -1;
    let curLen = 0;

    for (let frame = 0; frame < framesTotal; frame++) {
      // compute frame average (sparse bins)
      let frameSum = 0;
      let frameCount = 0;

      const base = frame * specHeight;
      for (let bin = 0; bin < specHeight; bin += BIN_STEP) {
        frameSum += mags[base + bin];
        frameCount++;
      }

      const frameAvg = frameSum / frameCount;

      if (frameAvg < threshold) {
        if (curStart < 0) curStart = frame;
        curLen++;
      } else {
        if (curLen > bestLen) {
          bestLen = curLen;
          bestStart = curStart;
        }
        curStart = -1;
        curLen = 0;
      }
    }

    // catch tail
    if (curLen > bestLen) {
      bestLen = curLen;
      bestStart = curStart;
    }

    // ------------------------------------------------
    // 3) Accept if region is big enough
    // ------------------------------------------------
    if (bestLen >= MIN_REGION_FRAMES) {
      noiseProfileMin = bestStart;
      noiseProfileMax = bestStart + bestLen;
      noiseProfile = computeNoiseProfileFromFrames(ch,noiseProfileMin,noiseProfileMax);
      updateNoiseProfile();
      return;
    }
  }

  // ----------------------------------------------------
  // 4) Fallback: whole file
  // ----------------------------------------------------
  noiseProfileMin = 0;
  noiseProfileMax = framesTotal;
  noiseProfile = computeNoiseProfileFromFrames(ch,noiseProfileMin,noiseProfileMax);
  updateNoiseProfile();
}
function showOrHideMasterVolume(){document.getElementById("masterVolumeDiv").style.display=(window.innerWidth<1400)?"none":"";};
showOrHideMasterVolume();
window.addEventListener("resize",()=>{
  minCol = 0; maxCol = framesTotal;
  restartRender();
  showOrHideMasterVolume();
});