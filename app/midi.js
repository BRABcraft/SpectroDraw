// ---------- BasicPitch loader (replace original basicPitchReady block) ----------
let BasicPitchPkg = null;
let bpInstance = null;
let tf = null;

/**
 * Try to load BasicPitch from multiple possible sources:
 * 1) window.__BASIC_PITCH__ (glue script creates this)
 * 2) window.BasicPitch (older global name)
 * 3) require('@spotify/basic-pitch') (if running in a bundler that supports require)
 * 4) dynamic import('@spotify/basic-pitch') (ESM specifier - works with native ESM-aware bundlers)
 * 5) dynamic import from CDNs (esm.sh, skypack) - works on a plain static site
 * 6) poll for window.__BASIC_PITCH__ for a short time (if another script sets it)
 */
let basicPitchReady = (async function loadBasicPitch() {
  if (BasicPitchPkg !== null) return BasicPitchPkg;
  // quick helper
  function setAndLog(pkg, source) {
    BasicPitchPkg = pkg && pkg.__esModule ? (pkg.default || pkg) : (pkg || null);
    if (BasicPitchPkg) console.log(`BasicPitch: loaded from ${source}`, !!BasicPitchPkg);
    return BasicPitchPkg;
  }

  // 0) If running in browser, check commonly used globals (glue script)
  try {
    if (typeof window !== 'undefined') {
      if (window.__BASIC_PITCH__) return setAndLog(window.__BASIC_PITCH__, 'window.__BASIC_PITCH__');
      if (window.BasicPitch) return setAndLog(window.BasicPitch, 'window.BasicPitch');
    }
  } catch (e) {}

  // 1) Try CommonJS require (bundlers / electron-like envs)
  try {
    if (typeof require === 'function') {
      try {
        console.log('BasicPitch: trying require()');
        const mod = require('@spotify/basic-pitch');
        return setAndLog(mod, 'require()');
      } catch (err) {
        console.warn('BasicPitch: require() failed:', err && err.message);
      }
    }
  } catch (err) {
    console.warn('BasicPitch: require check threw:', err && err.message);
  }

  // 2) Try dynamic import with plain specifier (works with bundlers/native ESM when server/resolver supports it)
  try {
    if (typeof window !== 'undefined') {
      console.log('BasicPitch: trying dynamic import("@spotify/basic-pitch")');
      try {
        const imported = await import('@spotify/basic-pitch');
        if (imported) return setAndLog(imported, 'dynamic import(@spotify/basic-pitch)');
      } catch (err) {
        console.warn('BasicPitch: dynamic import(@spotify/basic-pitch) failed:', err && err.message);
      }
    }
  } catch (err) {
    console.warn('BasicPitch: dynamic import threw:', err && err.message);
  }

  // 3) Try a few ESM CDN fallbacks (useful for pure static sites)
  const cdnCandidates = [
    'https://esm.sh/@spotify/basic-pitch',
    'https://cdn.skypack.dev/@spotify/basic-pitch',
    'https://cdn.jsdelivr.net/npm/@spotify/basic-pitch' // may or may not expose ESM shape
  ];
  for (const url of cdnCandidates) {
    try {
      console.log('BasicPitch: trying CDN import()', url);
      const imported = await import(url);
      if (imported) return setAndLog(imported, `cdn:${url}`);
    } catch (err) {
      console.warn(`BasicPitch: CDN import failed (${url}):`, err && err.message);
    }
  }

  // 4) Poll for a global set by a glue script (some pages set window.__BASIC_PITCH__ asynchronously)
  if (typeof window !== 'undefined') {
    const waitMs = 3000; // total time to wait
    const intervalMs = 120;
    const maxTries = Math.ceil(waitMs / intervalMs);
    for (let i = 0; i < maxTries; i++) {
      if (window.__BASIC_PITCH__) {
        return setAndLog(window.__BASIC_PITCH__, 'window.__BASIC_PITCH__ (polled)');
      }
      if (window.BasicPitch) {
        return setAndLog(window.BasicPitch, 'window.BasicPitch (polled)');
      }
      // small delay
      await new Promise(r => setTimeout(r, intervalMs));
    }
  }

  console.warn('BasicPitch: not available — will use legacy pipeline.');
  return null;
})();


