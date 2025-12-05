function forEachSpritePixelInOrder(sprite, ch, cb) {
  if (!sprite) return;
  const cols = Array.from(sprite.pixels[ch].keys()).sort((a,b)=>a-b);
  for (const x of cols) {
    const col = sprite.pixels[ch].get(x);
    // ys are pushed in painting order (top-down if you painted that way), but ensure ascending y:
    const order = col.ys.map((y, i) => ({y, i})).sort((a,b)=>a.y - b.y);
    for (const entry of order) {
      const i = entry.i;
      cb(x, col.ys[i], col.prevMags[i], col.prevPhases[i], col.nextMags[i], col.nextPhases[i]);
    }
  }
}

let selectedSpriteId = null;

// utility to find sprite index by id
function getSpriteIndexById(id) {
  if (!sprites) return -1;
  return sprites.findIndex(s => s && s.id === id);
}

function getSpriteById(id) {
  const idx = getSpriteIndexById(id);
  return idx >= 0 ? sprites[idx] : null;
}

// Render the sprites table
function renderSpritesTable() {
  const tbody = document.getElementById('spriteTableBody');
  tbody.innerHTML = '';
  if (sprites.length == 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="3" class="muted">No sprites</td>';
    tbody.appendChild(tr);
    updateEditorSelection(null);
    return;
  }

  sprites.forEach(sprite => {
    if (!sprite) return;
    const tr = document.createElement('tr');
    tr.className = 'sprite-row' + (selectedSpriteId === sprite.id ? ' selected' : '');
    tr.dataset.spriteId = sprite.id;

    // NAME
    const tdName = document.createElement('td');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = sprite.name;
    nameInput.className = 'sprite-name-input';
    nameInput.style = 'background:none;border:none;color:white;';

    // auto-size function
    function autosize() {
      nameInput.style.width = "10%"; // fallback/minimum
      const temp = document.createElement("span");
      temp.style.visibility = "hidden";
      temp.style.whiteSpace = "pre";
      temp.style.font = getComputedStyle(nameInput).font;
      temp.textContent = nameInput.value || "";
      document.body.appendChild(temp);

      const needed = temp.getBoundingClientRect().width + 12; // padding buffer
      document.body.removeChild(temp);

      nameInput.style.width = Math.max(10, needed) + "px";
    }

    autosize();
    nameInput.addEventListener("input", autosize);

    // block row-select click
    nameInput.addEventListener('click', ev => ev.stopPropagation());

    // apply changes
    nameInput.addEventListener('change', ev => {
      sprite.name = nameInput.value;
      renderSpritesTable();
    });

    tdName.appendChild(nameInput);

    // ENABLED checkbox
    const tdEnabled = document.createElement('td');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!sprite.enabled;
    cb.title = 'Toggle sprite enabled';
    cb.addEventListener('click', (ev) => {
      ev.stopPropagation();
    });

    // Keep change handler for toggle logic
    cb.addEventListener('change', (ev) => {
      ev.stopPropagation();
      toggleSpriteEnabled(sprite.id, cb.checked);
      renderSpritesTable();
    });
    tdEnabled.appendChild(cb);
    tr.addEventListener("mouseover", () => {
      spritePath = generateSpriteOutlinePath(sprite, { height: specHeight });
      drawSpriteOutline(false);
    });

    tr.addEventListener("mouseout", () => {
      if (sprite.ch==="all") {
        for (let ch=0;ch<channelCount;ch++){
          const overlayCanvas = document.getElementById("overlay-"+ch);
          const overlayCtx = overlayCanvas.getContext("2d");
          overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
        }
      } else {
        const overlayCanvas = document.getElementById("overlay-"+sprite.ch);
        const overlayCtx = overlayCanvas.getContext("2d");
        overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
      }
    });


    // TOOL
    const tdTool = document.createElement('td');
    tdTool.textContent = sprite.effect.tool || '';

    tr.appendChild(tdName);
    tr.appendChild(tdEnabled);
    tr.appendChild(tdTool);

    // click selects
    tr.addEventListener('click', () => {
      if (selectedSpriteId == sprite.id){
        selectedSpriteId = null;
      } else {
        selectedSpriteId = sprite.id;
      }
      renderSpritesTable();
      updateEditorSelection(sprite.id);
    });

    tbody.appendChild(tr);
  });
}

// Update editor info for selected sprite
function updateEditorSelection(spriteId) {
  document.getElementById("stlb").innerText="Tool:"
  if (spriteId === null || selectedSpriteId === null) {
    selectedSpriteId = null;
    spriteEditorDiv.setAttribute('disabled', 'disabled');
    nameEl.value = 'No sprite selected';
    toolEl.value = '';toolEl.style.display="";
    enabledEl.checked = false;
    sChannelEl.value = '';
  } else {
    const s=getSpriteById(spriteId);
    spriteEditorDiv.removeAttribute('disabled');
    nameEl.value = s.name;
    enabledEl.checked = s.enabled;
    if (s.effect.tool==="sample"){toolEl.style.display="none";document.getElementById("stlb").innerText="Tool: sample"}else{toolEl.style.display="";toolEl.value = s.effect.tool;}
    sChannelEl.value = s.ch;
    renderToolEditorSettings(s);
    renderSpriteFade();
    processSpriteFade();
  }
}

document.getElementById('sphaseTexture').addEventListener('change', () => {
  const s = getSpriteById(selectedSpriteId);
  if (!s) return;
  s.effect.phaseTexture = document.getElementById('sphaseTexture').value;
  updateSpriteEffects(selectedSpriteId, s.effect);
});

// ---------- config (top) ----------
// [ rangeId, textId, assignFn, optionalExtraFn ]
const sliderDefs = [
  // [rangeId, textId, effectsKey, optionalCallback]
  ['sbrushColor',      'sbrushColorInput',       'brushColor'],
  ['spenPhase',        'spenPhaseInput',         'penPhase'],
  ['sbrushOpacity',    'sbrushOpacityInput',     'brushOpacity'],
  ['sphaseOpacity',    'sphaseOpacityInput',     'phaseOpacity'],
  ['sblurRadius',      'sblurRadiusInput',       'blurRadius'      ],
  ['samp',             'sampInput',              'amp'             ],
  ['snoiseRemoveFloor','snoiseRemoveFloorInput', 'noiseRemoveFloor']
];

const $ = id => document.getElementById(id);
const parseF = v => parseFloat(v);
const CLAMP = (v, a, b) =>
  isNaN(v) ? v :
  (a != null && v < a ? a :
  (b != null && v > b ? b : v));

// -------------------------------
// Universal slider logic
// -------------------------------
sliderDefs.forEach(([rangeId, textId, effectsKey, extraFn]) => {
  const r = document.getElementById(rangeId);
  const t = document.getElementById(textId);
  if (!r || !t) return;

  const assignToSprite = val => {
    const s = getSpriteById(selectedSpriteId);
    if (!s) return;
    if (!s.effect) s.effect = {};
    s.effect[effectsKey] = val;
    updateSpriteEffects(selectedSpriteId, s.effect);
  };

  const handleValueChange = val => {
    t.value = val;
    assignToSprite(val);
  };

  // range input → mirror + assign
  r.addEventListener('input', () => handleValueChange(parseF(r.value)));

  // text input → Enter → clamp + assign
  t.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    let val = parseF(t.value);
    const min = parseF(r.min), max = parseF(r.max);
    if (isNaN(val)) val = parseF(r.value);
    val = CLAMP(val, min, max);
    r.value = val;
    handleValueChange(val);
  });

  // optional: detect blur from text input too
  t.addEventListener('blur', () => {
    let val = parseF(t.value);
    if (isNaN(val)) val = parseF(r.value);
    val = CLAMP(val, parseF(r.min), parseF(r.max));
    r.value = val;
    handleValueChange(val);
  });
});

