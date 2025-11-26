function floatTo16BitPCM(float32Array) {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return view;
}

function writeWavHeader(view, sampleRate, numSamples) {
    const blockAlign = 2; 
    const byteRate = sampleRate * blockAlign;

    function writeString(view, offset, str) {
        for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    }

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);       
    view.setUint16(20, 1, true);        
    view.setUint16(22, 1, true);        
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);       
    writeString(view, 36, 'data');
    view.setUint32(40, numSamples * 2, true);
}
async function renderEQAppliedPCM(bandCount = (typeof curveEQ !== 'undefined' && curveEQ && curveEQ.bandCount) ? curveEQ.bandCount : 24) {
  let pcm = channels[0].pcm;
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
  let pcm = channels[0].pcm;
  if (!pcm) return alert('No PCM loaded!');
  try {
    // try to render with EQ; choose bandCount based on curveEQ or use default 24
    const bandCount = (typeof curveEQ !== 'undefined' && curveEQ && curveEQ.bandCount) ? curveEQ.bandCount : 24;
    // you can reduce bandCount here to speed up renders for long files
    const renderedPCM = await renderEQAppliedPCM(bandCount);

    const numSamples = renderedPCM.length;
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    writeWavHeader(view, sampleRate, numSamples);

    const pcm16 = floatTo16BitPCM(renderedPCM);
    // copy bytes
    for (let i = 0; i < pcm16.byteLength; i++) {
      view.setUint8(44 + i, pcm16.getUint8(i));
    }

    const blob = new Blob([view], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'output.wav';
    a.click();
    // revoke after a short tick to give the browser time to start download (some browsers need it)
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.warn("EQ render failed or unsupported — falling back to raw PCM download:", err);
    // fallback: original raw PCM download
    const numSamples = pcm.length;
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    writeWavHeader(view, sampleRate, numSamples);

    const pcm16 = floatTo16BitPCM(pcm);
    for (let i = 0; i < pcm16.byteLength; i++) {
      view.setUint8(44 + i, pcm16.getUint8(i));
    }

    const blob = new Blob([view], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'output.wav';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
});
document.getElementById('downloadButton').addEventListener('click', function() {
    let oil = iLow; oih = iHigh; ofl = fLow; ofh = fHigh;
    iLow = 0; iHigh = framesTotal; fLow = 0; fHigh = sampleRate/2; updateCanvasScroll();
    const canvas = document.getElementById("canvas-0");//CHANGE LATER
    let canvasUrl = canvas.toDataURL('image/png');
    const downloadLink = document.createElement('a');
    downloadLink.href = canvasUrl;
    downloadLink.download = 'spectrodraw.png';
    downloadLink.click();
    downloadLink.remove();
    iLow = oil; iHigh = oih; fLow = ofl; fHigh = ofh;
});