// ---------------------- helper functions ----------------------
function dbToMag(db) {
  return Math.pow(10, db / 20);
}
function complexMag(re, im) {
  return Math.hypot(re || 0, im || 0);
}

// convert pcm Float32Array -> AudioBuffer (uses OfflineAudioContext when available)
function pcmToAudioBuffer(pcmFloat32, sampleRate) {
  const length = pcmFloat32.length;
  try {
    const ctx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, length, sampleRate);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    buffer.getChannelData(0).set(pcmFloat32);
    return buffer;
  } catch (e) {
    // fallback to regular AudioContext (may require user gesture)
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw e;
    const actx = new AC();
    const buffer = actx.createBuffer(1, length, sampleRate);
    buffer.getChannelData(0).set(pcmFloat32);
    return buffer;
  }
}
// Resample helpers ---------------------------------------------------------

/**
 * Resample Float32Array pcm to target sample rate using OfflineAudioContext if available,
 * otherwise fall back to a simple linear-interpolation resampler.
 *
 * @param {Float32Array} pcm - mono PCM [-1..1]
 * @param {number} srcRate - original sample rate (e.g. 48000)
 * @param {number} targetRate - desired sample rate (e.g. 22050)
 * @returns {Promise<{pcm: Float32Array, sampleRate: number}>}
 */
async function resampleToTargetSampleRate(pcm, srcRate, targetRate) {
  if (!pcm || !(pcm instanceof Float32Array) || pcm.length === 0) {
    return { pcm: new Float32Array(0), sampleRate: targetRate };
  }
  if (!isFinite(srcRate) || !isFinite(targetRate) || srcRate <= 0 || targetRate <= 0) {
    throw new Error('Invalid sample rates for resampling');
  }
  if (Math.round(srcRate) === Math.round(targetRate)) {
    // no resampling needed
    return { pcm, sampleRate: srcRate };
  }

  // Try OfflineAudioContext resampling first (higher quality)
  try {
    if (typeof window !== 'undefined' && (window.OfflineAudioContext || window.webkitOfflineAudioContext)) {
      const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;

      // Create an AudioBuffer with the source sample rate
      // Use the AudioBuffer constructor (widely supported) or fallback to OfflineAudioContext.createBuffer
      let srcBuffer;
      try {
        srcBuffer = new AudioBuffer({ length: pcm.length, numberOfChannels: 1, sampleRate: srcRate });
        srcBuffer.getChannelData(0).set(pcm);
      } catch (e) {
        // Safari older engines may not allow AudioBuffer ctor; use OfflineAudioContext to create buffer instead
        const tmpCtx = new OfflineCtx(1, pcm.length, srcRate);
        srcBuffer = tmpCtx.createBuffer(1, pcm.length, srcRate);
        srcBuffer.getChannelData(0).set(pcm);
      }

      // Create an OfflineAudioContext at the target rate with appropriate length
      const targetLen = Math.ceil(srcBuffer.duration * targetRate);
      const offline = new OfflineCtx(1, targetLen, targetRate);

      const src = offline.createBufferSource();
      src.buffer = srcBuffer;
      src.connect(offline.destination);
      src.start(0);

      const rendered = await offline.startRendering(); // Promise<AudioBuffer>
      const out = new Float32Array(rendered.length);
      out.set(rendered.getChannelData(0));
      return { pcm: out, sampleRate: targetRate };
    }
  } catch (err) {
    console.warn('resampleToTargetSampleRate: OfflineAudioContext resample failed, falling back to linear resampler:', err && err.message);
    // fall through to linear
  }

  // Linear interpolation resampler (fast, OK quality)
  function linearResample(input, inRate, outRate) {
    const ratio = inRate / outRate;
    const outLen = Math.max(1, Math.round(input.length / ratio));
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const idx = i * ratio;
      const i0 = Math.floor(idx);
      const i1 = Math.min(input.length - 1, i0 + 1);
      const frac = idx - i0;
      out[i] = input[i0] * (1 - frac) + input[i1] * frac;
    }
    return out;
  }

  try {
    const out = linearResample(pcm, srcRate, targetRate);
    return { pcm: out, sampleRate: targetRate };
  } catch (err) {
    console.warn('resampleToTargetSampleRate: linear resampling failed:', err && err.message);
    // return empty on catastrophic failure
    return { pcm: new Float32Array(0), sampleRate: targetRate };
  }
}


