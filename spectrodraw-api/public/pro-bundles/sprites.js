function forEachSpritePixelInOrder(sprite, cb) {
  if (!sprite) return;
  const cols = Array.from(sprite.pixels.keys()).sort((a,b)=>a-b);
  for (const x of cols) {
    const col = sprite.pixels.get(x);
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
      overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
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
  if (spriteId === null || selectedSpriteId === null) {
    selectedSpriteId = null;
    spriteEditorDiv.setAttribute('disabled', 'disabled');
    spriteEffectSettingsDiv.style.display = 'none';
    nameEl.value = 'No sprite selected';
    toolEl.value = '';
    enabledEl.checked = false;
  } else {
    const s=getSpriteById(spriteId);
    spriteEditorDiv.removeAttribute('disabled');
    spriteEffectSettingsDiv.style.display = 'block';
    nameEl.value = s.name;
    enabledEl.checked = s.enabled;
    toolEl.value = s.effect.tool;
    renderToolEditorSettings(s);
  }
}

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

  // detect "stop adjusting" via mouseup
  r.addEventListener('mouseup', () => console.log(`Stopped adjusting ${effectsKey}, value:`, parseF(r.value)));
  r.addEventListener('touchend', () => console.log(`Stopped adjusting ${effectsKey}, value:`, parseF(r.value)));

  // text input → Enter → clamp + assign
  t.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    let val = parseF(t.value);
    const min = parseF(r.min), max = parseF(r.max);
    if (isNaN(val)) val = parseF(r.value);
    val = CLAMP(val, min, max);
    r.value = val;
    handleValueChange(val);
    console.log(`Stopped editing ${effectsKey}, value:`, val);
  });

  // optional: detect blur from text input too
  t.addEventListener('blur', () => {
    let val = parseF(t.value);
    if (isNaN(val)) val = parseF(r.value);
    val = CLAMP(val, parseF(r.min), parseF(r.max));
    r.value = val;
    handleValueChange(val);
    console.log(`Stopped editing ${effectsKey}, value:`, val);
  });
});


function renderToolEditorSettings(sprite) {
  document.getElementById('samplifyDiv').style.display = 'none';
  document.getElementById('sblurRadiusDiv').style.display = 'none';
  document.getElementById('snoiseFloorDiv').style.display = 'none';
  document.getElementById("sbrushColorDiv").style.display='none';
  document.getElementById("sev").style.display='flex';
  document.getElementById("sphaseDiv").style.display='flex';
  document.getElementById("sphaseStrengthDiv").style.display='flex';
  if (toolEl.value === 'amplifier') {
    document.getElementById('samplifyDiv').style.display = 'flex';
  } else if (toolEl.value === 'blur') {
    document.getElementById('sblurRadiusDiv').style.display = 'flex';
  } else if (toolEl.value === 'noiseRemover') {
    document.getElementById('snoiseFloorDiv').style.display = 'flex';
    document.getElementById("sev").style.display='none';
    document.getElementById("sphaseDiv").style.display='none';
    document.getElementById("sphaseStrengthDiv").style.display='none';
  } else {
    document.getElementById("sbrushColorDiv").style.display='flex';
  }
  if (!sprite) return;

  // Ensure effects object exists to read from
  const effects = sprite.effect || {};
  console.log(effects);

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
}


