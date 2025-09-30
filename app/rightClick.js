// Replace these stubs with your own integration functions
function updateTools(){
    toolButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === currentTool);
        btn.style.background = (btn.dataset.tool === currentTool)?"#4af":"var(--accent-gradient)"
    });
    if(currentTool === "image") overlayFile.click();
    updateBrushPreview();
}
function applyEQChanges(){
    console.log('applyEQChanges() - implement', eqBands);
}
function removeHarmonicsAction(){
    console.log('removeHarmonics() - implement');
}
function setPixelMagPhaseAtCursor(x, y, mag = undefined, phase = undefined){

  // compute hx/hy/index same way the menu calculates it (best-effort)
  try {
    const cx = Math.floor(x);
    const cy = Math.floor(y);

    // try to compute same index convention used elsewhere
    const hz = (typeof getSineFreq === 'function' && typeof visibleToSpecY === 'function')
      ? getSineFreq(visibleToSpecY(cy))
      : null;

    const hx = Math.floor(cx);
    const hy = (hz !== null && typeof sampleRate !== 'undefined' && typeof fftSize !== 'undefined')
      ? Math.floor(hz / (sampleRate / fftSize))
      : Math.floor(y);

    const i = (typeof specHeight !== 'undefined') ? (hx * specHeight + hy) : (hx * (fftSize || 1) + hy);

    // write magnitude back (inverse of normalizedMag = mags[i]/256)
    if (typeof mag === 'number' && window.mags && typeof window.mags.length !== 'undefined'){
      // mags seems to be scaled so normalizedMag = mags[i] / 256
      const val = Math.max(0, Math.min(1, mag));
      window.mags[i] = val * 256;
    } else {
      console.log('setPixelMagPhaseAtCursor: mags array not found or mag not provided');
    }

    // write phase if we can find a phases/angs array
    if (typeof phase === 'number') {
      if (window.phases && typeof window.phases.length !== 'undefined') {
        window.phases[i] = phase; // common name
      } else if (window.angs && typeof window.angs.length !== 'undefined') {
        window.angs[i] = phase; // alternative name
      } else {
        console.log('setPixelMagPhaseAtCursor: no phases/angs array to write phase into');
      }
    }

    // trigger any UI updates you normally expect (redraw / apply EQ etc.)
    try { redrawAll && redrawAll(); } catch (e) { /* ignore */ }

    console.log('setPixelMagPhaseAtCursor: wrote mag,phase at index', i, { mag, phase });

  } catch (err){
    console.error('setPixelMagPhaseAtCursor error', err);
  }
}
function zoomTimelineFit(){
    iLow = 0;
    iHigh = framesTotal;
    iWidth = iHigh - iLow;
    updateCanvasScroll();
    drawTimeline();
    closeMenu();
}
function zoomYAxisFit(){
    fLow = 0;
    fHigh = sampleRate/2;
    fWidth = fHigh - fLow;
    drawYAxis();
    closeMenu();
}
// -------------------------

// Generic context menu builder
const MENU_ROOT = document.createElement('div'); // container for active menu
document.body.appendChild(MENU_ROOT);

