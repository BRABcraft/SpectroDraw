function floatTo16BitPCM(float32Array) {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return view;
}

function writeWavHeader(view, sampleRate, numChannels, numFrames) {
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;

    function writeString(view, offset, str) {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    }

    const dataByteLength = numFrames * blockAlign;
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataByteLength, true); // file size - 8
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);       // PCM chunk size
    view.setUint16(20, 1, true);        // audio format = PCM
    view.setUint16(22, numChannels, true);  // number of layers
    view.setUint32(24, sampleRate, true);   // sample rate
    view.setUint32(28, byteRate, true);     // byte rate
    view.setUint16(32, blockAlign, true);   // block align
    view.setUint16(34, 16, true);           // bits per sample
    writeString(view, 36, 'data');
    view.setUint32(40, dataByteLength, true); // data chunk length
}
async function renderEQAppliedPCM(bandCount = (typeof curveEQ !== 'undefined' && curveEQ && curveEQ.bandCount) ? curveEQ.bandCount : 24) {
  let pcm = layers[0].pcm;
  if (!pcm) throw new Error("No PCM to render.");
  const nyquist = sampleRate * 0.5;
  const fMin = 20;
  const fMax = nyquist;
  const len = pcm.length;

  // geometric spacing
  const ratio = Math.pow(fMax / fMin, 1 / Math.max(1, bandCount - 1));
  const centers = new Array(bandCount);
  centers[0] = fMin;
  for (let i = 1; i < bandCount; i++) centers[i] = centers[i - 1] * ratio;

  // Helper: get gain for a center frequency using spline if available, otherwise nearest eqBand
  function gainForFreq(fc) {
    try {
      if (typeof eqCanvas !== 'undefined' && eqCanvas && typeof evalEQGainAtY === 'function') {
        const y = freqToY(fc, eqCanvas.height);
        const XonSpline = evalEQGainAtY(y);
        return (XonSpline === null) ? 0 : xToGain(XonSpline, eqCanvas.width);
      }
    } catch (e) {
      // ignore and fallback
    }
    // fallback: find nearest configured band in eqBands
    if (Array.isArray(eqBands) && eqBands.length > 0) {
      let best = eqBands[0], bestDist = Math.abs((best.freq || 0) - fc);
      for (let b of eqBands) {
        const d = Math.abs((b.freq || 0) - fc);
        if (d < bestDist) { best = b; bestDist = d; }
      }
      return (best && typeof best.gain === 'number') ? best.gain : 0;
    }
    return 0;
  }

  // Create offline context
  if (typeof OfflineAudioContext === 'undefined') throw new Error("OfflineAudioContext not supported");
  const offlineCtx = new OfflineAudioContext(1, len, sampleRate);

  // create buffer & source
  const buffer = offlineCtx.createBuffer(1, len, sampleRate);
  buffer.copyToChannel(pcm, 0);
  const src = offlineCtx.createBufferSource();
  src.buffer = buffer;

  // Build filters in offline context
  const filters = [];
  for (let i = 0; i < bandCount; i++) {
    const fc = centers[i];
    const prevFc = (i === 0) ? (fc / ratio) : centers[i - 1];
    const nextFc = (i === bandCount - 1) ? (fc * ratio) : centers[i + 1];
    const bw = Math.max(1e-6, nextFc - prevFc);
    let Q = fc / bw;
    Q = clamp(Q, 0.3, 18);

    const gainDb = gainForFreq(fc);

    const node = offlineCtx.createBiquadFilter();
    node.type = 'peaking';
    node.frequency.value = Math.min(Math.max(fc, 1), nyquist - 1);
    node.Q.value = Q;
    node.gain.value = gainDb;
    filters.push(node);
  }

  // wire chain: src -> f0 -> ... -> destination
  if (filters.length === 0) {
    src.connect(offlineCtx.destination);
  } else {
    src.connect(filters[0]);
    for (let i = 0; i < filters.length - 1; i++) {
      filters[i].connect(filters[i + 1]);
    }
    filters[filters.length - 1].connect(offlineCtx.destination);
  }

  src.start(0);

  // render
  const rendered = await offlineCtx.startRendering(); // may take time for long audio
  const out = new Float32Array(rendered.length);
  rendered.copyFromChannel(out, 0);
  return out;
}