function updateSpriteEffects(spriteId, newEffect) {
  const sprite = getSpriteById(spriteId);
  if (!sprite) return;
  renderToolEditorSettings(sprite);
  let minCol = Math.max(0, sprite.minCol || 0);
  let maxCol = Math.min(specWidth - 1, sprite.maxCol || (specWidth - 1));
  const sigSprite = formatSignificantAsSprite(sprite,getSignificantPixels(sprite,{height:specHeight}));
  forEachSpritePixelInOrder(sigSprite, (x, y, prevMag, prevPhase) => {
    const id = x * specHeight + y;
    const newPixel = applyEffectToPixel(prevMag,prevPhase,y,newEffect);
    mags[id] = newPixel.mag;
    phases[id] = newPixel.phase;
  });
  recomputePCMForCols(minCol, maxCol);
  restartRender(false);
  if (spriteId < sprites.length && getSpriteById(spriteId+1).enabled) {
    // toggleSpriteEnabled(spriteId+1, getSpriteById(spriteId+1).enabled);
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

  // apply prev (disable) or next (enable)
  if (enable) {
    // write next values at recorded coords
    forEachSpritePixelInOrder(sprite, (x, y, _prevMag, _prevPhase, nextMag, nextPhase) => {
      const id = x * specHeight + y;
      mags[id] = nextMag;
      phases[id] = nextPhase;
    });
    sprite.enabled = true;
  } else {
    // write prev values back
    forEachSpritePixelInOrder(sprite, (x, y, prevMag, prevPhase) => {
      const id = x * specHeight + y;
      mags[id] = prevMag;
      phases[id] = prevPhase;
    });
    sprite.enabled = false;
  }
  recomputePCMForCols(minCol, maxCol);
  restartRender(false);
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
function moveSprite(spriteId, dx, dy) {
  const sprite = getSpriteById(spriteId);
  if (!sprite) return;

  // old range (may be Infinity if empty)
  const oldMinCol = sprite.minCol;
  const oldMaxCol = sprite.maxCol;

  // 1) restore prev values at old positions (keep same behaviour)
  forEachSpritePixelInOrder(sprite, (x, y, prevMag, prevPhase) => {
    const idOld = x * specHeight + y;
    mags[idOld] = prevMag;
    phases[idOld] = prevPhase;
  });

  // We'll build a fresh map for the new sprite pixels.
  // But avoid writing to mags/phases until we've finished building the structure.
  const newMap = new Map();
  let newMin = Infinity, newMax = -Infinity;

  const cols = Array.from(sprite.pixels.keys()); // no sort - insertion order is fine
  for (const oldX of cols) {
    const col = sprite.pixels.get(oldX);
    if (!col) continue;

    for (let i = 0; i < col.ys.length; i++) {
      const oldY = col.ys[i];
      const nextMag = col.nextMags ? col.nextMags[i] : col.prevMags[i]; // keep your pattern
      const nextPhase = col.nextPhases ? col.nextPhases[i] : col.prevPhases[i];

      const nx = oldX + dx;
      const f = sampleRate / fftSize;
      const ny = Math.floor(invlsc(lsc(oldY * f) + dy * f) / f);
      const ny1 = Math.floor(invlsc(lsc((oldY + 1) * f) + dy * f) / f);

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
        // capture prev values once before any writes
        ncol.prevMags.push(mags[destIdx]);
        ncol.prevPhases.push(phases[destIdx]);
        ncol.nextMags.push(nextMag);
        // your original used phases[destIdx] + nextPhase; I preserve that behaviour:
        ncol.nextPhases.push(phases[destIdx] + nextPhase);
        // NOTE: we DO NOT write mags[destIdx]/phases[destIdx] here.
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
  sprite.pixels = newMap;
  sprite.minCol = newMin === Infinity ? Infinity : Math.max(0, newMin);
  sprite.maxCol = newMax === -Infinity ? -1 : Math.min(specWidth - 1, newMax);

  // Recompute columns once over the union of old/new ranges
  const recomputeMin = Math.min(
    Number.isFinite(oldMinCol) ? oldMinCol : Infinity,
    Number.isFinite(sprite.minCol) ? sprite.minCol : Infinity
  );
  const recomputeMax = Math.max(
    Number.isFinite(oldMaxCol) ? oldMaxCol : -Infinity,
    Number.isFinite(sprite.maxCol) ? sprite.maxCol : -Infinity
  );

  if (recomputeMin <= recomputeMax && Number.isFinite(recomputeMin)) {
    recomputePCMForCols(recomputeMin, recomputeMax);
  }

  // Only restart render / audio if necessary
  restartRender(false);

  if (playing) {
    stopSource(true);
    playPCM(true);
  }

  renderSpritesTable();
  updateEditorSelection(spriteId);
}


// Delete sprite: disable (restore prev) then remove from sprites array
function deleteSprite(spriteId) {
  const idx = getSpriteIndexById(spriteId);
  if (idx === -1) return;
  const sprite = sprites[idx];

  // restore prev values
  forEachSpritePixelInOrder(sprite, (x, y, prevMag, prevPhase) => {
    const id = x * specHeight + y;
    mags[id] = prevMag;
    phases[id] = prevPhase;
  });

  const minCol = Math.max(0, sprite.minCol || 0);
  const maxCol = Math.min(specWidth - 1, sprite.maxCol || (specWidth - 1));
  // remove from array
  sprites.splice(idx, 1);
  recomputePCMForCols(minCol, maxCol);
  restartRender(false);

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
    canvas.style.cursor = 'grabbing';
    mvsbtn.innerText = 'Moving Sprite';
  } else {
    canvas.style.cursor = 'crosshair';
    mvsbtn.innerText = 'Move Sprite';
  }
});
function formatSignificantAsSprite(origSprite, sig) {
  if (!sig) return null;

  const { minX, maxX, clusterY0, maskHeight, filled } = sig;
  const W = (maxX - minX + 1);

  // new sprite container
  const out = {
    pixels: new Map(),
    minCol: Infinity,
    maxCol: -Infinity
  };

  // local helper (in case addPixelToSprite isn't available)
  function _addPixelToSprite(sprite, x, y, prevMag, prevPhase, nextMag, nextPhase) {
    let col = sprite.pixels.get(x);
    if (!col) {
      col = { ys: [], prevMags: [], prevPhases: [], nextMags: [], nextPhases: [] };
      sprite.pixels.set(x, col);
    }
    col.ys.push(y);
    col.prevMags.push(prevMag);
    col.prevPhases.push(prevPhase);
    col.nextMags.push(nextMag);
    col.nextPhases.push(nextPhase);

    if (x < sprite.minCol) sprite.minCol = x;
    if (x > sprite.maxCol) sprite.maxCol = x;
  }

  const useProvidedAdder = (typeof addPixelToSprite === 'function');

  // iterate over all columns in the filled mask
  for (let xr = 0; xr < W; xr++) {
    const colArr = filled[xr];
    if (!colArr) continue; // defensive

    const xGlobal = minX + xr;

    for (let yr = 0; yr < colArr.length; yr++) {
      if (!colArr[yr]) continue;
      const yGlobal = clusterY0 + yr;

      // try to copy actual mags/phases from original sprite if present
      let prevMag = 0, prevPhase = 0, nextMag = 0, nextPhase = 0;
      if (origSprite && origSprite.pixels) {
        const srcCol = origSprite.pixels.get(xGlobal);
        if (srcCol && Array.isArray(srcCol.ys)) {
          // locate the same y in the source column
          const idx = srcCol.ys.findIndex(v => v === yGlobal);
          if (idx !== -1) {
            if (srcCol.prevMags && srcCol.prevMags[idx] != null) prevMag = srcCol.prevMags[idx];
            if (srcCol.prevPhases && srcCol.prevPhases[idx] != null) prevPhase = srcCol.prevPhases[idx];
            if (srcCol.nextMags && srcCol.nextMags[idx] != null) nextMag = srcCol.nextMags[idx];
            if (srcCol.nextPhases && srcCol.nextPhases[idx] != null) nextPhase = srcCol.nextPhases[idx];
          } else {
            // If exact y not found, as a fallback we could pick nearest neighbor or leave zeros.
            // For now, leave defaults = 0.
          }
        }
      }

      // add the pixel to the output sprite
      if (useProvidedAdder) {
        addPixelToSprite(out, xGlobal, yGlobal, prevMag, prevPhase, nextMag, nextPhase);
      } else {
        _addPixelToSprite(out, xGlobal, yGlobal, prevMag, prevPhase, nextMag, nextPhase);
      }
    }
  }

  // If no pixels were added, return null so callers can handle empty cases
  if (out.pixels.size === 0) return null;

  return out;
}

/**
 * Generate a single outline path (closed loop) for a sprite.
 * - sprite.pixels is a Map<x, { ys:[], prevMags:[], nextMags:[], ... }>
 * - Coordinates returned are in bin/frame space. Each pixel at (x,y) is treated as the unit square [x,x+1] x [y,y+1].
 *
 * Returns:
 * {
 *   points: [{x:number,y:number}],       // ordered vertices of chosen loop (clockwise/ccw)
 *   connections: [[i,j], ...],           // edges between point indices (in order form a closed loop)
 *   areaPixels: number,                  // area in pixels of chosen component
 *   bounds: {minX,maxX,minY,maxY}
 * }
 *
 * Options:
 * - height: (required) vertical size / specHeight
 * - width: optional (used only for bounds); if omitted inferred from sprite columns
 * - clusterOptions: {kernel: int, minFrac: number, stdFactor: number}
 * - simplify: RDP tolerance (0 = no simplify)
 */
/**
 * Extract the "significant" pixels from a sprite for outlining.
 * Returns null if nothing significant found, otherwise an object:
 * {
 *   minX, maxX, clusterY0, clusterY1, maskHeight,
 *   W, H, filled, bestComponent, compSet, areaPixels
 * }
 *
 * Options uses:
 *   options.height (required) - overall spec height used for histogram
 *   options.clusterOptions - { kernel, minFrac, stdFactor } (optional)
 *   options.width (optional) - override width
 */
function getSignificantPixels(sprite, options = {}) {
  const height = options.height;
  if (typeof height !== 'number') throw new Error('getSignificantPixels: options.height is required');

  const clusterOptions = Object.assign({ kernel: 3, minFrac: 0.25, stdFactor: 0.5 }, options.clusterOptions || {});

  // --- 1) build per-y histogram of magnitude deltas ----------------
  const histogram = new Float64Array(height);
  let maxDelta = 0;
  let anyPixels = false;

  for (const [x, col] of sprite.pixels) {
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
  const colsList = Array.from(sprite.pixels.keys()).sort((a, b) => a - b);
  if (colsList.length === 0) return null;
  const minX = colsList[0], maxX = colsList[colsList.length - 1];
  const width = ('width' in options && options.width != null) ? options.width : (maxX - minX + 1);

  const maskHeight = clusterY1 - clusterY0 + 1;
  // temporary marker map: xRel -> Uint8Array(maskHeight) marking presence before thresholding
  const maskCols = {};
  let maxCellDelta = 0;

  for (const x of colsList) {
    const col = sprite.pixels.get(x);
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
    const colSrc = sprite.pixels.get(x);
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
  const finalPointsArr = finalPoints.map(p => ({ x: p.x, y: specHeight-lsc(p.y,specHeight) }));
  const connections = [];
  for (let i = 0; i < finalPointsArr.length; i++) connections.push([i, (i + 1) % finalPointsArr.length]);

  const bounds = { minX, maxX, minY: clusterY0, maxY: clusterY1 };

  return {
    points: finalPointsArr,
    connections,
    areaPixels,
    bounds
  };
}