function buildMenu(items){
  const menu = document.createElement('div');
  menu.className = 'ctx-menu';
  menu.addEventListener('mouseleave', () => {
    closeMenu();
  });
  items.forEach(it => {
    if (it.type === 'separator'){
      const sep = document.createElement('div'); sep.className='ctx-sep';
      menu.appendChild(sep); return;
    }
    const itemEl = document.createElement('div');
    itemEl.className = 'ctx-item';

    // attach metadata for later peer updates
    if (it.group) itemEl.dataset.group = it.group;
    if (typeof it.value !== 'undefined') itemEl.dataset.value = String(it.value);

    // label row
    const labelRow = document.createElement('div');
    labelRow.className = 'ctx-label';
    const left = document.createElement('div');

    if (it.type === 'toggle' || it.type === 'check'){
      left.className = 'ctx-check' + (it.checked ? ' checked' : '');
      left.innerHTML = it.checked ? '✓' : '';
    } else if (it.type === 'radio'){
      // show a check mark when selected (instead of dot)
      left.className = 'ctx-radio' + (it.checked ? ' selected' : '');
      left.style.width = '18px';
      left.style.display = 'inline-flex';
      left.style.alignItems = 'center';
      left.style.justifyContent = 'center';
      left.innerHTML = it.checked ? '✓' : '';
    } else {
      left.style.width = '18px';
    }

    const title = document.createElement('div');
    title.textContent = it.label;
    title.style.flex = '1';
    title.style.fontWeight = it.bold ? '600' : '500';

    labelRow.appendChild(left);
    labelRow.appendChild(title);
    if (it.rightText){
      const rt = document.createElement('div'); rt.textContent = it.rightText; rt.style.opacity = 0.8;
      labelRow.appendChild(rt);
    }
    itemEl.appendChild(labelRow);

    if (it.desc){
      const desc = document.createElement('div'); desc.className = 'ctx-desc'; desc.textContent = it.desc;
      itemEl.appendChild(desc);
    }

    // if submenu provided, recursively render
    if (it.submenu && Array.isArray(it.submenu)){
      const sub = document.createElement('div'); sub.className = 'ctx-submenu';
      it.submenu.forEach(si => {
        const subEl = document.createElement('div');
        subEl.className = 'ctx-item';
        const subLabel = document.createElement('div'); subLabel.className='ctx-label';
        const dot = document.createElement('div'); dot.style.width='18px';
        const text = document.createElement('div'); text.textContent = si.label;
        subLabel.appendChild(dot); subLabel.appendChild(text);
        subEl.appendChild(subLabel);
        if (si.desc) { const sd = document.createElement('div'); sd.className='ctx-desc'; sd.textContent = si.desc; subEl.appendChild(sd); }
        sub.appendChild(subEl);
      });
      itemEl.appendChild(sub);
    }

    // input type
    if (it.type === 'input'){
      const inp = document.createElement('input');
      inp.className = 'ctx-input';
      inp.value = it.value ?? '';
      inp.placeholder = it.placeholder ?? '';
      inp.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          it.onConfirm && it.onConfirm(inp.value);
          closeMenu();
        } else if (ev.key === 'Escape') closeMenu();
      });
      itemEl.appendChild(inp);
      // auto-focus
      setTimeout(()=> inp.focus(), 30);
    }

    itemEl.addEventListener('click', e => {
      e.stopPropagation();

      if (it.type === 'toggle' || it.type === 'check'){
        it.checked = !it.checked;
        if (left) { left.classList.toggle('checked', it.checked); left.innerHTML = it.checked ? '✓' : ''; }
        it.onToggle && it.onToggle(it.checked);

      } else if (it.type === 'radio'){
        if (it.group){
          // update items state: uncheck peers, check this one
          items.forEach(peer => {
            if (peer.type === 'radio' && peer.group === it.group){
              peer.checked = (peer === it);
            }
          });

          // update DOM peers visually using data attributes
          const group = it.group;
          const myValStr = typeof it.value === 'undefined' ? '' : String(it.value);
          menu.querySelectorAll('.ctx-item').forEach(child => {
            if (child.dataset.group === group){
              // find its left indicator
              // prefer .ctx-radio then fallback to other classes
              const leftDiv = child.querySelector('.ctx-radio, .ctx-radio-dot, .ctx-check');
              if (!leftDiv) return;
              const childVal = child.dataset.value ?? '';
              const checked = (childVal === myValStr);
              leftDiv.classList.toggle('selected', checked);
              // use checkmark character for selected, empty otherwise
              leftDiv.innerHTML = checked ? '✓' : '';
            }
          });

          // keep internal flag for this item as true
          it.checked = true;
          // call group handler
          it.onSelect && it.onSelect(it.value);

        } else {
          // radio without group falls back to simple click handler
          it.onClick && it.onClick();
        }

      } else {
        it.onClick && it.onClick();
      }
    });

    menu.appendChild(itemEl);
  });
  return menu;
}


