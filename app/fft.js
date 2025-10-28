function nextPow2(v) {
  v = (v | 0) >>> 0;
  if (v <= 1) return 1;
  return 1 << (32 - Math.clz32(v - 1));
}
const _hannCache = new Map();
function hann(N) {
  let w = _hannCache.get(N);
  if (w) return w;
  w = new Float32Array(N);
  if (N === 1) { w[0] = 1.0; _hannCache.set(N, w); return w; }
  const half = Math.floor((N + 1) / 2);
  const denom = N - 1;
  for (let i = 0; i < half; i++) {
    w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / denom));
  }
  for (let i = half; i < N; i++) {
    w[i] = w[N - 1 - i];
  }
  _hannCache.set(N, w);
  return w;
}
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
    const rev = new Uint32Array(n);
    rev[0] = 0;
    for (let i = 1; i < n; i++) {
      rev[i] = (rev[i >> 1] >> 1) | ((i & 1) << (levels - 1));
    }
    this.rev = rev;
  }
  _buildTwiddles() {
    const n = this.n;
    const half = n >>> 1;
    const cos = new Float32Array(half);
    const sin = new Float32Array(half);
    for (let k = 0; k < half; k++) {
      const ang = -2 * Math.PI * k / n;
      cos[k] = Math.cos(ang);
      sin[k] = Math.sin(ang);
    }
    this.cos = cos;
    this.sin = sin;
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
        let tw = 0;
        let k = i;
        const baseK = i;
        for (let j = 0; j < half; j++, k++, tw += step) {
          const l = k + half;
          const wr = cos[tw], wi = sin[tw];
          const r_k = re[k], i_k = im[k];
          const r_l = re[l], i_l = im[l];
          const tr = wr * r_l - wi * i_l;
          const ti = wr * i_l + wi * r_l;
          re[l] = r_k - tr;
          im[l] = i_k - ti;
          re[k] = r_k + tr;
          im[k] = i_k + ti;
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
const _fftCache = new Map();
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
  _getFFT(n).fft(re, im);
}
function ifft_inplace(re, im) {
  const n = re.length;
  if (n !== im.length) throw new Error('Mismatched lengths');
  if ((n & (n - 1)) !== 0) throw new Error('Length must be power of 2');
  _getFFT(n).ifft(re, im);
}
function overlapAdd(signal, N) {
  N = nextPow2(N);
  const hop = N >>> 1; 
  const window = hann(N);
  const len = signal.length;
  const frames = Math.max(1, Math.ceil((len - N) / hop) + 1);
  const outLen = (frames - 1) * hop + N;
  const out = new Float32Array(outLen);
  const denom = new Float32Array(outLen);
  const winSq = new Float32Array(N);
  for (let i = 0; i < N; i++) winSq[i] = window[i] * window[i];
  let pos = 0;
  for (let frame = 0; frame < frames; frame++, pos += hop) {
    if (pos + N <= len) {
      let baseOut = pos;
      let sOffset = pos;
      for (let i = 0; i < N; i++) {
        const s = signal[sOffset + i] * window[i];
        out[baseOut + i] += s;
        denom[baseOut + i] += winSq[i];
      }
    } else {
      let baseOut = pos;
      let sOffset = pos;
      let i = 0;
      for (; i < N && (sOffset + i) < len; i++) {
        const s = signal[sOffset + i] * window[i];
        out[baseOut + i] += s;
        denom[baseOut + i] += winSq[i];
      }
      for (; i < N; i++) {
        denom[baseOut + i] += winSq[i];
      }
    }
  }
  const EPS = 1e-12;
  const result = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const d = denom[i];
    if (d > EPS) result[i] = out[i] / d;
    else result[i] = out[i]; 
  }
  return result;
}