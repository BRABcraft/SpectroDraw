(function () {
  const makeArray100 = (fnOrFill = 0) => {
    const a = new Array(100);
    if (typeof fnOrFill === 'function') {
      for (let i = 0; i < 100; i++) a[i] = fnOrFill(i);
    } else {
      for (let i = 0; i < 100; i++) a[i] = fnOrFill;
    }
    return a;
  };
  function fill100(arr){
    while (arr.length<100) arr.push(0);
    return arr;
  }
  const presets = {
    __load__: {
      name: 'Load preset...',
      value: '__load__',
      harmonics: makeArray100(0),
      chorus: { enabled: false, voices: 1, voiceStrength: 1, detune: 0, panSpread: 0, randomness: 0 },
      phaseTexture: 'Static',
      panTexture: 'Flat'
    },
    sine: {
      name: 'Sine wave', value: "sine",
      harmonics: (() => {
        const a = makeArray100(0);
        a[0] = 1;
        return a;
      })(),
      chorus: { enabled: false, voices: 1, voiceStrength: 1, detune: 0, panSpread: 0, randomness: 0 }
    },
    triangle: {
      name: 'Triangle wave', value: "triangle",
      harmonics: (() =>
        makeArray100(i => {
          const n = i + 1;
          return (n % 2 === 1) ? 1 / (n * n) : 0;
        })
      )(),
      chorus: { enabled: false, voices: 1, voiceStrength: 1, detune: 0, panSpread: 0, randomness: 0 }
    },
    square: {
      name: 'Square wave', value: "square",
      harmonics: (() =>
        makeArray100(i => {
          const n = i + 1;
          return (n % 2 === 1) ? 1 / n : 0;
        })
      )(),
      chorus: { enabled: false, voices: 1, voiceStrength: 1, detune: 0, panSpread: 0, randomness: 0 }
    },
    saw: {
      name: 'Saw wave', value: "saw",
      harmonics: makeArray100(i => 1 / (i + 1)),
      chorus: { enabled: false, voices: 1, voiceStrength: 1, detune: 0, panSpread: 0, randomness: 0 }
    },
    crystalBloom: {
      name: 'Crystal Bloom', value: "crystalBloom",
      harmonics: (() =>
        makeArray100(i => {
          const center = 6, width = 10;
          const g = Math.exp(-Math.pow(i - center, 2) / (2 * width * width));
          return g * (1 / (1 + i * 0.08));
        })
      )(),
      chorus: { enabled: true, voices: 4, voiceStrength: 0.45, detune: 18, panSpread: 0.4, randomness: 0.12 }
    },
    submarinePulse: {
      name: 'Submarine Pulse', value: "submarinePulse",
      harmonics: (() =>
        makeArray100(i => {
          const k = i + 1;
          return (k <= 8 ? 0.9 / k : 0.25 / k) * (k % 2 === 0 ? 1.2 : 0.7);
        })
      )(),
      chorus: { enabled: true, voices: 3, voiceStrength: 0.55, detune: 34, panSpread: 0.25, randomness: 0.08 }
    },
    glassHarp: {
      name: 'Glass Harp', value: "glassHarp",
      harmonics: (() =>
        makeArray100(i => {
          const k = i + 1;
          const cluster = (Math.sin(i * 0.7) + 1) * 0.5;
          return (0.8 / (k * 0.6 + 0.3)) * (0.5 + 0.5 * cluster);
        })
      )(),
      chorus: { enabled: true, voices: 5, voiceStrength: 0.6, detune: 26, panSpread: 0.6, randomness: 0.18 }
    },
    ironSwell: {
      name: 'Iron Swell', value: "ironSwell",
      harmonics: (() =>
        makeArray100(i => {
          const k = i + 1;
          let v = (0.7 / (1 + 0.06 * k)) * (1 - 0.4 * Math.sin(k * 1.3));
          if (i < 3) v *= 1.4;
          return Math.max(0, v / 1.06);
        })
      )(),
      chorus: { enabled: true, voices: 2, voiceStrength: 0.75, detune: 40, panSpread: 0.15, randomness: 0.22 }
    },
    nebulaPad: {
      name: 'Nebula Pad', value: "nebulaPad",
      harmonics: (() =>
        makeArray100(i => {
          const k = i + 1;
          return Math.exp(-k / 18) * 0.9 * (1 - Math.exp(-k / 4) * 0.2);
        })
      )(),
      chorus: { enabled: true, voices: 6, voiceStrength: 0.35, detune: 12, panSpread: 0.7, randomness: 0.06 }
    },
    pluckedStar: {
      name: 'Plucked Star', value: "pluckedStar",
      harmonics: (() =>
        makeArray100(i => {
          const k = i + 1;
          return ((k === 1) ? 1.0 : 0.55 / k) * Math.exp(-k / 9);
        })
      )(),
      chorus: { enabled: true, voices: 3, voiceStrength: 0.5, detune: 8, panSpread: 0.18, randomness: 0.04 }
    },
    wobbleCluster: {
      name: 'Wobble Cluster', value: "wobbleCluster",
      harmonics: (() =>
        makeArray100(i => {
          const k = i + 1;
          const cluster = (Math.sin(i * 0.9) + Math.cos(i * 0.33)) * 0.5 + 0.6;
          return (0.6 / (1 + 0.05 * k)) * Math.max(0.05, cluster);
        })
      )(),
      chorus: { enabled: true, voices: 7, voiceStrength: 0.8, detune: 62, panSpread: 0.85, randomness: 0.45 }
    },
    bellBloom: {
      name: 'Bell Bloom', value: "bellBloom",
      harmonics: (() => {
        const a = makeArray100(i => {
          const k = i + 1;
          return Math.exp(-Math.pow((k - 10) / 6, 2)) * (0.9 / (1 + 0.03 * k));
        });
        a[0] = Math.max(a[0], 0.35);
        return a;
      })(),
      chorus: { enabled: true, voices: 4, voiceStrength: 0.5, detune: 28, panSpread: 0.33, randomness: 0.1 }
    },
    liquidChime: {
      name: 'Liquid Chime', value: "liquidChime",
      harmonics: (() =>
        makeArray100(i =>
          Math.exp(-i / 12) *
          (0.25 + 0.75 * ((Math.sin(i * 0.6 + 0.3) * 0.5) + 0.5))
        )
      )(),
      chorus: { enabled: true, voices: 5, voiceStrength: 0.65, detune: 22, panSpread: 0.5, randomness: 0.14 }
    },
    auroraDrift: {
      name: 'Aurora Drift', value: "auroraDrift",
      harmonics: (() =>
        makeArray100(i => {
          const k = i + 1;
          const env = Math.exp(-Math.pow((i - 18) / 22, 2));
          const shimmer = 0.5 + 0.5 * Math.sin(i * 0.42 + 0.7);
          return Math.max(0, env * shimmer * (0.8 / (1 + 0.02 * k)));
        })
      )(),
      chorus: { enabled: true, voices: 4, voiceStrength: 0.42, detune: 20, panSpread: 0.5, randomness: 0.11 }
    },
    violin: {
      name: 'Violin', value:"violin",
      harmonics: fill100([1,0.802,0.073,0.213,0.213,0.105,0.079,0.015,0.015,0.015,0.015,0.015,0.009]),
      chorus: {enabled: false, voices: 1, voiceStrength: 1, detune: 0, panSpread: 0, randomness: 0},
    },
    flute: {
      name: 'Flute', value:"flute",
      harmonics: fill100([1,0.718,0.463,0.456,0.021,0.015,0.009,0.002]),
      chorus: {enabled: false, voices: 1, voiceStrength: 1, detune: 0, panSpread: 0, randomness: 0},
      phaseTexture: "Flat", panTexture: "Random",
    },
    warm: {
      name: 'Warm', value:"warm",
      harmonics: fill100([1,0.987,0.533,0.533]),
      chorus: {enabled: true, voices: 8, voiceStrength: 0.464, detune: 32, panSpread: 1, randomness: 0},
      panTexture: "Random",
    }
  };
  const synthSelect = document.getElementById('synthPresets');
  synthSelect.innerHTML = '';
  const addOpt = (val, label, sel = false) => {
    const o = document.createElement('option');
    o.value = val;
    o.textContent = label;
    if (o.value==="__load__")o.style.background="#3c515a";
    if (sel) o.selected = true;
    synthSelect.appendChild(o);
  };
  Object.values(presets).forEach(p => {
    addOpt(p.value, p.name, false);
  });
  synthSelect.value="sine";
  function applyPresetKey(key) {
    const p = presets[key];//console.log(p);
    const panTextureEl = document.getElementById("brushPanTexture");
    if (p.phaseTexture) phaseTextureEl.value = p.phaseTexture; else phaseTextureEl.value = "Static";
    if (p.panTexture) panTextureEl.value = p.panTexture; else panTextureEl.value = "Flat";
    phaseTextureEl.dispatchEvent(new Event('input', { bubbles: true }));
    panTextureEl.dispatchEvent(new Event('input', { bubbles: true }));
    harmonics = Array.from(p.harmonics);
    harmonicsPreset.value = ["sine","triangle","square","saw"].includes(p.value) ? p.value : 'custom';
    harmonicsPreset.dispatchEvent(new Event('input', { bubbles: true }));
    renderHarmonicsCanvas();
    updateAllVariables(null);
    updateBrushPreview();
    const c = p.chorus || { enabled:false, voices:0, voiceStrength:0, detune:0, panSpread:0, randomness:0 };
    const enableEl = document.getElementById('enableChorus');
    enableEl.checked = !!c.enabled;
    enableEl.dispatchEvent(new Event('change', { bubbles: true }));
    sliders[34][0].value = sliders[34][1].value = chorusVoices = c.voices;
    sliders[35][0].value = sliders[35][1].value = chorusVoiceStrength = c.voiceStrength;
    sliders[36][0].value = sliders[36][1].value = chorusDetune = c.detune;
    sliders[37][0].value = sliders[37][1].value = chorusPanSpread = c.panSpread;
    sliders[38][0].value = sliders[38][1].value = chorusRandomness = c.randomness;
  }
  synthSelect.addEventListener('change', (ev) => {
    const key = ev.target.value;
    applyPresetKey(key);
  });
  (function applyInitial() {
    const initKey = synthSelect.value || 'sine';
    applyPresetKey(initKey);
  })();
  let loadInput = document.getElementById('loadSynthPreset');
  let __prevSynthValue = synthSelect.value || 'sine';
  synthSelect.addEventListener('change', (ev) => {
    const v = ev.target.value;
    if (v === '__load__') {
      loadInput.click();
      setTimeout(() => { synthSelect.value = __prevSynthValue; }, 0);
    } else {
      __prevSynthValue = v;
    }
  });
  loadInput.addEventListener('change', (ev) => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const fileBaseName = file.name.replace(/\.[^/.]+$/, ""); 
    const safeBase = fileBaseName
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^\w\-]/g, '') || 'loaded_preset';
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const obj = JSON.parse(e.target.result);
        if (!Array.isArray(obj.harmonics)) {
          throw new Error('Invalid preset file (missing harmonics array).');
        }
        let key = safeBase;
        let i = 1;
        while (presets[key]) key = `${safeBase}_${i++}`;
        const newPreset = {
          name: safeBase,
          value: key,
          harmonics: fill100(obj.harmonics.slice(0, 100)),
          chorus: obj.chorus || {
            enabled: false, voices: 1, voiceStrength: 1,
            detune: 0, panSpread: 0, randomness: 0
          },
          phaseTexture: obj.phaseTexture || 'Static',
          panTexture: obj.panTexture || 'Flat'
        };
        presets[key] = newPreset;
        addOpt(key, newPreset.name, true);
        synthSelect.value = key;
        applyPresetKey(key);
      } catch (err) {
        alert('Failed to load preset: ' + err.message);
      } finally {
        ev.target.value = '';
      }
    };
    reader.readAsText(file);
  });
  document.getElementById('saveSynthPreset').addEventListener('click', async () => {
    try {
      const key = synthSelect.value;
      const selPreset = presets[key] || {};
      const defaultName =
        (selPreset.name || key || 'preset')
          .replace(/[^\w\d_\-]+/g, '_');
      const out = {
        harmonics,
        chorus: {
          enabled: document.getElementById("enableChorus").checked,
          voices: chorusVoices,
          voiceStrength: chorusVoiceStrength,
          detune: chorusDetune,
          panSpread: chorusPanSpread,
          randomness: chorusRandomness
        },
        phaseTexture: phaseTextureEl.value,
        panTexture: document.getElementById("brushPanTexture").value
      };
      const json = JSON.stringify(out, null, 2);
      if (window.showSaveFilePicker) {
        const handle = await showSaveFilePicker({
          suggestedName: `${defaultName}.json`,
          types: [{
            description: 'Synth Preset',
            accept: { 'application/json': ['.json'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(json);
        await writable.close();
        return;
      }
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${defaultName}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch(e){}
  });
})();