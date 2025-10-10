function dbToMag(db) {
  //Mag to db: return (20 * Math.log10(mag));
  return Math.pow(10, db / 20);
}

function complexMag(re, im) {
  return Math.hypot(re || 0, im || 0);
}

function detectPitches(alignPitch) {
  detectedPitches = [];
  if (pos + fftSize > pcm.length) { rendering = false; status.style.display = "none"; return false; }

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
      // nearest pitch logic (keeps your prior intent)
      let nearestPitch = Math.round(npo * Math.log2(freq / a4p));
      nearestPitch = a4p * Math.pow(2, nearestPitch / npo);
      detectedPitch = Math.round(nearestPitch / factor);
    } else {
      detectedPitch = freq;
    }
    // per-frame integer velocity from this bin's magnitude
    const magToDb = m => 20 * Math.log10(Math.max(m, 1e-12));
    const db = magToDb(mag);
    const t = mag; // (db - noiseFloor) / (0 - noiseFloor); (kept simple as original)
    const velFrame = Math.round(Math.max(0, Math.min(1, t)));

    // ensure uniqueness per frame by pitch+velocity
    // Note: we push complex re/im instead of scalar mag so downstream can do vector sums
    if (!detectedPitches.some(([p, _r, _i, v]) => p === detectedPitch && v === velFrame)) {
      detectedPitches.push([detectedPitch, reBin, imBin, velFrame]);
    }
  }

  pos += hop; x++;
  audioProcessed += hop;
  if (x >= specWidth && status) { rendering = false; status.style.display = "none"; }
  return detectedPitches;
}
// ---------- exportMidi: detect & merge, now adds startTime (seconds) ----------
function exportMidi(opts = {}) {
  const downloadName = opts.downloadName ?? "export.mid";
  writeMidiFile(getNotes(), {downloadName});
}
function getNotes() {
  return exportMidi2().notes;
}