function openMenuAt(menuEl, x, y){
  // close previous
  closeMenu();
  MENU_ROOT.appendChild(menuEl);
  // clamp to viewport
  const pad = 8;
  const rect = menuEl.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  if (x + rect.width + pad > vw) x = vw - rect.width - pad;
  if (y + rect.height + pad > vh) y = vh - rect.height - pad;
  menuEl.style.left = x + 'px';
  menuEl.style.top = y + 'px';
  // close on outside click/escape
  setTimeout(()=> {
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onDocKey);
  }, 0);
}
function closeMenu(){
  MENU_ROOT.innerHTML = '';
  document.removeEventListener('click', onDocClick);
  document.removeEventListener('keydown', onDocKey);
}
function onDocClick(e){ closeMenu(); }
function onDocKey(e){ if (e.key === 'Escape') closeMenu(); }

// -------------------------
// Per-element menu definitions
// -------------------------
const TOOLS = ['brush','rectangle','line','blur','eraser','amplifier','image'];

//Need to remove the up/down arrow in the inputs
function makeCanvasMenu(cx, cy){
  // compute pitch/time + mag/db/phase using the logic you gave
  let hz = 0, secs = 0, hx = Math.floor(cx), hy = Math.floor(cy), i = -1;
  let normalizedMag = 0, db = -200, phaseVal = 0;
  try {
    const rect = canvas.getBoundingClientRect();
    hz = (typeof getSineFreq === 'function' && typeof visibleToSpecY === 'function') ? getSineFreq(visibleToSpecY(cy*canvas.height/rect.height)) : 0;
    secs = Math.floor(cx / (Number(sampleRate) / Number(hopSizeEl.value)) * 10000) / 10000;
    hx = Math.floor(cx);
    hy = (typeof fftSize !== 'undefined' && typeof sampleRate !== 'undefined') ? Math.floor(hz / (sampleRate / fftSize)) : Math.floor(cy);
    i = hx * (specHeight || 1) + hy;

    normalizedMag = Math.min(1, mags[i] / 256);
    db = (normalizedMag > 0) ? (20 * Math.log10(normalizedMag)) : -200;

    // try to read existing phase from commonly-used arrays
    phaseVal = Number(phases[i]) || 0;
  } catch (err) {
    console.warn('makeCanvasMenu compute failed', err);
  }

  // Build items array but we will insert a compact header DOM manually at top of menu
  // Inputs are rendered by buildMenu as .ctx-input elements (compact)
  const items = [
    // placeholder top item (will be replaced by non-clickable header DOM inserted later)
    { label: `Pitch: ${hz ? hz.toFixed(0) + 'hz' : '—'} ${typeof hzToNoteName === 'function' ? '(' + hzToNoteName(hz) + ')' : ''}`, desc: `Time: ${secs}`, onClick: null },

    { type: 'separator' },

    // Magnitude numeric input (0..1)
    { type: 'input', label: 'Magnitude', value: String(Number(normalizedMag)),
      onConfirm: (val)=> { /* nothing — handled after menu built */ } },

    // dB numeric input
    { type: 'input', label: 'dB', value: db,
      onConfirm: (val)=> { /* nothing — handled after menu built */ } },

    // Phase numeric input (radians) — buildMenu will create a numeric input; we'll clamp afterwards
    { type: 'input', label: 'Phase', value: String(Number(phaseVal.toFixed(3))),
      onConfirm: (val)=> { /* nothing — handled after menu built */ } },

    { type:'separator' },

    // keep your tool radio items
    ...TOOLS.map(t => ({
      type: 'radio',
      label: t.charAt(0).toUpperCase() + t.slice(1),
      group: 'tool',
      value: t,
      checked: currentTool === t,
      onSelect: (val) => { currentTool = val; console.log('tool ->', val); updateTools(); }
    })),

    { type:'separator' },

    { type: 'toggle', label: 'Align pitch', checked: alignPitch,
      onToggle: (v)=>{ alignPitch = v; updateTools(); } },

    { type: 'toggle', label: 'Align time', checked: alignTime,
      onToggle: (v)=>{ alignTime = v; updateTools(); } },

    { label: 'Remove harmonics', onClick: ()=> { removeHarmonicsAction(); } },
  ];

  // build the compact menu via existing buildMenu (this preserves your CSS/layout)
  const menu = buildMenu(items);

  // insert a compact, non-clickable header at top (replace first placeholder)
  const header = document.createElement('div');
  header.className = 'ctx-item';
  header.style.pointerEvents = 'none';
  header.style.padding = '6px 8px';
  header.style.margin = '0 0 4px 0';
  // two small lines, using your existing classes to remain compact
  const hLabel = document.createElement('div');
  hLabel.className = 'ctx-label';
  hLabel.style.fontWeight = '600';
  hLabel.style.fontSize = '13px';
  hLabel.textContent = `Pitch: ${hz ? hz.toFixed(0) + 'hz' : '—'} ${typeof hzToNoteName === 'function' ? '(' + hzToNoteName(hz) + ')' : ''}`;
  const tLabel = document.createElement('div');
  tLabel.className = 'ctx-label';
  tLabel.style.opacity = '0.85';
  tLabel.style.fontSize = '12px';
  tLabel.textContent = `Time: ${secs}`;

  header.appendChild(hLabel);
  header.appendChild(tLabel);

  // replace the first built item (placeholder) with this header
  if (menu.firstChild) menu.replaceChild(header, menu.firstChild);

  // now find the three inputs generated by buildMenu (they are in order)
  const inputs = menu.querySelectorAll('.ctx-input');
  // inputs ordering: magnitude, dB, phase (from our items)
  const oldMagInput = inputs[0];
  const oldDbInput = inputs[1];
  const oldPhaseInput = inputs[2];

  // if any input doesn't exist, return menu untouched
  if (!oldMagInput || !oldDbInput || !oldPhaseInput) return menu;

  // locate their parent ctx-item elements (we'll replace their content)
  const magItem = oldMagInput.closest('.ctx-item');
  const dbItem = oldDbInput.closest('.ctx-item');
  const phaseItem = oldPhaseInput.closest('.ctx-item');

  // helper: extract the label text from the corresponding .ctx-label element (fallback to a default)
  function extractLabelText(itemEl, fallback) {
    if (!itemEl) return fallback;
    const lbl = itemEl.querySelector('.ctx-label');
    if (!lbl) return fallback;
    // prefer the first line of label text
    return lbl.textContent.trim() || fallback;
  }

  // Create new slider-row for magnitude (label -> numeric aligned right)
  (function createMagRow(){
    const labelText = extractLabelText(magItem, 'Magnitude');
    const row = document.createElement('div');
    row.className = 'slider-row2';

    const lbl = document.createElement('label');
    lbl.textContent = labelText;
    row.appendChild(lbl);

    // create numeric input (reuse value from oldMagInput if present)
    const num = document.createElement('input');
    num.type = 'number';
    num.step = '0.001';
    num.min = '0';
    num.max = '1';
    num.value = (typeof oldMagInput.value !== 'undefined') ? oldMagInput.value : String(Number(normalizedMag.toFixed(3)));

    // push numeric to right
    num.style.flex = '0 0 70px';
    num.style.marginLeft = 'auto';
    num.className = 'ctx-input'; // preserve the class for any selector reliance
    row.appendChild(num);

    // replace magItem content
    magItem.innerHTML = '';
    magItem.appendChild(row);

    // return numeric for wiring sync later
    magItem._numInput = num;
  })();

  // Create new slider-row for dB (label -> numeric aligned right)
  (function createDbRow(){
    const labelText = extractLabelText(dbItem, 'dB');
    const row = document.createElement('div');
    row.className = 'slider-row2';

    const lbl = document.createElement('label');
    lbl.textContent = labelText;
    row.appendChild(lbl);

    const num = document.createElement('input');
    num.type = 'number';
    num.step = '0.1';
    num.value = (typeof oldDbInput.value !== 'undefined') ? oldDbInput.value : ((isFinite(db) && db > -199) ? db.toFixed(1) : '-∞');
    // push numeric to right
    num.style.flex = '0 0 70px';
    num.style.marginLeft = 'auto';
    num.className = 'ctx-input';
    row.appendChild(num);

    dbItem.innerHTML = '';
    dbItem.appendChild(row);

    dbItem._numInput = num;
  })();

  // Create new slider-row for Phase (label -> slider -> numeric)
  (function createPhaseRow(){
    const labelText = extractLabelText(phaseItem, 'Phase (rad, 0..π)');
    const row = document.createElement('div');
    row.className = 'slider-row2';

    const lbl = document.createElement('label');
    lbl.textContent = labelText;
    row.appendChild(lbl);

    // range slider
    const range = document.createElement('input');
    range.type = 'range';
    range.className = 'phase-slider';
    range.min = String(0-Math.PI);
    range.max = String(Math.PI);
    range.step = '0.001';
    range.style.flex = '0 0 120px';
    range.style.marginLeft = '8px';

    // numeric input
    const num = document.createElement('input');
    num.type = 'number';
    num.step = '0.001';
    num.min = String(0-Math.PI);
    num.max = String(Math.PI);
    num.style.flex = '0 0 70px';
    num.style.marginLeft = '8px';
    num.className = 'ctx-input';
    num.id = 'phase-num-input';

    // initialize values (prefer oldPhaseInput value)
    const initPhase = (typeof oldPhaseInput.value !== 'undefined' && oldPhaseInput.value !== '') ? Number(oldPhaseInput.value) : Number(phaseVal || 0);
    range.value = initPhase;
    num.value = Number(initPhase).toFixed(3);

    // wire syncing
    range.addEventListener('input', (e) => {
      num.value = Number(e.target.value).toFixed(3);
    });
    num.addEventListener('input', (e) => {
      const v = Number(e.target.value);
      if (!isFinite(v)) return;
      const clamped = Math.max(0, Math.min(Math.PI, v));
      range.value = clamped;
      num.value = clamped.toFixed(3);
    });

    row.appendChild(range);
    row.appendChild(num);

    phaseItem.innerHTML = '';
    phaseItem.appendChild(row);

    phaseItem._numInput = num;
    phaseItem._range = range;
  })();

  // Now wire mag <-> dB syncing (using the new numeric inputs)
  const magNum = magItem._numInput;
  const dbNum = dbItem._numInput;
  const phaseNum = phaseItem._numInput;
  const phaseRange = phaseItem._range;

  function magToDb(m){
    const mSafe = Math.max(Number(m) || 0, 1e-9);
    return 20 * Math.log10(mSafe);
  }
  function dbToMag(d){
    if (!isFinite(Number(d))) return 0;
    return Math.min(1, Math.pow(10, Number(d) / 20));
  }

  if (magNum && dbNum) {
    magNum.addEventListener('input', () => {
      const m = Math.max(0, Math.min(1, Number(magNum.value) || 0));
      const dd = magToDb(m);
      dbNum.value = isFinite(dd) ? dd.toFixed(1) : '-∞';
    });
  }
  if (dbNum && magNum) {
    dbNum.addEventListener('input', () => {
      const d = Number(dbNum.value);
      const m = dbToMag(d);
      magNum.value = m.toFixed(3);
    });
  }

  // clamp phase numeric (already synced with range above)
  if (phaseNum) {
    phaseNum.addEventListener('input', () => {
      let v = Number(phaseNum.value);
      if (!isFinite(v)) v = 0;
      v = Math.max(0, Math.min(Math.PI, v));
      phaseNum.value = v.toFixed(3);
      if (phaseRange) phaseRange.value = v;
    });
  }

  // wire the Apply item click (find the Apply .ctx-item by its label)
  const applyItem = Array.from(menu.querySelectorAll('.ctx-item')).find(el => {
    return el.textContent && el.textContent.trim().startsWith('Apply');
  });

  if (applyItem) {
    // we replace its click behavior: read inputs and call setter then close
    applyItem.addEventListener('click', (ev) => {
      ev.stopPropagation();

      // read values from the new inputs
      const magVal = magNum ? Math.max(0, Math.min(1, Number(magNum.value) || 0)) : normalizedMag;
      const dbValRaw = dbNum ? dbNum.value : (isFinite(db) ? db.toFixed(1) : '-∞');
      const dbVal = (dbValRaw === '-∞') ? -200 : Number(dbValRaw);
      const phase = phaseNum ? Math.max(0, Math.min(Math.PI, Number(phaseNum.value) || 0)) : phaseVal;

      // If a finite db was typed, prefer it (but your setPixelMagPhaseAtCursor expects mag & phase)
      const finalMag = (isFinite(dbVal) && dbVal > -199) ? dbToMag(dbVal) : magVal;

      // call your setter (we pass mag & phase); setPixelMagPhaseAtCursor should handle writing
      try {
        setPixelMagPhaseAtCursor(cx, cy, finalMag, phase);
      } catch (err) {
        console.error('Apply write error', err);
      }
      // close menu using your close function if present
      try { closeMenu(); } catch (e) { /* ignore */ }
    });
  }

  return menu;
}