function renderToolEditorSettings(sprite) {
  if (document.getElementById("effectSettingsToggleBtn").getAttribute("aria-expanded") === "false") return;
  document.getElementById('samplifyDiv').style.display = 'none';
  document.getElementById('sblurRadiusDiv').style.display = 'none';
  document.getElementById('snoiseFloorDiv').style.display = 'none';
  document.getElementById("sbrushColorDiv").style.display='none';
  document.getElementById("sev").style.display='flex';
  document.getElementById("sphaseDiv").style.display='flex';
  document.getElementById("sphaseStrengthDiv").style.display='flex';
  document.getElementById("sbrushOpacityDiv").style.display='flex';
  if (toolEl.value === 'amplifier') {
    document.getElementById('samplifyDiv').style.display = 'flex';
  } else if (toolEl.value === 'blur') {
    document.getElementById('sblurRadiusDiv').style.display = 'flex';
  } else if (toolEl.value === 'noiseRemover') {
    document.getElementById('snoiseFloorDiv').style.display = 'flex';
    document.getElementById("sev").style.display='none';
    document.getElementById("sphaseDiv").style.display='none';
    document.getElementById("sphaseStrengthDiv").style.display='none';
  } else if (sprite.effect.tool==="sample"){
    document.getElementById('samplifyDiv').style.display = 'flex';
    document.getElementById("sev").style.display='none';
    document.getElementById("sphaseStrengthDiv").style.display='none';
    document.getElementById("sbrushOpacityDiv").style.display='none';
  } else {
    document.getElementById("sbrushColorDiv").style.display='flex';
  }
  if (!sprite) return;

  // Ensure effects object exists to read from
  const effects = sprite.effect || {};

  // Load slider values from sprite.effect for each defined slider
  sliderDefs.forEach(([rangeId, textId, effectsKey, extraFn]) => {
    const r = document.getElementById(rangeId);
    const t = document.getElementById(textId);
    if (!r || !t) return;

    // read value from sprite.effect if present; otherwise skip
    let val = effects.hasOwnProperty(effectsKey) ? parseF(effects[effectsKey]) : undefined;

    // If the effect value is undefined, fall back to current range value (no change)
    if (val === undefined || isNaN(val)) {
      // keep as-is (but still ensure text mirrors range)
      t.value = r.value;
      return;
    }

    // clamp to the control's allowed range
    const min = parseF(r.min);
    const max = parseF(r.max);
    val = CLAMP(val, min, max);

    // write into the DOM controls
    r.value = val;
    t.value = val;

    // call the optional callback so any preview updates (brush preview, etc.) run
    if (typeof extraFn === 'function') extraFn(val);
  });
  document.getElementById('sphaseTexture').value = effects.phaseTexture || 'none';
}

document.getElementById("spriteChannel").addEventListener("change",()=>{updateSpriteChannels();});

async function updateSpriteChannels(){
  const type = document.getElementById("spriteChannel").value;
  const s = getSpriteById(selectedSpriteId);
  if (type === "all"){
    s.ch = "all";
    let v = -1;
    for (let c=0;c<channelCount;c++){
      if (s.pixels[c] instanceof Map && s.pixels[c].size !== 0) {
        if (v<0) v = c;
      } else {
        s.pixels[c] = new Map();
      }
    }
    forEachSpritePixelInOrder(s, v, (x, y, prevMag, prevPhase, nextMag, nextPhase)=>{
      const id = x * specHeight + y;
      for (let ch=0;ch<channelCount;ch++) {
        if (ch==v) continue;
        addPixelToSprite(s, x, y, channels[ch].mags[id], channels[ch].phases[id], nextMag, nextPhase, ch);
        channels[ch].mags[id] = nextMag;
        channels[ch].phases[id] = nextPhase;
      }
    });
  } else {
    const ch = parseInt(type);
    if (s.ch!=="all")s.pixels[ch] = new Map();
    let $s = s.ch==="all"?0:s.ch, $e = s.ch==="all"?channelCount:s.ch+1;
    for (let c = $s;c<$e;c++){
      if (c==ch) continue;
      forEachSpritePixelInOrder(s, c, (x, y, prevMag, prevPhase, nextMag, nextPhase)=>{
        const id = x * specHeight + y;
        if (s.ch!=="all")addPixelToSprite(s, x, y, channels[ch].mags[id], channels[ch].phases[id], nextMag, nextPhase, ch);
        channels[ch].mags[id] = nextMag;
        channels[c].mags[id] = prevMag;
        channels[ch].phases[id] = nextPhase;
        channels[c].phases[id] = prevPhase;
      });
      s.pixels[c] = null;
    }
    s.ch = ch;
  }
  recomputePCMForCols(s.minCol, s.maxCol);
  restartRender(false);
  await waitFor(()=>!rendering);
  for (let ch=0;ch<channelCount;ch++)renderSpectrogramColumnsToImageBuffer(s.minCol,s.maxCol,ch);
} 


async function updateSpriteEffects(spriteId, newEffect) {
  const sprite = getSpriteById(spriteId);
  if (!sprite) return;
  let recomputeMin = Infinity, recomputeMax = -Infinity;

  let $s = sprite.ch==="all"?0:sprite.ch, $e = sprite.ch==="all"?channelCount:sprite.ch+1;
  for (let ch=$s;ch<$e;ch++){
    const mags = channels[ch].mags, phases = channels[ch].phases;
    // keep a copy of the old effect to detect instant zeroing
    const oldEffect = Object.assign({}, sprite.effect || {});

    renderToolEditorSettings(sprite);

    // compute local sig sprite once
    const z = (sprite.effect.tool==="sample");
    const sigSprite = z?(sprite):(formatSignificantAsSprite(sprite, getSignificantPixels(sprite, { height: specHeight })));
    if (!sigSprite) return;

    // write new mags/phases for significant pixels
    const integral = buildIntegral(specWidth, specHeight, mags, phases);
    forEachSpritePixelInOrder(sigSprite, ch, (x, y, prevMag, prevPhase, newMag, newPhase) => {
      const id = x * specHeight + y;
      const newPixel = applyEffectToPixel(z?newMag:prevMag, z?newPhase:prevPhase, x, y, newEffect, integral);
      mags[id] = newPixel.mag;
      phases[id] = newPixel.phase;
    });

    // ---- IMPORTANT: expand recomputation range to account for FFT overlap ----
    // Determine hop size (try common names, fall back to fftSize to mean "no expansion")
    const hopSamples = (typeof hop === 'number' && hop > 0) ? hop :
                      (typeof fftHop === 'number' && fftHop > 0) ? fftHop :
                      fftSize;

    // how many analysis frames (columns) an FFT can affect laterally:
    // ceil(fftSize / hop) is number of overlapped frames per FFT window.
    // padCols here is conservative: expand by that many columns on each side.
    const padCols = Math.max(0, Math.ceil(fftSize / hopSamples));

    // compute sigSprite bounds
    const sigCols = Array.from(sigSprite.pixels[ch].keys()).sort((a,b)=>a-b);
    const minCol = sigCols.length ? Math.max(0, sigCols[0]) : Math.max(0, sprite.minCol || 0);
    const maxCol = sigCols.length ? Math.min(specWidth - 1, sigCols[sigCols.length - 1]) : Math.min(specWidth - 1, sprite.maxCol || (specWidth - 1));

    // expand bounds to include FFT overlap region
    const min = Math.max(0, minCol - padCols);
    const max = Math.min(specWidth - 1, maxCol + padCols);

    // Additional safeguard: if the user instantly set brushColor to zero, aggressively clear
    // a small neighborhood so partial overlap contributions get zeroed immediately.
    // (Only do this when brushColor exists in effects and it changed to 0.)
    if (typeof newEffect === 'object' &&
        typeof newEffect.brushColor !== 'undefined' &&
        newEffect.brushColor === 0 &&
        typeof oldEffect.brushColor !== 'undefined' &&
        oldEffect.brushColor !== 0) {

      // zero mags/phases in expanded recompute window to remove residuals
      for (let c = min; c <= max; c++) {
        const colBase = c * specHeight;
        for (let r = 0; r < specHeight; r++) {
          const idx = colBase + r;
          mags[idx] = 0;
          phases[idx] = 0;
        }
      }
    }
    if (min<recomputeMin)recomputeMin=min;if (max>recomputeMax)recomputeMax=max;
  }
  // Recompute PCM for the expanded area and restart render / audio
  recomputePCMForCols(recomputeMin, recomputeMax);
  restartRender(false);
  await waitFor(()=>!rendering);
  for (let ch=0;ch<channelCount;ch++)renderSpectrogramColumnsToImageBuffer(recomputeMin,recomputeMax,ch);

  // keep previous behaviour for audio restart
  if (spriteId < sprites.length && getSpriteById(spriteId+1).enabled) {
    // no-op (kept to match original)
  } else {
    if (playing) {
      stopSource(true);
      playPCM(true);
    }
  }
}