// ---------------------- BasicPitch runner (best-effort across API shapes) ----------------------
async function runBasicPitchAndReturnNotes({ pcmFloat32, sampleRate, hopSamples }) {
  if (!BasicPitchPkg) throw new Error('BasicPitch package not found');

  // small inspector
  const inspect = obj => {
    try { return obj && typeof obj === 'object' ? Object.keys(obj).slice(0, 20) : typeof obj; } catch (e) { return typeof obj; }
  };

  // Ensure tf is available BEFORE instantiating the model (BasicPitch often expects tf global present)
  async function ensureTF() {
    if (typeof window !== 'undefined' && typeof window.tf !== 'undefined') {
      // already present globally
      console.log('tf already present on window');
      return;
    }
    if (typeof tf !== 'undefined') {
      console.log('tf already present in scope');
      return;
    }
    // load CDN only if not present
    try {
      await new Promise((resolve, reject) => {
        // do not inject if script already present in DOM
        const exists = Array.from(document.scripts).some(s => s.src && s.src.includes('tensorflow'));
        if (exists) return resolve();
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js';
        s.async = true;
        s.onload = () => {
          // make sure global available
          if (typeof window !== 'undefined' && window.tf) resolve();
          else resolve(); // still resolve, we'll be defensive later
        };
        s.onerror = () => reject(new Error('Failed to load tfjs from CDN'));
        document.head.appendChild(s);
      });
      console.log('ensureTF: tfjs loaded or present.');
    } catch (e) {
      console.warn('ensureTF: failed to load tfjs automatically; BasicPitch may fail if tf is required.', e && e.message);
    }
  }

  // Resolve possible exported shapes
  const BProot = BasicPitchPkg && BasicPitchPkg.default ? BasicPitchPkg.default : BasicPitchPkg;
  console.log('BasicPitchPkg summary:', inspect(BasicPitchPkg));
  console.log('Resolved BP root summary:', inspect(BProot));

  // decide candidate class/factory
  let BasicPitchClass = null;
  if (BProot && typeof BProot === 'object' && typeof BProot.BasicPitch === 'function') {
    BasicPitchClass = BProot.BasicPitch;
    console.log('Using BProot.BasicPitch as class/factory.');
  } else if (typeof BProot === 'function') {
    BasicPitchClass = BProot;
    console.log('Using BProot (callable) as class/factory.');
  } else {
    console.log('BProot does not expose a class; will try using helpers if present.', inspect(BProot));
  }

  // Validate inputs
  if (!pcmFloat32 || !(pcmFloat32 instanceof Float32Array) || pcmFloat32.length === 0) {
    console.warn('BasicPitch runner: pcmFloat32 invalid/empty; returning []');
    return [];
  }
  if (!sampleRate || !isFinite(sampleRate)) {
    console.warn('BasicPitch runner: invalid sampleRate', sampleRate);
    return [];
  }
  hopSamples = hopSamples || (typeof hop === 'number' ? hop : 512);

  // ensure TF before instantiating
  await ensureTF();

  // Instantiate / load bpInstance
  if (!bpInstance) {
    try {
      if (BasicPitchClass && typeof BasicPitchClass.create === 'function') {
        console.log('BasicPitch: calling BasicPitchClass.create()');
        bpInstance = await BasicPitchClass.create();
        console.log('BasicPitch: created via BasicPitchClass.create()');
      } else if (BasicPitchClass && typeof BasicPitchClass === 'function') {
        try {
          console.log('BasicPitch: attempting new BasicPitchClass()');
          bpInstance = new BasicPitchClass();
          console.log('BasicPitch: bpInstance assigned from new BasicPitchClass()');
        } catch (errNew) {
          console.warn('BasicPitch: new BasicPitchClass() failed:', errNew && errNew.message);
          // try static create on the constructor if available
          if (typeof BasicPitchClass.create === 'function') {
            bpInstance = await BasicPitchClass.create();
            console.log('BasicPitch: bpInstance created via BasicPitchClass.create() fallback');
          } else if (BProot && typeof BProot.create === 'function') {
            bpInstance = await BProot.create();
            console.log('BasicPitch: bpInstance created via BProot.create() fallback');
          } else {
            // fallback to using the object directly
            bpInstance = BProot;
            console.log('BasicPitch: fallback - using BProot as instance');
          }
        }
      } else if (BProot && typeof BProot.create === 'function') {
        bpInstance = await BProot.create();
        console.log('BasicPitch: bpInstance created via BProot.create()');
      } else {
        bpInstance = BProot;
        console.log('BasicPitch: no class detected, using BProot directly as instance');
      }
    } catch (err) {
      console.warn('BasicPitch: Failed to instantiate BasicPitch:', err && err.message);
      throw new Error('Failed to instantiate BasicPitch: ' + (err && err.message));
    }
  } else {
    console.log('BasicPitch: using existing bpInstance', inspect(bpInstance));
  }

  // If bpInstance exists but internal model seems missing, try common init methods
  async function initializeIfNeeded(instance) {
    try {
      if (!instance) return;
      // If instance has .model property and it's defined, assume ready
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
          // once called, break out — don't call multiple init funcs
          return;
        }
      }
    } catch (e) {
      console.warn('BasicPitch: instance initialization attempt failed:', e && e.message);
    }
  }

  await initializeIfNeeded(bpInstance);

  // Ensure sampleRate BasicPitch expects 22050
  const BP_REQUIRED_SR = 22050;
  if (Math.round(sampleRate) !== BP_REQUIRED_SR) {
    try {
      console.log(`Resampling from ${sampleRate} -> ${BP_REQUIRED_SR}...`);
      const res = await resampleToTargetSampleRate(pcmFloat32, sampleRate, BP_REQUIRED_SR);
      pcmFloat32 = res.pcm;
      sampleRate = res.sampleRate;
      console.log('Resampling done, new length:', pcmFloat32.length, 'new sampleRate:', sampleRate);
    } catch (err) {
      console.warn('Resample to 22050 failed, continuing with original sampleRate:', err && err.message);
    }
  }

  // Convert to AudioBuffer
  let audioBuffer;
  try {
    audioBuffer = pcmToAudioBuffer(pcmFloat32, sampleRate);
    console.log('BasicPitch runner: created AudioBuffer length', audioBuffer && audioBuffer.length);
  } catch (err) {
    console.warn('BasicPitch runner: pcmToAudioBuffer failed:', err && err.message);
    return [];
  }

  // attempt to call model APIs; if we hit "execute undefined" style errors, try one init + retry
  const frames = [], onsets = [], contours = [];
  let rawResult = null;

  async function callModel() {
    if (bpInstance && typeof bpInstance.evaluateModel === 'function') {
      await bpInstance.evaluateModel(audioBuffer,
        (fChunk, oChunk, cChunk) => {
          if (Array.isArray(fChunk)) frames.push(...fChunk);
          if (Array.isArray(oChunk)) onsets.push(...oChunk);
          if (Array.isArray(cChunk)) contours.push(...cChunk);
        },
        (_progress) => {}
      );
      rawResult = { frames, onsets, contours };
      console.log('BasicPitch: evaluateModel produced lengths', frames.length, onsets.length, contours.length);
      return;
    }
    if (bpInstance && typeof bpInstance.transcribe === 'function') {
      rawResult = await bpInstance.transcribe(audioBuffer);
      console.log('BasicPitch: transcribe returned keys', rawResult && Object.keys(rawResult||{}));
      return;
    }
    if (bpInstance && typeof bpInstance.predict === 'function') {
      rawResult = await bpInstance.predict(audioBuffer);
      console.log('BasicPitch: predict returned keys', rawResult && Object.keys(rawResult||{}));
      return;
    }
    if (typeof BProot === 'function') {
      try {
        rawResult = await BProot(audioBuffer);
        console.log('BasicPitch: BProot(audioBuffer) returned keys', rawResult && Object.keys(rawResult||{}));
        return;
      } catch (e) {
        console.warn('BasicPitch: BProot(audioBuffer) threw', e && e.message);
      }
    }
    console.log('BasicPitch: no model API found on bpInstance; keys:', inspect(bpInstance));
  }

  // First try
  try {
    await callModel();
  } catch (err) {
    console.warn('BasicPitch runner: model call threw:', err && err.message);
    // if appears uninitialized (common error 'execute' or 'model undefined'), attempt instance initialization then retry once
    const msg = (err && err.message) ? err.message.toLowerCase() : '';
    console.log(bpInstance);
    const likelyUninitialized = msg.includes('execute') || msg.includes('model') || msg.includes('undefined');
    if (likelyUninitialized) {
      console.log('BasicPitch runner: model appears uninitialized — trying instance init then retrying once.');
      await initializeIfNeeded(bpInstance);
      try {
        await callModel();
      } catch (err2) {
        console.warn('BasicPitch runner: retry after initialization failed:', err2 && err2.message);
      }
    }
  }

  // If returned notes directly
  if (rawResult && Array.isArray(rawResult.notes) && rawResult.notes.length) {
    return rawResult.notes.map(normalizeNoteFromModel);
  }

  const framesFromRaw = rawResult && rawResult.frames ? rawResult.frames : frames;
  const onsetsFromRaw = rawResult && rawResult.onsets ? rawResult.onsets : onsets;
  const contoursFromRaw = rawResult && rawResult.contours ? rawResult.contours : contours;

  // Try helpers pipeline if present
  const helpers = BasicPitchPkg || {};
  const outToNotes = (helpers && (helpers.outputToNotesPoly || helpers.output_to_notes_poly)) || (bpInstance && bpInstance.outputToNotesPoly) || null;
  const addBends = (helpers && (helpers.addPitchBendsToNoteEvents || helpers.add_pitch_bends_to_note_events)) || (bpInstance && bpInstance.addPitchBendsToNoteEvents) || null;
  const framesToTime = (helpers && (helpers.noteFramesToTime || helpers.note_frames_to_time)) || (bpInstance && bpInstance.noteFramesToTime) || null;

  if (outToNotes && addBends && framesToTime && framesFromRaw && framesFromRaw.length) {
    try {
      const polyNotesFrames = outToNotes(framesFromRaw, onsetsFromRaw || [], 0.25, 0.25, 8);
      const notesWithBends = addBends(contoursFromRaw || [], polyNotesFrames);
      const notesTimed = framesToTime(notesWithBends);
      return Array.isArray(notesTimed) ? notesTimed.map(normalizeNoteFromModel) : [];
    } catch (e) {
      console.warn('BasicPitch helper pipeline failed:', e && e.message);
    }
  }

  // fallback naive mapping
  if (framesFromRaw && framesFromRaw.length) {
    try {
      const fallbackNotes = framesOnsetsContoursToNotes(framesFromRaw, onsetsFromRaw, contoursFromRaw, { sampleRate, hopSamples });
      return Array.isArray(fallbackNotes) ? fallbackNotes.map(normalizeNoteFromModel) : [];
    } catch (e) {
      console.warn('BasicPitch fallback frames->notes failed:', e && e.message);
    }
  }

  throw new Error('BasicPitch produced no usable output');
}