function makeTimelineMenu(){
  const items = [
    { label: 'Zoom to fit', desc: 'Scale timeline so all data fits in view', onClick: ()=> { zoomTimelineFit(); } },
    { type:'separator' },
    { label: 'Set min', desc: `Current: ${iLow/(sampleRate/specHeight*2)}`, onClick: ()=> {
        const v = prompt('Set timeline min (seconds):', String(iLow/(sampleRate/specHeight*2)));
        if (v !== null) { const n = Number(v)*(sampleRate/specHeight*2); if (!isNaN(n) && n>0 && Number(v)<iHigh){ iLow = n; drawTimeline(); } }
        closeMenu();
      } },
    { label: 'Set max', desc: `Current: ${iHigh/(sampleRate/specHeight*2)}`, onClick: ()=> {
        const v = prompt('Set timeline max (seconds):', String(iHigh/(sampleRate/specHeight*2)));
        if (v !== null) { const n = Number(v)*(sampleRate/specHeight*2); if (!isNaN(n) && Number(v)<=specWidth && Number(v)>iLow){ iHigh = n; drawTimeline(); } }
        closeMenu();
      } },
  ];
  return buildMenu(items);
}

function makeYAxisMenu(){
  const items = [
    { type: 'check', label: 'Show Hz / Note', checked: useHz,
      onToggle: (v)=>{ useHz = v; drawYAxis(); } },
    { label: 'Zoom to fit', desc: 'Fit frequency range to data', onClick: ()=> zoomYAxisFit() },
    { type:'separator' },
    { label: 'Set min', desc: `Current: ${fLow} Hz`, onClick: ()=> {
        const v = prompt('Set y-axis min frequency in Hz:', String(fLow));
        if (v !== null) { const n=Number(v); if (!isNaN(n)){ fLow = n; drawYAxis(); } }
      } },
    { label: 'Set max', desc: `Current: ${fHigh} Hz`, onClick: ()=> {
        const v = prompt('Set y-axis max frequency in Hz:', String(fHigh));
        if (v !== null) { const n=Number(v); if (!isNaN(n)){ fHigh = n; drawYAxis(); } }
      } },
    { type:'separator' },
    { type:'toggle', label: 'Log scale', desc: 'Switch y-axis between linear and log', checked: (Number(logscaleEl.value) > 1),
      onToggle: (v)=>{
        // map toggle to logscaleEl.value — if toggled on, set to 2, else set to 1
        logscaleEl.value = v ? 2 : 1;
        // if real input uses onchange, trigger it:
        logscaleEl.dispatchEvent && logscaleEl.dispatchEvent(new Event('change'));
        drawYAxis();
      } }
  ];
  return buildMenu(items);
}