nameEl.addEventListener('change', ev => {const c = getSpriteById(selectedSpriteId); c.name = nameEl.value;renderSpritesTable();});
toolEl.addEventListener('change', ev => {const c = getSpriteById(selectedSpriteId); c.effect.tool = toolEl.value;updateSpriteEffects(selectedSpriteId,c.effect);renderSpritesTable();});
enabledEl.addEventListener('change', ev => {const c = getSpriteById(selectedSpriteId); c.enabled = enabledEl.checked;toggleSpriteEnabled(selectedSpriteId,c.enabled);renderSpritesTable();});

// Toggle sprite (apply prev or next values)
function toggleSpriteEnabled(spriteId, enable) {
  const sprite = getSpriteById(spriteId);
  if (!sprite) return;
  let minCol = Math.max(0, sprite.minCol || 0);
  let maxCol = Math.min(specWidth - 1, sprite.maxCol || (specWidth - 1));
  let $s = sprite.ch==="all"?0:sprite.ch, $e = sprite.ch==="all"?channelCount:sprite.ch+1;
  for (let ch=$s;ch<$e;ch++){
    let mags = channels[ch].mags, phases = channels[ch].phases;

    // apply prev (disable) or next (enable)
    if (enable) {
      // write next values at recorded coords
      forEachSpritePixelInOrder(sprite, ch, (x, y, _prevMag, _prevPhase, nextMag, nextPhase) => {
        const id = x * specHeight + y;
        mags[id] = nextMag;
        phases[id] = nextPhase;
      });
      sprite.enabled = true;
    } else {
      // write prev values back
      forEachSpritePixelInOrder(sprite, ch, (x, y, prevMag, prevPhase) => {
        const id = x * specHeight + y;
        mags[id] = prevMag;
        phases[id] = prevPhase;
      });
      sprite.enabled = false;
    }
  }
  for (let ch=0;ch<channelCount;ch++)renderSpectrogramColumnsToImageBuffer(minCol,maxCol,ch);
  //restartRender(false);
  recomputePCMForCols(minCol, maxCol);
  if (spriteId < sprites.length && getSpriteById(spriteId+1).enabled) {
    // toggleSpriteEnabled(spriteId+1, getSpriteById(spriteId+1).enabled);
  } else {

    if (playing) {
      stopSource(true);
      playPCM(true);
    }
  }
}

// Move sprite by dx (frames) and dy (bins). Best-effort handling.
async function moveSprite(spriteId, dx, dy) {
  const sprite = getSpriteById(spriteId);
  let recomputeMax = -Infinity, recomputeMin = Infinity;
  if (!sprite) return;

  // old range (may be Infinity if empty)
  const oldMinCol = sprite.minCol;
  const oldMaxCol = sprite.maxCol;
  let $s = sprite.ch==="all"?0:sprite.ch, $e = sprite.ch==="all"?channelCount:sprite.ch+1;
  for (let ch=$s;ch<$e;ch++){
    let mags = channels[ch].mags, phases = channels[ch].phases;

    // 1) restore prev values at old positions (keep same behaviour)
    forEachSpritePixelInOrder(sprite, ch, (x, y, prevMag, prevPhase) => {
      const idOld = x * specHeight + y;
      mags[idOld] = prevMag;
      phases[idOld] = prevPhase;
    });

    // We'll build a fresh map for the new sprite pixels.
    // But avoid writing to mags/phases until we've finished building the structure.
    const newMap = new Map();
    let newMin = Infinity, newMax = -Infinity;

    const cols = Array.from(sprite.pixels[ch].keys()); // no sort - insertion order is fine
    for (const oldX of cols) {
      const col = sprite.pixels[ch].get(oldX);
      if (!col) continue;

      for (let i = 0; i < col.ys.length; i++) {
        const oldY = col.ys[i];
        const nextMag = col.nextMags ? col.nextMags[i] : col.prevMags[i]; // keep your pattern
        const nextPhase = col.nextPhases ? col.nextPhases[i] : col.prevPhases[i];

        const nx = oldX + dx;
        const f = sampleRate / fftSize;
        const $s = sampleRate/2, $l = logScaleVal[ch];
        const ny  = Math.floor(invlsc(lsc( oldY   *f,$s,$l) + dy * f,$s,$l) / f);
        const ny1 = Math.floor(invlsc(lsc((oldY+1)*f,$s,$l) + dy * f,$s,$l) / f);
        if (i===0) sprite.minY = ny;
        if (i===col.ys.length-1) sprite.maxY = ny;

        if (nx < 0 || nx >= specWidth || ny < 0 || ny1 >= specHeight) {
          continue; // out of bounds
        }

        // ensure column entry exists
        let ncol = newMap.get(nx);
        if (!ncol) {
          // Only store the arrays we actually need. We'll capture prev values lazily.
          ncol = { ys: [], prevMags: [], prevPhases: [], nextMags: [], nextPhases: [] };
          newMap.set(nx, ncol);
        }

        for (let j = ny; j < ny1; j++) {
          const destIdx = nx * specHeight + j;
          ncol.ys.push(j);
          ncol.prevMags.push(mags[destIdx]);
          ncol.prevPhases.push(phases[destIdx]);
          ncol.nextMags.push(nextMag);
          ncol.nextPhases.push(phases[destIdx] + nextPhase);
        }

        if (nx < newMin) newMin = nx;
        if (nx > newMax) newMax = nx;
      }
    }

    // 3) single pass: write next values into mags/phases for the new positions
    for (const [x, col] of newMap) {
      for (let i = 0; i < col.ys.length; i++) {
        const y = col.ys[i];
        const nextMag = col.nextMags[i];
        const nextPhase = col.nextPhases[i];
        const idNew = x * specHeight + y;
        mags[idNew] = nextMag;
        phases[idNew] = nextPhase;
      }
    }

    // 4) replace sprite.pixels, update bounds
    sprite.pixels[ch] = newMap;
    sprite.minCol = newMin === Infinity ? Infinity : Math.max(0, newMin);
    sprite.maxCol = newMax === -Infinity ? -1 : Math.min(specWidth - 1, newMax);

    // Recompute columns once over the union of old/new ranges
    let min = Math.min(
      Number.isFinite(oldMinCol) ? oldMinCol : Infinity,
      Number.isFinite(sprite.minCol) ? sprite.minCol : Infinity
    ); if (min<recomputeMin) recomputeMin = min;
    let max = recomputeMax = Math.max(
      Number.isFinite(oldMaxCol) ? oldMaxCol : -Infinity,
      Number.isFinite(sprite.maxCol) ? sprite.maxCol : -Infinity
    ); if (max>recomputeMax) recomputeMax = max;
  }

  if (recomputeMin <= recomputeMax && Number.isFinite(recomputeMin)) {
    recomputePCMForCols(recomputeMin, recomputeMax);
  }

  // Only restart render / audio if necessary
  restartRender(false);
  await waitFor(()=>!rendering);
  for (let ch=0;ch<channelCount;ch++) renderSpectrogramColumnsToImageBuffer(recomputeMin,recomputeMax,ch);

  if (playing) {
    stopSource(true);
    playPCM(true);
  }

  renderSpritesTable();
  // updateEditorSelection(spriteId);
}


