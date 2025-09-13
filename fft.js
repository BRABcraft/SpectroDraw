function nextPow2(v) { return 1 << Math.ceil(Math.log2(v)); }

function fft_inplace(re, im) {
  const n = re.length;
  if (n !== im.length) throw new Error('Mismatched lengths');
  const levels = Math.floor(Math.log2(n));
  if ((1 << levels) !== n) throw new Error('Length must be power of 2');

  for (let i = 0; i < n; i++) {
    let j = 0;
    for (let k = 0; k < levels; k++) j = (j << 1) | ((i >>> k) & 1);
    if (j > i) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  for (let size = 2; size <= n; size <<= 1) {
    const half = size >>> 1;
    const theta = -2 * Math.PI / size;
    const wpr = Math.cos(theta);
    const wpi = Math.sin(theta);
    for (let i = 0; i < n; i += size) {
      let wr = 1, wi = 0;
      for (let j = 0; j < half; j++) {
        const k = i + j;
        const l = k + half;
        const tr = wr * re[l] - wi * im[l];
        const ti = wr * im[l] + wi * re[l];
        re[l] = re[k] - tr;
        im[l] = im[k] - ti;
        re[k] += tr;
        im[k] += ti;
        const tmp = wr;
        wr = tmp * wpr - wi * wpi;
        wi = tmp * wpi + wi * wpr;
      }
    }
  }
}

function ifft_inplace(re, im) {
  for (let i = 0; i < re.length; i++) im[i] = -im[i];
  fft_inplace(re, im);
  for (let i = 0; i < re.length; i++) { re[i] /= re.length; im[i] = -im[i] / re.length; }
}

function hann(N) {
  const w = new Float32Array(N);
  for (let i = 0; i < N; i++) w[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)));
  return w;
}

function overlapAdd(signal, N) {
  const hop = N / 2; 
  const window = hann(N);
  const out = new Float32Array(signal.length + N); 
  const re = new Float32Array(N);
  const im = new Float32Array(N);

  for (let pos = 0; pos < signal.length; pos += hop) {

    for (let i = 0; i < N; i++) {
      re[i] = (pos + i < signal.length ? signal[pos + i] : 0) * window[i];
      im[i] = 0;
    }

    fft_inplace(re, im);

    ifft_inplace(re, im);

    for (let i = 0; i < N; i++) {
      out[pos + i] += re[i] * window[i]; 
    }
  }

  return out.subarray(0, signal.length); 
}