document.getElementById('downloadWav').addEventListener('click', async () => {
  let view;
    if (layerCount>1) {
      // find longest PCM length
      let maxLen = 0;
      for (let ch = 0; ch < layerCount; ch++) if (layers[ch].pcm.length > maxLen) maxLen = layers[ch].pcm.length;
      maxLen = Math.min(maxLen, Math.floor(emptyAudioLengthEl*sampleRate));

      // create left/right mixing buffers
      const left = new Float32Array(maxLen);
      const right = new Float32Array(maxLen);

      for (let ch = 0; ch < layerCount; ch++) {
          const c = layers[ch];
          if (!c || !c.pcm) continue;
          const device = (c.audioDevice || 'both').toString().toLowerCase();
          const pcmCh = c.pcm;
          for (let i = 0; i < pcmCh.length; i++) {
              const s = pcmCh[i] || 0;
              if (device === 'left' || device === 'both') left[i] += s;
              if (device === 'right' || device === 'both') right[i] += s;
              // if device === 'none' -> skip
          }
      }

      // prevent clipping: normalize only if needed
      let maxAbs = 0;
      for (let i = 0; i < maxLen; i++) {
          const a = Math.abs(left[i]) || 0;
          const b = Math.abs(right[i]) || 0;
          if (a > maxAbs) maxAbs = a;
          if (b > maxAbs) maxAbs = b;
      }
      if (maxAbs > 1) {
          const inv = 1 / maxAbs;
          for (let i = 0; i < maxLen; i++) {
              left[i] *= inv;
              right[i] *= inv;
          }
      }

      // create stereo interleaved 16-bit WAV
      const numlayerOut = 2;
      const numFrames = maxLen;
      const dataByteLength = numFrames * numlayerOut * 2; // 2 bytes per sample
      const buffer = new ArrayBuffer(44 + dataByteLength);
      view = new DataView(buffer);
      writeWavHeader(view, sampleRate, numChannelsOut, numFrames);

      let offset = 44;
      for (let i = 0; i < numFrames; i++) {
          // left
          let l = left[i] || 0;
          l = Math.max(-1, Math.min(1, l));
          view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7FFF, true);
          offset += 2;
          // right
          let r = right[i] || 0;
          r = Math.max(-1, Math.min(1, r));
          view.setInt16(offset, r < 0 ? r * 0x8000 : r * 0x7FFF, true);
          offset += 2;
      }
    } else {
      const renderedPCM = await renderEQAppliedPCM(24);
      // target length in samples
      const targetSamples = Math.floor(emptyAudioLengthEl.value* sampleRate);
      // clamp PCM to target length
      const numSamples = Math.min(renderedPCM.length, targetSamples);
      const pcmClamped = renderedPCM.subarray(0, numSamples);

      // allocate WAV buffer (mono, 16-bit)
      const buffer = new ArrayBuffer(44 + numSamples * 2);
      view = new DataView(buffer);

      // WAV header: sampleRate, layers=1, frames=numSamples
      writeWavHeader(view, sampleRate, 1, numSamples);

      // convert ONLY the clamped PCM
      const pcm16 = floatTo16BitPCM(pcmClamped);

      // copy PCM bytes
      for (let i = 0; i < pcm16.byteLength; i++) {
        view.setUint8(44 + i, pcm16.getUint8(i));
      }

    }
    const blob = new Blob([view], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'output_'+layerCount+'_layer'+((layerCount>1)?'s':'')+'.wav';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
});
document.getElementById('downloadSpectrogram').addEventListener('click', function() {
    const oil = iLow, oih = iHigh, ofl = fLow, ofh = fHigh;
    iLow = 0; iHigh = framesTotal; fLow = 0; fHigh = sampleRate/2;
    updateCanvasScroll();

    const totalLayers = layerCount;
    for (let ch = 0; ch < totalLayers; ch++) {
        const canvas = document.getElementById(`canvas-${ch}`);
        if (!canvas) continue;
        try {
            const canvasUrl = canvas.toDataURL('image/png');
            const downloadLink = document.createElement('a');
            downloadLink.href = canvasUrl;
            downloadLink.download = `spectrodraw-${ch}.png`;
            downloadLink.click();
            downloadLink.remove();
        } catch (e) {
            console.warn(`Failed to export canvas for layer ${ch}:`, e);
        }
    }

    iLow = oil; iHigh = oih; fLow = ofl; fHigh = ofh;
    updateCanvasScroll();
});