// Delete sprite: disable (restore prev) then remove from sprites array
async function deleteSprite(spriteId) {
  const idx = getSpriteIndexById(spriteId);
  if (idx === -1) return;
  const sprite = sprites[idx];
  let $s = spritePath.ch==="all"?0:spritePath.ch, $e = spritePath.ch==="all"?channelCount:spritePath.ch+1;
  for (let ch=$s;ch<$e;ch++){
    const mags = channels[ch].mags, phases = channels[ch].phases;
    forEachSpritePixelInOrder(sprite, ch, (x, y, prevMag, prevPhase) => {
      const id = x * specHeight + y;
      mags[id] = prevMag;
      phases[id] = prevPhase;
    });
  }
  const minCol = Math.max(0, sprite.minCol || 0);
  const maxCol = Math.min(specWidth - 1, sprite.maxCol || (specWidth - 1));
  sprites.splice(idx, 1);
  recomputePCMForCols(minCol, maxCol);
  restartRender(false);
  
  await waitFor(()=>!rendering);
  for (let ch=0;ch<channelCount;ch++) renderSpectrogramColumnsToImageBuffer(minCol,maxCol,ch);

  if (playing) {
    stopSource(true);
    playPCM(true);
  }
  selectedSpriteId = null;
  renderSpritesTable();
  updateEditorSelection(null);
}

document.getElementById('deleteSpriteBtn').addEventListener('click', () => {
  if (!selectedSpriteId) return;
  if (!confirm('Delete selected sprite? This cannot be undone.')) return;
  deleteSprite(selectedSpriteId);
});
const mvsbtn=document.getElementById('moveSpriteBtn');
mvsbtn.addEventListener('click', () => {
  if (!selectedSpriteId) return;
  movingSprite = !movingSprite;
  mvsbtn.classList.toggle('moving', movingSprite);
  if (movingSprite) {
    document.getElementById("canvas-"+currentChannel).style.cursor = 'grabbing';
    mvsbtn.innerText = 'Moving Sprite';
  } else {
    document.getElementById("canvas-"+currentChannel).style.cursor = 'crosshair';
    mvsbtn.innerText = 'Move Sprite';
  }
});

function formatSignificantAsSprite(origSprite, sig) {
  if (!sig) return null;
  const { minX, maxX, clusterY0, maskHeight, filled } = sig;
  const W = (maxX - minX + 1);
  let pixelmap=[];
  for(let c=0;c<channelCount;c++) pixelmap.push((origSprite.ch==="all"||c==origSprite.ch)?(new Map()):null);
  let out = {
    pixels: pixelmap,
    minCol: Infinity,
    maxCol: -Infinity
  };
  let $s = origSprite.ch==="all"?0:origSprite.ch, $e = origSprite.ch==="all"?channelCount:origSprite.ch+1;
  for (let ch=$s;ch<$e;ch++) {
    for (let xr = 0; xr < W; xr++) {
        const colArr = filled[xr]; if (!colArr) continue;
        const xGlobal = minX + xr;
        for (let yr = 0; yr < colArr.length; yr++) {
          if (!colArr[yr]) continue;
          const yGlobal = clusterY0 + yr;
          let prevMag = 0, prevPhase = 0, nextMag = 0, nextPhase = 0;
          if (origSprite && origSprite.pixels[ch]) {
            const srcCol = origSprite.pixels[ch].get(xGlobal);
            if (srcCol && Array.isArray(srcCol.ys)) {
              const idx = srcCol.ys.findIndex(v => v === yGlobal);
              if (idx !== -1) {
                if (srcCol.prevMags && srcCol.prevMags[idx] != null) prevMag = srcCol.prevMags[idx];
                if (srcCol.prevPhases && srcCol.prevPhases[idx] != null) prevPhase = srcCol.prevPhases[idx];
                if (srcCol.nextMags && srcCol.nextMags[idx] != null) nextMag = srcCol.nextMags[idx];
                if (srcCol.nextPhases && srcCol.nextPhases[idx] != null) nextPhase = srcCol.nextPhases[idx];
              }
            }
          }
          addPixelToSprite(out, xGlobal, yGlobal, prevMag, prevPhase, nextMag, nextPhase, ch);
        }
      }
      if (out.pixels[ch].size === 0) out = null;
  }
  return out;
}


function getSignificantPixels(sprite, options = {}) {
  const height = options.height;
  if (typeof height !== 'number') throw new Error('getSignificantPixels: options.height is required');

  const clusterOptions = Object.assign({ kernel: 3, minFrac: 0.25, stdFactor: 0.5 }, options.clusterOptions || {});
  // --- 1) build per-y histogram of magnitude deltas ----------------
  const histogram = new Float64Array(height);
  let maxDelta = 0;
  let anyPixels = false;
  let ch= sprite.ch=="all"?0:sprite.ch;

  for (const [x, col] of sprite.pixels[ch]) {
    if (!col || !col.ys) continue;
    for (let i = 0; i < col.ys.length; i++) {
      const y = col.ys[i];
      if (y < 0 || y >= height) continue;
      const prev = (col.prevMags && col.prevMags[i] != null) ? col.prevMags[i] : 0;
      const next = (col.nextMags && col.nextMags[i] != null) ? col.nextMags[i] : 0;
      const d = Math.abs(next - prev);
      histogram[y] += d;
      if (d > maxDelta) maxDelta = d;
      anyPixels = true;
    }
  }
  if (!anyPixels) return null;

  // quick stats: mean & std
  let sum = 0;
  for (let y = 0; y < height; y++) sum += histogram[y];
  const mean = sum / height;
  let varSum = 0;
  for (let y = 0; y < height; y++) {
    const v = histogram[y] - mean;
    varSum += v * v;
  }
  const std = Math.sqrt(varSum / Math.max(1, height - 1));

  // smooth histogram with box kernel
  function smoothArray(arr, kernel) {
    if (kernel <= 1) return arr.slice();
    const out = new Float64Array(arr.length);
    const half = Math.floor(kernel / 2);
    for (let i = 0; i < arr.length; i++) {
      let s = 0, cnt = 0;
      const a = Math.max(0, i - half), b = Math.min(arr.length - 1, i + half);
      for (let j = a; j <= b; j++) { s += arr[j]; cnt++; }
      out[i] = s / cnt;
    }
    return out;
  }
  const smoothHist = smoothArray(histogram, clusterOptions.kernel);

  const byMax = maxDelta * clusterOptions.minFrac;
  const byStd = mean + clusterOptions.stdFactor * std;
  const threshold = Math.max(byMax, byStd);

  // find contiguous segments where smoothHist >= threshold
  const segments = [];
  let s = -1;
  for (let y = 0; y < height; y++) {
    if (smoothHist[y] >= threshold) {
      if (s === -1) s = y;
    } else {
      if (s !== -1) { segments.push({ y0: s, y1: y - 1 }); s = -1; }
    }
  }
  if (s !== -1) segments.push({ y0: s, y1: height - 1 });

  // fallback: use areas where histogram > 0 if no segments found
  if (segments.length === 0) {
    let y0 = -1, y1 = -1;
    for (let y = 0; y < height; y++) {
      if (histogram[y] > 0) { if (y0 === -1) y0 = y; y1 = y; }
    }
    if (y0 === -1) return null;
    segments.push({ y0, y1 });
  }

  // pick best segment by total histogram mass
  let bestSeg = null, bestMass = -Infinity;
  for (const seg of segments) {
    let mass = 0;
    for (let y = seg.y0; y <= seg.y1; y++) mass += histogram[y];
    if (mass > bestMass) { bestMass = mass; bestSeg = seg; }
  }
  const clusterY0 = bestSeg.y0;
  const clusterY1 = bestSeg.y1;

  // --- 2) build mask limited to cluster Y-range and columns -----------
  const colsList = Array.from(sprite.pixels[ch].keys()).sort((a, b) => a - b);
  if (colsList.length === 0) return null;
  const minX = colsList[0], maxX = colsList[colsList.length - 1];
  const width = ('width' in options && options.width != null) ? options.width : (maxX - minX + 1);

  const maskHeight = clusterY1 - clusterY0 + 1;
  // temporary marker map: xRel -> Uint8Array(maskHeight) marking presence before thresholding
  const maskCols = {};
  let maxCellDelta = 0;

  for (const x of colsList) {
    const col = sprite.pixels[ch].get(x);
    if (!col) continue;
    const xRel = x - minX;
    let arr = maskCols[xRel];
    if (!arr) { arr = new Uint8Array(maskHeight); maskCols[xRel] = arr; }
    for (let i = 0; i < col.ys.length; i++) {
      const y = col.ys[i];
      if (y < clusterY0 || y > clusterY1) continue;
      const yRel = y - clusterY0;
      const prev = (col.prevMags && col.prevMags[i] != null) ? col.prevMags[i] : 0;
      const next = (col.nextMags && col.nextMags[i] != null) ? col.nextMags[i] : 0;
      const d = Math.abs(next - prev);
      if (d > maxCellDelta) maxCellDelta = d;
      arr[yRel] = Math.max(arr[yRel], d > 0 ? 1 : 0);
    }
  }

  // check if any mask content exists
  let anyInMask = false;
  for (const k in maskCols) { const a = maskCols[k]; for (let i = 0; i < a.length; i++) if (a[i]) { anyInMask = true; break; } if (anyInMask) break; }
  if (!anyInMask) {
    // fallback: consider histogram>0 rows across full height (caller may decide to abort)
    return null;
  }

  // choose per-cell threshold relative to maxCellDelta
  const cellThreshold = maxCellDelta > 0 ? Math.max(maxCellDelta * 0.15, 1e-12) : 0;

  // build boolean filled mask for x in [minX..maxX]
  const filled = {};
  let totalFilled = 0;
  for (let x = minX; x <= maxX; x++) {
    const xRel = x - minX;
    const colSrc = sprite.pixels[ch].get(x);
    const arr = new Uint8Array(maskHeight);
    if (colSrc) {
      for (let i = 0; i < colSrc.ys.length; i++) {
        const y = colSrc.ys[i];
        if (y < clusterY0 || y > clusterY1) continue;
        const prev = (colSrc.prevMags && colSrc.prevMags[i] != null) ? colSrc.prevMags[i] : 0;
        const next = (colSrc.nextMags && colSrc.nextMags[i] != null) ? colSrc.nextMags[i] : 0;
        const d = Math.abs(next - prev);
        if (d >= cellThreshold) { arr[y - clusterY0] = 1; totalFilled++; }
      }
    }
    filled[xRel] = arr;
  }

  if (totalFilled === 0) return null;

  // --- 3) find largest connected component (4-connected) ----------------
  const W = maxX - minX + 1;
  const H = maskHeight;
  const visited = {};
  function idxKey(xRel, yRel) { return (xRel < 0 || xRel >= W || yRel < 0 || yRel >= H) ? null : (xRel + ',' + yRel); }

  let bestComponent = null;

  for (let xr = 0; xr < W; xr++) {
    const colArr = filled[xr];
    for (let yr = 0; yr < H; yr++) {
      if (!colArr[yr]) continue;
      const key = idxKey(xr, yr);
      if (visited[key]) continue;
      // BFS flood
      const q = [key];
      visited[key] = true;
      const component = [];
      while (q.length) {
        const k = q.pop();
        const [cx, cy] = k.split(',').map(n => parseInt(n, 10));
        component.push([cx, cy]);
        const neigh = [[cx-1,cy],[cx+1,cy],[cx,cy-1],[cx,cy+1]];
        for (const [nx, ny] of neigh) {
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
          const nkey = nx + ',' + ny;
          if (visited[nkey]) continue;
          if (filled[nx][ny]) { visited[nkey] = true; q.push(nkey); }
        }
      }
      if (!bestComponent || component.length > bestComponent.length) bestComponent = component;
    }
  }

  if (!bestComponent || bestComponent.length === 0) return null;

  const compSet = new Set(bestComponent.map(([cx,cy]) => `${cx},${cy}`));
  const areaPixels = bestComponent.length;

  return {
    minX, maxX, clusterY0, clusterY1, maskHeight,
    W, H, filled, bestComponent, compSet, areaPixels
  };
}

