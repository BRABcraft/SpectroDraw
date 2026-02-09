function updateAllVariables(keyWord){
  const p = keyWord===null;
  function conditionalEvaluateExpression(expressionId, setValue, setValue2) {
    if (typeof getExpressionById !== "function") return;
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
        if (exprObj.expression===defaultExpressions[expressionId] && setValue2) setValue2();
        else setValue(result);
      }
      if (expressionId==="eqPresetsDiv") {updateGlobalGain(); updateEQ(); drawEQ();} else {updateBrushPreview();}
    }
  }
  conditionalEvaluateExpression("brushBrightnessDiv", v => {sliders[2][0].value = sliders[2][1].value = brushBrightness = v;});
  conditionalEvaluateExpression("brushMagStrengthDiv", v => {sliders[33][0].value = sliders[33][1].value = magStrength = v;});
  conditionalEvaluateExpression("blurRadiusDiv",      v => {sliders[16][0].value = sliders[16][1].value = blurRadius = v});
  conditionalEvaluateExpression("amplifyDiv",         v => {sliders[17][0].value = sliders[17][1].value = amp = v});
  conditionalEvaluateExpression("noiseAggDiv",        v => {sliders[18][0].value = sliders[18][1].value = noiseAgg = v});
  conditionalEvaluateExpression("autoTuneStrengthDiv",v => {sliders[23][0].value = sliders[23][1].value = autoTuneStrength = v});
  conditionalEvaluateExpression("astartOnPitchDiv",   v => {sliders[25][0].value = sliders[25][1].value = astartOnPitch = v});
  conditionalEvaluateExpression("anpoDiv",            v => {sliders[24][0].value = sliders[24][1].value = anpo = v});
  conditionalEvaluateExpression("phaseDiv",           v => {sliders[3][0].value = sliders[3][1].value = phaseShift = v});
  conditionalEvaluateExpression("phaseStrengthDiv",   v => {sliders[5][0].value = sliders[5][1].value = phaseStrength = v});
  conditionalEvaluateExpression("brushPanShiftDiv",   v => {sliders[30][0].value = sliders[30][1].value = panShift = v});
  conditionalEvaluateExpression("brushPanStrengthDiv",   v => {sliders[31][0].value = sliders[31][1].value = panStrength = v});
  conditionalEvaluateExpression("brushPanBandDiv",   v => {sliders[32][0].value = sliders[32][1].value = panBand = v});
  conditionalEvaluateExpression("brushWidthDiv",      v => {sliders[21][0].value = sliders[21][1].value = brushWidth = v});
  conditionalEvaluateExpression("brushHeightDiv",     v => {sliders[22][0].value = sliders[22][1].value = brushHeight = v});
  conditionalEvaluateExpression("opacityDiv",         v => {sliders[4][0].value = sliders[4][1].value = brushOpacity = v});
  conditionalEvaluateExpression("clonerScaleDiv",     v => {sliders[26][0].value = sliders[26][1].value = clonerScale = Math.max(v,0.001)});
  conditionalEvaluateExpression("brushHarmonicsEditorh3",v => {harmonics = v});
  conditionalEvaluateExpression("eqPresetsDiv",       v => {eqBands = v});
  conditionalEvaluateExpression("chorusVoicesDiv",    v => {sliders[34][0].value = sliders[34][1].value = chorusVoices = v}, ()=>{chorusVoices=sliders[34][0].value;});
  conditionalEvaluateExpression("chorusVoiceStrengthDiv",v =>{sliders[35][0].value=sliders[35][1].value = chorusVoiceStrength = v}, ()=>{chorusVoiceStrength=sliders[35][0].value;});
  conditionalEvaluateExpression("chorusDetuneDiv",    v => {sliders[36][0].value = sliders[36][1].value = chorusDetune = v}, ()=>{chorusDetune=sliders[36][0].value;});
  conditionalEvaluateExpression("chorusPanSpreadDiv", v => {sliders[37][0].value = sliders[37][1].value = chorusPanSpread = v}, ()=>{chorusPanSpread=sliders[37][0].value;});
  conditionalEvaluateExpression("chorusRandomnessDiv",v => {sliders[38][0].value = sliders[38][1].value = chorusRandomness = v}, ()=>{chorusRandomness=sliders[38][0].value;});
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
  [],//0
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
  [document.getElementById('brushPanShift'), document.getElementById('brushPanShiftInput')],//30
  [document.getElementById('brushPanStrength'), document.getElementById('brushPanStrengthInput')],
  [document.getElementById('brushPanBand'), document.getElementById('brushPanBandInput')],
  [document.getElementById('brushMagStrength'), document.getElementById('brushMagStrengthInput')],
  [document.getElementById('chorusVoices'), document.getElementById('chorusVoicesInput')],
  [document.getElementById('chorusVoiceStrength'), document.getElementById('chorusVoiceStrengthInput')],//35
  [document.getElementById('chorusDetune'), document.getElementById('chorusDetuneInput')],
  [document.getElementById('chorusPanSpread'), document.getElementById('chorusPanSpreadInput')],
  [document.getElementById('chorusRandomness'), document.getElementById('chorusRandomnessInput')],
];
  sliders.forEach(pair => {if (!pair[2]&&pair.length) syncNumberAndRange(pair[1], pair[0])});
// sliders[0][0].addEventListener('input', () =>{sliders[0][1].value = sliders[0][0].value;});
// sliders[0][0].addEventListener('mouseup', ()=>{/*for(let ch=0;ch<layerCount;ch++){layers[ch].hasCanvases=false;}*/initEmptyPCM(false);});
// sliders[0][1].addEventListener('keydown', (e) => {if (e.key === 'Enter') {let val = parseFloat(sliders[0][1].value);const min = parseFloat(sliders[0][0].min);const max = parseFloat(sliders[0][0].max);
    // if (isNaN(val)) val = 0;if (val < min) val = min;if (val > max) val = max;sliders[0][1].value = val;sliders[0][0].value = val;initEmptyPCM(false);}});
function rs_(i){const v = sliders[1][i].value; const f = v/brushSize; sliders[21][0].value=sliders[21][1].value=Math.round(brushWidth *= f); sliders[22][0].value=sliders[22][1].value=Math.round(brushHeight *= f); brushSize=v; updateBrushPreview();}
sliders[1][0].addEventListener("input", ()=>{rs_(0);updateAllVariables(null);});
sliders[1][1].addEventListener("input", ()=>{rs_(1);updateAllVariables(null);});
for (const i of [ 2, 3, 4, 5, 23, 24, 25, 26, 33, 34, 35, 36, 37, 38 ]) for (let j = 0; j < 2; j++) sliders[i][j].addEventListener("input", () => {updateAllVariables(null); updateBrushPreview();});
sliders[6][0].addEventListener("input", ()=>{const val=parseInt(sliders[6][0].value);updateNoteCircle(val);npo=val;});
sliders[6][1].addEventListener("input", ()=>{if (!isNaN(sliders[6][1].value)) {const val=parseInt(sliders[6][1].value);updateNoteCircle(val);npo=val;}});
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
sliders[30][0].addEventListener("input", ()=>{val=(sliders[30][0].value); panShift=val; updateBrushPreview();});
sliders[30][1].addEventListener("input", ()=>{val=(sliders[30][1].value); panShift=val; updateBrushPreview();});
sliders[31][0].addEventListener("input", ()=>{val=(sliders[31][0].value); panStrength=val; updateBrushPreview();});
sliders[31][1].addEventListener("input", ()=>{val=(sliders[31][1].value); panStrength=val; updateBrushPreview();});
sliders[32][0].addEventListener("input", ()=>{val=(sliders[32][0].value); panBand=val; updateBrushPreview();});
sliders[32][1].addEventListener("input", ()=>{val=(sliders[32][1].value); panBand=val; updateBrushPreview();});

recordBtn.innerHTML = micHTML;
lockHopBtn.innerHTML = unlockHTML;

function angleDiff(a, b) {
  const d = a - b;
  return Math.atan2(Math.sin(d), Math.cos(d));
}

