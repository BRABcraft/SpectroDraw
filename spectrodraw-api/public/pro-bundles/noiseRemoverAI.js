// ---------------------------
// Utility / config
// ---------------------------
const DEFAULT_OPTS = {
  normalizeRef: 128.0,   // same normalization you used earlier
  minGain: 0.02,
  maxGain: 1.0,
  // modelInputName: optional override; otherwise use first input name
  // model expects a 1D float array of length = specHeight (shape [1, specHeight] or [1, 1, specHeight])
};

// ---------------------------
// computeFrameGains
// - modelSession: ORT InferenceSession or null
// - magsFrame: Float32Array length = specHeight (0..255 mags as you use)
// - opts: overrides.
// Returns Float32Array of gains (0..1) length = specHeight
// ---------------------------
async function computeFrameGains(modelSession, magsFrame, opts = {}) {
  opts = Object.assign({}, DEFAULT_OPTS, opts);
  const H = magsFrame.length;
  // 1) If we have a model session, run ONNX inference:
  if (modelSession) {
    // Prepare input: convert to log-magnitude normalized values (common preproc)
    // Many magnitude-based models expect log-power / normalized inputs.
    const inBuf = new Float32Array(H);
    for (let i = 0; i < H; ++i) {
      // small offset to avoid log(0)
      const m = Math.max(1e-6, magsFrame[i]);
      // log10 power normalized around normalizeRef. This is a common choice; tune if your model expects different scaling.
      inBuf[i] = Math.log10((m / opts.normalizeRef));
    }

    // Build input tensor shape attempts:
    // Many simple spectrogram U-Nets accept [1, H] or [1, 1, H] or [1, H, 1].
    // We'll try a couple common shapes — you should adapt to the precise model you export.
    // Use ONNX Runtime Web API: ort.Tensor('float32', data, dims)
    const inputName = (modelSession.inputNames && modelSession.inputNames[0]) || 'input';
    const tryShapes = [[1, H], [1, 1, H], [1, H, 1]];

    let outputData = null;
    for (const shape of tryShapes) {
      try {
        const inputTensor = new ort.Tensor('float32', inBuf, shape);
        const feeds = {};
        feeds[inputName] = inputTensor;
        const outMap = await modelSession.run(feeds);
        // Get first output tensor
        const outKey = Object.keys(outMap)[0];
        const outTensor = outMap[outKey];
        // Expect the output to be float32 of length H or shape [1,H] etc.
        const raw = outTensor.data; // TypedArray
        // Ensure we have length >= H (some models output additional dims)
        if (raw.length >= H) {
          // Convert to Float32Array gains [0..1], also clamp & shape-handle
          outputData = new Float32Array(H);
          // Heuristic: if output is log-gain, convert; if mask already 0..1 then clamp.
          // We assume model outputs mask in [0..1] or gains near that range.
          for (let i = 0; i < H; ++i) {
            // map raw[i] -> 0..1
            let v = raw[i];
            // If values are outside [0,1], apply a logistic-style clamp (safe).
            if (!Number.isFinite(v)) v = 0;
            // If model sometimes returns log-gain (<0), convert: gain = 10^(v)
            if (v < -2 || v > 2) {
              // assume it's log10(gain) or large values; try converting if negative
              v = Math.pow(10, v);
            }
            // clamp to [minGain..maxGain]
            v = Math.max(opts.minGain, Math.min(opts.maxGain, v));
            outputData[i] = v;
          }
          break;
        }
      } catch (e) {
        // try next shape — don't fail hard here (models differ)
        //console.warn('shape attempt failed', shape, e);
      }
    }

    if (outputData) return outputData;

    // If we reach here, model inference failed to produce sensible output — fall back
    console.warn('Model session returned no usable output; falling back to heuristic denoiser');
  }

  // 2) FALLBACK heuristic tuned for vocals (fast, per-frame)
  // Idea: estimate per-bin noise floor using local median across +/- 1 semitone (as you liked),
  // then apply Wiener-like gain and a harmonic-preserving prominence term.
  const gains = new Float32Array(H);
  // We'll precompute approximate semitone window bins: short function
  // If you have binFreqs in opts, use them; otherwise assume linear up to Nyquist and derive semitone approx.
  const binFreqs = opts.binFreqs || (() => {
    const sr = opts.sampleRate || 48000;
    const nyq = sr / 2;
    const freqs = new Float32Array(H);
    for (let i = 0; i < H; ++i) freqs[i] = (i / (H - 1)) * nyq;
    return freqs;
  })();

  const semitoneRatio = Math.pow(2, 1 / 12);
  // Precompute neighbor stats per bin (noise floor as 25th percentile)
  for (let b = 0; b < H; ++b) {
    const f = binFreqs[b] || 1;
    const fLow = f / semitoneRatio;
    const fHigh = f * semitoneRatio;
    // collect neighbors
    const neigh = [];
    // expand both directions
    for (let j = b - 24; j <= b + 24; ++j) { // limit search radius for speed
      if (j < 0 || j >= H) continue;
      const fj = binFreqs[j];
      if (fj >= fLow && fj <= fHigh && j !== b) neigh.push(magsFrame[j] || 0);
    }
    if (neigh.length === 0) {
      // fallback: use global small floor
      gains[b] = 1.0;
      continue;
    }
    neigh.sort((a, b2) => a - b2);
    const p25 = neigh[Math.max(0, Math.floor(0.25 * (neigh.length - 1)))];
    const median = neigh[Math.floor(0.5 * (neigh.length - 1))];
    const noiseFloor = Math.min(p25, median * 1.05, median); // robust floor

    // power estimates
    const sig2 = Math.max(1e-9, magsFrame[b] * magsFrame[b]);
    const noise2 = Math.max(1e-9, noiseFloor * noiseFloor);

    let gamma = (sig2 - noise2) / noise2;
    if (gamma < 0) gamma = 0;
    let gain = gamma / (1 + gamma); // Wiener

    // prominence tweak: preserve harmonics when center is much stronger than median
    const prominence = magsFrame[b] / (median + 1e-9);
    if (prominence > 1.2) {
      gain = Math.min(1.0, gain * (1.0 + (prominence - 1.0) * 0.4));
    }

    // soft-knee (in dB) - gentle clamp so we don't suddenly zero
    const magDb = 20 * Math.log10((magsFrame[b] + 1e-9) / opts.normalizeRef);
    const floorDb = 20 * Math.log10((noiseFloor + 1e-9) / opts.normalizeRef);
    const dbDelta = magDb - floorDb;
    const kneeDb = opts.kneeDb || 6.0;
    if (dbDelta <= -kneeDb) {
      gain = Math.min(gain, opts.minGain);
    } else if (dbDelta < kneeDb) {
      const t = (dbDelta + kneeDb) / (2 * kneeDb);
      const kneeGain = opts.minGain * (1 - t) + 1.0 * t;
      gain = Math.min(gain, kneeGain);
    } else {
      gain = Math.min(1.0, gain);
    }

    gains[b] = Math.max(opts.minGain, Math.min(opts.maxGain, gain));
  }

  return gains;
}