/**
 * Main: generate outline path from sprite (uses getSignificantPixels)
 * Mostly unchanged logic after we obtain the significant pixels/component.
 */
function generateSpriteOutlinePath(sprite, options = {}) {
  if (sprite.effect.tool === "sample"){
    const mn = sprite.minCol, mx = sprite.maxCol;
    const ny = sprite.minY || 0;
    const my = sprite.maxY || specHeight;
    const points = [
      { x: mn, y: ny},
      { x: mx, y: ny},
      { x: mx, y: my },
      { x: mn, y: my }
    ];
    const shift = fLow/(sampleRate/2)*specHeight;
    let ch= sprite.ch=="all"?0:sprite.ch;
    const finalPointsArr = points.map(p => ({ x: p.x, y: specHeight-((lsc(p.y,specHeight,logScaleVal[ch])-shift)*((sampleRate/2)/fWidth))}));
    return {
      points: finalPointsArr,
      connections: [[0,1],[1,2],[2,3],[3,0]],
      areaPixels: Math.max(0, (mx - mn + 1))*specHeight,
      bounds:{ minX: mn, maxX: mx, minY: 0, maxY: specHeight - 1 },
      ch: sprite.ch
    };
  }
  const height = options.height;
  if (typeof height !== 'number') throw new Error('generateSpriteOutlinePath: options.height (specHeight) is required');

  const simplifyTolerance = typeof options.simplify === 'number' ? options.simplify : 1;

  // get the component / mask / bounds
  const sig = getSignificantPixels(sprite, options);
  if (!sig) return { points: [], connections: [], areaPixels: 0, bounds: null };

  const { minX, maxX, clusterY0, clusterY1, maskHeight, W, H, filled, bestComponent, compSet, areaPixels } = sig;

  // --- 4) produce exposed edge segments from component pixels ------------
  let segments = [];
  function addSegment(p1, p2) { segments.push([p1, p2]); }

  for (const [cx, cy] of bestComponent) {
    const xGlobal = minX + cx;
    const yGlobal = clusterY0 + cy;
    const left = compSet.has(`${cx-1},${cy}`);
    const right = compSet.has(`${cx+1},${cy}`);
    const up = compSet.has(`${cx},${cy-1}`);
    const down = compSet.has(`${cx},${cy+1}`);
    if (!up)    addSegment([xGlobal, yGlobal], [xGlobal + 1, yGlobal]); // top
    if (!right) addSegment([xGlobal + 1, yGlobal], [xGlobal + 1, yGlobal + 1]); // right
    if (!down)  addSegment([xGlobal + 1, yGlobal + 1], [xGlobal, yGlobal + 1]); // bottom
    if (!left)  addSegment([xGlobal, yGlobal + 1], [xGlobal, yGlobal]); // left
  }

  if (segments.length === 0) {
    // single pixel fallback: return 1-pixel rectangle
    const cx = bestComponent[0][0], cy = bestComponent[0][1];
    const xGlobal = minX + cx, yGlobal = clusterY0 + cy;
    const pts = [[xGlobal,yGlobal],[xGlobal+1,yGlobal],[xGlobal+1,yGlobal+1],[xGlobal,yGlobal+1]];
    const points = pts.map(p => ({x:p[0], y:p[1]}));
    return {
      points,
      connections: [[0,1],[1,2],[2,3],[3,0]],
      areaPixels: 1,
      bounds: {minX, maxX, minY: clusterY0, maxY: clusterY1}
    };
  }

  // --- 5) stitch segments into loops (dedupe points -> adjacency -> walk) ---
  const pointIndex = new Map();
  const pointsArr = [];
  function getPointIdx(pt) {
    const key = pt[0] + ',' + pt[1];
    let idx = pointIndex.get(key);
    if (idx == null) {
      idx = pointsArr.length;
      pointIndex.set(key, idx);
      pointsArr.push({x: pt[0], y: pt[1]});
    }
    return idx;
  }

  const adj = new Map();
  function addEdgeIdx(a,b) {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a).add(b);
    adj.get(b).add(a);
  }

  for (const seg of segments) {
    const a = getPointIdx(seg[0]);
    const b = getPointIdx(seg[1]);
    addEdgeIdx(a,b);
  }

  const visitedEdge = new Set();
  const loops = [];
  function edgeKey(a,b) { return a < b ? `${a},${b}` : `${b},${a}`; }

  for (const [startIdx, neighSet] of adj.entries()) {
    for (const nb of neighSet) {
      const k = edgeKey(startIdx, nb);
      if (visitedEdge.has(k)) continue;
      const loop = [];
      let a = startIdx, b = nb;
      loop.push(a);
      visitedEdge.add(edgeKey(a,b));
      // walk
      while (true) {
        loop.push(b);
        const nbSet = Array.from(adj.get(b) || []);
        let nextC = null;
        for (const c of nbSet) {
          if (c === a) continue;
          const k2 = edgeKey(b, c);
          if (!visitedEdge.has(k2)) { nextC = c; break; }
        }
        if (nextC == null) nextC = a;
        visitedEdge.add(edgeKey(b, nextC));
        a = b;
        b = nextC;
        if (b === loop[0]) break;
        if (loop.length > pointsArr.length * 4) break;
      }
      loops.push(loop);
    }
  }

  if (loops.length === 0) return { points: [], connections: [], areaPixels, bounds: {minX, maxX, minY: clusterY0, maxY: clusterY1} };

  // choose largest-perimeter loop
  function loopPerimeter(loop) {
    let per = 0;
    for (let i = 0; i < loop.length; i++) {
      const a = pointsArr[loop[i]];
      const b = pointsArr[loop[(i+1) % loop.length]];
      const dx = a.x - b.x, dy = a.y - b.y;
      per += Math.hypot(dx, dy);
    }
    return per;
  }
  let bestLoop = loops[0], bestPer = loopPerimeter(loops[0]);
  for (let i = 1; i < loops.length; i++) {
    const p = loopPerimeter(loops[i]);
    if (p > bestPer) { bestPer = p; bestLoop = loops[i]; }
  }
  const loopPoints = bestLoop.map(idx => pointsArr[idx]);

  // optional simplification (RDP)
  function rdp(points, eps) {
    if (eps <= 0 || points.length < 4) return points.slice();
    const closed = points.concat([points[0]]);
    function perpDist(a,b,p) {
      const vx = b.x - a.x, vy = b.y - a.y;
      const wx = p.x - a.x, wy = p.y - a.y;
      const denom = vx*vx + vy*vy;
      if (denom === 0) return Math.hypot(wx, wy);
      const t = (wx*vx + wy*vy) / denom;
      const px = a.x + t*vx, py = a.y + t*vy;
      return Math.hypot(p.x - px, p.y - py);
    }
    function rdpRec(arr, start, end, keep) {
      let maxd = -1, idx = -1;
      for (let i = start + 1; i < end; i++) {
        const d = perpDist(arr[start], arr[end], arr[i]);
        if (d > maxd) { maxd = d; idx = i; }
      }
      if (maxd > eps) {
        keep[idx] = true;
        rdpRec(arr, start, idx, keep);
        rdpRec(arr, idx, end, keep);
      }
    }
    const n = closed.length;
    const keep = new Array(n).fill(false);
    keep[0] = keep[n-1] = true;
    rdpRec(closed, 0, n-1, keep);
    const out = [];
    for (let i = 0; i < n - 1; i++) if (keep[i]) out.push(closed[i]);
    return out;
  }

  let finalPoints = loopPoints;
  if (simplifyTolerance > 0) {
    const candidate = rdp(loopPoints, simplifyTolerance);
    if (candidate.length >= 3) finalPoints = candidate;
  }

  // build final points array and connections (note: your code previously referenced specHeight & lsc)
  // keep the same transformation you used previously so behaviour remains identical.
  //*((sampleRate/2)/fWidth)+fLow/(sampleRate/fftSize)
  const shift = fLow/(sampleRate/2)*specHeight;
  let ch= sprite.ch=="all"?0:sprite.ch;
  const finalPointsArr = finalPoints.map(p => ({ x: p.x, y: specHeight-((lsc(p.y,specHeight,logScaleVal[ch])-shift)*((sampleRate/2)/fWidth))}));
  const connections = [];
  for (let i = 0; i < finalPointsArr.length; i++) connections.push([i, (i + 1) % finalPointsArr.length]);

  const bounds = { minX, maxX, minY: clusterY0, maxY: clusterY1 };

  return {
    points: finalPointsArr,
    connections,
    areaPixels,
    bounds,
    ch:sprite.ch
  };
}