function makeLogscaleMenu(){
  const items = [
    { label: 'Set logscale value', desc: `Current value: ${logscaleEl.value}`, type: 'input', value: String(logscaleEl.value),
      onConfirm: (val)=>{
        const n = Number(val); if (!isNaN(n)){ logscaleEl.value = n; logscaleEl.dispatchEvent && logscaleEl.dispatchEvent(new Event('change')); drawYAxis(); }
      }, placeholder: 'numeric value (e.g. 1.0 or 2.0)'
    }
  ];
  return buildMenu(items);
}

function makeEQMenu(){
  const addPoint = ()=> {
    const type = prompt('Type (peaking/low_shelf/high_shelf):','peaking') || 'peaking';
    const freq = Number(prompt('Frequency (Hz):','1000') || 1000);
    const gain = Number(prompt('Gain (dB):','0') || 0);
    const Q = Number(prompt('Q:', '1') || 1);
    eqBands.push({ type, freq, gain, Q, angle: Math.PI/2, tLen: 60 });
    applyEQChanges();
  };
  const removePoint = ()=> {
    if (!eqBands.length){ alert('No EQ points to remove'); return; }
    // Build a submenu listing items
    const submenu = eqBands.map((b, idx) => ({
      label: `#${idx}: ${b.type} ${b.freq}Hz ${b.gain}dB`,
      desc: `Q=${b.Q}, tLen=${b.tLen}`,
      onClick: ()=> { eqBands.splice(idx,1); applyEQChanges(); }
    }));
    const menu = buildMenu([
      { label: 'Remove specific point', desc: 'Choose a point to remove', submenu: submenu }
    ]);
    // show it near center of current menu; since we call this from inside other menu, append to root
    MENU_ROOT.appendChild(menu);
    // position centered
    const rect = MENU_ROOT.getBoundingClientRect();
    menu.style.left = (rect.left + 40) + 'px';
    menu.style.top = (rect.top + 40) + 'px';
  };

  const items = [
    { label: 'Add point', desc: 'Add a new EQ band (freq, gain, Q)', onClick: addPoint },
    { label: 'Remove point', desc: 'Remove an existing EQ band', onClick: removePoint },
    { type:'separator' },
    { label: 'List current points', desc: `Count: ${eqBands.length}`, onClick: ()=> { console.table(eqBands); alert('See console.table(eqBands)'); } }
  ];
  return buildMenu(items);
}

