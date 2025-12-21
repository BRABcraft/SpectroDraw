const fileEl=document.getElementById("fileB");
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
const sChannelEl = document.getElementById('spriteChannel');

const historyStack = []; const redoStack = [];
const MAX_HISTORY_ENTRIES = 80;
const defaultFadePoints = [
  { x: 0.0, y: 1.0, mx: 120, my: 0, tLen: 120 },
  { x: 0.5, y: 1.0, mx: 120, my: 0, tLen: 120 },
  { x: 1.0, y: 1.0, mx: 120, my: 0, tLen: 120 }
];

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
let selectedImage = null;
let useHz = false;
let autoPlayOnFinish = true;
let alignPitch=false;let alignTime=false;midiAlignTime=true;useMidiAI=useAIEl.checked;
let subBeat = 1;mSubBeat=16;midiBpm=120;
let tQTempo=120;tQStrength=0;
let useVolumeControllers = false;

let startX = null, startY = null;
let cx_ = null, cy_ = null;
let zooming = false;

let brushSize=parseInt(brushSizeEl.value), brushWidth = brushSize, brushHeight = brushSize;
let brushOpacity=parseInt(brushOpacityEl.value)/100;
let phaseOpacity=parseInt(phaseOpacityEl.value)/100;
let brushColor=parseInt(brushColorEl.value);
let blurRadius=parseInt(blurRadiusEl.value);
let amp=parseInt(ampEl.value),cAmp=1;
let noiseRemoveFloor = parseInt(noiseRemoveFloorEl.value);
let penPhase=parseInt(penPhaseEl.value)/10000;
let currentTool = "fill";
let currentShape = "note";
let currentPanel = "0";
let bpm = 120, npo = 12, anpo = 12, aStartOnP = 440, startOnP = 440;
let noiseFloor = document.getElementById("noiseFloorCutoff").value;
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
let syncChannels = false;
let uploads = [], images = []; startCh = 0;
let draggingSample = [], dragInsert = false;
let showToolSettings = true;
let showEffectSettings = true;
let harmonics = Array(100).fill(0); harmonics[0]=1;
let stamps = [
  {name:"Circle Fill",dataUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMYAAADIAQMAAACJXwxuAAAABlBMVEVHcEz///+flKJDAAAAAXRSTlMAQObYZgAAAaZJREFUWMPt2E2OgzAMhmGiLrLsETgKR0uO1qNwBJYsEJ5Ff0ISvx7JQq06GraPBHaYKfY3DOW6yKBfo4jMGgQRkV2TSURElh4ucr96uT7k1kl6yEo36283vmSGm3W3Cy9oW4pFJMNj2gelg9QPOoBsejdtR7GSDAXUJUyVLFBaVVyo4HgKdWnH4mIjuXuf0r3XqZEFSjsW10A5udDKTkWXsmMnGYouZY+dzNBOaSh1skI7pSGU0MtOjT5bjYpkaPTZKsuoyAxH8DyEpMj6iyhwP4SgyW6Ldjj344mqZFOuqtxMGVWZTZlUWUxJqqymqCCbT4Iuu0/0FydiSQTJLrmC3FwygsxvkwlkeZskkPVLBUC2f/la+Wt/o5//r//8L9+5v+TnfmU837lzv7TnTgGuOcQz73jmKs/85pkTeer0zLA8Ebvma57WecL37Au8ffDGwluOZ2cyNjDe2njT4+2QN0reQnlz5W3X2JB5q+ZNnLd33vg5JeBkwUgjOMHg1IOTEk5XjESGUxxOfjgt4oTJSKU4yeL0y0jMOGXjZM5I8zgBbFPDH++dG9YL0B0cAAAAAElFTkSuQmCC"},
  {name:"Curve Triangle Fill",dataUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMUAAADFAQMAAADe9qSzAAAABlBMVEVHcEz///+flKJDAAAAAXRSTlMAQObYZgAAARlJREFUWMOd0KEVA1AMQtGOntEySkaIjOB8Kmr7DNhrgE99KB3IBLKBHIoCeYE4ETzbHcgEsoHg2VYgLxCzVCAdyKBsIBeIUF4gZqlAOpBB2UAuEKG8QMxSgTTKBLKBHIoCeShOpFA6kEHZQA5FgTwUJ1IoHcigbCCHIpQXiFkqkEYZlA3kUBTIQzFLBdIog7IoF4hQHopZCqUDGZRFORShPBSzFEqjDMqiHIpQHopZGmVQFuVQHopZCqVRFuVQhGKWQmmURTkUoZilUAZlUYTyUMzSKINyKEIxS6EMyqEIxSyFMiiLIhSzFMqgLIpQzFIog3IoQjFLowzKoTyU31Zjhb+yKEIxS6EMyqE8FBdKoyyKUMzSKItyX2rwhArSbF1kAAAAAElFTkSuQmCC"},
  {name:"Right Triangle Fill",dataUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMYAAADGAQMAAACzVW0eAAAABlBMVEVHcEz///+flKJDAAAAAXRSTlMAQObYZgAAATVJREFUWMN1zzERAEEIALGXjjSkIIGSgjleQbZNtV98KilFacpQlvIoZ+HQceg4dBw6Dh2HjkN3lqAkpShNGcpSHuUsQUlKUZoylKU8ylmCkpSiNGUoS3mUswQlKUVpylCW8ihnCUpSitKUoSzlUc4SlKQUpSlDWcqjnCUoSSlKU4aylEc5S1CSUpSmDGUpj3KWoCSlKE0ZylIe5SxBSUpRmjKUpTzKWYKSlKI0ZShLeZSzBCUpRWnKUJbyKGcJSlKK0pShLOVRzhKUpBSlKUNZyqOcJShJKUpThrKURzlLUJJSlKYMZSmPcpagJKUoTRnKUh7lLEFJSlGaMpSlPMpZgpKUojRlKEt5lLMEJSlFacpQlvIoZwlKUorSlKEs5VHOEpSkFKUpQ1nKo5wlKEkpSlOGsj8YUdR0ew4eKAAAAABJRU5ErkJggg=="},
  {name:"Triangle fill", dataUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMcAAADIAQMAAABmnWdQAAAABlBMVEVHcEz///+flKJDAAAAAXRSTlMAQObYZgAAAWFJREFUWMOd2LENwyAUQMGMntEYhREoUyBeJrgC0j5FFzk2hv/5fvSZLD+WwxKhCEUoQhGKUIQiFKEIRShCEYpQhCIUoQhFKEIRilCEIhShCEUoQhGKUIQiFKEIRShCEYpQhCIUoQhFKEIRilCEIhShCEUoQhGKUIQiFKEIRShCEYpQhCIUoQhFKEIRilCEIhShCEUoQhGKUIQiFKEIRShCEYpQhCIUoQhFKEIRilCEInT/nXn/287DNZj31/o8/Kfz/t45D/fovH8WzsMzN++f7fOwhsz7teo8rInzfu09D2v8vH+XnId31mIZLHyfbpbFMli4P9gsi2WwcL+zWRbLYOH+bbMslsHC/ehmWSyDhfvrzbJYBgvPC5tlsQwWnn82y2IZLDzPbZbFMlh4Pt0si2Ww8Ly9WRbLYOH8YLMslsHCechmWSyDhfOdzbIeJkzf+0nW72Fi9r2fzP0eJoBk/mFg7KJFcNhxAAAAAElFTkSuQmCC"},
  {name:"D Fill",dataUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADHAQMAAABmwI4IAAAABlBMVEVHcEz///+flKJDAAAAAXRSTlMAQObYZgAAAUZJREFUWMPt2DGOAjEMhWGOnqP5KDlCSheWHw27LDB/kafRNCztJ8XDCBw/37Ru8JHIJKlQJJZGOTrwIQeP8SMaKI3ycd5TxLJQxLJQGkUTpVBeXsSrJEqjKFASpVH+HPcuC6VRnl/2QyZKojTKbyFhIWEhYSFhIWGhA1kohdIoj0c4kkBZKInSKGIZKIGyUBKlUBpFLAMlUCbKQkmUQmkUsQyUMGSiLEMSpVDaEDkyDAlDpiHrVMmLpE6V/hfpIvmeN3rub/Sqf9a5/cDpSE7nczqs0cmdG6MMSeMGnIaEcdeP/cmhjQkljUloGhPX2J/s2pgg05hUpzERG5N3GRP+NJKEkVjSSEaBggmsjDw393NjG/mUMy0m5DLyduzn+tzfH7SxpwiSNnYouHdJlEGSuPkZ+7sn3FcFSW7v0or2b0U7u3EEd5GGk+Bzz8sLAAAAAElFTkSuQmCC"},
  {name:"Circle Outline",dataUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMYAAADIAQMAAACJXwxuAAAABlBMVEVHcEz///+flKJDAAAAAXRSTlMAQObYZgAAAkpJREFUWMPtWEFuxCAMBOWQI0/gKTyNPC1PyRNy5BCFlmwCGHuohFZVV+remqG2MWB7Rqnym6KSfzbGuEmA/gbiKSEuIXHnwBRfP46YG1kZ4m8kIGPcnM3IBowxczoD7ZbmgsSFuzmU4Mjf23fM0RPudP1rs5stm20DKGsWGkAoHjd6AltZtNPQKpeBZOCowjxJaHttmYS21ke41H8QA2tl4CD52KvQAgk0iKuIBU1vjClhTzRVc4lnpiesy0JDj0QV47Y5Rp/T65qjtzlU31xmk220F2nOftu7PD2Ibq9l/jA1QRcjM3sz/nZs2ON0d7CGPRl7I5a9zWeta7aTPO+3P/5oww8ILyn6tUPNNvos1rw4KH/WRmkS6hBpEpYL2YQiuIjJedJihML1+mZZch4PGHFRKp1XQTmlOrzn/bZI2r0/hBJ9IVFEjgdmiesiWir4V8A9ROos9kzbFZGYkFVJ/SMlT0aWLrIISPpqALJ2EakdpogtQLYecsptdwxxANmVO8TG/3bEAyQoH0TE/21EvNYqJeAf+VTkM28iflm/9bZxdXlvFRupo7gqj9R43DFG+g/uZrgD4q450oNHen1ncsDTBp5Q8FSDJ6GRuQpPaXiyw9MgniDx1IknVTzd4ol4aL7G0zqe8DErwEwCsw/MWDDLwcyow6YwA8OsDTM9zA4xo8QsFDNXzHY7DBmzaszEMXvHjB+rBFhZ6KgRWMHAqgdWSrC60lFksIqDlR+sFmGFqaNKYSULq18dxQyrbFiZ66h5WAFsVcMv/fpuaO1pe+4AAAAASUVORK5CYII="},
  {name:"Curve Triangle Outline",dataUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMUAAADFAQMAAADe9qSzAAAABlBMVEVHcEz///+flKJDAAAAAXRSTlMAQObYZgAAAjJJREFUWMOd102OrCAUBeA2DByyBJbC0nRpLMUl0HmD58BIp1Tg/h07Tc2sL9Fzj0pRX+sX+qQB2QYkD8gO5RiQc0DKiMCySxqQbUDygMCyyzEg54AULOuApAHZoOQB2QfkgHIOSMGyDkj6s/xHlZZ/qLgX+UbFvUhGlZa8nH+XWLCsQAIUD4r7yAZkhuJAcW8ygeI+cqA1BAso7iMFSYQCirskAfFQQHGXZCAOCijukgOtvVjs4i4pSCIUu7hbEhAPxS7ulgzEQbGLu+VAv1nmGnfJgqUgMV/VS8KLJCDmq3qJWc8v4qx6LjHruc/zIicSq55brHpuCS+SgFj13GKVUGUH4qBY9TwXMEp4xCihyQok6lEfCVCMEppkIEYJjzg96iOTHrWeX28GquhRuyQgUQ1UJaiB6hdeDVRlVgNVcWqgKpMaqF1Y7UeaLDJ2kyhjt+MgYzfxMlyTWYZr4uQGq8kkY/dEiwjXD6MI1yWITrt4Ea7LLMJ1keFIILEFJkcLD0ck8nBERDgiIhwRx3fuNA8PRw8WFoFKZLeVCg9HZWb9UOHheBzaDxMWjkmgEZh42g+TmUZgMtEI4j6SCFwiicAlkAhcaAQujtwi+Zj3CEKWHkEIiSDE9whCSAS1CrQIUnoEKT2ClB5Bims3QsrUIqiFtUVQEurjqKRFUNIiKJnqf0z9W7U8s2qpEbT4p24t7pnV2hjcsxbzs0LZoOxQTiifCwFJUDKUA0rBkqBkKPsPYLC3olvwmGMAAAAASUVORK5CYII="},
  {name:"Right Triangle Outline",dataUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMYAAADGAQMAAACzVW0eAAAABlBMVEVHcEz///+flKJDAAAAAXRSTlMAQObYZgAAAe1JREFUWMN92MtNw0AYAOHJKIfccAkpxaWFzqAT6ABuIPHMkzx28HWkX/rsjeNdNtT1kOUpy0uWtywfWb6yfFeQTZY5yzrLlGWVZZnFLIssBfotc5Z1linLKssyi1kWWQK0LXOWdZYpyyrKW4D8XYpG+QqQ26W4ySc3R3kYg9z+tqYoL2OQFEgKJAWSAu2f3BxlDJICSYGkQFIgKZAUaDdnCJICSYGkQFIgKZAUSAq0HzMCSYGkQFIgKZAUSAokBTpMGYCkQFIgKZAUSAokBZICHYfcgqRAUiApkBRICiQFkgKdZtyApEBSICmQFEgKJAWSAv2NuAZJgaRAUiApkBRICiQFOptwBZICSYGkQFIgKZAUSAp0PuASJAWSAkmBpEBSICmQFOjihlyApEBSICmQFEgKJAWSAl2u2HOQFEgKJAWSAkmBpEBSoKtXyhlICiQFkgJJgaRAUiAp0PU7/w8kBZICSYGkQFIgKZAU6OZP+QSSAkmBpEBSICmQFEgKdPvVdARJgaRAUiApkBRICiQFGnzWHkBSICmQFEgKJAWSAkmBRvuOPUgKJAWSAkmBpEBSICnQcGO4A0mBpEBSICmQFEgKJAUa79y3oCV3w/OidZ7HTFlWWZb/nO5UWbCok6z7LI9ZnrO8ZnnP8vkDgua0+S3BfwkAAAAASUVORK5CYII="},
  {name:"Triangle outline", dataUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMcAAADIAQMAAABmnWdQAAAABlBMVEVHcEz///+flKJDAAAAAXRSTlMAQObYZgAAAjlJREFUWMOd2M2N2zAQhuE1cvAxJaiUlGaXplJSAoFc9iDsRBb/hjPfe7D3+mLx2DI5Avn1/KK/v1i+sfxgMYQMIUPIEDKEDCFDyBAyhAwhQ8gQMoQMIUPIELJ/BFkhyMofgKz8BsjKL4Cs0KM7C0BnAegsAJ0FoFfR0Kto6FU09CoauoqEriKhq0joKhKqRUG1KKgWBdWioFYE1IqAWhFQKwLqJUO9ZKiXDPWSoVESNEqCRknQKAmaJUKzRGiWCM0SIVcC5EqAXAmQKwHyZYV8WSFfVsiXFVrKAi1lgZayQEtZoLV4aC0eWouH1uKhUBwUioNCcVAoDoplQrFMKJYJxTKhVAaUyoBSGVAqA8qlQ7l0KJcO5dIhURokSoNEaZAoDVKlQqpUSJUKqVIhWS5Ilgt683/Q4c/G34efAT43ftb8+/BviuuA1w6vtw3X6IPW9Q33wh33z4Z77kH79IZ7+47zYMMZ8qC5c8NZdcf5tuFMfNAcveHsveO83nDGP+i9cMN3yR3fPxu+s06myPJidllOxvT79GQOXRbGl5XxZWV8WRlfVsaVwLgSGFcC40pgZonMLJGZJTKzRGaUxIySmFESM0pieslML5npJTO9ZKYVwbQimFYE04pgalFMLYqpRTG1KOYqkrmKZK4imatIpp8odzyF4sn1wNNuwRPyjqdqPIkfeHoveOLf8ZYAbxYOLAXLjgXvQw4sBcuOBe93Dizlgxum5/s3Wd8f3Jg937+Z+/7gBhCZ/4LavcNONrrmAAAAAElFTkSuQmCC"},
  {name:"D Outline",dataUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADHAQMAAABmwI4IAAAABlBMVEVHcEz///+flKJDAAAAAXRSTlMAQObYZgAAAjVJREFUWMPd2EGupSAQQFEIA4YsgaWwNFyaS3EJDh0YqweKgtT9ieSnk+43PRHqIUJVGVkN/ETIRER2FBGWA0Ub8BIljCIyoRwo3XiPCMuK8npIVhP0h2Q1xqnhyWqMsRctnZSn9l6M7xeiTBtFRGRTxHQx3HKONyti0mu4R9xruOqPp3a4Smy7QvVipWa4WlzzZ5sFzvXaNRLquNuXUk/USqomasVXE71f8TPRS+Iz0Uv8M5GyyxZd0r10bwn3PnmLu0PQPoFJl1jeXie+hNCJK6vQf7olhF7S9SH1Eq7genFXcL3YKzjl8MhncIqkc+UUCWfYivgzbEXsGbZ2ip5ha5JlAYmyggTZQLzsIE4OECsCYrJMKDNIQomygARZQTyKkw3Eyg5i5CDJLEKSUKJMnyXIDOJ/kAXE/SAriB0QI9t3ySOyk6QROb5L/M8kyN+Rf3N1RnbIyE7kfT3ylQx8jfZXzwM3cCL5gZMvDJywaeAk53uB7xK8f/hm4tuMb8CA9ynftHw7810vJJw5cLbBGQpnNZwJcfaEGRdnaQ4zO84GI2aQnHVipuqu7L8XjxlxxCw6Y+ZdCgYtj4cMP5TCpJOElcRdKSt1yY61zKZLpsrIPuWmUmdhbbZ/rOe4BoxYN2Kt6bE+TVTTuqbxUEtsGgW1YL0dqUa3WNdH6gVY7B9k6jlgn+Jqe8zUDzm6foijHkpWmzV1F2dDmUg27AlN33tP2K+aSbbPvbSd+m879ewmDf4AU+0LXkH1rLMAAAAASUVORK5CYII="},
  {name:"Semicircle Fill",dataUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMYAAADIAQMAAACJXwxuAAAABlBMVEVHcEz///+flKJDAAAAAXRSTlMAQObYZgAAAWFJREFUWMPt0z1uxCAQBeC1XLjkCBzF19oOjsZROAIlBWKSdbwJP/OMFhHLiZb2K5j3GG635Nxv/JmIAi+CiDQrn0Ceg+UhxIncxDCiNnHsZI8T0DXcRXKX+qJ1FwcGYBLtAzAjzE8hrrSvo8FoRBaMVg+nvsUzT8AON/1IREOXYy+JaBCn7FQmYkGcMpBKxIM4RaAplYji5IFy0SBoLiITA4LmUddMHBQPKsglg6yEXCIoJ5O8grSeUjQoJxVRiIFiQW2prIU4KB7UdiQB1HYkERSaFIdlrkQ3ZanENEVUYpsiK3FNWSvxTVEvSACPcCSxJfXzPB8Iy8yI7paFEdMQwYjtFsmI65aVEd8QRehRR0kEa9AnhBakX2ZW9FAxYKn6xIKlGi0OrNto8WBFR0sAK/obwsK22GcIoYW/gmjwSc4TAz7WNUQAsZcW+bK4C8g6UPwfFXVZCacJveUt/08+AGH8Xip4Ut8dAAAAAElFTkSuQmCC"},
  {name:"Semicircle Outline",dataUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMYAAADIAQMAAACJXwxuAAAABlBMVEVHcEz///+flKJDAAAAAXRSTlMAQObYZgAAAh9JREFUWMPtl0GOhCAQRTUuXHIEj+K1Zqe7uRZH4QgsXRAYGxGh6heJnUnHScZNd/voqv+LArTriuurw1cfgsNEhRBWSHYQNgTGFwmITJFoQJZILFT2upyUBiWaEuGJ5kSsIAA4igK+kYQhlkYBCeqIA0o3Har2D8OlJVeWSXOp4BubApv+65honZR4Jno9y0fr6cmQy47LCTWxY7NIQ+wYNuYcqXPcjdhZsxZH7Fz6fW3Hg0EHcSDwEXwrxKyVUVMY0JVRA7/X41RldS5ij5XVJZQ6S1K666si1D/kYV4KXSeVhZrK9gqL8/ql4fd63EQKb2DOWs9MprGYLF83hUTKWpGVUZK6+RaPAteCetLKc8AFLY0PZGFMRZMbssx0JposTQ1LXcZQZNEOxQKkW4AVyOVv9pRsArnquMiE7p35RpAJ3exyYpH0bOs8DcpkYBvxOUGcqEy0QEZGzjsyUeyQODO3CD+mDJzSy3uDeH64WzzZufoyWfhZnW7dInMi/BEjpQ4y4cf7JJOAG6RFVChLzskAySqQMRF9i2jYVBfhD21DgxjYbi3SJ9LdIhY24jkzoBHfJBtu0RaJnTa7e8Th5m2RGGjZ7hP4tB2tQBILgx6p3yMBL4VjolvEfICscGEdzT7AF47fJhouxpOgN6jhg0RB8qqmCt1jySQTj19J7QPILBN3k+x7wd8kcBN7Atklf4rALfGfPIcI1z9pkh/dvcGuqu36HgAAAABJRU5ErkJggg=="},
  {name:"Down Curve",dataUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMoAAADIAQMAAACTY+zgAAAABlBMVEVHcEz///+flKJDAAAAAXRSTlMAQObYZgAAAWlJREFUWMPNl7GNxDAMBC0oUKgS1MZnKo0uzaW4hAsvMLwffDx8YCEYdjowudwl7+BtbPjMA1GciOShzzvQl0d+Cbo4ryfRjWg8iYSor0c7obYeHQaqJjoNVEz04MXq/bd3rz4wLT+VffU9LN/s5ev7sdZ3+SJe1iLeq7fNXClvbw4LnauX48ENkBVzeDHLiznJ8jCQG9jHCsyyXp718qzfGS32t7FT1TKxZCayUyEHTcupwXZ0nrnxzJVnLhliO5TZsbMd3sxfnvnimW9G4plZvVh9cCyT1XdW31hiZYklkSiWGCxxsoudJTbWUcVBi3UEWzVZx2Adjf2oiQ6xH8G5DB66cbOaNBM3C242uFkT2ljENoptnMLMOsuvYvniipMrdq5Yk4rBFQdP3YShFbGPk4V0oZAiYaAhDLQL9Rfxa8GvdaHIv4oXTg3ZNAmdDBb5r5ADAwWUpTYYZTcz0l/p5FsD/3K3n+0XmHjB7STZ3kAAAAAASUVORK5CYII="},
  {name:"Up Curve",dataUrl:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMoAAADIAQMAAACTY+zgAAAABlBMVEVHcEz///+flKJDAAAAAXRSTlMAQObYZgAAAXZJREFUWMPNljuOhDAQBbvlwKHTzXwUH80cjaPMEQgJEL3BpFRL+2StIC1h3g9mrO9G17gRzTgIRUSCDkaRoIPRzSg+ID4irmfLERGxPaEaLGSykBIRETs/7XxEHpxIZ2uFT/w+zfi23dAbnNg4fsccv0Ke5VvFZtKJdJZf8tFdyYnGGve/L3xgjNYwRnOO0SbGaJ11VDbtybs7WUdnHZV1OOuwiXnYYB2Neyks0bkXmyyxs8TGEgtLdJaYfW4Hq++svrL6whtwVm+T1Q9GnY01NlbZWGFjzsZsYmM22HNnY000drKxi43xD7XqeWPPOxtT4qiMCsfhHIdlKPtLY1IcWlI7x/GRkjo4qdUhzltBg/PtGdqEELV8S4aSfJXoLUNJ9FIr419b2aRWXlLYIRV2SoVdUmES6lLNTaq5ZkhZQJEW4BnSFvCScazeTV+/m/dPSkPa2t4/RA0tn++1er6rR9/WI230y9HyV2UxcgkZW7aJxH7sF9mSvV2IZpJkAAAAAElFTkSuQmCC"},
];
let currentStamp = stamps[0];
let autoTuneStrength = 1;
let clonerX = null, clonerY = null, clonerCh = 0, changingClonerPos = true, rcY = 0, rsY = 0, clonerScale = 1;
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
    el.addEventListener("mousemove", e=> {currentChannel = parseInt(el.id.match(/(\d+)$/)[1], 10);el.title = "Log scale: " + logScaleVal[currentChannel];});
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
function sanitizeFilename(name) {return (name || "unnamed").replace(/[^a-z0-9\-_\.]/gi, "_");}
function serializeSprites(sprites) {
  if (!Array.isArray(sprites)) return null;
  return sprites.map(sprite => {
    // shallow-copy primitive/enumerable props
    const copy = {};
    for (const k in sprite) {
      if (k === 'pixels') continue; // handle below
      // skip functions / DOM nodes if any
      const v = sprite[k];
      if (typeof v !== 'function') copy[k] = v;
    }

    // pixels: array where each element is either null or a Map
    copy.pixels = (sprite.pixels || []).map(chMap => {
      if (!chMap || !(chMap instanceof Map)) return null;
      const pairs = [];
      for (const [col, cell] of chMap.entries()) {
        // convert typed arrays to plain arrays
        const cellCopy = {};
        for (const ck in cell) {
          const cv = cell[ck];
          if (cv instanceof Float32Array || cv instanceof ArrayBuffer || ArrayBuffer.isView(cv)) {
            cellCopy[ck] = Array.from(cv);
          } else if (Array.isArray(cv)) {
            cellCopy[ck] = cv.slice();
          } else if (cv !== undefined && typeof cv !== 'function') {
            cellCopy[ck] = cv;
          }
        }
        pairs.push([Number(col), cellCopy]);
      }
      return pairs;
    });

    return copy;
  });
}

function deserializeSprites(serialized) {
  if (!Array.isArray(serialized)) return [];
  return serialized.map(s => {
    const sprite = {};
    // copy primitive props back
    for (const k in s) {
      if (k === 'pixels') continue;
      sprite[k] = s[k];
    }

    // rebuild pixels: array of Maps
    sprite.pixels = (s.pixels || []).map(chArr => {
      if (!Array.isArray(chArr)) return new Map();
      const m = new Map();
      for (const [col, cell] of chArr) {
        const reconstructed = {};
        for (const ck in cell) {
          const cv = cell[ck];
          // treat numerical arrays as Float32Array for mags/phases/prev*
          if (Array.isArray(cv) && cv.length > 0 && (ck.toLowerCase().includes('mag') || ck.toLowerCase().includes('phase') || ck.toLowerCase().startsWith('prev'))) {
            reconstructed[ck] = new Float32Array(cv);
          } else if (Array.isArray(cv)) {
            reconstructed[ck] = cv.slice();
          } else {
            reconstructed[ck] = cv;
          }
        }
        m.set(Number(col), reconstructed);
      }
      return m;
    });

    // ensure default arrays exist as in original
    if (!Array.isArray(sprite.spriteFade)) sprite.spriteFade = [];
    if (!Array.isArray(sprite.prevSpriteFade)) sprite.prevSpriteFade = [];

    return sprite;
  });
}