// ---------------------------
// denoiseVocalBin
// - bin: integer
// - magsFrame: Float32Array
// - frameGains: Float32Array computed by computeFrameGains
// returns the cleaned magnitude (0..255)
// ---------------------------
function denoiseVocalBin(bin, magsFrame, frameGains) {
  const H = magsFrame.length;
  if (!frameGains || frameGains.length !== H) {
    // safety fallback: no gains available -> return original
    return magsFrame[bin];
  }
  const g = frameGains[bin];
  // apply gain and clamp
  const newMag = Math.min(255, Math.max(0, magsFrame[bin] * g));
  return newMag;
}

// ---------------------------
// Example usage / integration notes
// ---------------------------
// (A) Preload ONNX session (example):
// const session = await ort.InferenceSession.create('model.onnx'); // or create(buffer)
// // When user starts/updates brush for xFrame:
/// const magsFrame = channels[ch].mags.subarray(specHeight * xFrame, specHeight * (xFrame + 1));
// const gains = await computeFrameGains(session, magsFrame, { binFreqs, sampleRate: 48000 });
// // Then inside your paint loop/call for each bin:
// const cleaned = denoiseVocalBin(bin, magsFrame, gains);
// // write cleaned into mags array or separate buffer

// (B) If you don't have a model yet: pass modelSession = null and computeFrameGains will use the heuristic fallback.

