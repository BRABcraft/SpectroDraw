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
  console.log('Rendering sprites table, selectedSpriteId=', selectedSpriteId);
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
    const name = sprite.name || ('Sprite #' + sprite.id);
    const tdName = document.createElement('td');
    tdName.textContent = name;

    // ENABLED checkbox
    const tdEnabled = document.createElement('td');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = !!sprite.enabled;
    cb.title = 'Toggle sprite enabled';
    cb.addEventListener('change', (ev) => {
      ev.stopPropagation();
      toggleSpriteEnabled(sprite.id, cb.checked);
      renderSpritesTable();
    });
    tdEnabled.appendChild(cb);

    // TOOL
    const tdTool = document.createElement('td');
    tdTool.textContent = sprite.tool || '';

    tr.appendChild(tdName);
    tr.appendChild(tdEnabled);
    tr.appendChild(tdTool);

    // click selects
    tr.addEventListener('click', () => {
      selectedSpriteId = sprite.id;
      renderSpritesTable();
      updateEditorSelection(sprite.id);
    });

    tbody.appendChild(tr);
  });
}

// Update editor info for selected sprite
function updateEditorSelection(spriteId) {
  const nameEl = document.getElementById('selectedName');
  const toolEl = document.getElementById('selectedTool');
  const metaEl = document.getElementById('selectedMeta');
  console.log(spriteId);
  if (spriteId === null) {
    selectedSpriteId = null;
    nameEl.textContent = 'No sprite selected';
    toolEl.textContent = '';
    metaEl.textContent = 'Select a sprite to edit — move or delete it.';
    return;
  }
  const s = getSpriteById(spriteId);
  if (!s) { updateEditorSelection(null); return; }
  const displayName = s.name || ('Sprite #' + s.id);
  nameEl.textContent = displayName;
  toolEl.textContent = ' — ' + (s.tool || '');
  const info = `Pixels columns: ${s.pixels ? Array.from(s.pixels.keys()).length : 0}  •  Enabled: ${!!s.enabled}`;
  metaEl.textContent = info;
  // ensure inputs reset
  document.getElementById('moveDeltaX').value = 0;
  document.getElementById('moveDeltaY').value = 0;
}

// Toggle sprite (apply prev or next values)
function toggleSpriteEnabled(spriteId, enable) {
  const sprite = getSpriteById(spriteId);
  if (!sprite) return;
  const minCol = Math.max(0, sprite.minCol || 0);
  const maxCol = Math.min(specWidth - 1, sprite.maxCol || (specWidth - 1));

  // apply prev (disable) or next (enable)
  if (enable) {
    // write next values at recorded coords
    forEachSpritePixelInOrder(sprite, (x, y, _prevMag, _prevPhase, nextMag, nextPhase) => {
      const id = y * specWidth + x;
      mags[id] = nextMag;
      phases[id] = nextPhase;
    });
    sprite.enabled = true;
  } else {
    // write prev values back
    forEachSpritePixelInOrder(sprite, (x, y, prevMag, prevPhase) => {
      const id = y * specWidth + x;
      mags[id] = prevMag;
      phases[id] = prevPhase;
    });
    sprite.enabled = false;
  }

  // update image buffer and PCM for affected columns
  renderSpectrogramColumnsToImageBuffer(minCol, maxCol);
  recomputePCMForCols(minCol, maxCol);
  restartRender(false);
  updateCanvasScroll();

  if (playing) {
    stopSource(true);
    playPCM(true);
  }
}