// Normalize model note to the shape writeMidiFile expects
function normalizeNoteFromModel(n) {
  const copy = Object.assign({}, n);

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

  return copy;
}

// Very small fallback mapping (frames->notes) if helpers are absent
function framesOnsetsContoursToNotes(frames, onsets, contours, { sampleRate, hopSamples }) {
  const notes = [];
  const nFrames = frames ? frames.length : 0;
  if (!nFrames) return notes;
  const nBins = frames[0] ? frames[0].length : (specHeight || 128);
  const factor = sampleRate / (fftSize || (hopSamples * 2)) / 2;

  for (let t = 0; t < nFrames; t++) {
    const onsetVal = onsets && onsets[t] ? onsets[t] : 0;
    if (onsetVal < 0.25) continue;
    const magRow = frames[t];
    if (!magRow) continue;
    let bestIdx = 0; let bestVal = -Infinity;
    for (let b = 0; b < magRow.length; b++) {
      if (magRow[b] > bestVal) { bestVal = magRow[b]; bestIdx = b; }
    }
    const freq = bestIdx * factor;
    if (!isFinite(freq) || freq <= 0) continue;
    const midiFloat = 69 + 12 * Math.log2(freq / a4p);
    let endFrame = t + 1;
    while (endFrame < nFrames && frames[endFrame] && frames[endFrame][bestIdx] > 0.1 * bestVal) endFrame++;
    const lengthFrames = endFrame - t;
    const vel = Math.max(1, Math.min(127, Math.round(100 * Math.min(1, bestVal || 0))));
    notes.push({
      midiFloat,
      velocity: vel,
      lengthFrames,
      lengthSeconds: (lengthFrames * hopSamples) / sampleRate,
      startTime: (t * hopSamples) / sampleRate,
      velChanges: [{ offsetFrames: 0, vel }]
    });
  }
  return notes;
}

