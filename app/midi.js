let BasicPitchPkg = null;
let bpInstance = null;
let tf = null;
let bpInstancePromise = null;   
let tfReadyPromise = null;
const gpbl = document.getElementById('globalProgressBar');
const gpfl = document.getElementById('globalProgressFill');
const gpt = document.getElementById('gpt');
const mInfo = document.getElementById("mouseInfo");
function setGlobalProgress(pct) {
  if (pct == null || typeof pct !== 'number') return;
  if (pct >= 0 && pct <= 1) pct = pct * 100;
  pct = Math.max(0, Math.min(100, Math.round(pct)));
  try {
    if (gpfl) {gpfl.style.width = pct + '%';gpbl.style.display = "block";} else {mInfo.innerHTML = `Processing: ${pct}%<br><br>`}
  } catch (e) {  }
}
const DEFAULT_MODEL_URL = 'https://cdn.jsdelivr.net/gh/BRABcraft/SpectroDraw@main/node_modules/@spotify/basic-pitch/model/model.json';
const DEFAULT_IDB_KEY = 'basicpitch-v1';
function createWorkerFromText(workerText) {
  const blob = new Blob([workerText], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  const w = new Worker(url);
  w._blobUrl = url;
  const origTerminate = w.terminate.bind(w);
  w.terminate = function() {
    try { URL.revokeObjectURL(url); } catch (e) {}
    origTerminate();
  };
  return w;
}
const BASICPITCH_PRELOAD_WORKER_SRC = `
${(() => {}).toString()}`;
const worker = createWorkerFromText(BASICPITCH_PRELOAD_WORKER_SRC);
worker.postMessage({ 
  type: 'init', 
  BasicPitchPkgImport: 'https://esm.sh/@spotify/basic-pitch' 
});
worker.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'ready') {
    console.log('BasicPitch worker ready');
  }
  if (msg.type === 'notes') {
    console.log('Received notes from worker', msg.notes);
  }
  if (msg.type === 'error') {
    console.error('BasicPitch worker error:', msg.detail);
  }
};
function analyzePCM(pcmFloat32, sampleRate, hop = 512) {
  worker.postMessage({ 
    type: 'processAudio', 
    pcmFloat32, 
    sampleRate, 
    hopSamples: hop 
  });
}
async function preloadBasicPitchModelInWorker(modelUrl = DEFAULT_MODEL_URL, idbKey = DEFAULT_IDB_KEY, opts = {}) {
  return new Promise((resolve, reject) => {
    let worker;
    if (opts.workerUrl) {
      worker = new Worker(opts.workerUrl);
    } else {
      if (opts.workerFetchUrl) {
        fetch(opts.workerFetchUrl).then(r => r.text()).then(text => {
          worker = createWorkerFromText(text);
          start(worker);
        }).catch(err => reject(err));
        return;
      } else {
        const workerCode = `
self.addEventListener('message', async (ev) => {
  const msg = ev.data || {};
  if (msg && msg.type === 'preload') {
    const modelUrl = msg.modelUrl;
    const idbKey = msg.idbKey || 'basicpitch-v1';
    if (!modelUrl) { self.postMessage({ type: 'status', status: 'error', detail: 'no modelUrl supplied' }); return; }
    try {
      if (typeof self.tf === 'undefined') {
        try { importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js'); } catch (e) { self.postMessage({ type: 'status', status: 'error', detail: 'importScripts(tfjs) failed: ' + String(e) }); return; }
      }
      if (typeof self.tf === 'undefined') { self.postMessage({ type: 'status', status: 'error', detail: 'tf not available after importScripts' }); return; }
      try {
        const mdl = await self.tf.loadGraphModel('indexeddb://' + idbKey);
        self.postMessage({ type: 'status', status: 'already', detail: 'model already in indexeddb', idbKey });
        if (mdl && typeof mdl.dispose === 'function') mdl.dispose();
        return;
      } catch (eAlready) {}
      self.postMessage({ type: 'status', status: 'loading', detail: 'loading modelUrl ' + modelUrl });
      const graphModel = await self.tf.loadGraphModel(modelUrl);
      try {
        await graphModel.save('indexeddb://' + idbKey);
        self.postMessage({ type: 'status', status: 'saved', detail: 'model saved to indexeddb://' + idbKey, idbKey });
      } catch (saveErr) {
        self.postMessage({ type: 'status', status: 'error', detail: 'save to indexeddb failed: ' + String(saveErr) });
      } finally {
        if (graphModel && typeof graphModel.dispose === 'function') graphModel.dispose();
      }
    } catch (err) {
      self.postMessage({ type: 'status', status: 'error', detail: String(err && err.message ? err.message : err) });
    }
  }
});`;
        worker = createWorkerFromText(workerCode);
      }
    }
    function start(w) {
      const timeout = setTimeout(() => {
      }, opts.timeout || 60_000);
      const cleanup = (res, err) => {
        try { w.removeEventListener('message', onMsg); } catch (e) {}
        try { w.terminate(); } catch (e) {}
        clearTimeout(timeout);
        if (err) reject(err); else resolve(res);
      };
      function onMsg(e) {
        const data = e.data || {};
        if (data && data.type === 'status') {
          if (data.status === 'already') {
            cleanup({ status: 'already', idbKey, detail: data.detail }, null);
          } else if (data.status === 'saved') {
            cleanup({ status: 'saved', idbKey, detail: data.detail }, null);
          } else if (data.status === 'error') {
            cleanup(null, new Error(data.detail || 'worker error'));
          } else if (data.status === 'loading') {
            console.log('worker:', data.detail || 'loading');
          }
        }
      }
      w.addEventListener('message', onMsg);
      w.postMessage({ type: 'preload', modelUrl, idbKey });
    }
    if (worker && typeof worker.postMessage === 'function') start(worker);
  });
}
async function isModelInIndexedDB(idbKey = DEFAULT_IDB_KEY) {
  if (typeof window === 'undefined') return false;
  if (typeof window.tf === 'undefined') {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js';
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load main-thread tfjs'));
      document.head.appendChild(s);
    }).catch(() => { return false; });
    if (typeof window.tf === 'undefined') return false;
  }
  try {
    const mdl = await window.tf.loadGraphModel('indexeddb://' + idbKey);
    if (mdl && typeof mdl.dispose === 'function') mdl.dispose();
    return true;
  } catch (e) {
    return false;
  }
}
async function yieldToUI(frames = 1) {
  for (let i = 0; i < frames; i++) {
    await new Promise(r => requestAnimationFrame(r));
  }
}
const dbToMag = db => Math.pow(10, db / 20);
const complexMag = (re, im) => Math.hypot(re || 0, im || 0);
function pcmToAudioBuffer(pcmFloat32, sampleRate) {
  const length = pcmFloat32.length;
  if (typeof window === 'undefined') throw new Error('No window available to create AudioBuffer');
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (OfflineCtx) {
    try {
      const ctx = new OfflineCtx(1, length, sampleRate);
      const buffer = ctx.createBuffer(1, length, sampleRate);
      buffer.getChannelData(0).set(pcmFloat32);
      return buffer;
    } catch (err) {
      console.warn('pcmToAudioBuffer: OfflineAudioContext creation failed, falling back to AudioContext:', err && err.message);
    }
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) throw new Error('No AudioContext available');
  const actx = new AC();
  const buffer = actx.createBuffer(1, length, sampleRate);
  buffer.getChannelData(0).set(pcmFloat32);
  return buffer;
}
async function resampleToTargetSampleRate(pcm, srcRate, targetRate) {
  if (!pcm || !(pcm instanceof Float32Array) || pcm.length === 0) {
    return { pcm: new Float32Array(0), sampleRate: targetRate };
  }
  if (!isFinite(srcRate) || !isFinite(targetRate) || srcRate <= 0 || targetRate <= 0) {
    throw new Error('Invalid sample rates for resampling');
  }
  if (Math.round(srcRate) === Math.round(targetRate)) return { pcm, sampleRate: srcRate };
  if (typeof window !== 'undefined') {
    const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (OfflineCtx) {
      try {
        let srcBuffer;
        try {
          srcBuffer = new AudioBuffer({ length: pcm.length, numberOfChannels: 1, sampleRate: srcRate });
        } catch (e) {
          const tmp = new OfflineCtx(1, pcm.length, srcRate);
          srcBuffer = tmp.createBuffer(1, pcm.length, srcRate);
        }
        srcBuffer.getChannelData(0).set(pcm);
        const targetLen = Math.ceil(srcBuffer.duration * targetRate);
        const offline = new OfflineCtx(1, targetLen, targetRate);
        const src = offline.createBufferSource();
        src.buffer = srcBuffer;
        src.connect(offline.destination);
        src.start(0);
        const rendered = await offline.startRendering();
        const out = new Float32Array(rendered.length);
        out.set(rendered.getChannelData(0));
        return { pcm: out, sampleRate: targetRate };
      } catch (err) {
        console.warn('resampleToTargetSampleRate: OfflineAudioContext resample failed, falling back to linear resampler:', err && err.message);
      }
    }
  }
  async function linearResampleChunked(input, inRate, outRate, chunkSize = 64 * 1024) {
    const ratio = inRate / outRate;
    const outLen = Math.max(1, Math.round(input.length / ratio));
    const out = new Float32Array(outLen);
    const chunkCount = Math.ceil(outLen / chunkSize);
    for (let chunk = 0; chunk < chunkCount; chunk++) {
      const start = chunk * chunkSize;
      const end = Math.min(outLen, start + chunkSize);
      for (let i = start; i < end; i++) {
        const idx = i * ratio;
        const i0 = Math.floor(idx);
        const i1 = Math.min(input.length - 1, i0 + 1);
        const frac = idx - i0;
        out[i] = input[i0] * (1 - frac) + input[i1] * frac;
      }
      await yieldToUI();
    }
    return out;
  }
  try {
    const out = await linearResampleChunked(pcm, srcRate, targetRate);
    return { pcm: out, sampleRate: targetRate };
  } catch (err) {
    console.warn('resampleToTargetSampleRate: linear resampling failed:', err && err.message);
    return { pcm: new Float32Array(0), sampleRate: targetRate };
  }
}
async function ensureTF() {
  if (tf) return tf;
  if (tfReadyPromise) return tfReadyPromise;
  tfReadyPromise = (async () => {
    const TF_KERNEL_ALREADY_REGISTERED_RE = /The kernel .* for backend .* is already registered/i;
    const origWarn = console.warn;
    console.warn = (...args) => {
      try {
        const first = args.length ? (typeof args[0] === 'string' ? args[0] : String(args[0])) : '';
        if (TF_KERNEL_ALREADY_REGISTERED_RE.test(first)) return;
      } catch (e) {}
      return origWarn.apply(console, args);
    };
    if (BasicPitchPkg && BasicPitchPkg.tf) {
      if (typeof window !== 'undefined') window.tf = BasicPitchPkg.tf;
      tf = BasicPitchPkg.tf;
      console.log('ensureTF: detected tf exposed on BasicPitchPkg');
      console.warn = origWarn;
      return tf;
    }
    if (typeof window !== 'undefined' && window.tf) {
      tf = window.tf;
      console.log('ensureTF: tf already present on window');
      console.warn = origWarn;
      return tf;
    }
    await yieldToUI();
    const CDN = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js';
    const timeoutMs = 5000;
    const pollInterval = 100;
    if (typeof window !== 'undefined') {
      if (!window.__TFJS_INJECTED_ONCE__) window.__TFJS_INJECTED_ONCE__ = false;
    }
    const alreadyScript = typeof document !== 'undefined' && Array.from(document.scripts).some(s =>
      !!(s.src && (s.src.includes('tensorflow') || s.src.includes('tfjs')))
    );
    if (!alreadyScript && !(typeof window !== 'undefined' && window.__TFJS_INJECTED_ONCE__)) {
      if (typeof window !== 'undefined') window.__TFJS_INJECTED_ONCE__ = true;
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = CDN;
        s.async = true;
        s.crossOrigin = 'anonymous';
        s.onload = resolve;
        s.onerror = () => reject(new Error('Failed to load tfjs from CDN: ' + CDN));
        document.head.appendChild(s);
      }).catch(e => console.warn('ensureTF: failed to append tf script:', e && e.message));
    } else {
      console.log('ensureTF: tf script present or flagged; waiting for global tf');
    }
    const start = performance.now();
    await new Promise((resolve, reject) => {
      (function poll() {
        if (typeof window !== 'undefined' && window.tf) { tf = window.tf; return resolve(); }
        if ((performance.now() - start) > timeoutMs) return reject(new Error('tfjs did not appear within timeout (' + timeoutMs + 'ms).'));
        setTimeout(poll, pollInterval);
      })();
    }).catch(e => { console.warn('ensureTF: poll failed:', e && e.message); });
    await yieldToUI();
    if (typeof window !== 'undefined' && window.tf) {
      tf = window.tf;
      if (typeof tf.ready === 'function') await tf.ready().catch(()=>{});
    }
    console.warn = origWarn;
    console.log('ensureTF: tf assigned and ready (if supported)');
    return tf;
  })();
  return tfReadyPromise;
}
async function runBasicPitchAndReturnNotes({ pcmFloat32, sampleRate, hopSamples }, progressCb = () => {}) {
  if (!BasicPitchPkg) throw new Error('BasicPitch package not found');
  const inspect = obj => (obj && typeof obj === 'object') ? Object.keys(obj).slice(0,20) : typeof obj;
  const BProot = BasicPitchPkg && BasicPitchPkg.default ? BasicPitchPkg.default : BasicPitchPkg;
  console.log('BasicPitchPkg summary:', inspect(BasicPitchPkg));
  console.log('Resolved BP root summary:', inspect(BProot));
  let BasicPitchClass = null;
  if (BProot && typeof BProot === 'object' && typeof BProot.BasicPitch === 'function') {
    BasicPitchClass = BProot.BasicPitch;
  } else if (typeof BProot === 'function') {
    BasicPitchClass = BProot;
  }
  if (!pcmFloat32 || !(pcmFloat32 instanceof Float32Array) || pcmFloat32.length === 0) {
    console.warn('BasicPitch runner: pcmFloat32 invalid/empty; returning []');
    setGlobalProgress(0);
    return [];
  }
  if (!sampleRate || !isFinite(sampleRate)) {
    console.warn('BasicPitch runner: invalid sampleRate', sampleRate);
    setGlobalProgress(0);
    return [];
  }
  const hop = hopSamples || 512;
  await ensureTF();
  if (typeof window !== 'undefined' && window.tf) {
    tf = window.tf;
    if (typeof tf.ready === 'function') await tf.ready().catch(()=>{});
  }
  const tfRef = tf || (typeof window !== 'undefined' ? window.tf : null);
  if (!bpInstance) {
    if (bpInstancePromise) {
      bpInstance = await bpInstancePromise;
    } else {
      bpInstancePromise = (async () => {
        const MODEL_JSON_URL = 'https://cdn.jsdelivr.net/gh/BRABcraft/SpectroDraw@main/node_modules/@spotify/basic-pitch/model/model.json';
        const tryCreateWithUrl = async (cls, url) => {
          if (!cls || typeof cls.create !== 'function') return null;
          console.log('BasicPitch: attempting class.create({ modelUrl }) ...');
          try {
            return await cls.create({ modelUrl: url });
          } catch (e) {
            console.warn('BasicPitch: create({modelUrl}) failed:', e && e.message);
            return null;
          }
        };
        if (BasicPitchClass) {
          await yieldToUI(); 
          bpInstance = await tryCreateWithUrl(BasicPitchClass, MODEL_JSON_URL);
        }
        if (!bpInstance) {
          if (!tfRef) throw new Error('tfjs not available; cannot load TF model');
          await yieldToUI();
          let loadedModel;
          try {
            loadedModel = await tfRef.loadGraphModel('indexeddb://basicpitch-v1');
            console.log('Loaded BasicPitch model from IndexedDB');
          } catch (err) {
            console.warn('Failed to load model from IndexedDB, loading from network...', err);
            loadedModel = await tfRef.loadGraphModel(MODEL_JSON_URL);
            try { await loadedModel.save('indexeddb://basicpitch-v1'); } catch(e){console.warn('Saving model to IndexedDB failed', e);}
          }
          if (BasicPitchClass && typeof BasicPitchClass === 'function') {
            try {
              bpInstance = new BasicPitchClass(loadedModel);
            } catch(e) {
              console.warn('BasicPitchClass creation failed', e);
              if (typeof BProot === 'function') bpInstance = BProot(loadedModel);
            }
          }
        }
        if (!bpInstance && BProot) bpInstance = BProot;
        if (!bpInstance) throw new Error('Failed to produce a BasicPitch instance');
        return bpInstance;
      })();
      try {
        bpInstance = await bpInstancePromise;
      } finally {
        bpInstancePromise = null;
      }
    }
  }
  async function initializeIfNeeded(instance) {
    if (!instance) return;
    if (instance.model) return;
    const initNames = ['create', 'load', 'init', 'prepare', 'initialize', 'setup'];
    for (const name of initNames) {
      if (typeof instance[name] === 'function') {
        console.log(`BasicPitch: attempting instance.${name}() to initialize model...`);
        const res = instance[name]();
        const awaited = res instanceof Promise ? await res : res;
        if (awaited && awaited !== instance && typeof awaited === 'object') {
          bpInstance = awaited;
          instance = bpInstance;
          console.log('BasicPitch: instance init returned new instance; replaced bpInstance');
        }
        return;
      }
    }
  }
  await initializeIfNeeded(bpInstance);
  const BP_REQUIRED_SR = 22050;
  if (Math.round(sampleRate) !== BP_REQUIRED_SR) {
    console.log(`Resampling from ${sampleRate} -> ${BP_REQUIRED_SR}...`);
    const res = await resampleToTargetSampleRate(pcmFloat32, sampleRate, BP_REQUIRED_SR);
    pcmFloat32 = res.pcm;
    sampleRate = res.sampleRate;
    console.log('Resampling done, new length:', pcmFloat32.length, 'new sampleRate:', sampleRate);
  }
  let audioBuffer;
  try {
    audioBuffer = pcmToAudioBuffer(pcmFloat32, sampleRate);
    console.log('BasicPitch runner: created AudioBuffer length', audioBuffer && audioBuffer.length);
  } catch (err) {
    console.warn('BasicPitch runner: pcmToAudioBuffer failed:', err && err.message);
    setGlobalProgress(0);
    return [];
  }
  const frames = [], onsets = [], contours = [];
  let rawResult = null;
  const callModel = async () => {
    if (bpInstance && typeof bpInstance.evaluateModel === 'function') {
      await bpInstance.evaluateModel(audioBuffer,
        (fChunk, oChunk, cChunk) => {
          if (Array.isArray(fChunk)) frames.push(...fChunk);
          if (Array.isArray(oChunk)) onsets.push(...oChunk);
          if (Array.isArray(cChunk)) contours.push(...cChunk);
          try { progressCb(0.5); } catch (e) {}
        },
        (rawProgress) => {
          try {
            let pct = null;
            if (typeof rawProgress === 'number') pct = rawProgress;
            else if (rawProgress && typeof rawProgress.progress === 'number') pct = rawProgress.progress;
            else if (rawProgress && typeof rawProgress.processed === 'number' && typeof rawProgress.total === 'number' && rawProgress.total > 0) pct = rawProgress.processed / rawProgress.total;
            if (pct != null && isFinite(pct)) progressCb(Math.max(0, Math.min(1, pct)) * 100);
          } catch (e) {  }
        }
      );
      rawResult = { frames, onsets, contours };
      return;
    }
    if (bpInstance && typeof bpInstance.transcribe === 'function') {
      try { progressCb(5); } catch (e) {}
      rawResult = await bpInstance.transcribe(audioBuffer);
      try { progressCb(90); } catch (e) {}
      return;
    }
    if (bpInstance && typeof bpInstance.predict === 'function') {
      try { progressCb(5); } catch (e) {}
      rawResult = await bpInstance.predict(audioBuffer);
      try { progressCb(90); } catch (e) {}
      return;
    }
    if (typeof BProot === 'function') {
      try { progressCb(5); } catch (e) {}
      rawResult = await BProot(audioBuffer).catch(e => {
        console.warn('BasicPitch: BProot(audioBuffer) threw', e && e.message);
        return null;
      });
      try { progressCb(90); } catch (e) {}
      return;
    }
    console.log('BasicPitch: no model API found on bpInstance; keys:', inspect(bpInstance));
  };
  try {
    await callModel();
  } catch (err) {
    console.warn('BasicPitch runner: model call threw:', err && err.message);
    await initializeIfNeeded(bpInstance);
    try { await callModel(); } catch (err2) { console.warn('BasicPitch runner: retry after initialization failed:', err2 && err2.message); }
  }
  if (rawResult && Array.isArray(rawResult.notes) && rawResult.notes.length) {
    try { progressCb(100); } catch(e){}
    return rawResult.notes.map(normalizeNoteFromModel);
  }
  const framesFromRaw = rawResult && rawResult.frames ? rawResult.frames : frames;
  const onsetsFromRaw = rawResult && rawResult.onsets ? rawResult.onsets : onsets;
  const contoursFromRaw = rawResult && rawResult.contours ? rawResult.contours : contours;
  const helpers = BasicPitchPkg || {};
  const outToNotes =
    (helpers && (helpers.outputToNotesPoly || helpers.output_to_notes_poly)) ||
    (bpInstance && bpInstance.outputToNotesPoly) ||
    null;
  const addBends =
    (helpers && (helpers.addPitchBendsToNoteEvents || helpers.add_pitch_bends_to_note_events)) ||
    (bpInstance && bpInstance.addPitchBendsToNoteEvents) ||
    null;
  const framesToTime =
    (helpers && (helpers.noteFramesToTime || helpers.note_frames_to_time)) ||
    (bpInstance && bpInstance.noteFramesToTime) ||
    null;
  if (outToNotes && framesFromRaw && framesFromRaw.length) {
    try {
      try { progressCb(92); } catch(e){}
      let polyNotes = outToNotes(framesFromRaw, onsetsFromRaw || [], 0.5, 0.3, 5);
      if (addBends && contoursFromRaw) {
        try { polyNotes = addBends(contoursFromRaw, polyNotes); } catch (e) { console.warn('BasicPitch: addPitchBendsToNoteEvents failed:', e && e.message); }
      }
      let timedNotes;
      if (framesToTime) {
        timedNotes = framesToTime(polyNotes);
      } else {
        const FFT_HOP = 256;
        const AUDIO_SAMPLE_RATE = 22050;
        const ANNOTATIONS_FPS = Math.floor(AUDIO_SAMPLE_RATE / FFT_HOP);
        const ANNOT_N_FRAMES = ANNOTATIONS_FPS * 2; 
        const AUDIO_N_SAMPLES = AUDIO_SAMPLE_RATE * 2 - FFT_HOP;
        const WINDOW_OFFSET = (FFT_HOP / AUDIO_SAMPLE_RATE) * (ANNOT_N_FRAMES - AUDIO_N_SAMPLES / FFT_HOP) + 0.0018;
        const modelFrameToTimeFallback = (frame) => (frame * FFT_HOP) / AUDIO_SAMPLE_RATE - WINDOW_OFFSET * Math.floor(frame / ANNOT_N_FRAMES);
        timedNotes = polyNotes.map(n => ({
          pitchMidi: n.pitchMidi,
          amplitude: n.amplitude,
          pitchBends: n.pitchBends,
          startTimeSeconds: modelFrameToTimeFallback(n.startFrame),
          durationSeconds: modelFrameToTimeFallback(n.startFrame + n.durationFrames) - modelFrameToTimeFallback(n.startFrame)
        }));
      }
      const output = timedNotes.map(nt => {
        const velocity = (typeof nt.amplitude === 'number')
          ? Math.max(1, Math.min(127, Math.round(nt.amplitude * 127)))
          : 100;
        return normalizeNoteFromModel({
          midiFloat: nt.pitchMidi,
          freq: null,
          velocity,
          lengthSeconds: nt.durationSeconds,
          startTime: nt.startTimeSeconds,
          velChanges: [{ offsetFrames: 0, vel: velocity }],
          pitchBends: nt.pitchBends
        });
      });
      try { progressCb(100); } catch(e){}
      return output;
    } catch (e) {
      console.warn('BasicPitch helper pipeline failed:', e && e.message);
    }
  }
  try { progressCb(100); } catch(e){}
  return [];
}
function normalizeNoteFromModel(n) {
  const copy = Object.assign({}, n);
  try {
    if (typeof copy.lengthFrames !== 'number') {
      if (typeof copy.lengthSeconds === 'number') {
        copy.lengthFrames = Math.round((copy.lengthSeconds * sampleRate) / hop);
      } else if (typeof copy.endTime === 'number' && typeof copy.startTime === 'number') {
        copy.lengthSeconds = copy.endTime - copy.startTime;
        copy.lengthFrames = Math.round((copy.lengthSeconds * sampleRate) / hop);
      } else {
        copy.lengthFrames = 0;
      }
    }
    if (typeof copy.lengthSeconds !== 'number' && typeof copy.lengthFrames === 'number') {
      copy.lengthSeconds = (copy.lengthFrames * hop) / sampleRate;
    }
    if (!Array.isArray(copy.velChanges)) {
      const vel = typeof copy.velocity === 'number' ? copy.velocity : 100;
      copy.velChanges = [{ offsetFrames: 0, vel }];
    } else {
      copy.velChanges = copy.velChanges.map(vc => {
        const cpy = Object.assign({}, vc);
        if (typeof cpy.offsetFrames !== 'number') {
          if (typeof cpy.offsetSeconds === 'number') {
            cpy.offsetFrames = Math.round((cpy.offsetSeconds * sampleRate) / hop);
          } else cpy.offsetFrames = 0;
        } else {
          cpy.offsetFrames = Math.round(cpy.offsetFrames);
        }
        if (typeof cpy.vel !== 'number') cpy.vel = 100;
        return cpy;
      });
    }
    if (typeof copy.midiFloat !== 'number') {
      if (typeof copy.freq === 'number') {
        copy.midiFloat = 69 + 12 * Math.log2(copy.freq / a4p);
      } else if (typeof copy.midi === 'number') {
        copy.midiFloat = copy.midi;
      } else if (typeof copy.midiRounded === 'number') {
        copy.midiFloat = copy.midiRounded;
      } else {
        copy.midiFloat = 60;
      }
    }
    if (typeof copy.startTime !== 'number' && typeof copy.startFrame === 'number') {
      copy.startTime = (copy.startFrame * hop) / sampleRate;
    } else {
      copy.startTime = copy.startTime || 0;
    }
    if (typeof copy.velocity !== 'number') {
      copy.velocity = copy.velChanges && copy.velChanges.length ? copy.velChanges[0].vel : 100;
    }
  } catch (e) {
    copy.lengthFrames = copy.lengthFrames || 0;
    copy.lengthSeconds = copy.lengthSeconds || 0;
    copy.velChanges = copy.velChanges || [{ offsetFrames: 0, vel: 100 }];
    copy.midiFloat = typeof copy.midiFloat === 'number' ? copy.midiFloat : 60;
    copy.startTime = typeof copy.startTime === 'number' ? copy.startTime : 0;
    copy.velocity = typeof copy.velocity === 'number' ? copy.velocity : 100;
  }
  return copy;
}
function detectPitchesLegacy(alignPitch) {
  detectedPitches = [];
  if (pos + fftSize > pcm.length) { rendering = false; if(status) status.style.display = "none"; return false; }
  const re = new Float32Array(fftSize);
  const im = new Float32Array(fftSize);
  for (let j = 0; j < fftSize; j++) { re[j] = (pcm[pos + j] || 0) * win[j]; im[j] = 0; }
  fft_inplace(re, im);
  const factor = sampleRate / fftSize / 2; 
  for (let bin = 0; bin < specHeight; bin++) {
    const reBin = (re[bin] || 0) / 256;
    const imBin = (im[bin] || 0) / 256;
    const mag = complexMag(reBin, imBin);
    if (mag <= dbToMag(noiseFloor)) continue;
    const freq = factor * bin;
    if (freq <= 0) continue;
    let detectedPitch;
    if (alignPitch) {
      let nearestPitch = Math.round(npo * Math.log2(freq / a4p));
      nearestPitch = a4p * Math.pow(2, nearestPitch / npo);
      detectedPitch = Math.round(nearestPitch / factor);
    } else {
      detectedPitch = freq;
    }
    const magToDb = m => 20 * Math.log10(Math.max(m, 1e-12));
    const db = magToDb(mag);
    const t = mag;
    const velFrame = Math.round(Math.max(0, Math.min(1, t)));
    if (!detectedPitches.some(([p, _r, _i, v]) => p === detectedPitch && v === velFrame)) {
      detectedPitches.push([detectedPitch, reBin, imBin, velFrame]);
    }
  }
  pos += hop; x++;
  audioProcessed += hop;
  if (x >= specWidth && status) { rendering = false; status.style.display = "none"; }
  return detectedPitches;
}
function exportMidiLegacy(progressCb = () => {}) {
  const velSplitTolerance = 40; 
  const minVelocityDb = -60;
  pos = 0;
  x = 0;
  const w = specWidth; const h = specHeight;
  let detectedPitches = [];
  audioProcessed = 0;
  for (let frame = 0; frame < w; frame++) {
    detectedPitches.push(detectPitchesLegacy(true));
    try {
      const pct = Math.round(((frame + 1) / Math.max(1, w)) * 100);
      progressCb(pct);
    } catch (e) {}
  }
  let globalMaxMag = 0;
  for (const frameArr of detectedPitches) {
    for (const entry of frameArr) {
      const reVal = entry[1], imVal = entry[2];
      const mag = complexMag(reVal, imVal);
      if (mag > globalMaxMag) globalMaxMag = mag;
    }
  }
  if (globalMaxMag <= 0) globalMaxMag = 1e-12;
  function mapComplexToMidi(reVal, imVal) {
    const mag = complexMag(reVal, imVal);
    let amp = (Math.max(0, mag) / globalMaxMag);
    amp = Math.min(1, Math.pow(amp, 2) * 1.4);
    const db = amp > 0 ? 20 * Math.log10(amp) : -1000;
    let norm = (db - minVelocityDb) / (0 - minVelocityDb);
    if (!isFinite(norm)) norm = 0;
    if (norm < 0) norm = 0;
    if (norm > 1) norm = 1;
    let midi = Math.round(norm * 127);
    if (midi < 1) midi = 1;
    return midi;
  }
  const notes = [];
  const active = [];
  const factor = sampleRate / fftSize / 2;
  function avgMagFromParts(reArr, imArr) {
    if (!reArr || reArr.length === 0) return 0;
    let s = 0;
    for (let i = 0; i < reArr.length; i++) s += complexMag(reArr[i], imArr[i]);
    return s / reArr.length;
  }
  for (let frame = 0; frame < w; frame++) {
    for (const a of active) a.seen = false;
    for (const [detectedPitch, reVal, imVal] of detectedPitches[frame]) {
      const freq = detectedPitch * factor;
      if (freq <= 0) continue;
      const midiFloat = 69 + 12 * Math.log2(freq / a4p);
      const midiRounded = Math.round(midiFloat);
      const mag = complexMag(reVal, imVal);
      let match = null;
      for (const a of active) {
        if (a.midiRounded === midiRounded) {
          if (!useVolumeControllers) {
            if (Math.abs(a.lastMag - mag) <= velSplitTolerance) {
              match = a;
              break;
            } else {
              continue;
            }
          } else {
            match = a;
            break;
          }
        }
      }
      if (match) {
        match.reParts.push(reVal);
        match.imParts.push(imVal);
        match.velFrames.push({ frame, re: reVal, im: imVal });
        match.lastMag = mag;
        match.seen = true;
      } else {
        active.push({
          midiRounded,
          startFrame: frame,
          reParts: [reVal],
          imParts: [imVal],
          velFrames: [{ frame, re: reVal, im: imVal }],
          lastMag: mag,
          midiFloat,
          seen: true
        });
      }
    }
    for (let i = active.length - 1; i >= 0; i--) {
      const a = active[i];
      if (!a.seen) {
        const lengthFrames = frame - a.startFrame;
        const vf = a.velFrames.slice().sort((u, v) => u.frame - v.frame);
        const velChanges = [];
        let lastVel = null;
        for (const entry of vf) {
          const rel = entry.frame - a.startFrame;
          const mapped = mapComplexToMidi(entry.re, entry.im);
          if (lastVel === null || mapped !== lastVel) {
            velChanges.push({ offsetFrames: rel, vel: mapped });
            lastVel = mapped;
          }
        }
        if (velChanges.length === 0) {
          const avgMag = avgMagFromParts(a.reParts, a.imParts);
          velChanges.push({ offsetFrames: 0, vel: mapComplexToMidi(avgMag, 0) });
        }
        notes.push({
          midiFloat: a.midiFloat,
          velocity: velChanges[0].vel,
          lengthFrames,
          lengthSeconds: (lengthFrames * hop) / sampleRate,
          startTime: (a.startFrame * hop) / sampleRate,
          velChanges
        });
        active.splice(i, 1);
      }
    }
  }
  for (const a of active) {
    const lengthFrames = w - a.startFrame;
    const vf = a.velFrames.slice().sort((u, v) => u.frame - v.frame);
    const velChanges = [];
    let lastVel = null;
    for (const entry of vf) {
      const rel = entry.frame - a.startFrame;
      const mapped = mapComplexToMidi(entry.re, entry.im);
      if (lastVel === null || mapped !== lastVel) {
        velChanges.push({ offsetFrames: rel, vel: mapped });
        lastVel = mapped;
      }
    }
    if (velChanges.length === 0) {
      const avgMag = avgMagFromParts(a.reParts, a.imParts);
      velChanges.push({ offsetFrames: 0, vel: mapComplexToMidi(avgMag, 0) });
    }
    notes.push({
      midiFloat: a.midiFloat,
      velocity: velChanges[0].vel,
      lengthFrames,
      lengthSeconds: (lengthFrames * hop) / sampleRate,
      startTime: (a.startFrame * hop) / sampleRate,
      velChanges
    });
  }
  let i = 0;
  while (i < notes.length) {
    if (notes[i].lengthSeconds < dCutoff) {
      notes.splice(i, 1);
    } else {
      i++;
    }
  }
  if (midiAlignTime && notes.length > 0) {
    const firstStart = notes[0].startTime + (hop/sampleRate) || 0;
    const quant = (60 / midiBpm) / mSubBeat;
    const threshold = quant / 2;
    const kept = [];
    for (const n of notes) {
      const rel = (n.startTime - firstStart);
      const rem = ((rel % quant) + quant) % quant;
      if (rem > threshold) {
        continue;
      }
      kept.push(n);
    }
    notes.length = 0;
    notes.push(...kept);
  }
  try { progressCb(100); } catch(e){}
  return { notes };
}
async function getNotes() {
  if (!useMidiAI) {
    const out = exportMidiLegacy();
    return out.notes;
  }
  try {
    if (!BasicPitchPkg) {
      if (gpt) gpt.innerText="Loading model, might take a while..."; else mInfo.innerHTML="Loading model, might take a while...<br><br>";
      console.log('BasicPitch: initializing...');
      const setAndLog = (pkg, source) => {
        BasicPitchPkg = pkg && pkg.__esModule ? (pkg.default || pkg) : (pkg || null);
        if (BasicPitchPkg) console.log(`BasicPitch: loaded from ${source}`, !!BasicPitchPkg);
        return BasicPitchPkg;
      };
      if (typeof window !== 'undefined') {
        if (window.__BASIC_PITCH__) setAndLog(window.__BASIC_PITCH__, 'window.__BASIC_PITCH__');
        else if (window.BasicPitch) setAndLog(window.BasicPitch, 'window.BasicPitch');
      }
      if (!BasicPitchPkg && typeof require === 'function') {
        try {
          console.log('BasicPitch: trying require()');
          const mod = require('@spotify/basic-pitch');
          if (mod) setAndLog(mod, 'require()');
        } catch (err) {
          console.warn('BasicPitch: require() failed:', err && err.message);
        }
      }
      if (!BasicPitchPkg && typeof window !== 'undefined') {
        await yieldToUI();
        try {
          console.log('BasicPitch: trying dynamic import("@spotify/basic-pitch")');
          const imported = await import('@spotify/basic-pitch');
          if (imported) setAndLog(imported, 'dynamic import(@spotify/basic-pitch)');
        } catch (err) {
          console.warn('BasicPitch: dynamic import("@spotify/basic-pitch") failed:', err && err.message);
        }
      }
      if (!BasicPitchPkg && typeof window !== 'undefined') {
        const cdnCandidates = [
          'https://esm.sh/@spotify/basic-pitch',
          'https://cdn.skypack.dev/@spotify/basic-pitch',
          'https://cdn.jsdelivr.net/npm/@spotify/basic-pitch'
        ];
        for (const url of cdnCandidates) {
          await yieldToUI();
          try {
            console.log('BasicPitch: trying CDN import()', url);
            const imported = await import(url);
            if (imported) {
              setAndLog(imported, `cdn:${url}`);
              break;
            }
          } catch (err) {
            console.warn(`BasicPitch: CDN import failed (${url}):`, err && err.message);
          }
        }
      }
      if (!BasicPitchPkg && typeof window !== 'undefined') {
        const waitMs = 3000, intervalMs = 120, maxTries = Math.ceil(waitMs / intervalMs);
        for (let i = 0; i < maxTries; i++) {
          if (window.__BASIC_PITCH__) {
            setAndLog(window.__BASIC_PITCH__, 'window.__BASIC_PITCH__ (polled)');
            break;
          }
          if (window.BasicPitch) {
            setAndLog(window.BasicPitch, 'window.BasicPitch (polled)');
            break;
          }
          await new Promise(r => setTimeout(r, intervalMs));
        }
      }
      if (!BasicPitchPkg) {
        console.warn('BasicPitch: not available — will use legacy pipeline.');
      }
    }
    await yieldToUI();
    if (BasicPitchPkg) {
      if (gpt) gpt.innerText=""; else mInfo.innerHTML="Model loaded<br><br>";
      const hopSamples = typeof hop === 'number' ? hop : (fftSize ? (fftSize / 4) : 512);
      await yieldToUI();
      const notes = await runBasicPitchAndReturnNotes({ pcmFloat32: pcm, sampleRate, hopSamples },
        (pct) => { try { setGlobalProgress(pct); } catch(e){} });
      try { setGlobalProgress(100); } catch(e){}
      gpbl.style.display = "none";
      return notes;
    }
    const out = exportMidiLegacy();
    console.log(out.notes);
    return out.notes;
  } catch (err) {
    console.warn('BasicPitch inference failed — falling back to legacy pipeline:', err);
    const out = exportMidiLegacy();
    return out.notes;
  }
}
function filterNotes() {
  if (useMidiAI) {
    let i = 0;
    while (i < notes.length) if (notes[i].lengthSeconds < dCutoff) notes.splice(i, 1); else i++;
    const tQdivision = (typeof tQd !== "undefined") ? parseInt(tQd.value):4;
    for (i = 0; i < notes.length; i++) {
      let original = notes[i].startTime;
      const factor = 60/tQTempo/tQdivision;
      let quantized = Math.floor(original/factor)*factor;
      let final = original + (quantized-original) * (tQStrength/100);
      notes[i].startTime = final;
    }
    i = 0;
    let storage = [];
    while (i < notes.length) {
      let a = notes[i].startTime; b = notes[i].midiFloat;
      if (storage.includes([a,b])) {
        notes.splice(i, 1);
      } else {
        i++;
        storage.push([a,b])
      }
    };
  }
}
async function exportMidi(opts = {}) {
  const downloadName = opts.downloadName ?? "export.mid";
  let notes = await getNotes();
  filterNotes();
  writeMidiFile(notes, { downloadName, tempoBPM: opts.tempoBPM, a4: opts.a4, pitchBendRange: opts.pitchBendRange });
  return notes;
}
function writeMidiFile(notes, opts = {}) {
  const ppq = opts.ppq ?? 480;
  const tempoBPM = opts.tempoBPM ?? 120;
  const channel = opts.channel ?? 0;
  const a4 = opts.a4 ?? 440;
  const pitchBendRange = opts.pitchBendRange ?? 2; 
  const downloadName = opts.downloadName ?? "output.mid";
  function writeVarLen(value, out) {
    let buffer = value & 0x7f;
    while ((value >>= 7) > 0) {
      buffer <<= 8;
      buffer |= ((value & 0x7f) | 0x80);
    }
    while (true) {
      out.push(buffer & 0xff);
      if (buffer & 0x80) buffer >>= 8;
      else break;
    }
  }
  const bytes = [];
  function pushU16BE(v) { bytes.push((v >> 8) & 0xff, v & 0xff); }
  function pushU32BE(v) { bytes.push((v >> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff); }
  bytes.push(0x4d,0x54,0x68,0x64); 
  pushU32BE(6);
  pushU16BE(0); 
  pushU16BE(1); 
  pushU16BE(ppq);
  const track = [];
  const microsecondsPerQuarter = Math.round(60000000 / tempoBPM);
  writeVarLen(0, track);
  track.push(0xFF, 0x51, 0x03);
  track.push((microsecondsPerQuarter >> 16) & 0xff, (microsecondsPerQuarter >> 8) & 0xff, microsecondsPerQuarter & 0xff);
  writeVarLen(0, track); track.push(0xC0 | channel, 0);
  function pushControl(changeController, value) {
    writeVarLen(0, track);
    track.push(0xB0 | (channel & 0x0f), changeController & 0x7f, value & 0x7f);
  }
  pushControl(0x65, 0x00);
  pushControl(0x64, 0x00);
  const semis = Math.floor(Math.max(0, Math.min(127, Math.round(pitchBendRange))));
  pushControl(0x06, semis);
  pushControl(0x26, 0x00);
  pushControl(0x65, 127);
  pushControl(0x64, 127);
  function freqToMidiFloat(freq, npo) {
    if (!freq || freq <= 0) return null;
    if (npo && npo > 0) {
      const micro = Math.round(npo * Math.log2(freq / a4));
      return 69 + (12 * micro) / npo;
    } else {
      return 69 + 12 * Math.log2(freq / a4);
    }
  }
  const ticksPerSec = ppq * (tempoBPM / 60);
  function midiFloatToPitchBend(midiFloat, baseMidi, rangeSemitones) {
    const semitoneOffset = midiFloat - baseMidi;
    const normalized = semitoneOffset / rangeSemitones;
    const clamped = Math.max(-1, Math.min(1, normalized));
    const value = Math.round(8192 + clamped * 8192);
    return Math.max(0, Math.min(16383, value));
  }
  const events = [];
  for (let i = 0, L = notes.length; i < L; ++i) {
    const note = notes[i];
    if (!note || typeof note.lengthSeconds !== "number") continue;
    const startTime = (typeof note.startTime === 'number') ? note.startTime : 0;
    const startTick = Math.max(0, Math.round(startTime * ticksPerSec));
    const lengthTicks = Math.max(1, Math.round(note.lengthSeconds * ticksPerSec));
    const endTick = startTick + lengthTicks;
    let midiFloat = null;
    if (typeof note.midiFloat === "number") midiFloat = note.midiFloat;
    else if (typeof note.freq === "number") {
      if (note.freq >= 0 && note.freq <= 127 && Number.isInteger(note.freq)) midiFloat = note.freq;
      else midiFloat = freqToMidiFloat(note.freq, opts.npo);
    } else {
      continue;
    }
    if (!Number.isFinite(midiFloat)) continue;
    let baseMidi = Math.round(midiFloat);
    baseMidi = Math.max(0, Math.min(127, baseMidi));
    const pb14 = midiFloatToPitchBend(midiFloat, baseMidi, pitchBendRange);
    const pbLSB = pb14 & 0x7f;
    const pbMSB = (pb14 >> 7) & 0x7f;
    const velocity = (typeof note.velocity === 'number') ? Math.max(1, Math.min(127, note.velocity)) : 100;
    const velChanges = Array.isArray(note.velChanges) ? note.velChanges : [{ offsetFrames: 0, vel: velocity }];
    if (useVolumeControllers) {
      const initialCC = Math.max(0, Math.min(127, Math.round(velChanges[0].vel)));
      events.push([startTick, -1, 'cc', 0x07, initialCC]); 
      for (let vc = 0; vc < velChanges.length; vc++) {
        const c = velChanges[vc];
        if (c.offsetFrames === 0) continue; 
        const offsetSeconds = (c.offsetFrames * hop) / sampleRate;
        const changeTick = startTick + Math.round(offsetSeconds * ticksPerSec);
        const ccval = Math.max(0, Math.min(127, Math.round(c.vel)));
        events.push([changeTick, -1, 'cc', 0x07, ccval]);
      }
      events.push([startTick, 0, 'pb', pbLSB, pbMSB]);
      events.push([startTick, 1, 'on', baseMidi, Math.max(1, Math.min(127, Math.round(velChanges[0].vel)))]);
      events.push([endTick,   2, 'off', baseMidi, 0]);
    } else {
      events.push([startTick, 0, 'pb', pbLSB, pbMSB]);
      events.push([startTick, 1, 'on', baseMidi, velocity]);
      events.push([endTick,   2, 'off', baseMidi, 0]);
    }
  }
  events.sort(function(a,b){
    if (a[0] < b[0]) return -1;
    if (a[0] > b[0]) return  1;
    return a[1] - b[1];
  });
  let lastTick = 0;
  for (let i = 0; i < events.length; ++i) {
    const ev = events[i];
    const delta = Math.max(0, ev[0] - lastTick);
    writeVarLen(delta, track);
    const type = ev[2];
    if (type === 'pb') {
      track.push(0xE0 | (channel & 0x0f), ev[3] & 0x7f, ev[4] & 0x7f);
    } else if (type === 'on') {
      track.push(0x90 | (channel & 0x0f), ev[3] & 0x7f, ev[4] & 0x7f);
    } else if (type === 'off') {
      track.push(0x90 | (channel & 0x0f), ev[3] & 0x7f, 0x00);
    } else if (type === 'cc') {
      track.push(0xB0 | (channel & 0x0f), ev[3] & 0x7f, ev[4] & 0x7f);
    }
    lastTick = ev[0];
  }
  writeVarLen(0, track);
  track.push(0xFF, 0x2F, 0x00);
  bytes.push(0x4d,0x54,0x72,0x6b); 
  pushU32BE(track.length);
  const totalLen = bytes.length + track.length;
  const out = new Uint8Array(totalLen);
  let k = 0;
  for (let i = 0; i < bytes.length; ++i) out[k++] = bytes[i];
  for (let i = 0; i < track.length; ++i) out[k++] = track[i];
  if (downloadName) {
    const blob = new Blob([out], { type: "audio/midi" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 5000);
  }
  return out;
}
function removeHarmonics({harmonicTolerance = 0.04,maxHarmonic = 8,peakMadMultiplier = 4} = {}) {
  if (typeof snapshotMags !== "undefined") {
    snapshotMags = new Float32Array(mags);
    snapshotPhases = new Float32Array(phases);
    pos = 0;
    x = 0;
    audioProcessed = 0;
  }
  const h = specHeight;
  function median(arr) {
    const a = Array.from(arr).sort((a, b) => a - b);
    const mid = Math.floor(a.length / 2);
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  }
  function mad(arr, med) {
    const diffs = arr.map(v => Math.abs(v - med));
    return median(diffs);
  }
  const factor = sampleRate / fftSize; 
  for (let frame = 0; frame < specWidth; frame++) {
    const re = new Float32Array(fftSize);
    const im = new Float32Array(fftSize);
    for (let j = 0; j < fftSize; j++) {
      re[j] = (pcm[pos + j] || 0) * win[j];
      im[j] = 0;
    }
    fft_inplace(re, im);
    const fmags = new Float32Array(h);
    for (let bin = 0; bin < h; bin++) {
      fmags[bin] = Math.hypot(re[bin] || 0, im[bin] || 0) / 256;
    }
    const med = median(fmags);
    const m = mad(fmags, med) || 1e-12;
    const threshold = med + peakMadMultiplier * m;
    const peaks = [];
    for (let bin = 1; bin < h; bin++) {
      const mag = fmags[bin];
      if (mag > threshold) {
        peaks.push({ bin, mag, freq: factor * bin });
      }
    }
    peaks.sort((a, b) => b.mag - a.mag);
    const suppressed = new Array(h).fill(false);
    const suppressedBinsThisFrame = [];
    function suppressBin(binIndex) {
      if (suppressed[binIndex]) return;
      const mirror = (fftSize - binIndex) % fftSize;
      const scale = 1 / 10000;
      re[binIndex] *= scale; im[binIndex] *= scale;
      re[mirror] *= scale;  im[mirror] *= scale;
      suppressed[binIndex] = true;
      if (mirror < h) suppressed[mirror] = true;
      suppressedBinsThisFrame.push(binIndex);
    }
    for (const peak of peaks) {
      if (suppressed[peak.bin]) continue; 
      const baseFreq = peak.freq;
      for (const q of peaks) {
        if (q.bin === peak.bin) continue;
        if (suppressed[q.bin]) continue;
        for (let k = 2; k <= maxHarmonic; k++) {
          if (Math.abs(q.freq - k * baseFreq) <= harmonicTolerance * baseFreq) {
            suppressBin(q.bin);
            break;
          }
        }
      }
    }
    const processedMags = new Float32Array(h);
    for (let bin = 0; bin < h; bin++) {
      if (suppressed[bin]) {
        processedMags[bin] = 0
      } else {
        processedMags[bin] = Math.hypot(re[bin] || 0, im[bin] || 0);
      }
    }
    mags.set(processedMags,frame*specHeight);
    pos += hop;
    x++;
    audioProcessed += hop;
    if (x >= specWidth) break;
  }
  if (typeof newHistory === "function") {
    newHistory();
    recomputePCMForCols(0, specWidth);
    restartRender();
    startTime = performance.now();
    audioProcessed = 0;
    playPCM();
    document.getElementById("playPause").innerHTML=pauseHtml;
  }
}
(function attachExports() {
  const api = {
    getNotes,
    exportMidi,
    writeMidiFile,
    removeHarmonics
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof define === 'function' && define.amd) {
    define(() => api);
  }
  if (typeof window !== 'undefined') {
    window.MIDI = Object.assign(window.MIDI || {}, api);
  }
})();
if (!localStorage.getItem('basicPitchPreloadDone')) {
  preloadBasicPitchModelInWorker(MODEL_JSON_URL, 'basicpitch-v1')
    .then(() => localStorage.setItem('basicPitchPreloadDone', '1'))
    .catch(err => console.warn(err));
}