// generic handler helper
function preventAndOpen(e, menuFactory){
  e.preventDefault();
  e.stopPropagation();
  const menu = menuFactory(e.clientX, e.clientY);
  openMenuAt(menu, e.clientX, e.clientY);
}

canvas && canvas.addEventListener('contextmenu', (e)=> {
  // pass canvas pixel location (example from mouse)
  const rect = canvas.getBoundingClientRect();
  const cx = Math.floor((e.clientX - rect.left));
  const cy = Math.floor((e.clientY - rect.top));
  preventAndOpen(e, ()=> makeCanvasMenu(cx, cy));
});

timeline && timeline.addEventListener('contextmenu', (e)=> preventAndOpen(e, makeTimelineMenu));
yAxis && yAxis.addEventListener('contextmenu', (e)=> preventAndOpen(e, makeYAxisMenu));
// attach plain contextmenu to logscaleEl too:
logscaleEl && logscaleEl.addEventListener('contextmenu', (e)=> preventAndOpen(e, makeLogscaleMenu));
EQcanvas && EQcanvas.addEventListener('contextmenu', (e)=> preventAndOpen(e, makeEQMenu));

// close on window resize/scroll
window.addEventListener('resize', closeMenu);
window.addEventListener('scroll', closeMenu, true);

// Prevent native menu globally on targets (optional)
[canvas, timeline, yAxis, EQcanvas].forEach(el=> {
  if (!el) return;
  el.addEventListener('mousedown', (ev)=> {
    // right click handled above. keep native for left click
    // if you want to always prevent native menu on these elements, uncomment:
    // ev.preventDefault();
  });
});

// Example: wire logscaleEl change to drawYAxis if present
if (logscaleEl && logscaleEl.addEventListener){
  logscaleEl.addEventListener('change', ()=> {
    console.log('logscale changed to', logscaleEl.value);
    drawYAxis();
  });
}

// done