// ---------------------- LEGACY PIPELINE (inlined) ----------------------
// I inlined your original detectPitches() and exportMidi2() implementation here
// so the fallback is self-contained. These functions assume the globals used
// in your original code exist (pcm, sampleRate, fftSize, win, hop, specWidth, specHeight, etc.)

// your original detectPitches (unchanged except using local scope)
function detectPitchesLegacy(alignPitch) {
  detectedPitches = [];
  console.log('detectedPitcheslegacy');
  if (pos + fftSize > pcm.length) { rendering = false; if(status) status.style.display = "none"; return false; }

  const re = new Float32Array(fftSize);
  const im = new Float32Array(fftSize);
  for (let j = 0; j < fftSize; j++) { re[j] = (pcm[pos + j] || 0) * win[j]; im[j] = 0; }
  fft_inplace(re, im);

  const factor = sampleRate / fftSize / 2; // Hz per bin (kept original)

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

// Inlined export/merge pipeline (your exportMidi2 body, unchanged except function name)
function exportMidiLegacy() {
  console.log('exportmidilegacy');
  const velSplitTolerance = 40; // used only when useVolumeControllers == false (kept original)
  const minVelocityDb = -60;

  pos = 0;
  x = 0;
  const w = specWidth; const h = specHeight;
  let detectedPitches = [];
  audioProcessed = 0;
  for (let frame = 0; frame < w; frame++) {
    detectedPitches.push(detectPitchesLegacy(true)); // each entry: [detectedPitch, re, im, velFrame]
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
  return { notes };
}

// ---------------------- Public API: getNotes() and exportMidi() ----------------------
// getNotes() returns the array of notes (same format as legacy)
// exportMidi(opts) writes the file using your existing writeMidiFile()

async function getNotes() {
  // wait for the loader probe to finish (it may set BasicPitchPkg or decide legacy fallback)
  try {
    await basicPitchReady;
  } catch (e) {
    // ignore - basicPitchReady should never throw, but be defensive
  }

  try {
    if (BasicPitchPkg) {
      const hopSamples = typeof hop === 'number' ? hop : (fftSize ? (fftSize / 4) : 512);
      const notes = await runBasicPitchAndReturnNotes({ pcmFloat32: pcm, sampleRate, hopSamples });
      return notes;
    }
    // fallback directly to legacy
    const out = exportMidiLegacy();
    return out.notes;
  } catch (err) {
    console.warn('BasicPitch inference failed — falling back to legacy pipeline:', err);
    const out = exportMidiLegacy();
    return out.notes;
  }
}

async function exportMidi(opts = {}) {
  const downloadName = opts.downloadName ?? "export.mid";
  const notes = await getNotes();
  writeMidiFile(notes, { downloadName, tempoBPM: opts.tempoBPM, a4: opts.a4, pitchBendRange: opts.pitchBendRange });
  return notes;
}

// ---------------------- Your writeMidiFile() and removeHarmonics() ----------------------
// Paste your original writeMidiFile and removeHarmonics implementations here
// (I assume they are already present in this file — keep them unchanged).
// If they're not present, copy them from your previous code into this location.




// ---------- writeMidiFile: uses note.startTime to schedule events ----------
function writeMidiFile(notes, opts = {}) {
  // options
  const ppq = opts.ppq ?? 480;
  const tempoBPM = opts.tempoBPM ?? 120;
  const channel = opts.channel ?? 0;
  const a4 = opts.a4 ?? 440;
  const pitchBendRange = opts.pitchBendRange ?? 2; // semitones (+/-)
  const downloadName = opts.downloadName ?? "output.mid";

  // helper: write variable length quantity into given array
  function writeVarLen(value, out) {
    // value is integer >= 0
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

  // push helpers
  const bytes = [];
  function pushU16BE(v) { bytes.push((v >> 8) & 0xff, v & 0xff); }
  function pushU32BE(v) { bytes.push((v >> 24) & 0xff, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff); }

  // Header chunk (format 0 single track)
  bytes.push(0x4d,0x54,0x68,0x64); // "MThd"
  pushU32BE(6);
  pushU16BE(0); // format 0
  pushU16BE(1); // 1 track
  pushU16BE(ppq);

  // track bytes collector
  const track = [];

  // tempo meta
  const microsecondsPerQuarter = Math.round(60000000 / tempoBPM);
  writeVarLen(0, track);
  track.push(0xFF, 0x51, 0x03);
  track.push((microsecondsPerQuarter >> 16) & 0xff, (microsecondsPerQuarter >> 8) & 0xff, microsecondsPerQuarter & 0xff);

  // program change (optional)
  writeVarLen(0, track); track.push(0xC0 | channel, 0);

  // set pitch bend range via RPN (delta 0)
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

  // utility: convert frequency to midiFloat (not strictly used if notes already provide midiFloat)
  function freqToMidiFloat(freq, npo) {
    if (!freq || freq <= 0) return null;
    if (npo && npo > 0) {
      const micro = Math.round(npo * Math.log2(freq / a4));
      return 69 + (12 * micro) / npo;
    } else {
      return 69 + 12 * Math.log2(freq / a4);
    }
  }

  // compute ticks per second for tick conversions
  const ticksPerSec = ppq * (tempoBPM / 60);

  // helper: produce 14-bit pitch bend from fractional midi relative to base
  function midiFloatToPitchBend(midiFloat, baseMidi, rangeSemitones) {
    const semitoneOffset = midiFloat - baseMidi;
    const normalized = semitoneOffset / rangeSemitones;
    const clamped = Math.max(-1, Math.min(1, normalized));
    const value = Math.round(8192 + clamped * 8192);
    return Math.max(0, Math.min(16383, value));
  }

  // Build compact event list: arrays [tick, order, type, a, b, extra...]
  // order: cc(-1) -> pitch-bend(0) -> note-on(1) -> note-off(2) for stable ordering
  const events = [];
  for (let i = 0, L = notes.length; i < L; ++i) {
    const note = notes[i];
    if (!note || typeof note.lengthSeconds !== "number") continue;

    const startTime = (typeof note.startTime === 'number') ? note.startTime : 0;
    const startTick = Math.max(0, Math.round(startTime * ticksPerSec));
    const lengthTicks = Math.max(1, Math.round(note.lengthSeconds * ticksPerSec));
    const endTick = startTick + lengthTicks;

    // derive midiFloat
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

    // If velChanges exists and useVolumeControllers is true, create CC events; otherwise rely on note.velocity and possibly split earlier
    const velChanges = Array.isArray(note.velChanges) ? note.velChanges : [{ offsetFrames: 0, vel: velocity }];

    if (useVolumeControllers) {
      // emit initial CC at startTick with first vel
      const initialCC = Math.max(0, Math.min(127, Math.round(velChanges[0].vel)));
      events.push([startTick, -1, 'cc', 0x07, initialCC]); // controller #7 (channel volume)

      // emit CC changes for each subsequent change (skip offset=0 already emitted)
      for (let vc = 0; vc < velChanges.length; vc++) {
        const c = velChanges[vc];
        if (c.offsetFrames === 0) continue; // already emitted
        const offsetSeconds = (c.offsetFrames * hop) / sampleRate;
        const changeTick = startTick + Math.round(offsetSeconds * ticksPerSec);
        const ccval = Math.max(0, Math.min(127, Math.round(c.vel)));
        events.push([changeTick, -1, 'cc', 0x07, ccval]);
      }

      // push pitch-bend, note-on, note-off as before
      events.push([startTick, 0, 'pb', pbLSB, pbMSB]);
      events.push([startTick, 1, 'on', baseMidi, Math.max(1, Math.min(127, Math.round(velChanges[0].vel)))]);
      events.push([endTick,   2, 'off', baseMidi, 0]);
    } else {
      // not using volume controllers: fallback to single note-on velocity (notes were split earlier based on velocity)
      events.push([startTick, 0, 'pb', pbLSB, pbMSB]);
      events.push([startTick, 1, 'on', baseMidi, velocity]);
      events.push([endTick,   2, 'off', baseMidi, 0]);
    }
  }

  // sort events - numeric comparator
  events.sort(function(a,b){
    if (a[0] < b[0]) return -1;
    if (a[0] > b[0]) return  1;
    return a[1] - b[1];
  });

  // write events with proper delta times (iterative)
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
      // Control Change: ev[3] = controller, ev[4] = value
      track.push(0xB0 | (channel & 0x0f), ev[3] & 0x7f, ev[4] & 0x7f);
    }

    lastTick = ev[0];
  }

  // End of track meta
  writeVarLen(0, track);
  track.push(0xFF, 0x2F, 0x00);

  // Write track chunk header + bytes
  bytes.push(0x4d,0x54,0x72,0x6b); // "MTrk"
  pushU32BE(track.length);
  
  const totalLen = bytes.length + track.length;
  const out = new Uint8Array(totalLen);

  let k = 0;
  for (let i = 0; i < bytes.length; ++i) out[k++] = bytes[i];
  for (let i = 0; i < track.length; ++i) out[k++] = track[i];

  // optional download
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

  const factor = sampleRate / fftSize; // Hz per bin

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

    // === New simplified loop ===
    for (const peak of peaks) {
      if (suppressed[peak.bin]) continue; // already removed as harmonic
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
        processedMags[bin] = 0//fmags[bin] / 100000;
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

  // CommonJS / Node
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  // AMD
  if (typeof define === 'function' && define.amd) {
    define(() => api);
  }

  // Browser global
  if (typeof window !== 'undefined') {
    window.MIDI = Object.assign(window.MIDI || {}, api);
  }
})();