document.getElementById('downloadVideo').addEventListener('click', async function() {
  // --- Progress Bar UI Setup ---
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
    backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column',
    justifyContent: 'center', alignItems: 'center', zIndex: '10000', color: 'white', fontFamily: 'sans-serif'
  });

  const label = document.createElement('div');
  label.textContent = 'Exporting Video: 0%';
  label.style.marginBottom = '10px';

  const progressBg = document.createElement('div');
  Object.assign(progressBg.style, {
    width: '300px', height: '20px', backgroundColor: '#333', borderRadius: '10px', overflow: 'hidden'
  });

  const progressBar = document.createElement('div');
  Object.assign(progressBar.style, {
    width: '0%', height: '100%', backgroundColor: '#00ff00', transition: 'width 0.1s linear'
  });

  progressBg.appendChild(progressBar);
  overlay.appendChild(label);
  overlay.appendChild(progressBg);
  document.body.appendChild(overlay);
  // -----------------------------

  const WIDTH = 1280;
  const HEIGHT = 720;
  const FPS = 30;
  const NEEDLE_W = 3;
  const NEEDLE_COLOR = '#00ff00';

  // Build the WAV exactly like downloadWav does, then attach it to the video stream.
  let wavView;
  let numFramesOut = 0;

  try {
    if (layerCount > 1) {
      // find longest PCM length
      let maxLen = 0;
      for (let ch = 0; ch < layerCount; ch++) if (layers[ch] && layers[ch].pcm && layers[ch].pcm.length > maxLen) maxLen = layers[ch].pcm.length;
      maxLen = Math.min(maxLen, Math.floor(emptyAudioLengthEl.value * sampleRate));

      // create left/right mixing buffers
      const left = new Float32Array(maxLen);
      const right = new Float32Array(maxLen);

      for (let ch = 0; ch < layerCount; ch++) {
        const c = layers[ch];
        if (!c || !c.pcm) continue;
        const device = (c.audioDevice || 'both').toString().toLowerCase();
        const pcmCh = c.pcm;
        for (let i = 0; i < pcmCh.length && i < maxLen; i++) {
          const s = pcmCh[i] || 0;
          if (device === 'left' || device === 'both') left[i] += s;
          if (device === 'right' || device === 'both') right[i] += s;
        }
      }

      // prevent clipping: normalize only if needed
      let maxAbs = 0;
      for (let i = 0; i < maxLen; i++) {
        const a = Math.abs(left[i]) || 0;
        const b = Math.abs(right[i]) || 0;
        if (a > maxAbs) maxAbs = a;
        if (b > maxAbs) maxAbs = b;
      }
      if (maxAbs > 1) {
        const inv = 1 / maxAbs;
        for (let i = 0; i < maxLen; i++) {
          left[i] *= inv;
          right[i] *= inv;
        }
      }

      // create stereo interleaved 16-bit WAV
      const numChannelsOut = 2;
      const numFrames = maxLen;
      numFramesOut = numFrames;
      const dataByteLength = numFrames * numChannelsOut * 2; 
      const buffer = new ArrayBuffer(44 + dataByteLength);
      wavView = new DataView(buffer);
      writeWavHeader(wavView, sampleRate, numChannelsOut, numFrames);

      let offset = 44;
      for (let i = 0; i < numFrames; i++) {
        let l = left[i] || 0;
        l = Math.max(-1, Math.min(1, l));
        wavView.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7FFF, true);
        offset += 2;
        let r = right[i] || 0;
        r = Math.max(-1, Math.min(1, r));
        wavView.setInt16(offset, r < 0 ? r * 0x8000 : r * 0x7FFF, true);
        offset += 2;
      }
    } else {
      const renderedPCM = await renderEQAppliedPCM(24);
      const targetSamples = Math.floor(emptyAudioLengthEl.value * sampleRate);
      const numSamples = Math.min(renderedPCM.length, targetSamples);
      const pcmClamped = renderedPCM.subarray(0, numSamples);

      numFramesOut = numSamples;
      const buffer = new ArrayBuffer(44 + numSamples * 2);
      wavView = new DataView(buffer);

      writeWavHeader(wavView, sampleRate, 1, numSamples);

      const pcm16 = floatTo16BitPCM(pcmClamped);
      for (let i = 0; i < pcm16.byteLength; i++) {
        wavView.setUint8(44 + i, pcm16.getUint8(i));
      }
    }
  } catch (err) {
    overlay.remove();
    console.error('Failed to build WAV for video audio:', err);
    return alert('Failed to prepare audio for video: ' + (err && err.message ? err.message : String(err)));
  }

  if (!numFramesOut || numFramesOut <= 0) { overlay.remove(); return alert('No audio frames to render.'); }

  const audioBlob = new Blob([wavView], { type: 'audio/wav' });
  const audioUrl = URL.createObjectURL(audioBlob);
  const durationSec = numFramesOut / sampleRate;

  const recordCanvas = document.createElement('canvas');
  recordCanvas.width = WIDTH;
  recordCanvas.height = HEIGHT;
  const rctx = recordCanvas.getContext('2d');

  function drawSpectrogramBase() {
    rctx.clearRect(0, 0, WIDTH, HEIGHT);
    for (let ch = 0; ch < layerCount; ch++) {
      const sourceCanvas = document.getElementById('canvas-' + ch);
      if (!sourceCanvas) continue;
      const sw = sourceCanvas.width;
      const sh = sourceCanvas.height;
      if (layerCount>1){ 
        rctx.drawImage(sourceCanvas, 0, 0, sw, sh, 0, ch * (HEIGHT / layerCount), WIDTH, HEIGHT / layerCount)-5;
        rctx.fillStyle = "#888";
        rctx.fillRect(0,(ch+1) * (HEIGHT / layerCount)-5,WIDTH,5);
      } else {
        rctx.drawImage(sourceCanvas, 0, 0, sw, sh, 0, ch * (HEIGHT / layerCount), WIDTH, HEIGHT / layerCount);
      }
    }
  }

  function drawFrame(progress) {
    drawSpectrogramBase();
    const x = Math.round(progress * (WIDTH - NEEDLE_W));
    rctx.fillStyle = NEEDLE_COLOR;
    rctx.fillRect(x, 0, NEEDLE_W, HEIGHT);
  }

  let audioStream = null;
  let audioElement = null;
  let audioCtxFallback = null;
  let audioSrcNodeFallback = null;
  let fallbackDest = null;

  try {
    audioElement = document.createElement('audio');
    audioElement.src = audioUrl;
    audioElement.preload = 'auto';
    audioElement.crossOrigin = 'anonymous';
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 500);
      audioElement.addEventListener('canplay', () => { clearTimeout(timer); resolve(); }, { once: true });
      audioElement.load();
    });

    if (typeof audioElement.captureStream === 'function') {
      try {
        audioStream = audioElement.captureStream();
        if (!audioStream || audioStream.getAudioTracks().length === 0) audioStream = null;
      } catch (e) { audioStream = null; }
    }

    if (!audioStream) {
      audioCtxFallback = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });
      const arrayBuffer = await audioBlob.arrayBuffer();
      const decoded = await audioCtxFallback.decodeAudioData(arrayBuffer);
      audioSrcNodeFallback = audioCtxFallback.createBufferSource();
      audioSrcNodeFallback.buffer = decoded;
      fallbackDest = audioCtxFallback.createMediaStreamDestination();
      audioSrcNodeFallback.connect(fallbackDest);
      audioStream = fallbackDest.stream;
    }
  } catch (err) {
    overlay.remove();
    if (audioCtxFallback) try { audioCtxFallback.close(); } catch (_) {}
    URL.revokeObjectURL(audioUrl);
    return alert('Failed to attach audio to video: ' + (err && err.message ? err.message : String(err)));
  }

  const videoStream = recordCanvas.captureStream(FPS);
  const combined = new MediaStream();
  videoStream.getVideoTracks().forEach(t => combined.addTrack(t));
  if (audioStream) audioStream.getAudioTracks().forEach(t => combined.addTrack(t));

  let mime = 'video/webm;codecs=vp8,opus';
  if (!MediaRecorder.isTypeSupported(mime)) {
    mime = 'video/webm';
    if (!MediaRecorder.isTypeSupported(mime)) mime = '';
  }
  const recorder = new MediaRecorder(combined, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

  recorder.start();
  drawFrame(0);

  const leadMs = 60;
  const startPerf = performance.now() + leadMs;

  if (audioElement && audioStream && typeof audioElement.captureStream === 'function') {
    setTimeout(() => { audioElement.play().catch(() => {}); }, leadMs);
  } else if (audioSrcNodeFallback && audioCtxFallback) {
    const startTime = audioCtxFallback.currentTime + (leadMs / 1000);
    try { audioSrcNodeFallback.start(startTime); } catch (e) { console.warn('fallback start failed', e); }
  }

  let lastDraw = 0;
  let stopped = false;
  function rafTick(now) {
    if (stopped) return;
    const elapsed = (performance.now() - startPerf) / 1000;
    const clamped = Math.max(0, Math.min(1, elapsed / durationSec));
    
    // Update Progress Overlay
    const percent = Math.round(clamped * 100);
    progressBar.style.width = percent + '%';
    label.textContent = `Exporting Video: ${percent}%`;

    if (now - lastDraw >= (1000 / FPS) - 1) {
      drawFrame(clamped);
      lastDraw = now;
    }
    if (elapsed < durationSec + 0.12) {
      requestAnimationFrame(rafTick);
    } else {
      stopped = true;
      setTimeout(() => {
        try { recorder.stop(); } catch (e) { console.warn('recorder.stop() failed', e); }
      }, 120);
    }
  }
  requestAnimationFrame(rafTick);

  await new Promise((res) => { recorder.onstop = () => res(); });

  const outBlob = new Blob(chunks, { type: 'video/webm' });
  const url = URL.createObjectURL(outBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'spectrodraw.webm';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  // cleanup
  overlay.remove(); // Remove overlay here
  try { if (audioElement) { audioElement.pause(); audioElement.src = ''; } } catch (e) {}
  try { if (audioCtxFallback) audioCtxFallback.close(); } catch (e) {}
  try { videoStream.getTracks().forEach(t => t.stop()); } catch (e) {}
  try { combined.getTracks().forEach(t => t.stop()); } catch (e) {}
  try { URL.revokeObjectURL(audioUrl); } catch (e) {}
});