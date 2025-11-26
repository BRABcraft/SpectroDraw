const fileEl=document.getElementById("file");
// let canvas=document.getElementById("canvas-0");
// let ctx=canvas.getContext("2d");
// let overlayCanvas = document.getElementById("overlay-0");
// let overlayCtx = overlayCanvas.getContext("2d");
// let yAxis=document.getElementById("freq-0");
// let yctx=yAxis.getContext("2d");
// let timeline = document.getElementById('timeline-0');
// let tctx = timeline.getContext('2d');
//const logscaleEl = document.getElementById("logscale");
const status=document.getElementById("status");
const fftSizeEl=document.getElementById("fftSize");
const hopSizeEl=document.getElementById("hopSize");
const brushSizeEl=document.getElementById("brushSize");
const brushOpacityEl=document.getElementById("brushOpacity");
const phaseOpacityEl=document.getElementById("phaseOpacity");
const brushColorEl=document.getElementById("brushColor");
const blurRadiusEl=document.getElementById("blurRadius");
const ampEl=document.getElementById("amp");
const noiseRemoveFloorEl=document.getElementById("noiseRemoveFloor");
const penPhaseEl=document.getElementById("penPhase");
const emptyAudioLengthEl = document.getElementById("emptyAudioLength");
const phaseTextureEl = document.getElementById("phaseTexture");
const recordBtn = document.getElementById("rec");
const preset = document.getElementById("presets");
const es = document.getElementById("es");
const ev = document.getElementById("ev");
const yAxisMode=document.getElementById("yAxisMode");
const info = document.getElementById("mouseInfo");
const alignPitchBtn = document.getElementById("alignPitch");
const startOnPitchDiv = document.getElementById("startOnPitchDiv");
const alignTimeBtn = document.getElementById("alignTime");
const bpmDiv = document.getElementById("bpmDiv");
const midiAlignTimeBtn = document.getElementById("midiAlignTime");
const useAIEl = document.getElementById("useMidiAI");
const nonAIMidiOptions = document.getElementById("nonAiMidiDiv");
const matOptions = document.getElementById("matOptions");
const midiBpmDiv = document.getElementById("midiBpmDiv");
const subBeatDiv = document.getElementById("subBeatDiv");
const AIMidiOptions = document.getElementById("AiMidiDiv");
const tQs = document.getElementById("tQs");
const tQt = document.getElementById("tQt");
const tQd = document.getElementById("tQd");
const midiChannelMode = document.getElementById("midiChannelMode");
const midiSingleChannelDiv = document.getElementById("midiSingleChannelDiv");
const WORKLET_CODE = `
class RecorderProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0] && input[0].length > 0) {
      const chunk = new Float32Array(input[0].length);
      chunk.set(input[0]);

      this.port.postMessage(chunk, [chunk.buffer]);
    }
    return true;
  }
}
registerProcessor('recorder-processor', RecorderProcessor);
`;
const micHTML = `
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="2 5 19 19" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M8 15a4 4 0 0 0 8 0" />
  <rect x="10" y="7" width="4" height="8" rx="2" ry="2" fill="black"/>
  <line x1="12" y1="18" x2="12" y2="17"/>
  <line x1="9" y1="21" x2="15" y2="21"/>
</svg>`;
const recHTML = `
<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="red">
  <circle cx="12" cy="12" r="8" />
</svg>`;
const lockHTML = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
  <path d="M8 10a4 4 0 0 1 8 0" fill="none" stroke="white" stroke-width="2"/>
  <rect x="6" y="10" width="12" height="10" fill="white"/>
</svg>`;
const unlockHTML = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
  <path d="M0 10a4 4 0 0 1 8 0" fill="none" stroke="white" stroke-width="2"/>
  <rect x="6" y="10" width="12" height="10" fill="white"/>
</svg>`;
const toolButtons = document.querySelectorAll(".tool-btn");
const shapeButtons = document.querySelectorAll(".shape-btn");
const panelButtons = document.querySelectorAll(".panel-btn");
const trueScale = document.getElementById("trueScale");
const overlayFile = document.getElementById("overlayFile");
const uvcb = document.getElementById("useVolumeControllers");
const EQcanvas = document.getElementById("eqCanvas");
const eCtx = EQcanvas.getContext("2d"); 
const eqPresets = document.getElementById("eqPresets");
const lockHopBtn = document.getElementById("lockHopBtn");
const spriteEffectSettingsDiv = document.getElementById("spriteEffectSettings");

const nameEl = document.getElementById('spriteName');
const toolEl = document.getElementById('spriteTool');
const enabledEl = document.getElementById('spriteEnabled');
const spriteEditorDiv = document.getElementById('spriteEditor');

const historyStack = []; const redoStack = [];
const MAX_HISTORY_ENTRIES = 80;