const svgPlus = `
  <svg aria-hidden="true" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <rect x="1.5" y="1.5" width="21" height="21" rx="3" ry="3" fill="transparent"/>
    <path d="M12 6.5v11M6.5 12h11"/>
  </svg>`;

const svgMinus = `
  <svg aria-hidden="true" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <rect x="1.5" y="1.5" width="21" height="21" rx="3" ry="3" fill="transparent"/>
    <path d="M6.5 12h11"/>
  </svg>`;

/* Toggle function: hide/show all children of the target section except its H3 */
function toggleSection(btn) {
  const targetId = btn.dataset.target;
  if (!targetId) return;
  const section = document.getElementById(targetId);
  if (!section) return;

  const expanded = btn.getAttribute('aria-expanded') === 'true';
  if (expanded) {
    // collapse: hide everything except the H3
    Array.from(section.children).forEach(child => {
      if (child.tagName === 'H3') return;
      child.style.display = 'none';
    });
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = svgPlus;
  } else {
    // expand: restore display for children (let CSS decide)
    Array.from(section.children).forEach(child => {
      if (child.tagName === 'H3') return;
      child.style.display = '';
    });
    btn.setAttribute('aria-expanded', 'true');
    btn.innerHTML = svgMinus;
    renderToolEditorSettings(getSpriteById(selectedSpriteId));
  }
}

/* Initialize toggles on DOM ready */
function initSectionToggles() {
  const buttons = document.querySelectorAll('.section-toggle');

  buttons.forEach(btn => {
    const targetId = btn.dataset.target;
    const section = document.getElementById(targetId);
    if (!section) return;

    // FORCE START COLLAPSED
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = svgPlus;
    Array.from(section.children).forEach(child => {
      if (child.tagName === 'H3') return;
      child.style.display = 'none';
    });

    // Add click listener
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSection(btn);
    });
  });
}

initSectionToggles();

const fadeCanvas = document.getElementById("spriteFadeCanvas");
const fcctx = fadeCanvas.getContext("2d");
// Editable horizontal fade curve for spriteFade
// Requires: fadeCanvas, fcctx (2D context)

// configuration
const GRID_W = 500, GRID_H = 300;
const POINT_HIT_RADIUS = 8;
const HANDLE_HIT_RADIUS = 8;


let draggingPointIndex = -1;
let draggingTangentIndex = -1;
let draggingTangentSide = 0;
let dragOffset = { x: 0, y: 0 };

// helper: convert normalized point to canvas coords
function pxX(normX, w) { return normX * w; }
function pxY(normY, h) { return (1 - normY) * h; } // invert: 1 top, 0 bottom

// crisp 1px helper (when not using hi-dpi scaling)
const crisp = v => Math.round(v) + 0.5;

// cubic hermite eval (returns {X, Y})
function evalHermiteAt(p0, p1, t) {
  const t2 = t * t, t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  const X = h00 * p0.x + h10 * p0.mx + h01 * p1.x + h11 * p1.mx;
  const Y = h00 * p0.y + h10 * p0.my + h01 * p1.y + h11 * p1.my;
  return { X, Y };
}

// find t on a segment for a target canvas X (pixel coord). returns t in [0,1] or null
function findTForXOnSegment(p0c, p1c, targetX) {
  // p0c/p1c are objects with x,y,mx,my in canvas coordinates
  const minX = Math.min(p0c.x, p1c.x) - Math.abs(p0c.mx) - Math.abs(p1c.mx) - 2;
  const maxX = Math.max(p0c.x, p1c.x) + Math.abs(p0c.mx) + Math.abs(p1c.mx) + 2;
  if (targetX < minX || targetX > maxX) return null;

  const SAMPLES = 28;
  let prevT = 0;
  let prevF = evalHermiteAt(p0c, p1c, 0).X - targetX;
  if (Math.abs(prevF) < 0.5) return 0;
  for (let i = 1; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const f = evalHermiteAt(p0c, p1c, t).X - targetX;
    if (Math.abs(f) < 0.5) return t;
    if (prevF * f <= 0) {
      // binary search between prevT and t
      let a = prevT, b = t;
      let fa = prevF, fb = f;
      for (let iter = 0; iter < 28; iter++) {
        const m = 0.5 * (a + b);
        const fm = evalHermiteAt(p0c, p1c, m).X - targetX;
        if (Math.abs(fm) < 0.5) return m;
        if (fa * fm <= 0) { b = m; fb = fm; } else { a = m; fa = fm; }
      }
      return 0.5 * (a + b);
    }
    prevT = t;
    prevF = f;
  }
  return null;
}