function exportMidi2() {
  const velSplitTolerance = 40; // used only when useVolumeControllers == false (kept original)
  const minVelocityDb = -60;

  pos = 0;
  x = 0;
  const w = specWidth; const h = specHeight;
  let detectedPitches = [];
  audioProcessed = 0;
  for (let frame = 0; frame < w; frame++) {
    detectedPitches.push(detectPitches(true)); // each entry: [detectedPitch, re, im, velFrame]
  }
  // console.log(detectedPitches);

  // compute global max magnitude (avoid divide-by-zero) using complex magnitudes
  let globalMaxMag = 0;
  for (const frameArr of detectedPitches) {
    for (const entry of frameArr) {
      const reVal = entry[1], imVal = entry[2];
      const mag = complexMag(reVal, imVal);
      if (mag > globalMaxMag) globalMaxMag = mag;
    }
  }
  if (globalMaxMag <= 0) globalMaxMag = 1e-12;

  // mapping: complex (re,im) -> MIDI velocity 1..127 using a dB perceptual scale
  function mapComplexToMidi(reVal, imVal) {
    // compute magnitude
    const mag = complexMag(reVal, imVal);
    // normalize to 0..1 w.r.t global max
    let amp = (Math.max(0, mag) / globalMaxMag);
    amp = Math.min(1, Math.pow(amp, 2) * 1.4);
    // amplitude to dB relative to max
    const db = amp > 0 ? 20 * Math.log10(amp) : -1000;
    // clamp to [minVelocityDb, 0]
    let norm = (db - minVelocityDb) / (0 - minVelocityDb);
    if (!isFinite(norm)) norm = 0;
    if (norm < 0) norm = 0;
    if (norm > 1) norm = 1;
    let midi = Math.round(norm * 127);
    // avoid 0 (note-on with vel 0 is interpreted as note-off)
    if (midi < 1) midi = 1;
    return midi;
  }

  // --- merge adjacent-frame detections into notes ---
  // final notes [{ midiFloat|freq, velocity, lengthFrames, lengthSeconds, startTime, velChanges: [{offsetFrames, vel}, ...] }, ...]
  const notes = [];
  const active = []; // array of { midiRounded, startFrame, reParts:[], imParts:[], velFrames: [{frame, re, im}], midiFloat, lastMag, seen }
  const factor = sampleRate / fftSize / 2;

  function avgMagFromParts(reArr, imArr) {
    if (!reArr || reArr.length === 0) return 0;
    let s = 0;
    for (let i = 0; i < reArr.length; i++) s += complexMag(reArr[i], imArr[i]);
    return s / reArr.length;
  }

  for (let frame = 0; frame < w; frame++) {
    // reset seen flag
    for (const a of active) a.seen = false;

    for (const [detectedPitch, reVal, imVal /*, velFrame */] of detectedPitches[frame]) {
      const freq = detectedPitch * factor;
      if (freq <= 0) continue;
      const midiFloat = 69 + 12 * Math.log2(freq / a4p);
      const midiRounded = Math.round(midiFloat);

      const mag = complexMag(reVal, imVal);

      // find an active entry with same midiRounded
      let match = null;
      for (const a of active) {
        if (a.midiRounded === midiRounded) {
          // if we're preserving volume-splitting (old behavior), require velocity (magnitude) match within tolerance
          if (!useVolumeControllers) {
            if (Math.abs(a.lastMag - mag) <= velSplitTolerance) {
              match = a;
              break;
            } else {
              // not a match by velocity — continue searching (might create new active)
              continue;
            }
          } else {
            // useVolumeControllers == true -> match by pitch only
            match = a;
            break;
          }
        }
      }

      if (match) {
        match.reParts.push(reVal);
        match.imParts.push(imVal);
        // store complex magnitude info here; we'll map to MIDI later when compressing velFrames
        match.velFrames.push({ frame, re: reVal, im: imVal });
        match.lastMag = mag;
        match.seen = true;
      } else {
        // create a new active note
        active.push({
          midiRounded,
          startFrame: frame,
          reParts: [reVal],
          imParts: [imVal],
          velFrames: [{ frame, re: reVal, im: imVal }], // store complex
          lastMag: mag,
          midiFloat,
          seen: true
        });
      }
    }

    // finalize any active notes that were NOT seen this frame
    for (let i = active.length - 1; i >= 0; i--) {
      const a = active[i];
      if (!a.seen) {
        const lengthFrames = frame - a.startFrame;
        // compress velFrames into changes relative to startFrame
        const vf = a.velFrames.slice().sort((u, v) => u.frame - v.frame);
        const velChanges = [];
        let lastVel = null;
        for (const entry of vf) {
          const rel = entry.frame - a.startFrame;
          // map the stored complex to MIDI here
          const mapped = mapComplexToMidi(entry.re, entry.im);
          if (lastVel === null || mapped !== lastVel) {
            velChanges.push({ offsetFrames: rel, vel: mapped });
            lastVel = mapped;
          }
        }
        if (velChanges.length === 0) {
          // fallback: use average magnitude mapped to MIDI
          const avgMag = avgMagFromParts(a.reParts, a.imParts);
          velChanges.push({ offsetFrames: 0, vel: mapComplexToMidi(avgMag, 0) });
        }

        notes.push({
          midiFloat: a.midiFloat,
          velocity: velChanges[0].vel, // primary velocity (first)
          lengthFrames,
          lengthSeconds: (lengthFrames * hop) / sampleRate,
          startTime: (a.startFrame * hop) / sampleRate,
          velChanges
        });
        active.splice(i, 1);
      }
    }
  }

  // finalize remaining active notes that extend to the end
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
    const quant = (60 / midiBpm) / mSubBeat; // grid size in seconds per your spec
    const threshold = quant / 2; // dCutoff/10

    const kept = [];
    for (const n of notes) {
      const rel = (n.startTime - firstStart);
      // positive modulo in [0, quant)
      const rem = ((rel % quant) + quant) % quant;
      // remove if remainder is greater than threshold
      if (rem > threshold) {
        // drop (off-grid)
        continue;
      }
      kept.push(n);
    }
    // replace notes with filtered array
    notes.length = 0;
    notes.push(...kept);
  }
  return { notes };
}


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