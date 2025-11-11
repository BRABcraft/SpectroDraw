const ctx = originalCanvas.getContext("2d");
(function(){
  const MAX_SECONDS = 10.0;
  let effectiveDuration = MAX_SECONDS; 
  const originalAudio = document.getElementById('originalAudio');
  const midiAudio = document.getElementById('midiAudio');
  const uploadInput = document.getElementById('audioUpload');
  const midiFileName = document.getElementById('midi-file-name');
  const notesPlayPauseBtn = document.getElementById('midiPlayPause'); 
  const playOriginalBtn = document.getElementById('playOriginalBtn'); 
  const midiTime = document.getElementById('midi-time');
  const originalScrub = document.getElementById('originalScrub');
  const midiScrub = document.getElementById('midiScrub');
  const originalTime = document.getElementById('originalTime');
  const midiTimeDisplay = document.getElementById('midiTime');
  const uploadNote = document.getElementById('upload-note');
  const originalCanvas = document.getElementById('originalCanvas');
  const midiCanvas = document.getElementById('midiCanvas');
  const arrowImg = document.getElementById('arrowImg');
  function resizeCanvases(){
    const row = document.querySelector('.midi-row');
    if(!row) return;
    const style = getComputedStyle(row);
    const gap = parseInt(style.gap || 12,10) || 12;
    const arrowW = arrowImg ? (arrowImg.clientWidth || 56) : 56;
    const totalW = row.clientWidth;
    const availableForPanels = Math.max(0, totalW - arrowW - gap*2);
    const panelW = Math.floor(availableForPanels / 2);
    [originalCanvas, midiCanvas].forEach(c => {
      c.style.width = '100%';
      const pixelW = Math.max(32, panelW - 32);
      c.width = pixelW;
    });
  }
  window.addEventListener('resize', resizeCanvases);
  setTimeout(resizeCanvases, 50);
  function updateEffectiveDuration(){
    if(pcm && pcm.length && sampleRate){
      effectiveDuration = Math.min(MAX_SECONDS, pcm.length / sampleRate);
    } else if (originalAudio && isFinite(originalAudio.duration) && originalAudio.duration > 0){
      effectiveDuration = Math.min(MAX_SECONDS, originalAudio.duration);
    } else if (midiAudio && isFinite(midiAudio.duration) && midiAudio.duration > 0){
      effectiveDuration = Math.min(MAX_SECONDS, midiAudio.duration);
    } else {
      effectiveDuration = MAX_SECONDS;
    }
    originalScrub.max = effectiveDuration;
    midiScrub.max = effectiveDuration;
  }
  function enforceMaxDuringPlayback(audio){
    function timeUpdateHandler(){
      if(audio.currentTime >= effectiveDuration){
        audio.pause();
        audio.currentTime = effectiveDuration;
      }
    }
    audio.addEventListener('timeupdate', timeUpdateHandler);
  }
  enforceMaxDuringPlayback(originalAudio);
  enforceMaxDuringPlayback(midiAudio);
  let audioCtx = null;
  let scheduledNodes = []; 
  let notesPlaying = false;
  let notesStartTime = 0; 
  let notesStartOffset = 0; 
  let notesProgressInterval = null;
  function midiToFreq(m){
    return 440 * Math.pow(2, (m - 69) / 12);
  }
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
  function updateNotesButtonText(){
    const span = notesPlayPauseBtn.querySelector('span');
    span.textContent = notesPlaying ? 'Pause MIDI' : 'Play MIDI';
  }
  function updateOriginalButtonText(){
    const span = playOriginalBtn.querySelector('span');
    span.textContent = originalAudio && !originalAudio.paused ? 'Pause original' : 'Play original';
  }
  function updateTimeDisplays(){
    updateEffectiveDuration();
    originalTime.textContent = formatTime(Math.min(originalAudio.currentTime || 0, effectiveDuration), effectiveDuration);
    if(!originalScrubSeeking){
      originalScrub.value = Math.min(originalAudio.currentTime || 0, effectiveDuration);
    }
    drawOriginalPlayhead(originalAudio.currentTime || 0);
    originalScrub.max = effectiveDuration;
    midiScrub.max = effectiveDuration;
    if(notesPlaying && audioCtx) {
      const elapsed = Math.min(effectiveDuration, notesStartOffset + (audioCtx.currentTime - notesStartTime));
      midiTimeDisplay.textContent = formatTime(elapsed, effectiveDuration);
      midiTime.textContent = `${formatTime(elapsed, effectiveDuration)} / ${formatTime(effectiveDuration, effectiveDuration)}`;
      midiScrub.value = elapsed;      
      drawMidiPlayhead(elapsed);
      if(elapsed >= effectiveDuration) {
        stopNotesPlayback();
      }
    } else {
      const t = Math.min(midiAudio.currentTime || 0, effectiveDuration);
      midiTimeDisplay.textContent = formatTime(t, effectiveDuration);
      midiTime.textContent = `${formatTime(t, effectiveDuration)} / ${formatTime(effectiveDuration, effectiveDuration)}`;
      midiScrub.value = t;
      drawMidiPlayhead(t);
    }
  }
  async function startNotesPlayback(){
    try { if(typeof removeHarmonics === 'function') removeHarmonics(); } catch(e){}
    if(!notes || !Array.isArray(notes) || notes.length === 0){
      uploadNote.textContent = 'No MIDI notes available to play.';
      setTimeout(()=> uploadNote.textContent = '', 2400);
      return;
    }
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx.state === 'suspended') {
      try { await audioCtx.resume(); } catch(e) { console.warn('audioCtx.resume() failed:', e); }
    }
    stopScheduledNotes();
    notesPlaying = true;
    notesStartOffset = Math.min(parseFloat(midiScrub.value || 0), effectiveDuration);
    notesStartTime = audioCtx.currentTime;
    const attack = 0.006;
    const decay = 0.18;
    const sustainLevel = 0.24;
    const release = 0.28;
    const minFloor = 0.0001; 
    for(const note of notes){
      const start = (typeof note.startTime === 'number') ? note.startTime : 0;
      const dur = (typeof note.lengthSeconds === 'number') ? note.lengthSeconds : 0.5;
      const noteEnd = start + dur;
      if(noteEnd <= notesStartOffset) continue; 
      const relativeStart = Math.max(0, start - notesStartOffset);
      const when = audioCtx.currentTime + relativeStart;
      const freq = midiToFreq(Math.round(note.midiFloat || 60));
      const vel = note.velocity;
      const velNorm = Math.max(0.01, Math.min(1, vel / 127));
      const peakGain = velNorm;
      const gainNode = audioCtx.createGain();
      gainNode.gain.setValueAtTime(minFloor, audioCtx.currentTime);
      gainNode.connect(audioCtx.destination);
      const osc = audioCtx.createOscillator();
      osc.type = 'sawtooth';              
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      osc.connect(gainNode);
      const noteOn = when;
      const noteOff = when + Math.max(0.01, dur);
      const startTime = Math.max(audioCtx.currentTime, noteOn - 0.005);
      try { osc.start(startTime); } catch(e){}
      gainNode.gain.setValueAtTime(minFloor, startTime);
      gainNode.gain.exponentialRampToValueAtTime(Math.max(minFloor, peakGain), noteOn + attack);
      gainNode.gain.exponentialRampToValueAtTime(Math.max(minFloor, peakGain * sustainLevel), noteOn + attack + decay);
      gainNode.gain.setValueAtTime(gainNode.gain.value, Math.max(audioCtx.currentTime, noteOff - release));
      gainNode.gain.exponentialRampToValueAtTime(minFloor, noteOff + 0.05);
      try { osc.stop(noteOff + 0.1); } catch(e){}
      scheduledNodes.push({ oscNodes: [osc], gain: gainNode, stopAt: noteOff + 0.1 });
    }
    notesProgressInterval = setInterval(updateTimeDisplays, 120);
    updateNotesButtonText();
  }
  function stopNotesPlayback(){
    if(audioCtx && notesPlaying){
      const elapsed = Math.min(effectiveDuration, notesStartOffset + (audioCtx.currentTime - notesStartTime));
      midiScrub.value = elapsed;
    }
    notesPlaying = false;
    stopScheduledNotes();
    if(notesProgressInterval){ clearInterval(notesProgressInterval); notesProgressInterval = null; }
    updateNotesButtonText();
    updateTimeDisplays();
  }
  notesPlayPauseBtn.addEventListener('click', async ()=>{
    if(!notesPlaying){
      await startNotesPlayback();
    } else {
      stopNotesPlayback();
    }
  });
  playOriginalBtn.addEventListener('click', ()=>{
    if(originalAudio.paused){
      if(originalAudio.currentTime >= effectiveDuration) originalAudio.currentTime = 0;
      originalAudio.play();
    } else {
      originalAudio.pause();
    }
    updateOriginalButtonText();
  });
  originalAudio.addEventListener('play', updateOriginalButtonText);
  originalAudio.addEventListener('pause', updateOriginalButtonText);
  originalAudio.addEventListener('ended', updateOriginalButtonText);
  function formatTime(s, max = MAX_SECONDS){
    s = Math.max(0, Math.min(s, max));
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2,'0');
    return `${m}:${sec}`;
  }
  function updateMidiAudioButton(){
  }
  originalAudio.addEventListener('timeupdate', updateTimeDisplays);
  midiAudio.addEventListener('timeupdate', updateTimeDisplays);
  let originalScrubSeeking = false;
  let midiScrubSeeking = false;
  originalScrub.addEventListener('input', ()=> {
    originalScrubSeeking = true;
    const t = parseFloat(originalScrub.value);
    originalTime.textContent = formatTime(t, effectiveDuration);
  });
  originalScrub.addEventListener('change', ()=>{ 
    originalScrubSeeking = false;
    originalAudio.currentTime = Math.min(parseFloat(originalScrub.value), effectiveDuration);
  });
  midiScrub.addEventListener('input', ()=> {
    midiScrubSeeking = true;
    const t = parseFloat(midiScrub.value);
    midiTimeDisplay.textContent = formatTime(t, effectiveDuration);
  });
  midiScrub.addEventListener('change', ()=> {
    midiScrubSeeking = false;
    if(notesPlaying){
      stopNotesPlayback();
    }
    midiAudio.currentTime = Math.min(parseFloat(midiScrub.value), effectiveDuration);
  });
  function onMetadataLoadedFor(audioElement){
    updateEffectiveDuration();
    updateTimeDisplays();
  }
  function displayYToBin(y, h) {
    if (!h) return 0;
    const s = 2.0;
    if (s <= 1.0000001) {
        return Math.max(0, Math.min(h - 1, Math.round(h - 1 - y)));
    } else {
        const a = s - 1;
        const denom = Math.log(1 + a * (h - 1));
        if (!isFinite(denom) || denom === 0) return Math.max(0, Math.min(h - 1, Math.round(h - 1 - y)));
        const t = 1 - (y / (h - 1));
        const raw = (Math.exp(t * denom) - 1) / a;
        const clamped = Math.max(0, Math.min(h - 1, Math.round(raw)));
        return clamped;
    }
  }
  function magPhaseToRGB(mag, phase){
    const h = (phase / (2*Math.PI) + 1) % 1; 
    const s = 1;
    const v = Math.min(mag/60,1);
    const c = v*s;
    const m = v - c;
    const hp = h*6;
    const x = c*(1-Math.abs(hp%2-1));
    let r=0,g=0,b=0;
    if(hp < 1){ r=c; g=x; b=0; }
    else if(hp < 2){ r=x; g=c; b=0; }
    else if(hp < 3){ r=0; g=c; b=x; }
    else if(hp < 4){ r=0; g=x; b=c; }
    else if(hp < 5){ r=x; g=0; b=c; }
    else { r=c; g=0; b=x; }
    return [Math.floor((r+m)*255), Math.floor((g+m)*255), Math.floor((b+m)*255)];
  }
  originalAudio.addEventListener('loadedmetadata', ()=>onMetadataLoadedFor(originalAudio));
  midiAudio.addEventListener('loadedmetadata', ()=>onMetadataLoadedFor(midiAudio));
  function drawOriginalPlayhead(timeSec){
    if(!imageBuffer || !ctx) return;
    const t = Math.max(0, Math.min(timeSec || 0, effectiveDuration));
    const w = originalCanvas.width || 1;
    const x = Math.round((t / Math.max(1e-8, effectiveDuration)) * (w - 1));
    ctx.putImageData(imageBuffer, 0, 0);
    ctx.save();
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x, 0, 2, originalCanvas.height);
    ctx.globalAlpha = 0.25;
    ctx.fillRect(Math.max(0, x-4), 0, 9, originalCanvas.height);
    ctx.restore();
  }
  function drawMidiPlayhead(timeSec){
    if(!midiCanvas) return;
    const mctx = midiCanvas.getContext('2d');
    const t = Math.max(0, Math.min(timeSec || 0, effectiveDuration));
    const w = midiCanvas.width || 1;
    const x = Math.round((t / Math.max(1e-8, effectiveDuration)) * (w - 1));
    if(midiSnapshot && midiSnapshot.width === midiCanvas.width && midiSnapshot.height === midiCanvas.height){
      mctx.putImageData(midiSnapshot, 0, 0);
    }
    mctx.save();
    mctx.globalAlpha = 1.0;
    mctx.fillStyle = 'rgba(255,255,255,0.12)';
    mctx.fillRect(x, 0, 2, midiCanvas.height);
    mctx.globalAlpha = 0.22;
    mctx.fillRect(Math.max(0, x - 4), 0, 9, midiCanvas.height);
    mctx.restore();
  }
  async function restartRender(getNotesBool = true) {
    if (!pcm) return;
    win = hann(fftSize);
    framesTotal = Math.max(1, Math.floor((pcm.length - fftSize) / hop) + 1);
    const freqBins = Math.floor(fftSize / 2);
    originalCanvas.width = framesTotal;
    originalCanvas.height = freqBins;
    specWidth = originalCanvas.width;
    specHeight = originalCanvas.height;
    imageBuffer = new ImageData(originalCanvas.width, originalCanvas.height);
    mags = new Float32Array(specWidth * specHeight);
    phases = new Float32Array(specWidth * specHeight);
    for (let i = 0; i < specWidth * specHeight; i++) {
      mags[i] = 0;
      phases[i] = 0;
    }
    pos = 0;
    x = 0;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, originalCanvas.width, originalCanvas.height);
    const h = specHeight;
    const w = specWidth;
    for (let f = 0; f < specWidth; f++) {
      const re = new Float32Array(fftSize);
      const im = new Float32Array(fftSize);
      for (let i = 0; i < fftSize; i++) {
        re[i] = (pcm[pos + i] || 0) * win[i];
        im[i] = 0;
      }
      fft_inplace(re, im);
      for (let bin = 0; bin < h; bin++) {
        const mag = Math.hypot(re[bin] || 0, im[bin] || 0);
        const phase = Math.atan2(im[bin] || 0, re[bin] || 0);
        const idx = x * h + bin;
        mags[idx] = mag;
        phases[idx] = phase;
      }
      for (let yy = 0; yy < h; yy += 4) {
        const mappedBin = displayYToBin(yy, h);
        const idx = x * h + mappedBin;
        const mag = mags[idx] || 0;
        const phase = phases[idx] || 0;
        const [r, g, b] = magPhaseToRGB(mag, phase);
        for (let i = 0; i < 4; i++) {
          const pix = ((yy + i) * w + x) * 4;
          imageBuffer.data[pix] = r;
          imageBuffer.data[pix + 1] = g;
          imageBuffer.data[pix + 2] = b;
          imageBuffer.data[pix + 3] = 255;
        }
      }
      pos += hop;
      x++;
    }
    ctx.clearRect(0, 0, originalCanvas.width, originalCanvas.height);
    ctx.putImageData(imageBuffer, 0, 0);
    drawOriginalPlayhead(0);
    try {
      if (typeof getNotes === "function" && getNotesBool) {
        const maybe = getNotes();
        if (maybe && typeof maybe.then === "function") {
          notes = await maybe;
        } else {
          notes = maybe || [];
        }
      } else {
        if (!getNotesBool) {
          const response = await fetch("assets/defaultnotes.txt");
          if (!response.ok) throw new Error(`Failed to load notes: ${response.status}`);
          const text = await response.text();
          notes = JSON.parse(text);
        } else {
          notes=[];
        }
      }
    } catch (err) {
      console.warn("Error obtaining notes, using empty array:", err);
      notes = [];
    }
    filterNotes();
    midiCanvas.width = originalCanvas.width;
    const mctx = midiCanvas.getContext("2d");
    mctx.clearRect(0, 0, midiCanvas.width, midiCanvas.height);
    mctx.fillStyle = "#06070a";
    mctx.fillRect(0, 0, midiCanvas.width, midiCanvas.height);
    if (!notes || notes.length === 0) return;
    const minMidi = 0;
    const maxMidi = 127;
    const pitchRange = maxMidi - minMidi;
    const totalSeconds = effectiveDuration;
    const canvasW = midiCanvas.width;
    const canvasH = midiCanvas.height;
    const noteMinHeight = 6;
    const bandHeight = Math.max(
      noteMinHeight,
      Math.round((canvasH / Math.min(48, pitchRange + 1)) * 0.9)
    );
    for (const note of notes) {
      const x = Math.round((note.startTime / Math.max(1e-8, totalSeconds)) * canvasW);
      const w = Math.max(1, Math.round((note.lengthSeconds / Math.max(1e-8, totalSeconds)) * canvasW));
      const pitchNorm = (note.midiFloat - minMidi) / (pitchRange || 1);
      const yCenter = Math.round((1 - pitchNorm) * (canvasH - 1));
      const h = bandHeight;
      const y = Math.max(0, Math.min(canvasH - h, yCenter - Math.round(h / 2)));
      const vel = note.velocity;
      const alpha = Math.max(0.08, Math.min(1, vel / 127));
      mctx.fillStyle = `rgba(120,255,200,${alpha})`;
      mctx.fillRect(x, y, w, h);
      mctx.strokeStyle = `rgba(20,40,60,${0.5 * alpha})`;
      mctx.lineWidth = 1;
      mctx.strokeRect(x + 0.5, y + 0.5, Math.max(1, w - 1), Math.max(1, h - 1));
    }
    try {
      midiSnapshot = mctx.getImageData(0, 0, midiCanvas.width, midiCanvas.height);
    } catch {
      midiSnapshot = null;
    }
    drawMidiPlayhead(0);
  }
  uploadInput.addEventListener('change', async (e)=>{
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    const url = URL.createObjectURL(file);
    originalAudio.src = url;
    midiAudio.src = url;
    try{
      const ab = await file.arrayBuffer();
      const AC = window.OfflineAudioContext || window.AudioContext || window.webkitOfflineAudioContext || window.webkitAudioContext;
      const audioCtxLocal = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioCtxLocal.decodeAudioData(ab.slice(0));
      sampleRate = audioBuffer.sampleRate || 44100;
      const ch0 = audioBuffer.numberOfChannels > 0 ? audioBuffer.getChannelData(0) : new Float32Array();
      const maxLen = Math.min(ch0.length, Math.floor(sampleRate * MAX_SECONDS));
      const floatSlice = ch0.subarray(0, maxLen);
      pcm = new Float32Array(maxLen);
      pcm.set(floatSlice);
      updateEffectiveDuration();
      originalAudio.load();
      midiAudio.load();
      originalAudio.currentTime = 0;
      midiAudio.currentTime = 0;
      midiAudio.pause();
      tQStrength=0;
      updateTimeDisplays();
      resizeCanvases();
      restartRender();
    }catch(err){
      console.error('Failed to decode audio file', err);
      uploadNote.textContent = 'Failed to decode audio — check file format.';
    }
  });
  function clampSeek(audio){
    if(audio.currentTime > effectiveDuration) audio.currentTime = effectiveDuration;
    if(audio.currentTime < 0) audio.currentTime = 0;
  }
  originalAudio.addEventListener('seeked', ()=>clampSeek(originalAudio));
  midiAudio.addEventListener('seeked', ()=>clampSeek(midiAudio));
  updateTimeDisplays();
  updateNotesButtonText();
  updateOriginalButtonText();
  async function loadDefaultAsset() {
    try {
      const resp = await fetch('assets/default.mp3');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const ab = await resp.arrayBuffer();
      const audioCtxLocal = new (window.AudioContext || window.webkitAudioContext)();
      const audioBuffer = await audioCtxLocal.decodeAudioData(ab.slice(0));
      sampleRate = audioBuffer.sampleRate || 44100;
      const ch0 = audioBuffer.numberOfChannels > 0 ? audioBuffer.getChannelData(0) : new Float32Array();
      const maxLen = Math.min(ch0.length, Math.floor(sampleRate * MAX_SECONDS));
      pcm = new Float32Array(maxLen);
      pcm.set(ch0.subarray(0, maxLen));
      updateEffectiveDuration();
      originalAudio.src = 'assets/default.mp3';
      midiAudio.src = 'assets/default.mp3';
      originalAudio.load();
      midiAudio.load();
      resizeCanvases();
      restartRender(false);
      updateTimeDisplays();
    } catch (err) {
      console.error('Failed to load default asset', err);
      uploadNote.textContent = 'Failed to load default audio. Check assets/default.mp3.';
    }
  }
  loadDefaultAsset();
  setTimeout(resizeCanvases, 80);
  setTimeout(()=>{restartRender(false)}, 80);
})();