let pcm=null, sampleRate=48000, pos=0, fftSize=1024, hop=512, win=hann(1024);
let framesTotal=0, x=0, rendering=false;
let imageBuffer=null;
let visited = null;
let currentCursorX = 0;
let iLow = null;
let iHigh = null;
let fLow = null;
let fHigh = null;
// let specCanvas = document.createElement("canvas");
// let specCtx = specCanvas.getContext("2d");
let logScaleVal = [1.12];

let mags = null;     
let phases = null;   
let specWidth = 0;
let specHeight = 0;
let pcmChunks = null;
let trueScaleVal=false;
let overlayImage = null;
let useHz = false;
let autoPlayOnFinish = true;
let alignPitch=false;let alignTime=false;midiAlignTime=true;useMidiAI=useAIEl.checked;
let subBeat = 1;mSubBeat=16;midiBpm=120;
let tQTempo=120;tQStrength=0;
let useVolumeControllers = false;

let startX = null, startY = null;
let cx_ = null, cy_ = null;
let zooming = false;

let brushSize=parseInt(brushSizeEl.value);
let brushOpacity=parseInt(brushOpacityEl.value)/100;
let phaseOpacity=parseInt(phaseOpacityEl.value)/100;
let brushColor=parseInt(brushColorEl.value);
let blurRadius=parseInt(blurRadiusEl.value);
let amp=parseInt(ampEl.value);
let noiseRemoveFloor = parseInt(noiseRemoveFloorEl.value);
let penPhase=parseInt(penPhaseEl.value)/10000;
let currentTool = "color";
let currentShape = "brush";
let currentPanel = "0";
let bpm = 120; let npo = 12;
let noiseFloor = document.getElementById("noiseFloorCutoff").value; let startOnP = 440;
let dCutoff = document.getElementById("durationCutoff").value;
let globalGain = 0;
let playingTutorial = false;
let currentFrame = 0;
let lockHop = false;
let sprites = [];
let nextSpriteId = 1;
let currentSprite = null;
let spriteRedoQueue = [];
let movingSprite = false;
let spritePath = null;
let channelCount = 1;
let channels = null;
let channelHeight = window.innerHeight - 70;
let $x = 0, $y = 0;
let currentChannel = 0;
// let updatingChannel = false;
let handlers = {
  "canvas-": (el) => {
    el.addEventListener("mousedown", e=>{canvasMouseDown(e,false);});
    el.addEventListener("touchstart",e=>{canvasMouseDown(e,true);});
    el.addEventListener("mousemove", e=>{canvasMouseMove(e,false,el);});
    el.addEventListener("touchmove", e=>{canvasMouseMove(e,true,el);});
    el.addEventListener("contextmenu", (e) => {
      const rect = el.getBoundingClientRect();
      const cx = Math.floor(e.clientX - rect.left);
      const cy = Math.floor(e.clientY - rect.top);
      preventAndOpen(e, () => makeCanvasMenu(cx, cy));
    });
    el.addEventListener('wheel', makeWheelZoomHandler(el, {zoomTimeline:true, zoomYAxis:false}), {passive:false});
  },
  "timeline-": (el) => {
    el.addEventListener("contextmenu", (e) => {preventAndOpen(e, makeTimelineMenu);});
    el.addEventListener('wheel', makeWheelZoomHandler(el, {zoomTimeline:true, zoomYAxis:false}), {passive:false});
    el.addEventListener("mousedown", (e) => {timelineMousedown(e,false);});
    el.addEventListener("touchstart", (e) => {timelineMousedown(e,false);});
  },
  "freq-": (el) => {
    el.addEventListener("contextmenu", (e) => {preventAndOpen(e, makeYAxisMenu);});
    el.addEventListener('wheel', makeWheelZoomHandler(el, {zoomTimeline:false, zoomYAxis:true}), {passive:false});
    el.addEventListener("mousedown", (e) => {yAxisMousedown(e,false);});
    el.addEventListener("touchstart", (e) => {yAxisMousedown(e,false);});
  },
  "logscale-": (el) => {
    el.addEventListener("mousedown", e=> {logScaleMouseDown(e,false,el);});
    el.addEventListener("touchstart", e=> {logScaleMouseDown(e,true,el);});
    el.addEventListener("mousemove", e=> {el.title = "Log scale: " + el.value;currentChannel = parseInt(el.id.match(/(\d+)$/)[1], 10);});
    el.addEventListener('contextmenu', (e)=> preventAndOpen(e, makeLogscaleMenu));
  }
}

//GLOBAL HELPER FUNCTIONS

function addEventListeners(){
  for (let ch = 0; ch < channelCount; ch++) {
    for (const prefix in handlers) {
      const id = prefix + ch;
      const el = document.getElementById(id);
      if (!el) continue;
      handlers[prefix](el);
    }
  }
}

async function waitFor(fn, interval = 10) {while (!fn()) await new Promise(r => setTimeout(r, interval));}
