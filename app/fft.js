function nextPow2(v) {
  if (v <= 1) return 1;
  v = v - 1 | 0;
  v |= v >>> 1;
  v |= v >>> 2;
  v |= v >>> 4;
  v |= v >>> 8;
  v |= v >>> 16;
  return (v + 1) >>> 0;
}
const _hannCache = new Map();
function hann(N) {
  let w = _hannCache.get(N);
  if (w) return w;
  w = new Float32Array(N);
  for (let i = 0; i < N; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
  _hannCache.set(N, w);
  return w;
}
const _fftCache = new Map();
class _FFT {
  constructor(n) {
    if ((n & (n - 1)) !== 0) throw new Error('n must be a power of two');
    this.n = n;
    this.levels = Math.log2(n) | 0;
    this._buildRev();
    this._buildTwiddles();
  }
  _buildRev() {
    const n = this.n;
    const levels = this.levels;
    this.rev = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      let j = 0;
      for (let k = 0; k < levels; k++) j = (j << 1) | ((i >>> k) & 1);
      this.rev[i] = j;
    }
  }
  _buildTwiddles() {
    const n = this.n;
    const half = n >>> 1;
    this.cos = new Float32Array(half);
    this.sin = new Float32Array(half);
    for (let k = 0; k < half; k++) {
      const ang = -2 * Math.PI * k / n;
      this.cos[k] = Math.cos(ang);
      this.sin[k] = Math.sin(ang);
    }
  }
  fft(re, im) {
    const n = this.n;
    if (re.length !== n || im.length !== n) throw new Error('Length mismatch');
    const rev = this.rev;
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) {
        let tmp = re[i]; re[i] = re[j]; re[j] = tmp;
        tmp = im[i]; im[i] = im[j]; im[j] = tmp;
      }
    }
    const cos = this.cos, sin = this.sin;
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >>> 1;
      const step = n / size; 
      for (let i = 0; i < n; i += size) {
        let k = i;
        for (let j = 0, tw = 0; j < half; j++, k++, tw += step) {
          const l = k + half;
          const wr = cos[tw], wi = sin[tw];
          const tr = wr * re[l] - wi * im[l];
          const ti = wr * im[l] + wi * re[l];
          re[l] = re[k] - tr;
          im[l] = im[k] - ti;
          re[k] += tr;
          im[k] += ti;
        }
      }
    }
  }
  ifft(re, im) {
    const n = this.n;
    for (let i = 0; i < n; i++) im[i] = -im[i];
    this.fft(re, im);
    const inv = 1 / n;
    for (let i = 0; i < n; i++) {
      re[i] *= inv;
      im[i] = -im[i] * inv;
    }
  }
}
function _getFFT(n) {
  let inst = _fftCache.get(n);
  if (!inst) {
    inst = new _FFT(n);
    _fftCache.set(n, inst);
  }
  return inst;
}
function fft_inplace(re, im) {
  const n = re.length;
  if (n !== im.length) throw new Error('Mismatched lengths');
  if ((n & (n - 1)) !== 0) throw new Error('Length must be power of 2');
  const fft = _getFFT(n);
  fft.fft(re, im);
}
function ifft_inplace(re, im) {
  const n = re.length;
  if (n !== im.length) throw new Error('Mismatched lengths');
  if ((n & (n - 1)) !== 0) throw new Error('Length must be power of 2');
  const fft = _getFFT(n);
  fft.ifft(re, im);
}
function overlapAdd(signal, N) {
  // Ensure power-of-two FFT size and use half-hop for Hann COLA
  N = nextPow2(N);
  const hop = N >>> 1; // N/2 hop is COLA for Hann
  const window = hann(N);
  const len = signal.length;

  // output length: we'll accumulate into this and then return first len samples
  const outLen = len + N;
  const out = new Float32Array(outLen);
  const denom = new Float32Array(outLen); // accumulate window^2 for normalization

  // accumulate windowed frames by simple overlap-add
  for (let pos = 0; pos < len; pos += hop) {
    const frameEnd = pos + N;
    for (let i = 0, idx = pos; i < N; i++, idx++) {
      const sample = (idx < len ? signal[idx] : 0) * window[i];
      out[pos + i] += sample;
      denom[pos + i] += window[i] * window[i];
    }
  }

  // normalize by sum of squared windows (safe even if hop/window aren't perfectly COLA)
  const EPS = 1e-12;
  for (let i = 0; i < len; i++) {
    if (denom[i] > EPS) out[i] /= denom[i];
    // else out[i] stays as-is (outside effective overlap region)
  }

  return out.subarray(0, len);
}