// build canvas-space representation of points (with tangents in pixels)
function buildCanvasPts(w, h) {
  const s = getSpriteById(selectedSpriteId);
  const pts = s.fadePoints.map(p => {
    const cx = pxX(p.x, w);
    const cy = pxY(p.y, h);
    return { p, x: cx, y: cy, mx:p.mx, my:p.my };
  });
  // ensure sorted by x
  pts.sort((A, B) => A.x - B.x);
  return pts;
}

// populate spriteFade[] by sampling the curve per pixel column
function sampleSpriteFade(w, h) {
  const s = getSpriteById(selectedSpriteId);
  if (!s) return;

  // ensure spriteFade exists and has correct length
  if (!s.spriteFade || !(s.spriteFade instanceof Float32Array) || s.spriteFade.length !== w) {
    s.spriteFade = new Float32Array(w);
  }

  // now local reference always points to the authoritative array
  const spriteFade = s.spriteFade;

  // clone values into prevSpriteFade (new buffer, not same reference)
  s.prevSpriteFade = new Float32Array(spriteFade);

  const pts = buildCanvasPts(w, h);
  if (pts.length === 0) {
    for (let i = 0; i < w; i++) spriteFade[i] = 1.0;
    return;
  }

  for (let xi = 0; xi < w; xi++) {
    const targetX = xi + 0.5; // pixel center
    if (targetX <= pts[0].x) {
      const v = 1 - (pts[0].y / h);
      spriteFade[xi] = Math.max(0, Math.min(1, v));
      continue;
    }
    if (targetX >= pts[pts.length - 1].x) {
      const v = 1 - (pts[pts.length - 1].y / h);
      spriteFade[xi] = Math.max(0, Math.min(1, v));
      continue;
    }

    let found = false;
    for (let si = 0; si < pts.length - 1; si++) {
      const p0c = pts[si];
      const p1c = pts[si + 1];
      if (targetX + 1 < Math.min(p0c.x, p1c.x) || targetX - 1 > Math.max(p0c.x, p1c.x)) continue;
      const t = findTForXOnSegment(p0c, p1c, targetX);
      if (t === null) continue;
      const { X, Y } = evalHermiteAt(p0c, p1c, t);
      const v = 1 - (Y / h);
      spriteFade[xi] = Math.max(0, Math.min(1, v));
      found = true;
      break;
    }

    if (!found) {
      let k = 0;
      while (k < pts.length - 1 && targetX > pts[k + 1].x) k++;
      const p0 = pts[k], p1 = pts[Math.min(k + 1, pts.length - 1)];
      const alpha = (targetX - p0.x) / Math.max(1e-6, (p1.x - p0.x));
      const ly = p0.y * (1 - alpha) + p1.y * alpha;
      spriteFade[xi] = Math.max(0, Math.min(1, 1 - (ly / h)));
    }
  }
}


// draw the grid and curve
function renderSpriteFade() {
  // ensure canvas size (fixed for now to match reference)
  fadeCanvas.width = GRID_W;
  fadeCanvas.height = GRID_H;
  const w = fadeCanvas.width, h = fadeCanvas.height;

  // clear
  fcctx.clearRect(0, 0, w, h);

  // background (optional) - keep transparent; draw grid lines
  fcctx.strokeStyle = "#333";
  fcctx.lineWidth = 3;

  // vertical grid (4 interior lines for 5 columns)
  for (let i = 1; i <= 4; i++) {
    const x = crisp((w * i) / 5);
    fcctx.beginPath();
    fcctx.moveTo(x, 0.5);
    fcctx.lineTo(x, h - 0.5);
    fcctx.stroke();
  }
  // horizontal grid (2 interior lines for 3 rows)
  for (let j = 1; j <= 2; j++) {
    const y = crisp((h * j) / 3);
    fcctx.beginPath();
    fcctx.moveTo(0.5, y);
    fcctx.lineTo(w - 0.5, y);
    fcctx.stroke();
  }

  // draw the curve
  const pts = buildCanvasPts(w, h);

  // stroke background band for clarity
  fcctx.lineWidth = 2;
  fcctx.strokeStyle = "#fff";
  fcctx.beginPath();
  if (pts.length > 0) {
    // walk segments
    const first = pts[0];
    // move to first point (Hermite at t=0)
    const start = evalHermiteAt(first, pts[1] || first, 0);
    fcctx.moveTo(start.X, start.Y);
    for (let si = 0; si < pts.length - 1; si++) {
      const p0 = pts[si], p1 = pts[si + 1];
      const dx = p1.x - p0.x, dy = p1.y - p0.y;
      const dist = Math.hypot(dx, dy);
      const steps = Math.max(8, Math.floor(dist / 6));
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const { X, Y } = evalHermiteAt(p0, p1, t);
        fcctx.lineTo(X, Y);
      }
    }
  }
  fcctx.stroke();

  // draw handles
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];

    // tangent line (from negative handle to positive handle)
    fcctx.lineWidth = 2;
    fcctx.strokeStyle = "#888";
    fcctx.beginPath();
    fcctx.moveTo(p.x - p.mx / 3, p.y - p.my / 3);
    fcctx.lineTo(p.x + p.mx / 3, p.y + p.my / 3);
    fcctx.stroke();

    // negative-side handle (left/behind)
    let nx = p.x - p.mx / 3;
    let ny = p.y - p.my / 3;
    fcctx.fillStyle = "#ff0";
    fcctx.beginPath();
    fcctx.arc(nx, ny, 4, 0, Math.PI * 2);
    fcctx.fill();
    // visual small stroke so handles are visible
    fcctx.lineWidth = 1;
    fcctx.strokeStyle = "#000";
    fcctx.stroke();

    // positive-side handle (right/ahead)
    let hx = p.x + p.mx / 3;
    let hy = p.y + p.my / 3;
    fcctx.fillStyle = "#ff0";
    fcctx.beginPath();
    fcctx.arc(hx, hy, 4, 0, Math.PI * 2);
    fcctx.fill();
    fcctx.lineWidth = 1;
    fcctx.strokeStyle = "#000";
    fcctx.stroke();

    // point (white)
    fcctx.fillStyle = "#fff";
    fcctx.beginPath();
    fcctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    fcctx.fill();
  }

  // sample into spriteFade per pixel column
  sampleSpriteFade(50, 30);
  const s = getSpriteById(selectedSpriteId);
  function areArraysIdentical(arr1, arr2) {
    for (let i = 0; i < arr1.length; i++) if (Math.abs(arr1[i] - arr2[i])>0.000001) return false;
    return true;
  }
  if (!areArraysIdentical(s.prevSpriteFade,s.spriteFade)) {
    processSpriteFade();
  }
}

function processSpriteFade() {
  const s = getSpriteById(selectedSpriteId);
  if (!s) return;

  let $s = s.ch==="all"?0:s.ch, $e = s.ch==="all"?channelCount:s.ch+1;
  for (let ch=$s;ch<$e;ch++){
    const mags = channels[ch].mags;
    const z=(s.effect.tool==="sample");
    const sigSprite = z?s:formatSignificantAsSprite(s, getSignificantPixels(s, { height: specHeight }));
    if (!sigSprite) return;
    const cols = [...sigSprite.pixels[ch].keys()].sort((a,b)=>a-b);
    if (cols.length === 0) return;
    const last = Math.max(0, s.spriteFade.length - 1);
    const span = Math.max(1, s.maxCol - s.minCol);
    forEachSpritePixelInOrder(sigSprite, ch, (x, y, _prevMag, _prevPhase, nextMag /*, nextPhase */) => {
      const t = (x - s.minCol) / span;
      const idx = Math.round(t * last);
      const factor = s.spriteFade[idx] || 0;
      const id = x * specHeight + y;
      if (z) mags[id]*=factor; else mags[id] = nextMag * factor;
    });
    recomputePCMForCols(s.minCol, s.maxCol);
  }
}