panelButtons.forEach(btn => {
  if(btn.dataset.tool === currentPanel) {
    btn.style.background = "#4af"; 
  }
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
    s("brushPanShiftDiv",     !(c("autotune")||c("noiseRemover")||c("amplifier")));
    s("brushPanStrengthDiv",  !(c("autotune")||c("noiseRemover")));
    s("brushPanTextureDiv",   !(c("autotune")||c("noiseRemover")||c("amplifier")));
    document.getElementById("brushPanBandDiv").style.display = (document.getElementById("brushPanTexture").value==="Band"&&!(c("autotune")||c("noiseRemover")||c("amplifier")))?"flex":"none";
    sliders[17][0].value=sliders[17][1].value=c("cloner")?cAmp:amp;
    sliders[31][0].max=sliders[31][1].max=c("amplifier")?2:1;
    if (!c("amplifier")&&sliders[31][1].value>1)sliders[31][0].value=sliders[31][1].value=1;
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
  const showSynthSettings = d("note") || d("line");
  document.getElementById("synthSettingsDiv").style.display = showSynthSettings?"block":"none";
  if (showSynthSettings) renderHarmonicsCanvas();
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
    //if (shape==="select")document.getElementById("spritesBtn").click(); else document.getElementById("toolEditBtn").click();
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
trueScale.addEventListener("click", () =>  {trueScaleVal = !trueScaleVal; trueScale.style.background = trueScaleVal?"#4af":"#444"; restartRender(false);});
yAxisMode.addEventListener("click", () =>  {useHz        = !useHz;        yAxisMode.style.background = useHz       ?"#4af":"#444"; drawYAxis();});
uvcb.addEventListener("click",()=>{useVolumeControllers=!useVolumeControllers;uvcb.style.background = useVolumeControllers?"#4af":"#444";});
alignPitchBtn.addEventListener("click",()=>{alignPitch=!alignPitch;alignPitchBtn.style.background = alignPitch?"#4af":"#444"; pitchAlignDiv.style.display=alignPitch?"block":"none";});
alignTimeBtn.addEventListener("click",()=>{alignTime=!alignTime;alignTimeBtn.style.background = alignTime?"#4af":"#444"; timeAlignDiv.style.display=alignTime?"block":"none";drawCursor(true);});
midiAlignTimeBtn.addEventListener("change",()=>{midiAlignTime=midiAlignTimeBtn.checked;midiAlignTimeBtn.style = midiAlignTime?"background:#4af;margin:none;":"background:#444;margin-bottom:15px;";matOptions.style.display=midiAlignTime?"block":"none";});
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
let ogHSv = hopSizeKnob.getValue();
async function toggleLockHop() {
  const len = emptyAudioLength*sampleRate;
  if (lockHop) {
    lockHopBtn.innerHTML=unlockHTML;
    hopSizeKnob.setDisabled(false);
    hopSizeKnob.setValue(ogHSv);
    iLow = 0; iHigh = Math.max(1, Math.floor((len - fftSize) / ogHSv) + 1);
  } else {
    lockHopBtn.innerHTML=lockHTML;
    hopSizeKnob.setDisabled(true);
    ogHSv = hopSizeKnob.getValue();
    hopSizeKnob.setValue(fftSizeKnob.getValue());
    iLow = 0; iHigh = Math.max(1, Math.floor((len - fftSize) / fftSizeKnob.getValue()) + 1);
  }
  minCol = 0; maxCol = Math.floor(len/hopSizeKnob.getValue());
  restartRender(false);
  await waitFor(() => !rendering);
  for(let ch=0;ch<layerCount;ch++)renderSpectrogramColumnsToImageBuffer(0,maxCol,ch);
  lockHop = !lockHop;
}
document.addEventListener('mousemove', e=>{
  const {cx,cy} = getCanvasCoords(e,false);
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
      if (key === 'd') {
        document.getElementById("settingsBtn").click();
      } else if (key === 'e') {
        document.getElementById("eqBtn").click();
      } else if (key === 'q') {
        document.getElementById("layersBtn").click();
      } else if (key === 'b') {
        //document.getElementById("spritesBtn").click();
      } else if (key === 'u') {
        document.getElementById("uploadsBtn").click();
      } else if (key === 'o') {
        document.getElementById("uploadsBtn").click();
        fileEl.click();
      } else if (key === 's') {
        document.getElementById('downloadWav').click();
      } else if (key === 'm') {
        exportMidi();
      } else if (key === 'p') {
        document.getElementById("preferencesWindowToggle").click();
      } else if (key === ' ') {
        recordBtn.click();
      } else {return;}
      event.preventDefault();
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
    let src = layers[i];

    // Quantize & delta-encode per-layer (keep only mags & phases in saved file)
    const encoded = {
      mags: src.mags ? deltaEncode(src.mags, 8) : null,
      phases: src.phases ? deltaEncode(src.phases, 3) : null,
      pans: src.pans ? deltaEncode(src.pans, 2) : null,
      volume: src.volume,
      enabled: src.enabled,
      brushPressure: src.brushPressure,
    };
    outChannels[i] = encoded;
  }

  const project = {
    name: document.getElementById("projectName").value,
    layerCount,
    fftSize,
    hop: hopSizeKnob.getValue(),
    bufferLength: emptyAudioLength,
    drawVolume: document.getElementById("drawVolume").value,
    masterVolume: masterVolumeKnob.getValue(),
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
      if (parsed.hop !== undefined) hopSizeKnob.setValue(parsed.hop);
      if (parsed.bufferLength !== undefined) emptyAudioLength = parsed.bufferLength;
      if (parsed.drawVolume !== undefined) document.getElementById("drawVolumeInput").value = document.getElementById("drawVolume").value = !!parsed.drawVolume;
      if (parsed.playbackVolume !== undefined) document.getElementById("playbackVolumeInput").value = document.getElementById("playbackVolume").value = !!parsed.playbackVolume;
      if (parsed.masterVolume !== undefined) masterVolumeKnob.setValue(!!parsed.masterVolume);
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
      const pcmLen = parsed.bufferLength * sampleRate;
      if (Array.isArray(parsed.layers)) {
        // New format: layers array present
        for (let i = 0; i < parsed.layers.length; i++) {
          const src = parsed.layers[i];
          reconstructedChannels[i] = {
            mags: deltaDecodeToFloat32(src.mags),
            phases: deltaDecodeToFloat32(src.phases),
            pans: deltaDecodeToFloat32(src.pans),
            pcm: [new Float32Array(pcmLen),new Float32Array(pcmLen)],
            snapshotMags: [],
            snapshotPhases: [],
            snapshotPans: [],
            volume: src.volume,
            enabled: src.enabled,
            brushPressure: src.brushPressure,
            samplePos: 0,
            sampleRate,
            hasCanvases: false
          };
        }
      }

      // Ensure reconstructedChannels length matches parsed.layerCount (fill with empty layers if needed)
      const desiredCount = parsed.layerCount || reconstructedChannels.length || 1;
      while (reconstructedChannels.length < desiredCount) {
        reconstructedChannels.push({ mags: null, phases: null, pans: null, pcm: [[],[]], snapshotMags: [], snapshotPhases: [], snapshotPans: null});
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

document.getElementById("saveProjectBtn").addEventListener('click', () => {
  saveProject();
});
document.getElementById("openProjectBtn").addEventListener('click', () => {
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

document.getElementById("newProjectBtn").addEventListener('click', () => {
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
    layers[0].pcm[0] = new Float32Array(decoded.getChannelData(0));
    layers[0].pcm[1] = decoded.getChannelData(1)?new Float32Array(decoded.getChannelData(1)):new Float32Array(decoded.getChannelData(0));
    sampleRate = decoded.sampleRate || sampleRate;

    status.textContent = `Loaded preset "${val}", ${layers[0].pcm[0].length} samples @ ${sampleRate} Hz`;
    let t = layers[0].pcm[0].length / sampleRate;
    hopSizeKnob.setValue(lockHop?Math.pow(2,fftSizeKnob.getValue()):(t<0.5?128:(t<5?512:1024)));
    emptyAudioLength = Math.ceil(t);
    document.getElementById("emptyAudioLengthInput").value = Math.ceil(t);
    minCol = 0; maxCol = Math.floor(layers[0].pcm[0].length/hopSizeKnob.getValue());
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
       if (c("ImpulseAlign")) d(t0,0,layers[0].pcm[0].length/sampleRate,0.001,"t0");
  else if (c("LinearDelay")) d(tau,0,10,0.01,"tau");
  else if (c("RandomSmall")) d(sigma,0,1,0.01,"sigma");
  else if (c("HarmonicStack")) d(harmonicCenter,0,128,0.01,"Harmonic Center");
  else if (c("PhasePropagate")) d(userDelta,0,1,0.01,"Delta");
  else if (c("CopyFromRef")) d(refPhaseFrame,0,framesTotal,1,"Reference Frame");
  else if (c("Chirp")) d(chirpRate,0,0.1,0.0001,"Chirp Rate");
}
let customPhaseExpr = "brush.effect.phaseShift", prevPhaseTexture="Static";
function updatePhaseTextureExpression() {
  const exprObj = getExpressionById("phaseTextureDiv");
  if (phaseTextureEl.value=== "Custom" && !exprObj.showing) showExpression("phaseTextureDiv");
  if (prevPhaseTexture === "Custom") customPhaseExpr = exprObj.expression;
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
      expr = "brush.effect.phaseShift - (Math.PI * pixel.bin * sampleRate * brush.effect.phaseSettings.t0) / specHeight;";
      break;
    case 'FrameAlignedImpulse': 
      expr=`const frameTime = (pixel.frame * hop) / sampleRate;
const t0f = frameTime + (hop / (2 * sampleRate));
return brush.effect.phaseShift - (Math.PI * pixel.bin * sampleRate * t0f) / specHeight;`;
      break;
    case 'ExpectedAdvance':
      expr="brush.effect.phaseShift + (Math.PI * pixel.bin * pixel.frame * hop) / specHeight";
      break;
    case 'PhasePropagate':
      expr=`const prevIdx = (pixel.frame - 1) * specHeight + pixel.bin;
let prevPhase = null;
if (pixel.frame > 0 && layers[currentLayer].phases[prevIdx] !== undefined) {
  prevPhase = layers[currentLayer].phases[prevIdx];
}
if (prevPhase !== null && isFinite(prevPhase)) {
  const expected = prevPhase + (Math.PI * pixel.bin * hop) / specHeight;
  phi = expected + brush.effect.phaseSettings.userDelta;
} else {
  phi = (Math.PI * pixel.bin * pixel.frame * hop) / specHeight;
}`;
      break;
    case 'RandomSmall':
      expr = "brush.effect.phaseShift + (Math.random() * 2 - 1) * brush.effect.phaseSettings.sigma;";
      break;
    case 'HarmonicStack': 
      expr = `const center = Math.max(1, brush.effect.phaseSettings.harmonicCenter);
return brush.effect.phaseShift - (Math.PI * pixel.bin * sampleRate * brush.effect.phaseSettings.t0) / specHeight + (k % center) * 0.12;`;
      break;
    case 'LinearDelay':
      expr = "brush.effect.phaseShift - (Math.PI * pixel.bin * sampleRate * brush.effect.phaseSettings.tau) / specHeight;";
      break;
    case 'Chirp':
      expr = "brush.effect.phaseShift - (Math.PI * pixel.bin * pixel.frame * hop) / specHeight - Math.pow(pixel.bin, 1.05) * brush.effect.phaseSettings.chirpRate;";
      break;
    case 'CopyFromRef': 
      expr = `const refIx = (brush.effect.phaseSettings.refPhaseFrame * specHeight + pixel.bin) | 0;
phi = layers[currentLayer].phases[refIx];`;
      break;
    case 'HopArtifact':
      expr = "//Expressions disabled for HopArtifact";
      break;
    case 'Custom':
      expr = customPhaseExpr;
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
let customPanExpr = "brush.effect.phaseShift", prevPanTexture="Static";
function updatePanTextureExpression() {
  const exprObj = getExpressionById("brushPanTextureDiv");
  const panTextureEl = document.getElementById("brushPanTexture");
  if (panTextureEl.value=== "Custom" && !exprObj.showing) showExpression("brushPanTextureDiv");
  if (prevPanTexture === "Custom") customPanExpr = exprObj.expression;
  prevPanTexture = panTextureEl.value;
  let expr = "";
  switch (panTextureEl.value) {
    case 'Flat':
      expr = "brush.effect.panShift;";
      break;
    case 'Random':
      expr = "(Math.random() + brush.effect.panShift) % 1;";
      break;
    case 'XCircles':
      expr = "(Math.sin(pixel.frame/(sampleRate*0.63661/hop))/2+0.5 + brush.effect.panShift) % 1";
      break;
    case 'YCircles':
      expr = "(Math.sin(pixel.bin/(sampleRate*0.63661/hop))/2+0.5  + brush.effect.panShift) % 1";
      break;
    case 'Band':
      expr = "(Math.pow((1/(specHeight*10)+1),(0-Math.pow(pixel.bin-(1000),2))) + brush.effect.panShift) % 1";
      break;
    case 'Custom':
      expr = customPanExpr;
      break;
  }
  exprObj.expression = expr;
  exprObj.lines = expr.split(/\r\n|\r|\n/);
}
document.getElementById("brushPanTexture").addEventListener("input",()=>{
  updatePanTextureExpression();
  document.getElementById("brushPanBandDiv").style.display = (document.getElementById("brushPanTexture").value==="Band")?"flex":"none";
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
      updateNoiseProfile(false);
      return;
    }
  }

  // ----------------------------------------------------
  // 4) Fallback: whole file
  // ----------------------------------------------------
  noiseProfileMin = 0;
  noiseProfileMax = framesTotal;
  noiseProfile = computeNoiseProfileFromFrames(ch,noiseProfileMin,noiseProfileMax);
  updateNoiseProfile(falses);
}
window.addEventListener("resize",()=>{
  minCol = 0; maxCol = framesTotal;
  restartRender();
});



document.querySelectorAll('.toolSection').forEach(section => {
  const header = section.querySelector('.toolSection-header');
  const btn = section.querySelector('.toggle-btn');
  const wrapper = section.querySelector('.content-wrapper');
  const body = section.querySelector('.panel-body');
  const controlId = wrapper.id;
  function open(){
    section.classList.add('open');
    header.setAttribute('aria-expanded','true');
    const h = body.scrollHeight + 10;
    wrapper.style.maxHeight = h + 'px';
  }
  function close(){
    section.classList.remove('open');
    header.setAttribute('aria-expanded','false');
    wrapper.style.maxHeight = 0;
  }
  header.addEventListener('click', (e)=>{
    if (section.classList.contains('open')) close(); else open();
  });
  const ro = new ResizeObserver(()=>{
    if (section.classList.contains('open')){
      wrapper.style.maxHeight = body.scrollHeight + 10 + 'px';
    }
  });
  ro.observe(body);
  window.addEventListener('resize', ()=>{
    if (section.classList.contains('open')) wrapper.style.maxHeight = body.scrollHeight +10+ 'px';
  });
  wrapper.style.maxHeight = 0;
  header.setAttribute('tabindex', 0);
  header.setAttribute('role','button');
});

document.querySelectorAll(".top-leftBtn").forEach(b => {
  b.addEventListener("click", (e) => {
    document.querySelectorAll(".top-leftBtn").forEach(b => {document.getElementById(b.id+"Dropdown").classList.remove("show");});
    e.stopPropagation();
    document.getElementById(b.id+"Dropdown").classList.toggle("show");
  });
});
document.addEventListener("click", (e) => {
  if (["undoBtn","redoBtn"].includes(e.target.id)||["wToggle"].includes(e.target.classList[0])) return;
  document.querySelectorAll(".top-leftBtn").forEach(b => {document.getElementById(b.id+"Dropdown").classList.remove("show");});
});
document.querySelectorAll(".wToggle").forEach(b =>{
  b.addEventListener("click",e=>{
    const el = document.getElementById(b.getAttribute("windowId")+"Check");
    el.innerText=(el.innerText==="✓")?" ":"✓";
  });
});
function globalXStretch(xFactor) {
  const sign = xFactor>0;
  xFactor = Math.abs(xFactor);
  const useMags = document.getElementById("globalUseMagsCheckbox").checked;
  const usePhases = document.getElementById("globalUsePhasesCheckbox").checked;
  const usePans = document.getElementById("globalUsePansCheckbox").checked;
  if (!useMags && !usePhases && !usePans) return;
  bufferLengthKnob.setValue(bufferLengthKnob.getValue()*xFactor,false);
  emptyAudioLength = bufferLengthKnob.getValue();

  // compute old/new frame counts once
  const oldFrames = framesTotal;
  const newFrameLength = Math.floor(emptyAudioLength*sampleRate/hop);

  for (let l=0;l<layerCount;l++){
    // remap mags/phases/pans (time-stretch)
    const newArrLen = newFrameLength*specHeight;
    let newMags;
    if (!useMags) {
      newMags = new Float32Array(newArrLen).fill(0);
      if (newArrLen>layers[l].mags.length)newMags.set(layers[l].mags,0);
    } else {
      newMags = new Float32Array(newArrLen);
    }
    let newPhases;
    if (!usePhases) {
      newPhases = Float32Array.from({ length: newArrLen }, () => { return Math.random()*Math.PI*2;});
      if (newArrLen>layers[l].phases.length)newPhases.set(layers[l].phases,0);
    } else {
      newPhases = new Float32Array(newArrLen);
    }
    let newPans;
    if (!usePans) {
      newPans = new Float32Array(newArrLen).fill(0);
      if (newArrLen>layers[l].pans.length) newPans.set(layers[l].pans,0);
    } else {
      newPans = new Float32Array(newArrLen);
    }

    for(let f=0;f<newFrameLength;f++){
      const oldF = Math.floor((sign?f:newFrameLength-f-1)*oldFrames/newFrameLength);
      const setP = oldF*specHeight;
      const magsF = useMags?layers[l].mags.slice(setP,setP+specHeight):null;
      const phasesF = usePhases?layers[l].phases.slice(setP,setP+specHeight):null;
      const pansF = usePans?layers[l].pans.slice(setP,setP+specHeight):null;
      if (useMags) newMags.set(magsF,f*specHeight);
      if (usePhases) newPhases.set(phasesF,f*specHeight);
      if (usePans) newPans.set(pansF,f*specHeight);
    }
    if (useMags) layers[l].mags = new Float32Array(newMags);
    if (usePhases) layers[l].phases = new Float32Array(newPhases);
    if (usePans) layers[l].pans = new Float32Array(newPans);
    layers[l].pcm[0] = new Float32Array(emptyAudioLength*sampleRate);
    layers[l].pcm[1] = new Float32Array(emptyAudioLength*sampleRate);
  }
  for (const sprite of sprites) {
    if (!sprite.pixels) continue;
    let $s = sprite.ch==="all"?0:sprite.ch, $e = sprite.ch==="all"?layerCount:sprite.ch+1;
    for (let l=$s;l<$e;l++){
      const oldMap = sprite.pixels[l];
      if (!oldMap) continue;
      const newMap = new Map();
      // iterate old columns
      oldMap.forEach((col, x) => {
        let newX = Math.floor(x * newFrameLength / Math.max(1, oldFrames));
        if (!sign) newX = newFrameLength-newX;
        if (newX < 0) return;
        const existing = newMap.get(newX);
        if (!existing) {
          // clone arrays so we don't alias the old object
          newMap.set(newX, {
            ys: col.ys.slice(),
            prevMags: col.prevMags ? col.prevMags.slice() : [],
            prevPhases: col.prevPhases ? col.prevPhases.slice() : [],
            nextMags: col.nextMags ? col.nextMags.slice() : [],
            nextPhases: col.nextPhases ? col.nextPhases.slice() : [],
            prevPans: col.prevPans ? col.prevPans.slice() : [],
            nextPans: col.nextPans ? col.nextPans.slice() : []
          });
        } else {
          // merge rows: overwrite if same y, otherwise push
          for (let i=0;i<col.ys.length;i++){
            const y = col.ys[i];
            const idx = existing.ys.indexOf(y);
            if (idx >= 0) {
              existing.prevMags[idx] = col.prevMags ? col.prevMags[i] : existing.prevMags[idx];
              existing.prevPhases[idx] = col.prevPhases ? col.prevPhases[i] : existing.prevPhases[idx];
              existing.nextMags[idx] = useMags ? (col.nextMags ? col.nextMags[i] : layers[l].mags[x*specHeight+y]) : existing.nextMags[idx];
              existing.nextPhases[idx] = usePhases ? (col.nextPhases ? col.nextPhases[i] : layers[l].phases[x*specHeight+y]) : existing.nextPhases[idx];
              existing.prevPans[idx] = col.prevPans ? col.prevPans[i] : existing.prevPans[idx];
              existing.nextPans[idx] = usePans ? (col.nextPans ? col.nextPans[i] : layers[l].pans[x*specHeight+y]) : existing.nextPans[idx];
            } else {
              existing.ys.push(y);
              existing.prevMags.push(col.prevMags ? col.prevMags[i] : 0);
              existing.prevPhases.push(col.prevPhases ? col.prevPhases[i] : 0);
              existing.nextMags.push(useMags ? (col.nextMags ? col.nextMags[i] : layers[l].mags[x*specHeight+y]) : 0);
              existing.nextPhases.push(usePhases ? (col.nextPhases ? col.nextPhases[i] : layers[l].phases[x*specHeight+y]) : 0);
              existing.prevPans.push(col.prevPans ? col.prevPans[i] : 0);
              existing.nextPans.push(usePans ? (col.nextPans ? col.nextPans[i] : layers[l].pans[x*specHeight+y]) : 0);
            }
          }
        }
      });
      sprite.pixels[l] = newMap;
      sprite.minCol = Infinity; sprite.maxCol = -Infinity;
      for (const k of newMap.keys()) {
        if (k < sprite.minCol) sprite.minCol = k;
        if (k > sprite.maxCol) sprite.maxCol = k;
      }
      if (!isFinite(sprite.minCol)) { sprite.minCol = 0; sprite.maxCol = 0; }
    }
  }

  // finalize frame counts and re-render
  framesTotal = specWidth = newFrameLength;
  simpleRestartRender(0,framesTotal);
  restartRender(false);
}

function globalYStretch(yFactor) {
  const useMags = document.getElementById("globalUseMagsCheckbox").checked;
  const usePhases = document.getElementById("globalUsePhasesCheckbox").checked;
  const usePans = document.getElementById("globalUsePansCheckbox").checked;
  if (!useMags && !usePhases && !usePans) return;
  for (let l=0;l<layerCount;l++){
    const newMags = useMags?new Float32Array(layers[l].mags):null;
    const newPhases = usePhases?new Float32Array(layers[l].phases):null;
    const newPans = usePans?new Float32Array(layers[l].pans):null;
    const f = sampleRate / fftSize, $s = sampleRate/2, $l = logScaleVal[ch];
    for (let b=0;b<specHeight;b++){
      const newBin = Math.max(Math.min(Math.floor(invlsc(((lsc(b*f,$s,$l)/f-(specHeight/2))/yFactor+(specHeight/2))*f,$s,$l)/f),specHeight),0);
      for(let f=0;f<framesTotal;f++){
        const base = f*specHeight;
        if (useMags) newMags[base+b] = layers[l].mags[base+newBin];
        if (usePhases) newPhases[base+b] = layers[l].phases[base+newBin];
        if (usePans) newPans[base+b] = layers[l].pans[base+newBin];
      }
    }
    if (useMags) layers[l].mags = new Float32Array(newMags);
    if (usePhases) layers[l].phases = new Float32Array(newPhases);
    if (usePans) layers[l].pans = new Float32Array(newPans);

  }
  for (const sprite of sprites) {
    if (!sprite.pixels) continue;
    let $s = sprite.ch==="all"?0:sprite.ch, $e = sprite.ch==="all"?layerCount:sprite.ch+1;
    for (let l=$s;l<$e;l++){
      const oldMap = sprite.pixels[l];
      if (!oldMap) continue;
      const newMap = new Map();
      oldMap.forEach((col, x) => {
        const newCol = {
          ys: [],
          prevMags: [],
          prevPhases: [],
          nextMags: [],
          nextPhases: [],
          prevPans: [],
          nextPans: []
        };
        for (let i=0;i<col.ys.length;i++){//console.log(1421);
          const oldY = col.ys[i];
          // invert the same mapping used for mags: target b such that sourceIndex === oldY
          const f = sampleRate / fftSize, $s = sampleRate/2, $l = logScaleVal[ch];
          const newY = Math.max(Math.min(Math.floor(invlsc(((lsc(oldY*f,$s,$l)/f-(specHeight/2))*yFactor+(specHeight/2))*f,$s,$l)/f),specHeight),0);
          const idx = newCol.ys.indexOf(newY);
          if (idx >= 0) {
            // overwrite
            newCol.prevMags[idx] = col.prevMags ? col.prevMags[i] : newCol.prevMags[idx];
            newCol.prevPhases[idx] = col.prevPhases ? col.prevPhases[i] : newCol.prevPhases[idx];
            newCol.nextMags[idx] = useMags? (col.nextMags ? col.nextMags[i] : layers[l].mags[x*specHeight+newY]) : newCol.nextMags[idx];
            newCol.nextPhases[idx] = usePhases? (col.nextPhases ? col.nextPhases[i] : layers[l].phases[x*specHeight+newY]) : newCol.nextPhases[idx];
            newCol.prevPans[idx] = col.prevPans ? col.prevPans[i] : newCol.prevPans[idx];
            newCol.nextPans[idx] = usePans? (col.nextPans ? col.nextPans[i] : layers[l].pans[x*specHeight+newY]) : newCol.nextPans[idx];
          } else {
            newCol.ys.push(newY);
            newCol.prevMags.push(col.prevMags ? col.prevMags[i] : 0);
            newCol.prevPhases.push(col.prevPhases ? col.prevPhases[i] : 0);
            newCol.nextMags.push(useMags? (col.nextMags ? col.nextMags[i] : layers[l].mags[x*specHeight+newY]) : 0);
            newCol.nextPhases.push(usePhases? (col.nextPhases ? col.nextPhases[i] : layers[l].phases[x*specHeight+newY]) : 0);
            newCol.prevPans.push(col.prevPans ? col.prevPans[i] : 0);
            newCol.nextPans.push(usePans? (col.nextPans ? col.nextPans[i] : layers[l].pans[x*specHeight+newY]) : 0);
          }

          // mirror addPixelToSprite's selection update behavior:
          if (sprite.effect && sprite.effect.shape !== "select") {
            updateSelections(x, newY, l, col.prevMags ? col.prevMags[i] : 0, col.prevPhases ? col.prevPhases[i] : 0, col.prevPans ? col.prevPans[i] : 0, col.nextMags ? col.nextMags[i] : 0, col.nextPhases ? col.nextPhases[i] : 0, col.nextPans ? col.nextPans[i] : 0);
          }
        }
        // if the column has any entries, set it
        if (newCol.ys.length) newMap.set(x, newCol);
      });
      sprite.pixels[l] = newMap;
    }
  }
  simpleRestartRender(0,framesTotal);
}

function globalXTranslate(deltaX) {
  deltaX = -Math.floor(deltaX);
  const useMags = document.getElementById("globalUseMagsCheckbox").checked;
  const usePhases = document.getElementById("globalUsePhasesCheckbox").checked;
  const usePans = document.getElementById("globalUsePansCheckbox").checked;
  if (!useMags && !usePhases && !usePans) return;

  for (let l=0;l<layerCount;l++){
    const newArrLen = framesTotal*specHeight;
    const newMags = useMags?new Float32Array(newArrLen):null;
    const newPhases = usePhases?new Float32Array(newArrLen):null;
    const newPans = usePans?new Float32Array(newArrLen):null;
    for(let f=0;f<framesTotal;f++){
      const oldF = f+deltaX;
      const setP = oldF*specHeight;
      const magsF = useMags?layers[l].mags.slice(setP,setP+specHeight):new Float32Array(specHeight);
      const phasesF = usePhases?layers[l].phases.slice(setP,setP+specHeight):new Float32Array(specHeight);
      const pansF = usePans?layers[l].pans.slice(setP,setP+specHeight):new Float32Array(specHeight);
      if (useMags) newMags.set(magsF,f*specHeight);
      if (usePhases) newPhases.set(phasesF,f*specHeight);
      if (usePans) newPans.set(pansF,f*specHeight);
    }
    if (useMags) layers[l].mags = new Float32Array(newMags);
    if (usePhases) layers[l].phases = new Float32Array(newPhases);
    if (usePans) layers[l].pans = new Float32Array(newPans);
  }
  for (const sprite of sprites) {
    if (!sprite.pixels) continue;
    let $s = sprite.ch === "all" ? 0 : sprite.ch,
        $e = sprite.ch === "all" ? layerCount : sprite.ch + 1;
    for (let l = $s; l < $e; l++) {
      const oldMap = sprite.pixels[l];
      if (!oldMap) continue;

      const newMap = new Map();
      // move each column by deltaX; drop if out of range
      oldMap.forEach((col, x) => {
        const newX = x + deltaX;
        if (newX < 0 || newX > framesTotal) return; // drop
        newMap.set(newX, col);
      });

      sprite.pixels[l] = newMap;

      // recompute min/max columns
      sprite.minCol = Infinity;
      sprite.maxCol = -Infinity;
      for (const k of newMap.keys()) {
        if (k < sprite.minCol) sprite.minCol = k;
        if (k > sprite.maxCol) sprite.maxCol = k;
      }
      if (!isFinite(sprite.minCol)) { sprite.minCol = 0; sprite.maxCol = 0; }
    }
  }
  maxCol = framesTotal;
  simpleRestartRender(0,framesTotal);
}

function globalYTranslate(deltaY) {
  deltaY = -Math.floor(deltaY);
  const useMags = document.getElementById("globalUseMagsCheckbox").checked;
  const usePhases = document.getElementById("globalUsePhasesCheckbox").checked;
  const usePans = document.getElementById("globalUsePansCheckbox").checked;
  if (!useMags && !usePhases && !usePans) return;
  for (let l=0;l<layerCount;l++){
    const newMags = useMags?new Float32Array(layers[l].mags):null;
    const newPhases = usePhases?new Float32Array(layers[l].phases):null;
    const newPans = usePans?new Float32Array(layers[l].pans):null;
    const f = sampleRate / fftSize, $s = sampleRate/2, $l = logScaleVal[ch];
    for (let b=0;b<specHeight;b++){
      const newBin = Math.max(Math.min(Math.floor(invlsc((lsc(b*f,$s,$l)/f+deltaY)*f,$s,$l)/f),specHeight),0);
      for(let f=0;f<framesTotal;f++){
        const base = f*specHeight;
        if (useMags) newMags[base+b] = layers[l].mags[base+newBin];
        if (usePhases) newPhases[base+b] = layers[l].phases[base+newBin];
        if (usePans) newPans[base+b] = layers[l].pans[base+newBin];
      }
    }
    if (useMags) layers[l].mags = new Float32Array(newMags);
    if (usePhases) layers[l].phases = new Float32Array(newPhases);
    if (usePans) layers[l].pans = new Float32Array(newPans);

  }
  for (const sprite of sprites) {
    if (!sprite.pixels) continue;
    let $s = sprite.ch==="all"?0:sprite.ch, $e = sprite.ch==="all"?layerCount:sprite.ch+1;
    for (let l=$s;l<$e;l++){
      const oldMap = sprite.pixels[l];
      if (!oldMap) continue;
      const newMap = new Map();
      oldMap.forEach((col, x) => {
        const newCol = {
          ys: [],
          prevMags: [],
          prevPhases: [],
          nextMags: [],
          nextPhases: [],
          prevPans: [],
          nextPans: []
        };
        for (let i=0;i<col.ys.length;i++){//console.log(1421);
          const oldY = col.ys[i];
          // invert the same mapping used for mags: target b such that sourceIndex === oldY
          const f = sampleRate / fftSize, $s = sampleRate/2, $l = logScaleVal[ch];
          const newY = Math.max(Math.min(Math.floor(invlsc((lsc(oldY*f,$s,$l)/f-deltaY)*f,$s,$l)/f),specHeight),0);
          const idx = newCol.ys.indexOf(newY);
          if (idx >= 0) {
            // overwrite
            newCol.prevMags[idx] = col.prevMags ? col.prevMags[i] : newCol.prevMags[idx];
            newCol.prevPhases[idx] = col.prevPhases ? col.prevPhases[i] : newCol.prevPhases[idx];
            newCol.nextMags[idx] = useMags? (col.nextMags ? col.nextMags[i] : layers[l].mags[x*specHeight+newY]) : newCol.nextMags[idx];
            newCol.nextPhases[idx] = usePhases? (col.nextPhases ? col.nextPhases[i] : layers[l].phases[x*specHeight+newY]) : newCol.nextPhases[idx];
            newCol.prevPans[idx] = col.prevPans ? col.prevPans[i] : newCol.prevPans[idx];
            newCol.nextPans[idx] = usePans? (col.nextPans ? col.nextPans[i] : layers[l].pans[x*specHeight+newY]) : newCol.nextPans[idx];
          } else {
            newCol.ys.push(newY);
            newCol.prevMags.push(col.prevMags ? col.prevMags[i] : 0);
            newCol.prevPhases.push(col.prevPhases ? col.prevPhases[i] : 0);
            newCol.nextMags.push(useMags? (col.nextMags ? col.nextMags[i] : layers[l].mags[x*specHeight+newY]) : 0);
            newCol.nextPhases.push(usePhases? (col.nextPhases ? col.nextPhases[i] : layers[l].phases[x*specHeight+newY]) : 0);
            newCol.prevPans.push(col.prevPans ? col.prevPans[i] : 0);
            newCol.nextPans.push(usePans? (col.nextPans ? col.nextPans[i] : layers[l].pans[x*specHeight+newY]) : 0);
          }

          // mirror addPixelToSprite's selection update behavior:
          if (sprite.effect && sprite.effect.shape !== "select") {
            updateSelections(x, newY, l, col.prevMags ? col.prevMags[i] : 0, col.prevPhases ? col.prevPhases[i] : 0, col.prevPans ? col.prevPans[i] : 0, col.nextMags ? col.nextMags[i] : 0, col.nextPhases ? col.nextPhases[i] : 0, col.nextPans ? col.nextPans[i] : 0);
          }
        }
        // if the column has any entries, set it
        if (newCol.ys.length) newMap.set(x, newCol);
      });
      sprite.pixels[l] = newMap;
    }
  }
  simpleRestartRender(0,framesTotal);
}

function xQuantize(columns) {
  const useMags = document.getElementById("globalUseMagsCheckbox").checked;
  const usePhases = document.getElementById("globalUsePhasesCheckbox").checked;
  const usePans = document.getElementById("globalUsePansCheckbox").checked;
  if (!useMags && !usePhases && !usePans) return;
  columns = Math.floor(framesTotal/Math.max(1, Math.floor(columns)));
  const totalFrames = framesTotal;
  const H = specHeight;
  for (let l = 0; l < layerCount; l++) {
    const layerMags = layers[l].mags;
    const layerPhases = layers[l].phases;
    const layerPans = layers[l].pans;
    const len = totalFrames * H;
    let newMags = useMags ? new Float32Array(len) : null;
    let newPhases = usePhases ? new Float32Array(len) : null;
    let newPans = usePans ? new Float32Array(len) : null;
    for (let start = 0; start < totalFrames; start += columns) {
      const end = Math.min(totalFrames, start + columns);
      const blockSize = end - start;
      for (let bin = 0; bin < H; bin++) {
        if (useMags) {
          let sum = 0;
          for (let f = start; f < end; f++) {
            sum += layerMags[f * H + bin];
          }
          const avg = sum / blockSize;
          for (let f = start; f < end; f++) {
            newMags[f * H + bin] = avg;
          }
        }
        if (usePhases) {
          let sumSin = 0;
          let sumCos = 0;
          for (let f = start; f < end; f++) {
            const a = layerPhases[f * H + bin];
            sumSin += Math.sin(a);
            sumCos += Math.cos(a);
          }
          const meanAngle = Math.atan2(sumSin, sumCos);
          for (let f = start; f < end; f++) {
            newPhases[f * H + bin] = meanAngle;
          }
        }
        if (usePans) {
          let sumPan = 0;
          for (let f = start; f < end; f++) {
            sumPan += layerPans[f * H + bin];
          }
          const avgPan = sumPan / blockSize;
          for (let f = start; f < end; f++) {
            newPans[f * H + bin] = avgPan;
          }
        }
      }
    }
    if (useMags) layers[l].mags = new Float32Array(newMags);
    if (usePhases) layers[l].phases = new Float32Array(newPhases);
    if (usePans) layers[l].pans = new Float32Array(newPans);
  }
  simpleRestartRender(0, framesTotal);
}

function yQuantize(rows) {
  const useMags = document.getElementById("globalUseMagsCheckbox").checked;
  const usePhases = document.getElementById("globalUsePhasesCheckbox").checked;
  const usePans = document.getElementById("globalUsePansCheckbox").checked;
  if (!useMags && !usePhases && !usePans) return;
  rows = Math.max(1, Math.floor(rows));

  const totalFrames = framesTotal;
  const H = specHeight;
  const freqPerBin = sampleRate / fftSize;
  const s = sampleRate / 2;

  for (let l = 0; l < layerCount; l++) {
    const layerMags = layers[l].mags;
    const layerPhases = layers[l].phases;
    const layerPans = layers[l].pans;
    const len = totalFrames * H;

    const newMags = useMags ? new Float32Array(len) : null;
    const newPhases = usePhases ? new Float32Array(len) : null;
    const newPans = usePans ? new Float32Array(len) : null;

    // log-scale parameter for this layer
    const lscVal = logScaleVal[l];

    // process frame-by-frame
    for (let fi = 0; fi < totalFrames; fi++) {
      const base = fi * H;

      // accumulators per region
      const magSums = useMags ? new Float32Array(rows) : null;
      const counts = new Uint16Array(rows);
      const sinSums = usePhases ? new Float32Array(rows) : null;
      const cosSums = usePhases ? new Float32Array(rows) : null;
      const panSums = usePans ? new Float32Array(rows) : null;

      // first pass: accumulate sums for each region (region determined by lsc mapping)
      for (let b = 0; b < H; b++) {
        const displayY = lsc(b * freqPerBin, s, lscVal) / freqPerBin;
        let regionIndex = Math.floor(displayY * rows / H);
        if (regionIndex < 0) regionIndex = 0;
        if (regionIndex >= rows) regionIndex = rows - 1;

        if (useMags) magSums[regionIndex] += layerMags[base + b];
        counts[regionIndex]++;

        if (usePhases) {
          const a = layerPhases[base + b];
          sinSums[regionIndex] += Math.sin(a);
          cosSums[regionIndex] += Math.cos(a);
        }
        if (usePans) {
          panSums[regionIndex] += layerPans[base + b];
        }
      }

      // second pass: compute averages and write them back into every bin that belongs to that region
      for (let b = 0; b < H; b++) {
        const displayY = lsc(b * freqPerBin, s, lscVal) / freqPerBin;
        let regionIndex = Math.floor(displayY * rows / H);
        if (regionIndex < 0) regionIndex = 0;
        if (regionIndex >= rows) regionIndex = rows - 1;

        if (useMags) {
          const cnt = counts[regionIndex];
          newMags[base + b] = cnt > 0 ? magSums[regionIndex] / cnt : layerMags[base + b];
        }

        if (usePhases) {
          const cnt = counts[regionIndex];
          if (cnt > 0) {
            newPhases[base + b] = Math.atan2(sinSums[regionIndex], cosSums[regionIndex]);
          } else {
            newPhases[base + b] = layerPhases[base + b];
          }
        }

        if (usePans) {
          const cnt = counts[regionIndex];
          newPans[base + b] = cnt > 0 ? (panSums[regionIndex] / cnt) : layerPans[base + b];
        }
      }
    }

    if (useMags) layers[l].mags = new Float32Array(newMags);
    if (usePhases) layers[l].phases = new Float32Array(newPhases);
    if (usePans) layers[l].pans = new Float32Array(newPans);
  }

  simpleRestartRender(0, framesTotal);
}

function newGlobalXYHistory(type,spriteIdx){
  function cloneLayerSpriteOptimized(layer, s) {
    const minCol = s.minCol;
    const maxCol = s.maxCol;
    const copy = { ...layer };
    copy.pcm = layer.pcm.map(chArr => {
      if (!chArr || typeof chArr.slice !== 'function') return chArr;
      return chArr.slice(minCol * hop, maxCol * hop);
    });
    copy.mags = copy.mags ? copy.mags.slice(minCol * specHeight, maxCol * specHeight) : copy.mags;
    copy.phases = copy.phases ? copy.phases.slice(minCol * specHeight, maxCol * specHeight) : copy.phases;
    return copy;
  }
  function cloneLayersSafe(layers) {
    return structuredClone(
      layers.map(layer => {
        const {
          _playbackBtn,
          _startedAt,
          _wasPlayingDuringDrag,
          ...cloneable
        } = layer;
        return cloneable;
      })
    );
  }
  const s = (spriteIdx)?getSpriteById(spriteIdx):null;
  if (type==="undo") {
    historyStack = historyStack.slice(0, historyIndex+1);
    historyIndex = historyStack.length;
    const undo = (!spriteIdx) ? {
      layers: cloneLayersSafe(layers),
      sprites: structuredClone(sprites),
      emptyAudioLength,
      ch:null
    } : {
      layers: s.ch === "all" ? layers.map(layer => {cloneLayerSpriteOptimized(layer,s)}) : cloneLayerSpriteOptimized(layers[s.ch],s),
      sprites: structuredClone(s),
      emptyAudioLength,
      ch:s.ch,
      spriteIdx
    };
    historyStack.push({
      type: "globalXYTools",
      undo,
      redo: null
    });
  } else {
    historyStack[historyIndex].redo = (!spriteIdx) ? {
      layers: cloneLayersSafe(layers),
      sprites: structuredClone(sprites),
      emptyAudioLength,
      ch:null
    } : {
      layers: s.ch === "all" ? layers.map(layer => {cloneLayerSpriteOptimized(layer,s)}) : cloneLayerSpriteOptimized(layers[s.ch],s),
      sprites: structuredClone(s),
      emptyAudioLength,
      ch:s.ch,
      spriteIdx
    };
  }
}

let Gtarget = null, _gX = 0, _gY = 0, _xQuantize = 4, _yQuantize = 4;
document.querySelectorAll("#globalXYTools td").forEach(td=>{
    td.addEventListener("pointerdown",e=>{
      const v = td.querySelector("div");
      if (!v.id.includes("stretch")&&!v.id.includes("translate")) return;
      newGlobalXYHistory("undo");
      v.style.color = "#4af";
      Gtarget = v.id;
      _gX = e.clientX; _gY = e.clientY;
    });
    document.addEventListener("pointermove",e=>{
      const v = td.querySelector("div").id;
      if (Gtarget!==v) return;
      if (v==="x-stretch") {
        const xFactor = ((e.clientX-_gX)-(e.clientY-_gY))/100+1;
        globalXStretch(xFactor);
      } else if (v==="y-stretch") {
        const yFactor = ((e.clientX-_gX)-(e.clientY-_gY))/500+1;
        globalYStretch(yFactor);
      } else if (v==="x-translate") {
        const deltaX = ((e.clientX-_gX)-(e.clientY-_gY))/(window.innerWidth-550)*framesTotal;
        globalXTranslate(deltaX);
      } else if (v==="y-translate") {
        const deltaY = ((e.clientX-_gX)-(e.clientY-_gY))/(window.innerHeight-150)*specHeight;
        globalYTranslate(deltaY);
      }

      _gX = e.clientX; _gY = e.clientY;
    });
    document.addEventListener("pointerup",()=>{
      const v = td.querySelector("div").id;
      if (Gtarget===v) newGlobalXYHistory("redo");
      Gtarget=null;
      td.querySelector("div").style.color = "#fff";
    });
    td.addEventListener("click",e=>{
      if (e.button !== 0) return;
      const v = td.querySelector("div").id;
      if (v.includes("stretch") || v.includes("translate")) return;
      newGlobalXYHistory("undo");
             if (v === "x-x2") {
        globalXStretch(2);
      } else if (v === "y-x2") {
        globalYStretch(2);
      } else if (v === "x-/2") {
        globalXStretch(0.5);
      } else if (v === "y-/2") {
        globalYStretch(0.5);
      } else if (v === "x-flip") {
        globalXStretch(-1);
      } else if (v === "y-flip") {
        globalYStretch(-1);
      } else if (v === "x-quantize") {
        xQuantize(_xQuantize);
      } else if (v === "y-quantize") {
        yQuantize(_yQuantize);
      }
      newGlobalXYHistory("redo");
    });
  }
);
const mvsmbtn = document.getElementById("moveSpritesModeBtn");
mvsmbtn.addEventListener("click",()=>{
  moveSpritesMode = !moveSpritesMode;
  mvsmbtn.classList.toggle('moving', moveSpritesMode);
  spritePath = null;
  if (!moveSpritesMode && movingSprite) document.getElementById('moveSpriteBtn').click();
  if (!moveSpritesMode) for (let ch=0;ch<layerCount;ch++)document.getElementById("canvas-"+ch).style.cursor = "crosshair";
});


function createNoteCircle(notes, size = 200) {
  let initialNotes = Array.isArray(notes) && notes.length > 0 ? notes.slice() : new Array(12).fill(0);

  // SVG root
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.classList.add("note-circle");

  const cx = size / 2;
  const cy = size / 2;

  // outer/inner radii for ring segments (thickness scales with size)
  const rOuter = (size / 2) - 4;                     // outer radius
  const thickness = Math.max(12, Math.round(size * 0.18)); // segment thickness
  const rInner = rOuter - thickness;                 // inner radius

  // dark plugin-like background
  const bg = document.createElementNS(svgNS, "circle");
  bg.setAttribute("cx", cx);
  bg.setAttribute("cy", cy);
  bg.setAttribute("r", (rInner - 6).toString()); // make inner area darker
  bg.setAttribute("fill", "#0b0b0b");            // plugin dark background
  bg.setAttribute("stroke", "none");
  svg.appendChild(bg);

  // helper to build ring-segment (donut slice) path
  function ringSegmentPath(cx, cy, rO, rI, startA, endA) {
    const twoPi = Math.PI * 2;
    // normalize sweep to [0, 2π]
    let sweep = endA - startA;
    while (sweep < 0) sweep += twoPi;
    while (sweep > twoPi) sweep -= twoPi;

    // if the sweep is effectively a full circle, split into two arcs so endpoints aren't identical
    if (Math.abs(sweep - twoPi) < 1e-6) {
      const mid = startA + Math.PI; // halfway around
      // outer points
      const xStartO = cx + rO * Math.cos(startA), yStartO = cy + rO * Math.sin(startA);
      const xMidO   = cx + rO * Math.cos(mid),   yMidO   = cy + rO * Math.sin(mid);
      // inner points
      const xStartI = cx + rI * Math.cos(startA), yStartI = cy + rI * Math.sin(startA);
      const xMidI   = cx + rI * Math.cos(mid),    yMidI   = cy + rI * Math.sin(mid);

      // two half-arcs for outer, two half-arcs for inner (reverse direction)
      return [
        `M ${xStartO.toFixed(3)} ${yStartO.toFixed(3)}`,
        `A ${rO.toFixed(3)} ${rO.toFixed(3)} 0 0 1 ${xMidO.toFixed(3)} ${yMidO.toFixed(3)}`,
        `A ${rO.toFixed(3)} ${rO.toFixed(3)} 0 0 1 ${xStartO.toFixed(3)} ${yStartO.toFixed(3)}`,
        `L ${xStartI.toFixed(3)} ${yStartI.toFixed(3)}`,
        `A ${rI.toFixed(3)} ${rI.toFixed(3)} 0 0 0 ${xMidI.toFixed(3)} ${yMidI.toFixed(3)}`,
        `A ${rI.toFixed(3)} ${rI.toFixed(3)} 0 0 0 ${xStartI.toFixed(3)} ${yStartI.toFixed(3)}`,
        'Z'
      ].join(' ');
    }

    // normal (partial) segment case
    const x1o = cx + rO * Math.cos(startA);
    const y1o = cy + rO * Math.sin(startA);
    const x2o = cx + rO * Math.cos(endA);
    const y2o = cy + rO * Math.sin(endA);
    const x2i = cx + rI * Math.cos(endA);
    const y2i = cy + rI * Math.sin(endA);
    const x1i = cx + rI * Math.cos(startA);
    const y1i = cy + rI * Math.sin(startA);

    const largeArcFlag = sweep > Math.PI ? 1 : 0;
    const d = [
      `M ${x1o.toFixed(3)} ${y1o.toFixed(3)}`,
      `A ${rO.toFixed(3)} ${rO.toFixed(3)} 0 ${largeArcFlag} 1 ${x2o.toFixed(3)} ${y2o.toFixed(3)}`,
      `L ${x2i.toFixed(3)} ${y2i.toFixed(3)}`,
      `A ${rI.toFixed(3)} ${rI.toFixed(3)} 0 ${largeArcFlag} 0 ${x1i.toFixed(3)} ${y1i.toFixed(3)}`,
      'Z'
    ].join(' ');
    return d;
  }

  // render function (recreates segment paths)
  function render(notesArray) {
    // remove all children except the background (index 0)
    while (svg.childNodes.length > 1) svg.removeChild(svg.lastChild);

    const n = notesArray.length;
    for (let i = 0; i < n; i++) {
      const startAngle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const endAngle   = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;

      const path = document.createElementNS(svgNS, "path");
      const d = ringSegmentPath(cx, cy, rOuter, rInner, startAngle, endAngle);
      path.setAttribute("d", d);

      // rainbow hue per slice
      const hue = Math.round((i / n) * 360);

      // colors: enabled = brighter; disabled = darker
      const enabledLight = 55;   // lightness for enabled base
      const disabledLight = 22;  // lightness for disabled base
      const saturationOn = 95;
      const saturationOff = 45;

      const isOn = !!notesArray[i];
      const baseFill = isOn
        ? `hsl(${hue}, ${saturationOn}%, ${enabledLight}%)`
        : `hsl(${hue}, ${saturationOff}%, ${disabledLight}%)`;

      // hover fill (brighter)
      const hoverFill = `hsl(${hue}, ${Math.min(100, saturationOn + 10)}%, ${Math.min(80, enabledLight + 12)}%)`;

      // initial fill/stroke
      path.setAttribute("fill", baseFill);
      path.setAttribute("stroke", "#050505");
      path.setAttribute("stroke-width", "0.6");
      path.style.cursor = 'pointer';

      // smooth transitions and origin for scaling
      path.style.transition = "transform 120ms ease, filter 120ms ease, fill 120ms ease";
      // for transform-origin to work reliably with SVG, provide pixel coordinates
      path.style.transformOrigin = `${cx}px ${cy}px`;

      // store metadata for event handlers
      path.dataset.index = i;
      path.dataset.hue = String(hue);
      path.dataset.sOn = String(saturationOn);
      path.dataset.sOff = String(saturationOff);
      path.dataset.lOn = String(enabledLight);
      path.dataset.lOff = String(disabledLight);
      path.dataset.hover = hoverFill;

      // click toggles note and updates fill
      path.addEventListener('click', function (e) {
        const idx = Number(this.dataset.index);
        svg._notes[idx] = svg._notes[idx] ? 0 : 1;
        // recompute fill for the new state
        const h = Number(this.dataset.hue);
        const on = !!svg._notes[idx];
        const newFill = on
          ? `hsl(${h}, ${this.dataset.sOn}%, ${this.dataset.lOn}%)`
          : `hsl(${h}, ${this.dataset.sOff}%, ${this.dataset.lOff}%)`;
        this.setAttribute('fill', newFill);
      });

      // hover interactions: brighten + scale up slightly
      path.addEventListener('mouseenter', function () {
        // prefer making hover visible: scale + brighter fill + gentle glow (via filter)
        this.style.transform = 'scale(1.08)';
        this.style.filter = 'drop-shadow(0 2px 6px rgba(0,0,0,0.45))';
        // set brighter fill (use hover stored)
        this.setAttribute('fill', this.dataset.hover);
      });
      path.addEventListener('mouseleave', function () {
        this.style.transform = 'none';
        this.style.filter = 'none';
        // restore fill depending on state
        const idx = Number(this.dataset.index);
        const on = !!svg._notes[idx];
        const h = Number(this.dataset.hue);
        const restored = on
          ? `hsl(${h}, ${this.dataset.sOn}%, ${this.dataset.lOn}%)`
          : `hsl(${h}, ${this.dataset.sOff}%, ${this.dataset.lOff}%)`;
        this.setAttribute('fill', restored);
      });

      svg.appendChild(path);
      const midAngle = (startAngle + endAngle) / 2;
      // place the text halfway through the ring thickness (slightly toward outer edge)
      const textRadius = rInner - 10 + Math.max(0, Math.round(thickness * 0.06));
      const tx = cx + textRadius * Math.cos(midAngle);
      const ty = cy + textRadius * Math.sin(midAngle);

      const txt = document.createElementNS(svgNS, "text");
      txt.setAttribute("x", tx.toFixed(3));
      txt.setAttribute("y", ty.toFixed(3));
      txt.setAttribute("fill", "#ffffff");               // white text
      txt.setAttribute("text-anchor", "middle");         // center horizontally
      txt.setAttribute("dominant-baseline", "middle");   // center vertically
      // scale font to ring thickness (keeps it proportional to size)
      const fontSize = Math.max(10, Math.round(thickness * 0.45));
      txt.setAttribute("font-size", String(fontSize));
      txt.setAttribute("font-family", "sans-serif");
      // make sure text doesn't intercept pointer events (clicks go to the path)
      txt.style.pointerEvents = "none";

      txt.textContent = String(i); // the slice index

      svg.appendChild(txt);
    }
  }

  // initial state & api
  svg._notes = initialNotes.slice();
  render(svg._notes);

  svg.setNotes = function(newNotes) {
    if (!Array.isArray(newNotes) || newNotes.length === 0) {
      console.warn('setNotes expects a non-empty array; no change made.');
      return;
    }
    svg._notes = newNotes.slice();
    render(svg._notes);
  };

  // append to DOM (keeps your original behaviour)
  const mount = document.getElementById("pitchAlignDiv") || document.body;
  mount.appendChild(svg);
  return svg;
}
const ncs = document.getElementById("notesCircleSelect");
const notesCircle = createNoteCircle([], 150);
notesCircle.setNotes(new Array(npo).fill(1));
const scales = {
  //               C # D # E F # G # A # B
  "Major":        [1,0,1,0,1,1,0,1,0,1,0,1],
  "Minor":        [1,0,1,1,0,1,0,1,1,0,1,0],
  "Diminished":   [1,0,1,1,0,1,1,0,1,1,0,1],
  "Whole Tone":   [1,0,1,0,1,0,1,0,1,0,1,0],
  "Mixolydian":   [1,0,1,0,1,1,0,1,0,1,1,0],
  "Lydian":       [1,0,1,0,1,0,1,1,0,1,0,1],
  "Chromatic":    [1,1,1,1,1,1,1,1,1,1,1,1],
  "Pentatonic":   [1,0,1,0,1,0,0,1,0,1,0,0],
  "Blues":        [1,0,0,1,1,1,0,0,1,0,1,0]
}
function updateNoteCircle(newNPO) { 
  let notes = notesCircle._notes; 
  if (notes.length>newNPO) { 
    notes = notes.slice(0,newNPO);
  } else {
    let i=notes.length-1;
    while (notes.length<newNPO) {
      notes.push(scales[ncs.value]?scales[ncs.value][i%12]:1);
      i++;
    }
  } 
  notesCircle.setNotes(notes);
}
ncs.addEventListener("change",e=>{
  if (ncs.value === "Custom") return;
  if (!scales[ncs.value]) {notesCircle.setNotes(new Array(12).fill(0)); return;}
  let scale = [];
  for (let i=0;i<npo;i++) {
    scale.push(scales[ncs.value][i%12]);
  }
  notesCircle.setNotes(scale);
});

const sops = document.getElementById("startOnPitchSelect");
sops.addEventListener("change",e=>{
  startOnP = sliders[9][0].value = sliders[9][1].value = parseFloat(e.target.value);
});
function findClosestOption(selectEl, targetValue) {
  let closestOption = null;
  let smallestDiff = Infinity;
  for (const option of selectEl.options) {
    const value = parseFloat(option.value);
    if (Number.isNaN(value)) continue;
    const diff = Math.abs(value - targetValue);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      closestOption = option;
    }
  }
  return closestOption;
}
sliders[9][0].addEventListener("input",e=>{
  sops.value = findClosestOption(sops, sliders[9][0].value).value;
});
sliders[9][1].addEventListener("input",e=>{
  sops.value = findClosestOption(sops, sliders[9][1].value).value;
});
function renderFilters(){
  const wrap = document.getElementById("filterMasksWrapper");
  
  wrap.innerHTML = "";

  filterMasks.forEach((mask) => {
    const tile = document.createElement("div");
    tile.title = mask.name;
    tile.className="stamp-tile";

    if (mask.dataUrl) {
      const img = document.createElement("img");
      img.src = mask.dataUrl;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      tile.appendChild(img);
    }
    tile.addEventListener('click', (ev) => {
      const useMags = document.getElementById("filterUseMagsCheckbox").checked;
      const usePhases = document.getElementById("filterUsePhasesCheckbox").checked;

      // draw mask into temp canvas so we can read pixels
      const tmp = document.createElement("canvas");
      tmp.width = specWidth;
      tmp.height = specHeight;
      const ctx = tmp.getContext("2d");

      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, specWidth, specHeight);
        const maskData = ctx.getImageData(0, 0, specWidth, specHeight).data;
        newGlobalXYHistory('undo');
        for (let l = 0; l < layerCount; l++) {
          let displayYToBin = [];
          for (let i=0;i<specHeight;i++) {
            const f = sampleRate / fftSize, $s = sampleRate/2, $l = logScaleVal[l];
            displayYToBin.push(specHeight-1-Math.floor(lsc(i*f,$s,$l)/f));
          }
          for (let i = 0; i < specWidth * specHeight; i++) {
            const xx = Math.floor(i/specHeight);
            const yy = displayYToBin[i%specHeight];
            //const yy = i%specHeight;
            const px = (yy*specWidth + xx) * 4;              // RGBA index
            const _opacity = maskData[px] / 255; // R channel → 0..1

            if (useMags)   layers[l].mags[i]   *= _opacity;
            if (usePhases) layers[l].phases[i] *= _opacity;
          }
        }
        simpleRestartRender(0, framesTotal);
        newGlobalXYHistory('redo');
      };

      img.src = mask.dataUrl;
    });

    wrap.appendChild(tile);
  });
}
renderFilters();
const colorSchemeEl = document.getElementById("colorScheme");
const magCSEl = document.getElementById("magnitudeColorScheme");
const phaseCSEl = document.getElementById("phaseColorScheme");
const panCSEl = document.getElementById("panColorScheme");
colorSchemeEl.addEventListener("change",()=>{
  if (colorSchemeEl.value === "custom") {
    magCSEl.innerHTML = phaseCSEl.innerHTML = panCSEl.innerHTML = `
                <option value="r">Red</option>
                <option value="g">Green</option>
                <option value="b">Blue</option>
                <option value="y">Luminance</option>
                <option value="cr">Chrominance Red</option>
                <option value="cb">Chrominance Blue</option>`;
    magCSEl.value = "y";phaseCSEl.value = "cr";panCSEl.value = "cb";
  } else {
    magCSEl.innerHTML = phaseCSEl.innerHTML = panCSEl.innerHTML = `
                <option value="h">Hue</option>
                <option value="s">Saturation</option>
                <option value="v">Value</option>
                <option value="o">Off</option>`;
    magCSEl.value = "v";phaseCSEl.value = "h";panCSEl.value = "s";
  }
  updateMagPhasePanMapping();
});