// Move sprite by dx (frames) and dy (bins). Best-effort handling.
function moveSprite(spriteId, dx, dy) {
  const sprite = getSpriteById(spriteId);
  if (!sprite) return;
  // 1) restore prev values at old positions
  forEachSpritePixelInOrder(sprite, (x, y, prevMag, prevPhase) => {
    const idOld = y * specWidth + x;
    mags[idOld] = prevMag;
    phases[idOld] = prevPhase;
  });

  // 2) build new pixel map shifted by dx/dy, clamped
  const newMap = new Map();
  let newMin = Infinity, newMax = -Infinity;

  const cols = Array.from(sprite.pixels.keys()).sort((a,b)=>a-b);
  for (const oldX of cols) {
    const col = sprite.pixels.get(oldX);
    for (let i = 0; i < col.ys.length; i++) {
      const oldY = col.ys[i];
      const prevMag = col.prevMags[i];
      const prevPhase = col.prevPhases[i];
      const nextMag = col.nextMags[i];
      const nextPhase = col.nextPhases[i];

      const nx = oldX + dx;
      const ny = oldY + dy;
      if (nx < 0 || nx >= specWidth || ny < 0 || ny >= specHeight) {
        // skip out-of-bounds pixels (they are effectively removed)
        continue;
      }
      // ensure column entry exists
      let ncol = newMap.get(nx);
      if (!ncol) {
        ncol = { ys: [], prevMags: [], prevPhases: [], nextMags: [], nextPhases: [] };
        newMap.set(nx, ncol);
      }
      // Because we've already restored prev at old locations, for the new location we want:
      // - prev values should be whatever is currently in mags/phases at that destination BEFORE we write next.
      //   However we can store the previous as the current mags/phases (which reflect other layers).
      //   But to be conservative, capture current mags/phases as prev for this moved sprite.
      const destIdx = ny * specWidth + nx;
      const currentDestMag = mags[destIdx] || 0;
      const currentDestPhase = phases[destIdx] || 0;
      ncol.ys.push(ny);
      ncol.prevMags.push(currentDestMag);
      ncol.prevPhases.push(currentDestPhase);
      ncol.nextMags.push(nextMag);
      ncol.nextPhases.push(nextPhase);

      if (nx < newMin) newMin = nx;
      if (nx > newMax) newMax = nx;
    }
  }

  // 3) write next values into mags/phases for the new positions
  const newCols = Array.from(newMap.keys()).sort((a,b)=>a-b);
  for (const x of newCols) {
    const col = newMap.get(x);
    for (let i = 0; i < col.ys.length; i++) {
      const y = col.ys[i];
      const nextMag = col.nextMags[i];
      const nextPhase = col.nextPhases[i];
      const idNew = y * specWidth + x;
      mags[idNew] = nextMag;
      phases[idNew] = nextPhase;
    }
  }

  // 4) replace sprite.pixels, update bounds
  sprite.pixels = newMap;
  sprite.minCol = newMin === Infinity ? Infinity : Math.max(0, newMin);
  sprite.maxCol = Math.max(-Infinity, newMax === -Infinity ? -1 : Math.min(specWidth-1, newMax));

  // recompute/render affected columns (old range & new range)
  const affectedMin = Math.max(0, Math.min(sprite.minCol || 0, newMin === Infinity ? specWidth-1 : newMin));
  const affectedMax = Math.min(specWidth - 1, Math.max(sprite.maxCol || 0, newMax === -Infinity ? 0 : newMax));
  // safer: recompute whole union of previous and new; but we restored prev at old coords earlier.

  renderSpectrogramColumnsToImageBuffer(affectedMin, affectedMax);
  recomputePCMForCols(affectedMin, affectedMax);
  restartRender(false);
  updateCanvasScroll();

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
    const id = y * specWidth + x;
    mags[id] = prevMag;
    phases[id] = prevPhase;
  });

  const minCol = Math.max(0, sprite.minCol || 0);
  const maxCol = Math.min(specWidth - 1, sprite.maxCol || (specWidth - 1));
  // remove from array
  sprites.splice(idx, 1);

  renderSpectrogramColumnsToImageBuffer(minCol, maxCol);
  recomputePCMForCols(minCol, maxCol);
  restartRender(false);
  updateCanvasScroll();

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