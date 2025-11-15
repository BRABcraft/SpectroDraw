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
function renderSpritesTable(line) {
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
    cb.addEventListener('click', (ev) => {
      ev.stopPropagation();
    });

    // Keep change handler for toggle logic
    cb.addEventListener('change', (ev) => {
      ev.stopPropagation();
      toggleSpriteEnabled(sprite.id, cb.checked);
      renderSpritesTable(49);
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
      if (selectedSpriteId == sprite.id){
        selectedSpriteId = null;
      } else {
        selectedSpriteId = sprite.id;
      }
      renderSpritesTable(63);
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
}

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

  renderSpritesTable(222);
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
  renderSpritesTable(255);
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
function generateSpriteOutlinePath(sprite, options = {}) {
  const height = options.height;
  if (typeof height !== 'number') throw new Error('generateSpriteOutlinePath: options.height (specHeight) is required');

  const clusterOptions = Object.assign({ kernel: 3, minFrac: 0.25, stdFactor: 0.5 }, options.clusterOptions || {});
  const simplifyTolerance = typeof options.simplify === 'number' ? options.simplify : 0;

  // --- 1) Build per-y histogram of magnitude deltas --------------------------
  // histogram[y] = sum of abs(nextMag - prevMag) across all columns for that y
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
  if (!anyPixels) return { points: [], connections: [], areaPixels: 0, bounds: null };

  // quick stats
  let sum = 0;
  for (let y = 0; y < height; y++) sum += histogram[y];
  const mean = sum / height;
  // std
  let varSum = 0;
  for (let y = 0; y < height; y++) {
    const v = histogram[y] - mean;
    varSum += v * v;
  }
  const std = Math.sqrt(varSum / Math.max(1, height - 1));

  // Smooth histogram with a small box kernel to widen clusters
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

  // threshold: choose whichever gives a clearer cluster: scaled max or mean+stdFactor*std
  const byMax = maxDelta * clusterOptions.minFrac;
  const byStd = mean + clusterOptions.stdFactor * std;
  const threshold = Math.max(byMax, byStd);

  // find contiguous segments where smoothHist >= threshold
  let segments = [];
  let s = -1;
  for (let y = 0; y < height; y++) {
    if (smoothHist[y] >= threshold) {
      if (s === -1) s = y;
    } else {
      if (s !== -1) {
        segments.push({ y0: s, y1: y - 1 });
        s = -1;
      }
    }
  }
  if (s !== -1) segments.push({ y0: s, y1: height - 1 });

  // if no segments pass threshold, fall back to area where histogram > 0
  if (segments.length === 0) {
    let y0 = -1, y1 = -1;
    for (let y = 0; y < height; y++) {
      if (histogram[y] > 0) { if (y0 === -1) y0 = y; y1 = y; }
    }
    if (y0 === -1) return { points: [], connections: [], areaPixels: 0, bounds: null };
    segments.push({ y0, y1 });
  }

  // pick the largest contiguous segment by total histogram mass
  let bestSeg = null;
  let bestMass = -Infinity;
  for (const seg of segments) {
    let mass = 0;
    for (let y = seg.y0; y <= seg.y1; y++) mass += histogram[y];
    if (mass > bestMass) { bestMass = mass; bestSeg = seg; }
  }
  const clusterY0 = bestSeg.y0;
  const clusterY1 = bestSeg.y1;

  // --- 2) Build mask (binary) limited to columns & cluster Y-range -----------
  // determine column range
  const colsList = Array.from(sprite.pixels.keys()).sort((a,b)=>a-b);
  if (colsList.length === 0) return { points: [], connections: [], areaPixels: 0, bounds: null };
  const minX = colsList[0], maxX = colsList[colsList.length - 1];
  const width = ('width' in options && options.width != null) ? options.width : (maxX - minX + 1);

  // Represent mask as object keyed by column index relative to minX => Uint8Array of height cluster slice
  const maskHeight = clusterY1 - clusterY0 + 1;
  const maskCols = {}; // xRel -> Uint8Array(maskHeight)
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
      // temporarily store the delta magnitude in the mask as >0 via setting 1 - we'll filter by cell threshold next
      arr[yRel] = Math.max(arr[yRel], d > 0 ? 1 : 0);
    }
  }

  // If mask empty (no pixels in cluster), expand cluster bounds to include any non-empty Y rows
  let anyInMask = false;
  for (const k in maskCols) { const a = maskCols[k]; for (let i=0;i<a.length;i++) if (a[i]) { anyInMask = true; break; } if (anyInMask) break; }
  if (!anyInMask) {
    // fallback: use any y with histogram>0 across full range; rebuild
    let newY0 = clusterY0, newY1 = clusterY1;
    for (let y = 0; y < height; y++) if (histogram[y] > 0) { newY0 = Math.min(newY0, y); newY1 = Math.max(newY1, y); }
    // rebuild mask columns quickly using this range
    // (for brevity here we simply return empty outline if nothing else)
    return { points: [], connections: [], areaPixels: 0, bounds: null };
  }

  // choose per-cell threshold relative to maxCellDelta (if it's 0, keep any presence)
  const cellThreshold = maxCellDelta > 0 ? Math.max(maxCellDelta * 0.15, 1e-12) : 0;

  // Build boolean mask (filled pixel) for columns from minX..maxX
  const filled = {}; // xRel -> Uint8Array(maskHeight) (0/1)
  let totalFilled = 0;
  for (let x = minX; x <= maxX; x++) {
    const xRel = x - minX;
    const colSrc = sprite.pixels.get(x);
    const arr = new Uint8Array(maskHeight);
    if (colSrc) {
      // for each y in column, set if delta >= cellThreshold
      for (let i = 0; i < colSrc.ys.length; i++) {
        const y = colSrc.ys[i];
        if (y < clusterY0 || y > clusterY1) continue;
        const prev = (colSrc.prevMags && colSrc.prevMags[i] != null) ? colSrc.prevMags[i] : 0;
        const next = (colSrc.nextMags && colSrc.nextMags[i] != null) ? colSrc.nextMags[i] : 0;
        const d = Math.abs(next - prev);
        if (d >= cellThreshold) { arr[y - clusterY0] = 1; totalFilled++; }
      }
    }
    // store even empty columns as zeros to simplify connectivity code
    filled[xRel] = arr;
  }

  if (totalFilled === 0) return { points: [], connections: [], areaPixels: 0, bounds: null };

  // --- 3) find the largest connected component (4-connected) ----------------
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
        // neighbors 4-connected
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

  if (!bestComponent || bestComponent.length === 0) return { points: [], connections: [], areaPixels: 0, bounds: null };

  // Build a fast lookup set for component membership
  const compSet = new Set(bestComponent.map(([cx,cy]) => `${cx},${cy}`));
  const areaPixels = bestComponent.length;

  // --- 4) For component pixels, produce exposed edges (top/right/bottom/left),
  // store them as segments between integer corner coordinates (in global bin/frame coords).
  // Pixel at (xr,yr) corresponds to global pixel coords (x = minX + xr, y = clusterY0 + yr).
  segments = []; // each segment: [[x1,y1],[x2,y2]]
  function addSegment(p1, p2) { segments.push([p1, p2]); }

  for (const [cx, cy] of bestComponent) {
    const xGlobal = minX + cx;
    const yGlobal = clusterY0 + cy;
    // neighbors in component coordinates
    const left = compSet.has(`${cx-1},${cy}`);
    const right = compSet.has(`${cx+1},${cy}`);
    const up = compSet.has(`${cx},${cy-1}`);
    const down = compSet.has(`${cx},${cy+1}`);
    // corners of pixel square: top-left (x,y), top-right (x+1,y), bottom-right (x+1,y+1), bottom-left (x,y+1)
    if (!up)    addSegment([xGlobal, yGlobal], [xGlobal + 1, yGlobal]); // top edge
    if (!right) addSegment([xGlobal + 1, yGlobal], [xGlobal + 1, yGlobal + 1]); // right edge
    if (!down)  addSegment([xGlobal + 1, yGlobal + 1], [xGlobal, yGlobal + 1]); // bottom edge
    if (!left)  addSegment([xGlobal, yGlobal + 1], [xGlobal, yGlobal]); // left edge
  }

  if (segments.length === 0) {
    // single pixel that somehow had no edges; give rectangle
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

  // --- 5) Stitch segments into loops ------------------------------------------------
  // Deduplicate points and map to indices
  const pointIndex = new Map(); // "x,y" -> idx
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

  // adjacency lists of indices
  const adj = new Map(); // idx -> Set(idx)
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

  // Now build loops by walking unvisited adjacency edges
  const visitedEdge = new Set(); // "a,b" canonical ordered
  const loops = [];

  function edgeKey(a,b) { return a < b ? `${a},${b}` : `${b},${a}`; }

  for (const [startIdx, neighSet] of adj.entries()) {
    for (const nb of neighSet) {
      const k = edgeKey(startIdx, nb);
      if (visitedEdge.has(k)) continue;
      // walk a loop starting with edge (startIdx -> nb)
      const loop = [];
      let a = startIdx, b = nb;
      loop.push(a);
      visitedEdge.add(edgeKey(a,b));
      // follow chain: choose next neighbor of b that isn't a (prefer deterministic ordering)
      while (true) {
        loop.push(b);
        const nbSet = Array.from(adj.get(b) || []);
        // choose neighbor nextC: the neighbor of b that's not prev a and where edge hasn't been visited if possible
        let nextC = null;
        for (const c of nbSet) {
          if (c === a) continue;
          const k2 = edgeKey(b, c);
          if (!visitedEdge.has(k2)) { nextC = c; break; }
        }
        if (nextC == null) {
          // try choosing the previous a to close loop
          nextC = a;
        }
        visitedEdge.add(edgeKey(b, nextC));
        a = b;
        b = nextC;
        if (b === loop[0]) break; // closed
        // defensive break to avoid infinite loop
        if (loop.length > pointsArr.length * 4) break;
      }
      loops.push(loop);
    }
  }

  if (loops.length === 0) return { points: [], connections: [], areaPixels, bounds: {minX, maxX, minY: clusterY0, maxY: clusterY1} };

  // pick the loop with largest perimeter (sum of segment lengths)
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
  for (let i=1;i<loops.length;i++) {
    const p = loopPerimeter(loops[i]);
    if (p > bestPer) { bestPer = p; bestLoop = loops[i]; }
  }

  // produce ordered points for the best loop
  const loopPoints = bestLoop.map(idx => pointsArr[idx]);

  // optional simplification using Ramer–Douglas–Peucker on the polygon (closed)
  function rdp(points, eps) {
    if (eps <= 0 || points.length < 4) return points.slice();
    // treat closed polygon -> duplicate first point at end for convenience then remove later
    const closed = points.concat([points[0]]);
    function perpDist(a,b,p) {
      // distance from p to line a-b
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
    for (let i = 0; i < n-1; i++) if (keep[i]) out.push(closed[i]);
    return out;
  }

  let finalPoints = loopPoints;
  if (simplifyTolerance > 0) {
    finalPoints = rdp(loopPoints, simplifyTolerance);
    // ensure closedness: rdp returns without duplicate final point, it's OK
    if (finalPoints.length < 3) {
      finalPoints = loopPoints; // fallback
    }
  }

  // build connections (ordered edges forming closed loop)
  const pointsIndexMap = new Map();
  const finalPointsArr = [];
  for (let i = 0; i < finalPoints.length; i+=4) {
    const p = finalPoints[i];
    const key = p.x + ',' + p.y;
    pointsIndexMap.set(key, i);
    finalPointsArr.push({x: p.x, y: specHeight-lsc(p.y,specHeight)});
  }
  const connections = [];
  for (let i = 0; i < finalPointsArr.length; i++) {
    connections.push([i, (i+1) % finalPointsArr.length]);
  }

  const bounds = { minX, maxX, minY: clusterY0, maxY: clusterY1 };

  return {
    points: finalPointsArr,
    connections,
    areaPixels,
    bounds
  };
}
