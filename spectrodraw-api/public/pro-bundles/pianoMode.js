let notes = [];
let scheduledNodes = []; 
let notesStartTime = 0; 
let notesStartOffset = 0; 
let notesProgressInterval = null;
function stopScheduledNotes(){
  if(!audioCtx) return;
  for(const s of scheduledNodes){
    try {
      if(s.gain) {
        s.gain.gain.cancelScheduledValues(audioCtx.currentTime);
        s.gain.gain.setValueAtTime(0, audioCtx.currentTime);
      }
      for(const o of s.oscNodes || []) {
        try { o.stop(); } catch(e) {}
        try { o.disconnect(); } catch(e) {}
      }
      if(s.gain && s.gain.disconnect) s.gain.disconnect();
    } catch(e){}
  }
  scheduledNodes.length = 0;
}
function stopNotesPlayback(){
  playing = false;
  stopScheduledNotes();
  if(notesProgressInterval){ clearInterval(notesProgressInterval); notesProgressInterval = null; }
}
function midiToFreq(m){
  return 440 * Math.pow(2, (m - 69) / 12);
}
async function playNotes() {
  if(!notes || !Array.isArray(notes) || notes.length === 0){
    return;
  }
  if(!audioCtx) audioCtx = new (window.AudioContext)();
  if(audioCtx.state === 'suspended') {
    try { await audioCtx.resume(); } catch(e) { console.warn('audioCtx.resume() failed:', e); }
  }
  playing = true;
  stopScheduledNotes();
  notesStartOffset = Math.min(currentCursorX/framesTotal*emptyAudioLength, emptyAudioLength);
  notesStartTime = audioCtx.currentTime;
  const minFloor = 0.000001;
  let periodicWave = null;
  if(synthParams.waveform === 'custom'){
    const N = synthharmonics.length;
    const real = new Float32Array(N+1);
    const imag = new Float32Array(N+1);
    real.fill(0);
    imag.fill(0);
    for(let i=1;i<=N;i++){
      imag[i] = synthharmonics[i-1] || 0;
    }
    try {
      periodicWave = audioCtx.createPeriodicWave(real, imag, {disableNormalization:false});
    } catch(e) {
      console.warn('createPeriodicWave failed, falling back to saw:', e);
      periodicWave = null;
    }
  }
  function makeReverbIR(decayTime, lengthSec=2.5) {
    const rate = audioCtx.sampleRate;
    const len = Math.floor(rate * lengthSec);
    const ir = audioCtx.createBuffer(2, len, rate);
    for(let ch=0;ch<2;ch++){
      const data = ir.getChannelData(ch);
      for(let i=0;i<len;i++){
        data[i] = (Math.random()*2-1) * Math.pow(1 - i/len, decayTime);
      }
    }
    return ir;
  }
  for(const note of notes){
    const start =note.startTime;
    const dur = note.lengthSeconds;
    const noteEnd = start + dur;
    if(noteEnd <= notesStartOffset) continue;
    const relativeStart = start - notesStartOffset;
    const when = audioCtx.currentTime + relativeStart;
    const midi = Math.round(note.midiFloat || 60);
    const freq = midiToFreq(midi);
    const vel = note.velocity || 1;
    const velNorm = Math.max(0.01, Math.min(1, vel));
    const peakGain = velNorm;
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(minFloor, audioCtx.currentTime);
    const panner = audioCtx.createStereoPanner();
    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    const hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass';
    lp.Q.value = synthParams.filter.q || 0.7;
    hp.Q.value = synthParams.filter.q || 0.7;
    const delayMixGain = audioCtx.createGain();
    const delayFBGain = audioCtx.createGain();
    const delayNode = audioCtx.createDelay(5.0);
    const delaySend = audioCtx.createGain();
    const chorusMixGain = audioCtx.createGain();
    const chorusDelay = audioCtx.createDelay();
    const chorusLFOgain = audioCtx.createGain();
    const chorusLFO = audioCtx.createOscillator();
    const reverbConvolver = audioCtx.createConvolver();
    const reverbSend = audioCtx.createGain();
    if(synthParams.reverb && synthParams.reverb.enabled){
      const ir = makeReverbIR(synthParams.reverb.decay || 2.4, Math.min(6, Math.max(0.3, synthParams.reverb.decay || 2.4)));
      reverbConvolver.buffer = ir;
    }
    const osc = audioCtx.createOscillator();
    if(synthParams.waveform === 'custom' && periodicWave){
      try { osc.setPeriodicWave(periodicWave); }
      catch(e){ console.warn('setPeriodicWave failed', e); osc.type = 'sawtooth'; }
    } else {
      osc.type = (['sine','square','sawtooth','triangle'].includes(synthParams.waveform) ? synthParams.waveform : 'sawtooth');
    }
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.detune.setValueAtTime(synthParams.detune || 0, audioCtx.currentTime);
    osc.connect(hp);
    hp.connect(lp);
    lp.connect(panner);
    panner.connect(gainNode);
    const masterGain = audioCtx.createGain();
    masterGain.gain.value = masterVolumeKnob.getValue();
    gainNode.connect(masterGain);
    gainNode.connect(delaySend);
    delaySend.connect(delayNode);
    delayNode.connect(delayFBGain);
    delayFBGain.connect(delayNode);
    delayNode.connect(delayMixGain); 
    delayMixGain.connect(masterGain); 
    gainNode.connect(chorusDelay);
    chorusDelay.connect(chorusMixGain);
    chorusMixGain.connect(masterGain);
    gainNode.connect(reverbSend);
    reverbSend.connect(reverbConvolver);
    reverbConvolver.connect(masterGain);
    delayNode.delayTime.value = synthParams.delay.time || 0.25;
    delayFBGain.gain.value = synthParams.delay.feedback || 0.35;
    delayMixGain.gain.value = synthParams.delay.mix || 0.2;
    delaySend.gain.value = (synthParams.delay.enabled ? 1 : 0);
    chorusMixGain.gain.value = (synthParams.chorus.enabled ? synthParams.chorus.mix : 0);
    chorusDelay.delayTime.value = 0.015; 
    chorusLFO.type = 'sine';
    chorusLFO.frequency.value = synthParams.chorus.rate || 1;
    chorusLFOgain.gain.value = synthParams.chorus.depth || 0.015;
    chorusLFO.connect(chorusLFOgain);
    chorusLFOgain.connect(chorusDelay.delayTime);
    chorusLFO.start();
    reverbSend.gain.value = (synthParams.reverb.enabled ? synthParams.reverb.mix : 0);
    masterGain.connect(audioCtx.destination);
    const now = Math.max(audioCtx.currentTime, when - 0.005);
    const noteOn = when;
    const noteOff = when + Math.max(0.01, dur);
    const vEnv = synthParams.volEnv || {a:0.1,d:0.18,s:0.24,r:0.28};
    gainNode.gain.setValueAtTime(minFloor, now);
    const volAmt = (typeof vEnv.amt === 'number' ? vEnv.amt : 1);
    const peakLevel = Math.max(minFloor, peakGain * volAmt);
    const sustainLevel = Math.max(minFloor, peakGain * (vEnv.s || 0) * volAmt);
    gainNode.gain.exponentialRampToValueAtTime(peakLevel, noteOn + (vEnv.a || 0));
    gainNode.gain.exponentialRampToValueAtTime(sustainLevel, noteOn + (vEnv.a || 0) + (vEnv.d || 0));
    gainNode.gain.setValueAtTime(gainNode.gain.value, Math.max(audioCtx.currentTime, noteOff - (vEnv.r || 0)));
    gainNode.gain.exponentialRampToValueAtTime(minFloor, noteOff + 0.05);
    const pEnv = synthParams.pitEnv || { a:0, d:0, s:0, r:0, amt:0 };
    const attackTime = pEnv.a || 0;
    const decayTime = pEnv.d || 0;
    const releaseTime = pEnv.r || 0;
    const semitoneSustain = (pEnv.s || 0) * (typeof pEnv.amt === 'number' ? pEnv.amt : 1);
    const sustainMultiplier = Math.pow(2, semitoneSustain / 12);
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.linearRampToValueAtTime(freq * sustainMultiplier, noteOn + attackTime + decayTime);
    osc.frequency.setValueAtTime(osc.frequency.value, Math.max(audioCtx.currentTime, noteOff - releaseTime));
    osc.frequency.linearRampToValueAtTime(freq, noteOff + 0.05);
    const panE = synthParams.panEnv || {a:0.01,d:0.1,s:0,r:0.2,amt:0};
    panner.pan.setValueAtTime(0, now);
    const panAmt = (typeof panE.amt === 'number' ? panE.amt : 1);
    const targetPan = (panE.s || 0) * panAmt; 
    panner.pan.linearRampToValueAtTime(clamp(targetPan, -1, 1), noteOn + (panE.a || 0) + (panE.d || 0));
    panner.pan.setValueAtTime(panner.pan.value, Math.max(audioCtx.currentTime, noteOff - (panE.r || 0)));
    panner.pan.linearRampToValueAtTime(0, noteOff + 0.05);
    const mEnv = synthParams.modEnv || { a:0, d:0, s:0, r:0, amt:0 };
    const mAmt = typeof mEnv.amt === 'number' ? mEnv.amt : 0;
    const baseLP = Math.max(20, Number(synthParams.filter.lp) || 18000);
    const baseHP = Math.max(20, Number(synthParams.filter.hp) || 20);
    lp.frequency.setValueAtTime(baseLP, now);
    hp.frequency.setValueAtTime(baseHP, now);
    if (mAmt !== 0) {
      const peakLP = Math.max(20, baseLP * (1 - mAmt)); 
      const sustainLP = Math.max(20, baseLP * (1 - (mEnv.s || 0) * mAmt));
      const nyquist = audioCtx.sampleRate ? audioCtx.sampleRate / 2 : 20000;
      const peakHP = Math.min(nyquist, baseHP * (1 + mAmt));
      const sustainHP = Math.min(nyquist, baseHP * (1 + (mEnv.s || 0) * mAmt));
      lp.frequency.linearRampToValueAtTime(peakLP, noteOn + (mEnv.a || 0));
      lp.frequency.linearRampToValueAtTime(sustainLP, noteOn + (mEnv.a || 0) + (mEnv.d || 0));
      hp.frequency.linearRampToValueAtTime(peakHP, noteOn + (mEnv.a || 0));
      hp.frequency.linearRampToValueAtTime(sustainHP, noteOn + (mEnv.a || 0) + (mEnv.d || 0));
      lp.frequency.setValueAtTime(lp.frequency.value, Math.max(audioCtx.currentTime, noteOff - (mEnv.r || 0)));
      lp.frequency.linearRampToValueAtTime(baseLP, noteOff + 0.05);
      hp.frequency.setValueAtTime(hp.frequency.value, Math.max(audioCtx.currentTime, noteOff - (mEnv.r || 0)));
      hp.frequency.linearRampToValueAtTime(baseHP, noteOff + 0.05);
    }
    try { osc.start(Math.max(audioCtx.currentTime, noteOn - 0.005)); } catch(e){ console.log('osc start err', e); }
    try { osc.stop(noteOff + 0.2); } catch(e){ console.log('osc stop err', e); }
    scheduledNodes.push({
      oscNodes: [osc],
      lfoNodes: [chorusLFO],
      gain: gainNode,
      stopAt: noteOff + 0.1,
      cleanup: ()=>{
        try { chorusLFO.disconnect(); } catch(e){}
        try { osc.disconnect(); } catch(e){}
        try { gainNode.disconnect(); } catch(e){}
      }
    });
    ((stopAt, rec) => {
      const tid = setTimeout(()=> {
        try { rec.cleanup(); } catch(e) {}
      }, Math.max(0, (stopAt - audioCtx.currentTime)*1000 + 50));
    })(scheduledNodes[scheduledNodes.length-1].stopAt, scheduledNodes[scheduledNodes.length-1]);
  } 
}
function recomputeNotesForCols(colStart,colEnd) {
  notes = exportMidiLegacy(0,false).notes;
}
let synthharmonics = new Float32Array(100);
for(let i=0;i<100;i++) synthharmonics[i]=0;
synthharmonics[0]=1.0;
window.synthParams = {
  waveform: 'sine', 
  detune: 0, 
  volEnv: { a:0.1, amt:1.0, d:0.18, s:0.24, r:0.28 },
  pitEnv: { a:0, amt:1.0, d:0, s:0, r:0 }, 
  panEnv: { a:0.01, amt:1.0, d:0.1, s:0, r:0.2 },
  modEnv: { a:0.01, amt:1.0, d:0.1, s:0, r:0.2 },
  filter: { lp:18000, hp:20, q:0.7},
  chorus: { enabled:false, rate:1, depth:0.015, mix:0.25 },
  delay: { enabled:false, time:0.25, feedback:0.35, mix:0.2 },
  reverb: { enabled:false, decay:2.4, mix:0.15 },
};
(function(){
  const presetSelect = document.getElementById('presetSelect');
  const waveSelect = document.getElementById('waveSelect');
  const detuneEl = document.getElementById('detune');
  const detuneVal = document.getElementById('detuneVal');
  const harmonicCanvas = document.getElementById('harmonicCanvas');
  const lpVal = document.getElementById('lpVal');
  const hpVal = document.getElementById('hpVal');
  const filterPad = document.getElementById('filterPad');
  const filterQ = document.getElementById('filterQ');
  const filterQVal = document.getElementById('filterQVal');
    // enable checkboxes (keep these as inputs)
  const chorusEnable = document.getElementById('chorusEnable');
  const delayEnable = document.getElementById('delayEnable');
  const reverbEnable = document.getElementById('reverbEnable');

  // knob container elements (we will wrap them with Knob instances)
  const chorusRateKnobEl = document.getElementById('chorusRateKnob');
  const chorusDepthKnobEl = document.getElementById('chorusDepthKnob');
  const chorusMixKnobEl = document.getElementById('chorusMixKnob');

  const delayTimeKnobEl = document.getElementById('delayTimeKnob');
  const delayFBKnobEl = document.getElementById('delayFBKnob');
  const delayMixKnobEl = document.getElementById('delayMixKnob');

  const reverbDecayKnobEl = document.getElementById('reverbDecayKnob');
  const reverbMixKnobEl = document.getElementById('reverbMixKnob');
  const savePresetBtn = document.getElementById('savePresetBtn');
  const uploadPresets = document.getElementById('uploadPresets');
  const waveOptions = ['custom','sine','square','sawtooth','triangle'];
  for(const w of waveOptions){
    const opt = document.createElement('option');
    opt.value = w;
    opt.textContent = (w==='custom' ? 'Custom' : w[0].toUpperCase()+w.slice(1));
    waveSelect.appendChild(opt);
  }
  const presets = [];
  function pushPreset(obj){
    presets.push(obj);
    refreshPresetSelect();
  }
  function refreshPresetSelect(){
    presetSelect.innerHTML = '';
    presets.forEach((p, idx) => {
      const o = document.createElement('option');
      o.value = idx;
      o.textContent = p.name || `Preset ${idx+1}`;
      presetSelect.appendChild(o);
    });
  }
  function makePreset(name, params, harmonicsArr=null){
    return { name, params: JSON.parse(JSON.stringify(params || {})), harmonics: harmonicsArr ? Float32Array.from(harmonicsArr) : Float32Array.from(synthharmonics) };
  }
  pushPreset(makePreset('Default', {...synthParams, waveform:'sine', detune:0}, (()=>{ const h=new Float32Array(100); h[0]=1; return h; })()));
  pushPreset(makePreset('Square', {...synthParams, waveform:'square', detune:0}, (()=>{ const h=new Float32Array(100); for(let i=0;i<100;i++) h[i]=(i%2===0?0:1/(i+1)); return h; })()));
  pushPreset(makePreset('Saw', {...synthParams, waveform:'sawtooth', detune:0}, (()=>{let l=new Float32Array(100); for (let i = 0; i < 100; i++) { l[i] = 1 / (i + 1); } return l;})()));
  pushPreset(makePreset('Triangle', {...synthParams, waveform:'triangle', detune:0}, (()=>{let l=new Float32Array(100); for (let i = 0; i < 100; i++) { l[i] = (i % 2 === 0) ? 0 : 1 / ((i + 1) * (i + 1)); } return l;})()));
  pushPreset(makePreset('Crystal Bloom', {...synthParams, waveform:'custom', detune:0, volEnv:{a:0.01,d:0.3,s:0.5,r:1.2}}, (()=>{ const h=new Float32Array(100); for(let i=0;i<100;i++) h[i]=Math.exp(0-((i-2)/8)**2) * (0.6 + 0.4*Math.random()); return h; })()));
  pushPreset(makePreset('Warm Pad', {...synthParams, waveform:'custom', detune:-6, volEnv:{a:0.5,d:1.6,s:0.8,r:1.6}, reverb:{enabled:true,decay:3.6,mix:0.3}}, (()=>{ const h=new Float32Array(100); for(let i=0;i<100;i++) h[i]=Math.exp(-i/12) * 0.9; return h; })()));
  pushPreset(makePreset('Chiptune Lead', {...synthParams, waveform:'custom', detune:0, volEnv:{a:0.001,d:0.06,s:0.7,r:0.05}}, (()=>{ const h=new Float32Array(100); for(let i=0;i<100;i++) h[i] = (Math.random()>0.5?1:0)*(i<20?1/(i+1):0); return h; })()));
  pushPreset(makePreset('Bell', {...synthParams, waveform:'custom', detune:0, volEnv:{a:0.001,d:0.6,s:0.01,r:1.8}}, (()=>{ const h=new Float32Array(100); for(let i=0;i<100;i++) h[i] = Math.exp(-i/6) * Math.sin(i*1.7)**2; return h; })()));
  refreshPresetSelect();
  function loadPreset(idx){
    const p = presets[idx];
    if(!p) return;
    synthParams = new Object(p.params);
    // const newParams = JSON.parse(JSON.stringify(p.params || {}));

    // // overwrite primitives
    // synthParams.waveform = newParams.waveform ?? synthParams.waveform;
    // synthParams.detune   = newParams.detune   ?? synthParams.detune;

    // // deep-merge nested objects safely
    // synthParams.filter  = { ...synthParams.filter,  ...(newParams.filter  || {}) };
    // synthParams.volEnv  = { ...synthParams.volEnv,  ...(newParams.volEnv  || {}) };
    // synthParams.pitEnv  = { ...synthParams.pitEnv,  ...(newParams.pitEnv  || {}) };
    // synthParams.panEnv  = { ...synthParams.panEnv,  ...(newParams.panEnv  || {}) };
    // synthParams.modEnv  = { ...synthParams.modEnv,  ...(newParams.modEnv  || {}) };

    // // ⭐ THIS PART FIXES YOUR ISSUE
    // (function applyEffect(name, allowedKeys = []) {
    //   const src = newParams[name] || {};
    //   // copy existing object then override with whatever is present in src
    //   synthParams[name] = { ...(synthParams[name] || {}), ...src };

    //   // ensure boolean 'enabled' is copied even if false
    //   if ('enabled' in src) synthParams[name].enabled = Boolean(src.enabled);

    //   // explicitly copy allowed numeric/string keys only if present on src
    //   allowedKeys.forEach(k => {
    //     if (k in src) synthParams[name][k] = src[k];
    //   });
    // })('chorus', ['rate','depth','mix']);

    // (function applyEffectDelay() {
    //   const src = newParams.delay || {};
    //   synthParams.delay = { ...(synthParams.delay || {}), ...src };
    //   if ('enabled' in src) synthParams.delay.enabled = Boolean(src.enabled);
    //   ['time','feedback','mix'].forEach(k => { if (k in src) synthParams.delay[k] = src[k]; });
    // })();

    // (function applyEffectReverb() {
    //   const src = newParams.reverb || {};
    //   synthParams.reverb = { ...(synthParams.reverb || {}), ...src };
    //   if ('enabled' in src) synthParams.reverb.enabled = Boolean(src.enabled);
    //   ['decay','mix'].forEach(k => { if (k in src) synthParams.reverb[k] = src[k]; });
    // })();
    if(p.harmonics){
      for(let i=0;i<100;i++) synthharmonics[i] = p.harmonics[i] || 0;
    }
    if (synthParams.volEnv) {
      envelopes.Volume.attack = Number(synthParams.volEnv.a || 0.1);
      envelopes.Volume.amt = Number(synthParams.volEnv.amt || 1);
      envelopes.Volume.delay = Number(synthParams.volEnv.d || 0.18);
      envelopes.Volume.sustain = Number(synthParams.volEnv.s || 0.24);
      envelopes.Volume.release = Number(synthParams.volEnv.r || 0.28);
    }
    if (synthParams.pitEnv) {
      envelopes.Pitch.attack = Number(synthParams.pitEnv.a || 0.1);
      envelopes.Pitch.amt = Number(synthParams.pitEnv.amt || 0);
      envelopes.Pitch.delay = Number(synthParams.pitEnv.d || 0.1);
      envelopes.Pitch.sustain = Number(synthParams.pitEnv.s || 0.5);
      envelopes.Pitch.release = Number(synthParams.pitEnv.r || 0.1);
    }
    if (synthParams.panEnv) {
      envelopes.Pan.attack = Number(synthParams.panEnv.a || 0.1);
      envelopes.Pan.amt = Number(synthParams.panEnv.amt || 0);
      envelopes.Pan.delay = Number(synthParams.panEnv.d || 0.1);
      envelopes.Pan.sustain = Number(synthParams.panEnv.s || 0.5);
      envelopes.Pan.release = Number(synthParams.panEnv.r || 0.1);
    }
    if (synthParams.modEnv) {
      envelopes.Mod.attack = Number(synthParams.modEnv.a || 0.1);
      envelopes.Mod.amt = Number(synthParams.modEnv.amt || 0);
      envelopes.Mod.delay = Number(synthParams.modEnv.d || 0.1);
      envelopes.Mod.sustain = Number(synthParams.modEnv.s || 0.5);
      envelopes.Mod.release = Number(synthParams.modEnv.r || 0.1);
    }
    updateKnobsFromEnvelope();
    drawEnvelope();
    window.loadingPreset=true;
    waveSelect.value = synthParams.waveform || 'custom';
    detuneEl.value = synthParams.detune || 0;
    detuneVal.textContent = detuneEl.value;
    lpVal.value = synthParams.filter.lp; hpVal.value = synthParams.filter.hp; filterQ.value = synthParams.filter.q;
    filterQVal.textContent = filterQ.value;
    chorusEnable.checked = !!synthParams.chorus.enabled;
    delayEnable.checked = !!synthParams.delay.enabled;
    reverbEnable.checked = !!synthParams.reverb.enabled;
    chorusRateKnob.setValue(Number(synthParams.chorus.rate || 1), true);
    chorusDepthKnob.setValue(Number(synthParams.chorus.depth || 0.015), true);
    chorusMixKnob.setValue(Number(synthParams.chorus.mix || 0.25), true);

    delayTimeKnob.setValue(Number(synthParams.delay.time || 0.25), true);
    delayFBKnob.setValue(Number(synthParams.delay.feedback || 0.35), true);
    delayMixKnob.setValue(Number(synthParams.delay.mix || 0.2), true);

    reverbDecayKnob.setValue(Number(synthParams.reverb.decay || 2.4), true);
    reverbMixKnob.setValue(Number(synthParams.reverb.mix || 0.15), true);
    window.loadingPreset=false;
    updateKnobDisabled();
    drawHarmonics();
    drawFilterPad();
  }
  presetSelect.addEventListener('change', (e)=> {
    const idx = parseInt(e.target.value);
    loadPreset(idx);
  });
  savePresetBtn.addEventListener('click', async () => {
    const data = {
      params: JSON.parse(JSON.stringify(synthParams)),
      harmonics: Array.from(synthharmonics)
    };

    const json = JSON.stringify(data, null, 2);

    // Modern browsers (Chrome, Edge, etc.)
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: (data.name || 'my-preset') + '.json',
          types: [{
            description: 'JSON Preset',
            accept: { 'application/json': ['.json'] }
          }]
        });

        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        return;
      } catch (err) {
        // user cancelled dialog → do nothing
        return;
      }
    }

    // Fallback for Firefox/Safari (auto download)
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (data.name || 'my-preset') + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
  waveSelect.addEventListener('change', (e) => {
    const v = e.target.value;
    synthParams.waveform = v;
    if (v === 'custom') {
    } else if (v === 'sine') {
      for (let i = 0; i < synthharmonics.length; i++) synthharmonics[i] = 0;
      synthharmonics[0] = 1.0;
    } else if (v === 'square') {
      for (let i = 0; i < synthharmonics.length; i++) {
        synthharmonics[i] = (i % 2 === 0) ? 0 : 1 / (i + 1);
      }
    } else if (v === 'sawtooth') {
      for (let i = 0; i < synthharmonics.length; i++) {
        synthharmonics[i] = 1 / (i + 1);
      }
    } else if (v === 'triangle') {
      for (let i = 0; i < synthharmonics.length; i++) {
        synthharmonics[i] = (i % 2 === 0) ? 0 : 1 / ((i + 1) * (i + 1));
      }
    }
    try { drawHarmonics(); } catch (err) { console.warn('drawHarmonics error', err); }
  });
  detuneEl.addEventListener('input', (e)=>{
    synthParams.detune = Number(e.target.value);
    detuneVal.textContent = e.target.value;
  });
  const fpCtx = filterPad.getContext('2d');
  function drawFilterPad(){
    const w = filterPad.width, h = filterPad.height;
    fpCtx.clearRect(0,0,w,h);
    fpCtx.strokeStyle = 'rgb(51, 17, 45)';
    fpCtx.fillStyle = '#180516';
    fpCtx.fillRect(0,0,w,h);
    fpCtx.strokeStyle = '#420b42';
    for(let i=0;i<4;i++){
      fpCtx.beginPath();
      fpCtx.moveTo((i+1)*w/5,0); fpCtx.lineTo((i+1)*w/5,h); fpCtx.stroke();
    }
    const minf = 20;
    const maxf = 22050;
    const lpValHz = Math.max(minf, Math.min(maxf, Number(synthParams.filter.lp) || minf));
    const hpValHz = Math.max(minf, Math.min(maxf, Number(synthParams.filter.hp) || minf));
    const xnorm = Math.log(lpValHz / minf) / Math.log(maxf / minf);
    const ynorm = 1 - (Math.log(hpValHz / minf) / Math.log(maxf / minf)); 
    const x = Math.max(0, Math.min(1, xnorm)) * w;
    const y = Math.max(0, Math.min(1, ynorm)) * h;
    fpCtx.fillStyle = '#cd4de1';
    fpCtx.beginPath();
    fpCtx.arc(x, y, 6, 0, Math.PI * 2);
    fpCtx.fill();
  }
  drawFilterPad();
  filterPad.addEventListener('pointerdown', (e)=>{
    const rect = filterPad.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    function applyXY(cx,cy){
      const w = rect.width, h = rect.height;
      const xnorm = Math.max(0, Math.min(1, cx / w));
      const ynorm = Math.max(0, Math.min(1, cy / h));
      const lp = Math.round( Math.pow(22050, xnorm) * Math.pow(20, 1-xnorm) ); 
      const minf=20, maxf=22050;
      const lp2 = Math.round(minf * Math.pow(maxf/minf, xnorm));
      const hp2 = Math.round(minf * Math.pow(maxf/minf, 1-ynorm));
      synthParams.filter.lp = Math.max(20, Math.min(22050, lp2));
      synthParams.filter.hp = Math.max(20, Math.min(22050, hp2));
      lpVal.value = synthParams.filter.lp;
      hpVal.value = synthParams.filter.hp;
      drawFilterPad();
    }
    applyXY(x,y);
    function move(e2){
      const rect2 = filterPad.getBoundingClientRect();
      const nx = e2.clientX - rect2.left;
      const ny = e2.clientY - rect2.top;
      applyXY(nx,ny);
    }
    function up(){
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
  lpVal.addEventListener('change', (e)=>{ synthParams.filter.lp = Number(e.target.value); drawFilterPad(); });
  hpVal.addEventListener('change', (e)=>{ synthParams.filter.hp = Number(e.target.value); drawFilterPad(); });
  filterQ.addEventListener('input', (e)=>{ synthParams.filter.q = Number(e.target.value); filterQVal.textContent = e.target.value; });
  const hCtx = harmonicCanvas.getContext('2d');
  function drawHarmonics(){
    const w = harmonicCanvas.width;
    const h = harmonicCanvas.height;
    hCtx.clearRect(0,0,w,h);
    hCtx.fillStyle = '#000';
    hCtx.fillRect(0,0,w,h);
    const barWidth = w / 100;
    const grad = hCtx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#ffffff'); 
    grad.addColorStop(1, 'rgb(72, 0, 255)');    
    hCtx.fillStyle = grad;
    for(let i = 0; i < 100; i++){
      const val = Math.max(0, Math.min(1, synthharmonics[i] || 0));
      const x = i * barWidth;
      const barHeight = val * h;
      const y = h - barHeight;
      hCtx.fillRect(x, y, barWidth - 1, barHeight);
    }
  }
  drawHarmonics();
  let isDrawing = false;
  function setHarmonicAt(clientX, clientY){
    const rect = harmonicCanvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const w = rect.width, h = rect.height;
    const idx = Math.floor((x / w) * 100);
    if(idx < 0 || idx >= 100) return;
    const val = 1 - Math.max(0, Math.min(1, y / h));
    synthharmonics[idx] = val;
    drawHarmonics();
  }
  harmonicCanvas.addEventListener('pointerdown', (e)=>{
    synthParams.waveform = "custom";
    waveSelect.value = "custom";
    isDrawing = true;
    setHarmonicAt(e.clientX, e.clientY);
    function move(e2){
      if(isDrawing) setHarmonicAt(e2.clientX, e2.clientY);
    }
    function up(e3){
      isDrawing = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
  harmonicCanvas.addEventListener('dblclick', (e)=>{
    const rect = harmonicCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const w = harmonicCanvas.width;
    const idx = Math.floor((x / w) * 100);
    if(idx>=0 && idx<100){ synthharmonics[idx] = 1.0; drawHarmonics(); }
  });
  function wireEffects(){
    if (window.loadingPreset) return;
    synthParams.chorus.enabled = !!chorusEnable.checked;
    synthParams.chorus.rate = Number(chorusRateKnob.getValue());
    synthParams.chorus.depth = Number(chorusDepthKnob.getValue());
    synthParams.chorus.mix = Number(chorusMixKnob.getValue());

    synthParams.delay.enabled = !!delayEnable.checked;
    synthParams.delay.time = Number(delayTimeKnob.getValue());
    synthParams.delay.feedback = Number(delayFBKnob.getValue());
    synthParams.delay.mix = Number(delayMixKnob.getValue());

    synthParams.reverb.enabled = !!reverbEnable.checked;
    synthParams.reverb.decay = Number(reverbDecayKnob.getValue());
    synthParams.reverb.mix = Number(reverbMixKnob.getValue());
  }
  [chorusEnable, delayEnable, reverbEnable].forEach(el => {
    el.addEventListener('input', wireEffects);
  });
  const chorusRateKnob = new Knob(chorusRateKnobEl, {
    name: 'Chorus Rate',
    type: 'continuous',
    range: [0.01, 5],
    value: synthParams.chorus.rate || 1,
    onInput: () => wireEffects()
  });
  const chorusDepthKnob = new Knob(chorusDepthKnobEl, {
    name: 'Chorus Depth',
    type: 'continuous',
    range: [0, 0.05],
    value: synthParams.chorus.depth || 0.015,
    onInput: () => wireEffects()
  });
  const chorusMixKnob = new Knob(chorusMixKnobEl, {
    name: 'Chorus Mix',
    type: 'continuous',
    range: [0, 1],
    value: synthParams.chorus.mix || 0.25,
    onInput: () => wireEffects()
  });

  const delayTimeKnob = new Knob(delayTimeKnobEl, {
    name: 'Delay Time',
    type: 'continuous',
    range: [0, 1],
    value: synthParams.delay.time || 0.25,
    onInput: () => wireEffects()
  });
  const delayFBKnob = new Knob(delayFBKnobEl, {
    name: 'Delay FB',
    type: 'continuous',
    range: [0, 0.99],
    value: synthParams.delay.feedback || 0.35,
    onInput: () => wireEffects()
  });
  const delayMixKnob = new Knob(delayMixKnobEl, {
    name: 'Delay Mix',
    type: 'continuous',
    range: [0, 1],
    value: synthParams.delay.mix || 0.2,
    onInput: () => wireEffects()
  });

  const reverbDecayKnob = new Knob(reverbDecayKnobEl, {
    name: 'Reverb Decay',
    type: 'continuous',
    range: [0.1, 8],
    value: synthParams.reverb.decay || 2.4,
    onInput: () => wireEffects()
  });
  const reverbMixKnob = new Knob(reverbMixKnobEl, {
    name: 'Reverb Mix',
    type: 'continuous',
    range: [0, 1],
    value: synthParams.reverb.mix || 0.15,
    onInput: () => wireEffects()
  });
  function initUI(){
    waveSelect.value = synthParams.waveform || 'custom';
    detuneEl.value = synthParams.detune || 0;
    detuneVal.textContent = detuneEl.value;
    lpVal.value = synthParams.filter.lp; hpVal.value = synthParams.filter.hp; filterQ.value = synthParams.filter.q;
    filterQVal.textContent = filterQ.value;
    chorusEnable.checked = !!synthParams.chorus.enabled;
    chorusRateKnob.setValue(Number(synthParams.chorus.rate || 1), true);
    chorusDepthKnob.setValue(Number(synthParams.chorus.depth || 0.015), true);
    chorusMixKnob.setValue(Number(synthParams.chorus.mix || 0.25), true);

    delayEnable.checked = !!synthParams.delay.enabled;
    delayTimeKnob.setValue(Number(synthParams.delay.time || 0.25), true);
    delayFBKnob.setValue(Number(synthParams.delay.feedback || 0.35), true);
    delayMixKnob.setValue(Number(synthParams.delay.mix || 0.2), true);

    reverbEnable.checked = !!synthParams.reverb.enabled;
    reverbDecayKnob.setValue(Number(synthParams.reverb.decay || 2.4), true);
    reverbMixKnob.setValue(Number(synthParams.reverb.mix || 0.15), true);
    drawHarmonics(); drawFilterPad();
  }
  initUI();
  document.getElementById("loadPresetBtn").addEventListener("click", () => uploadPresets.click());
  uploadPresets.addEventListener('change', (ev)=>{
    const f = ev.target.files[0];
    if(!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const json = JSON.parse(r.result);
        if(Array.isArray(json)){
          json.forEach(j => {
            const p = makePreset(j.name || 'uploaded', j.params || j, j.harmonics || null);
            pushPreset(p);
          });
        } else {
          const p = makePreset(f.name.replace(/\.json$/i,''), json.params || json, json.harmonics || null);
          pushPreset(p);
        }
        presetSelect.selectedIndex = presets.length - 1;
        presetSelect.dispatchEvent(new Event('change'));
      } catch(err) {
        alert('Invalid JSON file.');
      }
    };
    r.readAsText(f);
    uploadPresets.value = '';
  });
  window.historyStack = window.historyStack || [];
  window.historyIndex = typeof window.historyIndex === 'number' ? window.historyIndex : -1;
  function updateKnobDisabled() {
    const groups = [
      {
        checkbox: 'chorusEnable',
        knobs: ['chorusRateKnob','chorusDepthKnob','chorusMixKnob']
      },
      {
        checkbox: 'delayEnable',
        knobs: ['delayTimeKnob','delayFBKnob','delayMixKnob']
      },
      {
        checkbox: 'reverbEnable',
        knobs: ['reverbDecayKnob','reverbMixKnob']
      }
    ];

    groups.forEach(group => {
      const cb = document.getElementById(group.checkbox);
      if (!cb) return;

      group.knobs.forEach(id => {
        const knob = document.getElementById(id);
        if (knob) knob.classList.toggle('disabled', !cb.checked);
      });
    });
  }
  updateKnobDisabled();
  document.getElementById('chorusEnable').addEventListener('input', updateKnobDisabled);
  document.getElementById('delayEnable').addEventListener('input', updateKnobDisabled);
  document.getElementById('reverbEnable').addEventListener('input', updateKnobDisabled);
  function readExisting(id, fallback) {
    try {
      const el = document.getElementById(id);
      if (!el) return fallback;
      const v = parseFloat(el.value);
      return Number.isFinite(v) ? v : fallback;
    } catch (e) { return fallback; }
  }
  const tabs = ['Volume', 'Pitch', 'Pan', 'Mod'];
  const envelopes = {
    Volume: {
      attack: 0.1,
      amt: 1,
      delay: 0.18,
      sustain: 0.24,
      release: 0.28,
      ranges: { attack: [0, 2], delay: [0, 2], sustain: [0, 1], release: [0, 3], amt:[0,1] }
    },
    Pitch: {
      attack: 0.1,
      amt: 0,
      delay: 0.1,
      sustain: 0.5,
      release: 0.1,
      ranges: { attack: [0, 2], delay: [0, 2], sustain: [0, 12], release: [0, 3], amt:[-1,1] }
    },
    Pan: {
      attack: 0.1,
      amt: 0,
      delay: 0.1,
      sustain: 0.5,
      release: 0.1,
      ranges: { attack: [0, 1], delay: [0, 2], sustain: [-1, 1], release: [0, 3], amt:[0,1] }
    },
    Mod: {
      attack: 0.1,
      amt: 0,
      delay: 0.1,
      sustain: 0.5,
      release: 0.1,
      ranges: { attack: [0, 1], delay: [0, 2], sustain: [0, 1], release: [0, 3], amt:[0,1] }
    }
  };
  let currentTab = 'Volume';
  const canvas = document.getElementById('envCanvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const SUSTAIN_HOLD = 0.35;
  const attackKnob = new Knob(document.getElementById('attackKnob'), {
    name: 'Attack',
    type: 'continuous',
    range: envelopes[currentTab].ranges.attack.slice(),
    value: envelopes[currentTab].attack,
    onInput: onKnobInput
  });
  const amtKnob = new Knob(document.getElementById('amtKnob'), {
    name: 'Amount',
    type: 'continuous',
    range: envelopes[currentTab].ranges.amt.slice(),
    value: envelopes[currentTab].amt,
    onInput: onKnobInput
  });
  const delayKnob = new Knob(document.getElementById('delayKnob'), {
    name: 'Delay',
    type: 'continuous',
    range: envelopes[currentTab].ranges.delay.slice(),
    value: envelopes[currentTab].delay,
    onInput: onKnobInput
  });
  const sustainKnob = new Knob(document.getElementById('sustainKnob'), {
    name: 'Sustain',
    type: 'continuous',
    range: envelopes[currentTab].ranges.sustain.slice(),
    value: envelopes[currentTab].sustain,
    onInput: onKnobInput
  });
  const releaseKnob = new Knob(document.getElementById('releaseKnob'), {
    name: 'Release',
    type: 'continuous',
    range: envelopes[currentTab].ranges.release.slice(),
    value: envelopes[currentTab].release,
    onInput: onKnobInput
  });


  function updateKnobsFromEnvelope() {
    const env = envelopes[currentTab];
    attackKnob.range = env.ranges.attack.slice(); attackKnob.setValue(clamp(env.attack, ...attackKnob.range), true);
    amtKnob.range = env.ranges.amt.slice(); amtKnob.setValue(clamp(env.amt, ...amtKnob.range), true);
    delayKnob.range = env.ranges.delay.slice(); delayKnob.setValue(clamp(env.delay, ...delayKnob.range), true);
    sustainKnob.range = env.ranges.sustain.slice(); sustainKnob.setValue(clamp(env.sustain, ...sustainKnob.range), true);
    releaseKnob.range = env.ranges.release.slice(); releaseKnob.setValue(clamp(env.release, ...releaseKnob.range), true);
    attackKnob._buildLabels();amtKnob._buildLabels();delayKnob._buildLabels();sustainKnob._buildLabels();releaseKnob._buildLabels();
    attackKnob.render();amtKnob.render();delayKnob.render();sustainKnob.render();releaseKnob.render();
  }
  function onKnobInput(knobInstance) {
    const env = envelopes[currentTab];
    const v = knobInstance.getValue();
    if (knobInstance === attackKnob) env.attack = v;
    else if (knobInstance === amtKnob) env.amt = v;
    else if (knobInstance === delayKnob) env.delay = v;
    else if (knobInstance === sustainKnob) env.sustain = v;
    else if (knobInstance === releaseKnob) env.release = v;
    drawEnvelope();
  }
  function writeEnvToSynthParams(tabName, env) {
    if (!window.synthParams) return;
    if (tabName === 'Volume') {
      synthParams.volEnv.a = env.attack;
      synthParams.volEnv.amt = env.amt;
      synthParams.volEnv.d = env.delay;
      synthParams.volEnv.s = env.sustain;
      synthParams.volEnv.r = env.release;
    } else if (tabName === 'Pitch') {
      synthParams.pitEnv.a = env.attack;
      synthParams.pitEnv.amt = env.amt;
      synthParams.pitEnv.d = env.delay;
      synthParams.pitEnv.s = env.sustain;
      synthParams.pitEnv.r = env.release;
    } else if (tabName === 'Pan') {
      synthParams.panEnv.a = env.attack;
      synthParams.panEnv.amt = env.amt;
      synthParams.panEnv.d = env.delay;
      synthParams.panEnv.s = env.sustain;
      synthParams.panEnv.r = env.release;
    } else if (tabName === 'Mod') {
      synthParams.modEnv.a = env.attack;
      synthParams.modEnv.amt = env.amt;
      synthParams.modEnv.d = env.delay;
      synthParams.modEnv.s = env.sustain;
      synthParams.modEnv.r = env.release;
    }
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function totalDisplayTime(env) {
    return Math.max(env.attack + env.delay + env.release + SUSTAIN_HOLD, 0.25);
  }
  function timeToX(t, env) {
    const total = totalDisplayTime(env);
    return (t / total) * w;
  }
  function levelToY(level, env) {
    const range = env.ranges.sustain;
    const minL = Math.min(...range);
    const maxL = Math.max(...range);
    if (maxL === minL)
      return h * 0.5;
    const norm = (level - minL) / (maxL - minL);
    const scaledNorm = norm * Math.abs(env.amt);
    return h - scaledNorm * h;
  }
  function drawEnvelope() {
    writeEnvToSynthParams("Volume",envelopes.Volume);
    writeEnvToSynthParams("Pitch",envelopes.Pitch);
    writeEnvToSynthParams("Pan",envelopes.Pan);
    writeEnvToSynthParams("Mod",envelopes.Mod);
    const env = envelopes[currentTab];

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#2e2e2e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, h);
    ctx.moveTo(0, h);
    ctx.lineTo(w, h);
    ctx.stroke();
    const a = env.attack;
    const d = env.delay;
    const s = env.sustain;
    const r = env.release;
    const total = totalDisplayTime(env);
    const sustainHold = SUSTAIN_HOLD;
    const x0 = timeToX(0, env);
    const xA = timeToX(a, env);
    const xD = timeToX(a + d, env);
    const xS = timeToX(a + d + sustainHold, env);
    const xR = timeToX(a + d + sustainHold + r, env);
    const yTop = levelToY(env.ranges.sustain ? Math.max(...env.ranges.sustain) : 1, env); 
    const yPeak = levelToY( (env.ranges.sustain? Math.max(...env.ranges.sustain):1), env ); 
    const yS = levelToY(s, env);
    const yBase = levelToY( (env.ranges.sustain? Math.min(...env.ranges.sustain):0), env );
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#b888ff';
    ctx.beginPath();
    ctx.moveTo(x0, yBase);
    ctx.lineTo(xA, yPeak);
    ctx.lineTo(xD, yS);
    ctx.lineTo(xS, yS);
    ctx.lineTo(xR, yBase);
    ctx.stroke();
    ctx.fillStyle = 'rgba(136,192,255,0.08)';
    ctx.beginPath();
    ctx.moveTo(x0, yBase);
    ctx.lineTo(xA, yPeak);
    ctx.lineTo(xD, yS);
    ctx.lineTo(xS, yS);
    ctx.lineTo(xR, yBase);
    ctx.lineTo(x0, yBase);
    ctx.fill();
    const handles = [
      { id: 'attack', x: xA, y: yPeak },
      { id: 'delay', x: xD, y: yS },
      { id: 'sustain', x: xS, y: yS },
      { id: 'release', x: xR, y: yBase }
    ];
    ctx.fillStyle = '#56496c';
    ctx.strokeStyle = '#f9f9f9';
    handles.forEach(hd => {
      ctx.beginPath();
      ctx.arc(hd.x, hd.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    canvas._envHandles = handles;
  }
  let dragging = null; 
  let dragStart = {x:0,y:0,envCopy:null};
  function findClosestHandle(px, py) {
    const handles = canvas._envHandles || [];
    let best = null;
    let bestDist = 9999;
    handles.forEach(hd => {
      const dx = hd.x - px, dy = hd.y - py;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < bestDist) { bestDist = d; best = hd; }
    });
    if (bestDist <= 16) return best.id;
    return null;
  }
  function onCanvasPointerDown(e) {
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX ?? e.touches?.[0]?.clientX) - rect.left;
    const py = (e.clientY ?? e.touches?.[0]?.clientY) - rect.top;
    const hit = findClosestHandle(px, py);
    if (!hit) return;
    dragging = hit;
    dragStart.x = px; dragStart.y = py;
    dragStart.envCopy = Object.assign({}, envelopes[currentTab]);
    canvas.setPointerCapture?.(e.pointerId);
  }
  function onCanvasPointerMove(e) {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX ?? e.touches?.[0]?.clientX) - rect.left;
    const py = (e.clientY ?? e.touches?.[0]?.clientY) - rect.top;
    const env = envelopes[currentTab];
    const total = totalDisplayTime(env);
    const totalStart = totalDisplayTime(dragStart.envCopy || env);
    const xToTime = x => {
      const t = x / w;
      return clamp(t * totalStart, 0, totalStart);
    };
    const range = env.ranges.sustain;
    const minL = Math.min(...range), maxL = Math.max(...range);
    function yToLevel(y) {
      const t = clamp((h - y) / h, 0, 1);
      return minL + t * (maxL - minL);
    }
    if (dragging === 'attack') {
      const newA = xToTime(px);
      const maxA = Math.max(0, total - (env.delay + env.release + 0.01));
      env.attack = clamp(newA, env.ranges.attack[0], Math.min(env.ranges.attack[1], maxA));
    } else if (dragging === 'delay') {
      const t = xToTime(px);
      const newDelay = clamp(t - env.attack, env.ranges.delay[0], env.ranges.delay[1]);
      env.delay = Math.max(0, newDelay);
    } else if (dragging === 'sustain') {
      env.sustain = clamp(yToLevel(py), env.ranges.sustain[0], env.ranges.sustain[1]);
    } else if (dragging === 'release') {
      const t = xToTime(px);
      const base = env.attack + env.delay + SUSTAIN_HOLD;
      const newR = clamp(t - base, env.ranges.release[0], env.ranges.release[1]);
      env.release = Math.max(0, newR);
    }
    env.attack = clamp(env.attack, env.ranges.attack[0], env.ranges.attack[1]);
    env.delay = clamp(env.delay, env.ranges.delay[0], env.ranges.delay[1]);
    env.sustain = clamp(env.sustain, env.ranges.sustain[0], env.ranges.sustain[1]);
    env.release = clamp(env.release, env.ranges.release[0], env.ranges.release[1]);
    updateKnobsFromEnvelope();
    drawEnvelope();
  }
  function onCanvasPointerUp(e) {
    if (!dragging) return;
    dragging = null;
    try { canvas.releasePointerCapture?.(e.pointerId); } catch(e){}
  }
  canvas.addEventListener('pointerdown', onCanvasPointerDown);
  document.addEventListener('pointermove', onCanvasPointerMove);
  document.addEventListener('pointerup', onCanvasPointerUp);
  canvas.addEventListener('touchstart', function (ev) { onCanvasPointerDown(ev.changedTouches ? ev.changedTouches[0] : ev); ev.preventDefault(); });
  canvas.addEventListener('touchmove', function (ev) { onCanvasPointerMove(ev.changedTouches ? ev.changedTouches[0] : ev); ev.preventDefault(); });
  canvas.addEventListener('touchend', function (ev) { onCanvasPointerUp(ev.changedTouches ? ev.changedTouches[0] : ev); ev.preventDefault(); });
  document.querySelectorAll('.env-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.env-tab').forEach(b => {
        b.classList.remove('active');
        b.style.background = '';
      });
      btn.classList.add('active');
      btn.style.background = '#4af';
      currentTab = btn.dataset.tab;
      updateKnobsFromEnvelope();
      drawEnvelope();
    });
  });
  document.querySelectorAll('.env-tab').forEach(b => {
    b.style.background = (b.dataset.tab === currentTab ? '#4af' : '');
    if (b.dataset.tab === currentTab) b.classList.add('active');
  });
  updateKnobsFromEnvelope();
  drawEnvelope();
  window.envelopeUI = {
    getEnvelope(tabName = currentTab) { return Object.assign({}, envelopes[tabName]); },
    setEnvelope(tabName, envObj = {}) {
      if (!envelopes[tabName]) return;
      Object.assign(envelopes[tabName], envObj);
      if (tabName === currentTab) { updateKnobsFromEnvelope(); drawEnvelope(); }
    },
    selectTab(tabName) {
      const btn = Array.from(document.querySelectorAll('.env-tab')).find(b=>b.dataset.tab===tabName);
      if (btn) btn.click();
    }
  };
})();