// hit testing: returns {type: 'point'|'handle', index}
function getFadeHit(pos) {
  const w = fadeCanvas.width, h = fadeCanvas.height;
  const pts = buildCanvasPts(w, h);
  // check handles first (both sides)
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const hxPos = { x: p.x + p.mx / 3, y: p.y + p.my / 3 };
    const hxNeg = { x: p.x - p.mx / 3, y: p.y - p.my / 3 };

    const dxp = pos.x - hxPos.x, dyp = pos.y - hxPos.y;
    if ((dxp * dxp + dyp * dyp) <= (HANDLE_HIT_RADIUS * HANDLE_HIT_RADIUS)) {
      return { type: 'handle', index: i, side: +1 };
    }

    const dxn = pos.x - hxNeg.x, dyn = pos.y - hxNeg.y;
    if ((dxn * dxn + dyn * dyn) <= (HANDLE_HIT_RADIUS * HANDLE_HIT_RADIUS)) {
      return { type: 'handle', index: i, side: -1 };
    }
  }
  // points
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const dx = pos.x - p.x, dy = pos.y - p.y;
    if ((dx * dx + dy * dy) <= (POINT_HIT_RADIUS * POINT_HIT_RADIUS)) {
      return { type: 'point', index: i };
    }
  }
  return null;
}

// pointer helpers
function getCanvasPosFade(evt) {
  const rect = fadeCanvas.getBoundingClientRect();
  let clientX, clientY;
  if (evt.touches && evt.touches[0]) {
    clientX = evt.touches[0].clientX; clientY = evt.touches[0].clientY;
  } else {
    clientX = evt.clientX; clientY = evt.clientY;
  }
  clientX -= rect.left; clientY -= rect.top;
  clientX *= GRID_W/rect.width; clientY *= GRID_H/rect.height;
  return { x: clientX, y: clientY};
}

function onFadePointerDown(evt) {
  //updateFadeCursor(evt);
  evt.preventDefault();
  fadeCanvas.setPointerCapture && fadeCanvas.setPointerCapture(evt.pointerId);
  const pos = getCanvasPosFade(evt);
  const hit = getFadeHit(pos);
  if (!hit) {
    // nothing hit: do nothing (could add logic to insert new point)
    draggingPointIndex = -1;
    draggingTangentIndex = -1;
    return;
  }
  if (hit.type === 'point') {
    draggingPointIndex = hit.index;
    const s = getSpriteById(selectedSpriteId);
    const cp = s.fadePoints[hit.index];
    const w = fadeCanvas.width, h = fadeCanvas.height;
    const sx = pxX(cp.x, w), sy = pxY(cp.y, h);
    dragOffset.x = (pos.x - sx);
    dragOffset.y = (pos.y - sy);
  } else {
    // handle hit: store index + which side (+1 or -1)
    draggingTangentIndex = hit.index;
    draggingTangentSide = (typeof hit.side === 'number') ? hit.side : +1;
  }
  window.addEventListener('pointermove', onFadePointerMove);
  window.addEventListener('pointerup', onFadePointerUp, { once: true });
}

function onFadePointerMove(evt) {
  //updateFadeCursor(evt);
  evt.preventDefault();
  const pos = getCanvasPosFade(evt);
  const w = fadeCanvas.width, h = fadeCanvas.height;
  const s = getSpriteById(selectedSpriteId);

  if (draggingPointIndex !== -1) {
    const idx = draggingPointIndex;

    // convert pointer → canvas pixels
    let newX = pos.x - dragOffset.x;
    let newY = pos.y - dragOffset.y;

    // clamp to canvas
    newX = Math.max(0, Math.min(w, newX));
    newY = Math.max(0, Math.min(h, newY));

    // normalize Y
    s.fadePoints[idx].y = 1 - (newY / h);

    // SPECIAL RULES:
    // ------------------------------------------
    // LOCK FIRST POINT X = 0
    if (idx === 0) {
      s.fadePoints[idx].x = 0;
    }
    // LOCK LAST POINT X = 1
    else if (idx === s.fadePoints.length - 1) {
      s.fadePoints[idx].x = 1;
    }
    else {
      // interior points drag normally
      s.fadePoints[idx].x = newX / w;

      // enforce ordering to prevent crossing
      if (idx > 0 && s.fadePoints[idx].x < s.fadePoints[idx - 1].x + 0.001)
        s.fadePoints[idx].x = s.fadePoints[idx - 1].x + 0.001;

      if (idx < s.fadePoints.length - 1 && s.fadePoints[idx].x > s.fadePoints[idx + 1].x - 0.001)
        s.fadePoints[idx].x = s.fadePoints[idx + 1].x - 0.001;
    }
  }
  else if (draggingTangentIndex !== -1) {
    const idx = draggingTangentIndex;
    const cp = s.fadePoints[idx];
    const px = pxX(cp.x, w), py = pxY(cp.y, h);

    // vector from point -> pointer in canvas pixels
    let vx = (pos.x - px);
    let vy = (pos.y - py);

    // if dragging negative-side handle, invert vector so stored mx,my always represent
    // the positive-side tangent direction (so both handles are symmetric)
    if (draggingTangentSide === -1) {
      vx = -vx;
      vy = -vy;
    }

    // scale factor to map pointer->model tangent length (same as before)
    const mx = vx * 3;
    const my = vy * 3;

    // store mx,my so draw & sampling use these. We keep a single mx,my representing
    // the "positive side" direction; negative side will be drawn as -mx,-my.
    s.fadePoints[idx].mx = mx;
    s.fadePoints[idx].my = my;
  }

  renderSpriteFade();
}

function updateFadeCursor(evt){
  const hit = getFadeHit(getCanvasPosFade(evt));
  if (hit === null) {
    fadeCanvas.style.cursor = 'crosshair';
  } else if (draggingPointIndex !== -1 || (hit && hit.type === 'point')) {
    fadeCanvas.style.cursor = 'pointer';
  } else {
    fadeCanvas.style.cursor = rotateCursorUrl;
  }
}


function onFadePointerUp(evt) {
  draggingPointIndex = -1;
  draggingTangentIndex = -1;
  draggingTangentSide = 0;
  window.removeEventListener('pointermove', onFadePointerMove);
  // final sample
  renderSpriteFade();
}

fadeCanvas.addEventListener('mousemove',(evt)=>updateFadeCursor(evt))

const newFadePt = (cx,cy) => {
  const s = getSpriteById(selectedSpriteId);
  const w = fadeCanvas.width, h = fadeCanvas.height;
  const rect = fadeCanvas.getBoundingClientRect();
  cx *= w/rect.width; cy *= h/rect.height;
  const nx = cx / w; const ny = 1 - (cy / h);
  let insertAt = s.fadePoints.findIndex(p => p.x > nx);
  if (insertAt === -1) insertAt = s.fadePoints.length;
  s.fadePoints.splice(insertAt, 0, { x: nx, y: ny, mx: 120, my: 0, tLen: 120 });
  renderSpriteFade();
}

const removeFadePt = (cx,cy) => {
  const s = getSpriteById(selectedSpriteId);
  const w = fadeCanvas.width, h = fadeCanvas.height;
  const rect = fadeCanvas.getBoundingClientRect();
  cx *= w/rect.width; cy *= h/rect.height;
  const nx = cx / w; const ny = 1 - (cy / h);
  
  if (!s.fadePoints.length) {
    renderSpriteFade();
    return;
  }
  let nearestIndex = -1;
  let nearestDist = Infinity;
  for (let i = 0; i < s.fadePoints.length; i++) {
    const p = s.fadePoints[i];
    const dx = p.x - nx;
    const dy = p.y - ny;
    const dist = dx * dx + dy * dy; // squared distance
    if (dist < nearestDist) {
      nearestDist = dist;
      nearestIndex = i;
    }
  }
  const REMOVE_THRESHOLD = 0.02 * 0.02;
  if (nearestDist <= REMOVE_THRESHOLD) {
    s.fadePoints.splice(nearestIndex, 1);
  }
  renderSpriteFade();
}

// attach events
fadeCanvas.style.touchAction = 'none';
fadeCanvas.addEventListener('pointerdown', onFadePointerDown);