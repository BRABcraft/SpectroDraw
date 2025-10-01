function updateTools(){
    toolButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === currentTool);
        btn.style.background = (btn.dataset.tool === currentTool)?"#4af":"var(--accent-gradient)"
    });
    if(currentTool === "image") overlayFile.click();
    updateBrushPreview();
}
function applyEQChanges(){
    updateEQ();
    scheduleDraw();
}
function setPixelMagPhaseAtCursor(x, y, mag = undefined, phase = undefined){
    const idx = x*specHeight + y
    mags[idx] = mag;
    phases[idx] = phase;
    const topEdge = binToDisplayY(y - 0.5, specHeight);
    const botEdge = binToDisplayY(y + 0.5, specHeight);

    // ensure proper ordering (display coordinates may invert with freq mapping)
    const yTopF = Math.min(topEdge, botEdge);
    const yBotF = Math.max(topEdge, botEdge);

    // convert to integer pixel rows (inclusive)
    const yStart = Math.max(0, Math.floor(yTopF));
    const yEnd   = Math.min(specHeight - 1, Math.ceil (yBotF));

    // compute RGB once for this bin
    const [r, g, b] = magPhaseToRGB(mags[idx], phases[idx]);

    for (let yPixel = yStart; yPixel <= yEnd; yPixel++) {
      const pix = (yPixel * specWidth + x) * 4;
      imageBuffer.data[pix]     = r;
      imageBuffer.data[pix + 1] = g;
      imageBuffer.data[pix + 2] = b;
      imageBuffer.data[pix + 3] = 255;
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
function makeCanvasMenu(cx0, cy0){
  const rect = canvas.getBoundingClientRect();
  const cx = cx0 * canvas.width / rect.width + iLow;
  const cy = cy0 * canvas.height / rect.height;

  let hz = 0, secs = 0, i = -1, normalizedMag = 0, db = -200, phaseVal = 0;
  try {
    hz = getSineFreq(visibleToSpecY(cy));
    secs = Math.floor(cx / (Number(sampleRate)/Number(hopSizeEl.value)) * 10000) / 10000;
    const hx = Math.floor(cx);
    const hy = Math.floor(hz / (sampleRate/fftSize));
    i = hx*(specHeight||1) + hy;
    normalizedMag = Math.min(1, mags[i]/256);
    db = (normalizedMag > 0) ? (20 * Math.log10(normalizedMag)) : -200;
    phaseVal = Number(phases[i]) || 0;
  } catch(e){ console.warn(e); }

  // compact items creation (keeps same entries as before)
  const items = [
    { label:'', onClick:null },
    { type:'separator' },
    { type:'input', label:'Magnitude', value:normalizedMag },
    { type:'input', label:'dB', value:db },
    { type:'input', label:'Phase', value:phaseVal },
    { type:'separator' },
    ...TOOLS.map(t => ({ type:'radio', label: t[0].toUpperCase()+t.slice(1), group:'tool', value:t, checked:currentTool===t, onSelect: v => { currentTool=v; updateTools(); } })),
    { type:'separator' },
    { type:'toggle', label:'Align pitch', checked:alignPitch, onToggle:v=>{alignPitch=v;updateTools();} },
    { type:'toggle', label:'Align time', checked:alignTime, onToggle:v=>{alignTime=v;updateTools();} },
    { label:'Remove harmonics', onClick:()=>removeHarmonics() }
  ];

  const menu = buildMenu(items);

  // compact header
  if(menu.firstChild){
    menu.firstChild.innerHTML = `
      <div class="ctx-label" style="font-weight:600;font-size:13px">
        Pitch: ${hz ? hz.toFixed(0)+'hz' : '—'} ${typeof hzToNoteName==='function' ? '('+hzToNoteName(hz)+')' : ''}
      </div>
      <div class="ctx-label" style="opacity:.85;font-size:12px">Time: ${secs}</div>
    `;
    Object.assign(menu.firstChild.style, { pointerEvents:'none', padding:'6px 8px', margin:'0 0 4px 0' });
  }

  // find the three input placeholder items created by buildMenu and replace with richer innerHTML
  const inputs = Array.from(menu.querySelectorAll('.ctx-input'));
  const [magItem, dbItem, phaseItem] = [
    inputs[0].closest('.ctx-item'),
    inputs[1].closest('.ctx-item'),
    inputs[2].closest('.ctx-item')
  ];

  // numeric row template helper (inline)
  magItem.innerHTML = `<div class="slider-row2">
    <label>Magnitude</label>
    <input type="range" class="mag-slider" min="0" max="128" step="0.1" value="${normalizedMag}" style="position:absolute;left:70px;width:60px;">
    <input type="number" class="ctx-input" step="0.001" min="0" max="128" value="${normalizedMag}" style="flex:0 0 70px;margin-left:auto">
  </div>`;

  dbItem.innerHTML = `<div class="slider-row2">
    <label>dB</label>
    <input type="number" class="ctx-input" step="0.1" value="${isFinite(db)&&db>-199?db.toFixed(1):'-∞'}" style="flex:0 0 70px;margin-left:auto">
  </div>`;

  phaseItem.innerHTML = `
    <div class="slider-row2">
      <label>Phase</label>
      <input type="range" class="phase-slider" min="${-Math.PI}" max="${Math.PI}" step="0.001" style="flex:0 0 120px;margin-left:8px">
      <input type="number" class="ctx-input" id="phase-num-input" step="0.001" min="${-Math.PI}" max="${Math.PI}" style="flex:0 0 70px;margin-left:8px" value="${phaseVal.toFixed(3)}">
    </div>`;

  // re-query inputs after innerHTML replacement
  const magInput = magItem.querySelector('.ctx-input');
  const magRange = magItem.querySelector('.mag-slider');
  const dbInput  = dbItem.querySelector('.ctx-input');
  const phaseRange = phaseItem.querySelector('.phase-slider');
  const phaseInput = phaseItem.querySelector('.ctx-input');
  phaseRange.value = phaseInput.value = phaseVal;

  // compact helper conversions
  const magToDb = m => { const ms = Math.max(Number(m)||0,1e-9); return 20*Math.log10(ms/256); };
  const dbToMag = d => { if(!isFinite(Number(d))) return 0; return Math.min(1, Math.pow(10, Number(d)/20))*256; };

  // schedule live update (single compact function)
  const scheduleLiveUpdate = () => requestAnimationFrame(()=>{
    const magVal = Math.max(0, Math.min(128, Number(magInput.value)||0));
    const phaseClamped = Math.max(-Math.PI, Math.min(Math.PI, Number(phaseInput.value)||0));
    const bin = Math.floor(hz/(sampleRate/fftSize));
    setPixelMagPhaseAtCursor(Math.floor(cx), bin, magVal, phaseClamped);
    specCtx.putImageData(imageBuffer, 0, 0);
    pos = Math.floor(cx) * hop;
    autoRecomputePCM(Math.floor(cx), Math.floor(cx));
    drawFrame(specWidth, specHeight);
  });

  // compact wiring of events
  magInput.addEventListener('input', () => { dbInput.value = magToDb(magInput.value).toFixed(1); scheduleLiveUpdate(); });
  magRange.addEventListener('input', e => { magInput.value = Number(e.target.value); dbInput.value = magToDb(magInput.value).toFixed(1); scheduleLiveUpdate(); });
  dbInput.addEventListener('input',  () => { magInput.value = dbToMag(dbInput.value).toFixed(3); scheduleLiveUpdate(); });
  phaseRange.addEventListener('input', e => { phaseInput.value = Number(e.target.value).toFixed(3); scheduleLiveUpdate(); });
  phaseInput.addEventListener('input', () => {
    let v = Math.max(-Math.PI, Math.min(Math.PI, Number(phaseInput.value)||0));
    phaseInput.value = v.toFixed(3); phaseRange.value = v; scheduleLiveUpdate();
  });

  return menu;
}



function makeTimelineMenu(){
  const factor = (sampleRate/hopSizeEl.value); // seconds -> sample/index multiplier
  const currentMinSec = iLow / factor;
  const currentMaxSec = iHigh / factor;

  const items = [
    { label: 'Zoom to fit', onClick: ()=> zoomTimelineFit() },
    { type:'separator' },
    { type:'input', label: 'Set min', value: currentMinSec },
    { type:'input', label: 'Set max', value: currentMaxSec },
  ];

  const menu = buildMenu(items);

  const inputs = Array.from(menu.querySelectorAll('.ctx-input'));
  const minItem = inputs[0]?.closest('.ctx-item');
  const maxItem = inputs[1]?.closest('.ctx-item');

  function makeSlideRow(labelText, valueSec){
    return `
      <div class="slide-row2" style="display:flex;align-items:center;gap:8px">
        <label style="flex:1">${labelText}</label>
        <input type="number" class="ctx-input timeline-sec-input" step="0.01" min="0" value="${(isFinite(valueSec)?valueSec:'0')}"
          style="flex:0 0 90px;
                 border-radius:6px;
                 background-color:#333;
                 color:#fff;
                 border:1px solid #aaa;
                 padding:2px 6px">
      </div>`;
  }

  if (minItem) minItem.innerHTML = makeSlideRow('Set min', currentMinSec);
  if (maxItem) maxItem.innerHTML = makeSlideRow('Set max', currentMaxSec);

  function wireRow(itemEl, isMin){
    if (!itemEl) return;
    const input = itemEl.querySelector('.timeline-sec-input');

    input.addEventListener('input', () => {
      let v = Number(input.value);
      if (isNaN(v)) v = 0;
      const n = v * factor;

      if (isMin){
        if (n >= 0 && v <= iHigh / factor){
          iLow = n;
          drawTimeline();
        }
      } else {
        if (v >= iLow / factor && (typeof specWidth === 'undefined' || v <= specWidth)){
          iHigh = n;
          drawTimeline();
        }
      }
    });

    // optional: pressing Escape closes menu
    input.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  }

  wireRow(minItem, true);
  wireRow(maxItem, false);

  return menu;
}


function makeYAxisMenu(){
  const items = [
    { type:'check', label:'Show Hz / Note', checked: useHz },
    { label:'Zoom to fit', onClick: ()=> zoomYAxisFit() },
    { type:'separator' },
    { type:'input', label:'Set min', value: fLow },
    { type:'input', label:'Set max', value: fHigh },
    { type:'separator' },
    { type:'input', label:'Logscale', value: Number(logscaleEl.value) }
  ];

  const menu = buildMenu(items);

  const inputs = Array.from(menu.querySelectorAll('.ctx-input'));
  const minItem = inputs[0]?.closest('.ctx-item');
  const maxItem = inputs[1]?.closest('.ctx-item');
  const logItem = inputs[2]?.closest('.ctx-item');

  // numeric input row helper (like canvas menu)
  function makeSliderRow(labelText, value, min=0, max=100, step=0.01){
    return `
      <div class="slide-row2" style="display:flex;align-items:center;gap:8px">
        <label style="wrap:nowrap;">${labelText}</label>
        <input type="range" class="ctx-slider" min="${min}" max="${max}" step="${step}" value="${value}" style="flex:1; width:50px">
        <input type="number" class="ctx-input" value="${value}" step="${step}" min="${min}" max="${max}"
          style="flex:0 0 70px;
                 border-radius:6px;
                 background-color:#333;
                 color:#fff;
                 border:1px solid #aaa;
                 padding:2px 6px">
      </div>`;
  }

  // replace min/max rows
  if(minItem) minItem.innerHTML = makeSliderRow('Set min', fLow, 0, fHigh, 1);
  if(maxItem) maxItem.innerHTML = makeSliderRow('Set max', fHigh, fLow, 20000, 1); // assume 20kHz upper limit

  // replace log scale row
  if(logItem) logItem.innerHTML = makeSliderRow('Log scale', Number(logScaleVal), 1, 2, 0.01);

  // wiring helpers
  function wireSliderRow(itemEl, getValue, setValue, minVal, maxVal){
    if(!itemEl) return;
    const slider = itemEl.querySelector('.ctx-slider');
    const input = itemEl.querySelector('.ctx-input');

    const apply = (v)=>{
      let val = Math.max(minVal, Math.min(maxVal, Number(v)));
      setValue(val);
      slider.value = input.value = val;
      drawYAxis();
    };

    slider.addEventListener('input', e=> apply(e.target.value));
    input.addEventListener('input', e=> apply(e.target.value));
    input.addEventListener('keydown', e=>{ if(e.key==='Escape') closeMenu(); });
  }

  wireSliderRow(minItem, ()=>fLow, v=>{ fLow=v; if(v>fHigh) fHigh=v; }, 0, fHigh);
  wireSliderRow(maxItem, ()=>fHigh, v=>{ fHigh=v; if(v<fLow) fLow=v; }, fLow, 20000);
  wireSliderRow(logItem, ()=>Number(logscaleEl.value), v=>{
    logscaleEl.value = v;
    logScaleVal = v;
    logscaleEl.dispatchEvent && logscaleEl.dispatchEvent(new Event('change'));
    restartRender();
    drawYAxis();
  }, 1, 2);

  // keep the Show Hz / Note checkbox
  const checkItem = menu.querySelector('.ctx-item'); // the first ctx-item is the checkbox
    if(checkItem){
        checkItem.addEventListener('click', e => {
            e.stopPropagation(); // prevent menu from closing
            useHz = !useHz;
            const left = checkItem.querySelector('.ctx-check');
            if(left){
                left.classList.toggle('checked', useHz);
                left.innerHTML = useHz ? '✓' : '';
            }
            drawYAxis();
        });
    }

  return menu;
}


function makeLogscaleMenu() {
  const value = logScaleVal;
  const items = [
    { type: 'input', label: 'Logscale', value: value }
  ];

  const menu = buildMenu(items);

  const inputItem = menu.querySelector('.ctx-item');
  if (!inputItem) return menu;

  // create slider + numeric input row
  inputItem.innerHTML = `
    <div class="slide-row2" style="display:flex;align-items:center;gap:8px">
      <label style="flex:1">Logscale</label>
      <input type="range" class="ctx-slider" min="1" max="2" step="0.01" value="${value}" style="flex:1; width:50px">
      <input type="number" class="ctx-input" value="${value}" step="0.01" min="1" max="2"
        style="flex:0 0 70px;
               border-radius:6px;
               background-color:#333;
               color:#fff;
               border:1px solid #aaa;
               padding:2px 6px">
    </div>
  `;

  const slider = inputItem.querySelector('.ctx-slider');
  const numberInput = inputItem.querySelector('.ctx-input');

  const apply = (v) => {
    const val = Math.max(1, Math.min(2, Number(v)));
    logscaleEl.value = val;
    logScaleVal = val;
    slider.value = numberInput.value = val;
    logscaleEl.dispatchEvent && logscaleEl.dispatchEvent(new Event('change'));
    drawYAxis();
    restartRender();
  };

  slider.addEventListener('input', e => apply(e.target.value));
  numberInput.addEventListener('input', e => apply(e.target.value));
  numberInput.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  return menu;
}

function makeEQMenu(cx,cy){
  const h = EQcanvas.height;
  const w = EQcanvas.width;

  const addPoint = () => {
    const newPoint = {
        type: "peaking",
        freq: yToFreq(cy, h),
        gain: xToGain(cx, w),
        Q: 1,
        angle: Math.PI/2,
        tLen: 60
    };

    // find the insertion index (first band with freq > newPoint.freq)
    let idx = eqBands.findIndex(b => b.freq > newPoint.freq);
    if (idx === -1) idx = eqBands.length; // insert at end if none is greater

    eqBands.splice(idx, 0, newPoint);
    applyEQChanges();
};
  const removePoint = ()=> {
    const pos = {x:cx, y:cy};
    const hit = findHit(pos);
    console.log(hit);
    if (hit && hit.type === 'point'){
        eqBands.splice(hit.index, 1);
        applyEQChanges();
    }
  };

  const items = [
    { label: 'Add point', onClick: addPoint },
    { label: 'Remove point', onClick: removePoint }
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
EQcanvas && EQcanvas.addEventListener('contextmenu', (e)=> {
    const rect = EQcanvas.getBoundingClientRect();
    const cx = Math.floor((e.clientX - rect.left));
    const cy = Math.floor((e.clientY - rect.top));
    preventAndOpen(e, ()=> makeEQMenu(cx,cy))});

// close on window resize/scroll
window.addEventListener('resize', closeMenu);
window.addEventListener('scroll', closeMenu, true);

// Prevent native menu globally on targets (optional)
[canvas, timeline, yAxis, EQcanvas].forEach(el=> {
  if (!el) return;
  el.addEventListener('mousedown', (ev)=> {
    ev.preventDefault();
  });
});