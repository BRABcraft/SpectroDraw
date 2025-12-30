const harmonicsPreset = document.getElementById("harmonicsPresetSelect");
function renderHarmonicsCanvas(){
  const canvas = document.getElementById("harmonicsEditor");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  const bars = 100;
  const ch = currentChannel;
  const s = logScaleVal[ch];

  // index -> x position using same log mapping idea as ftvsy but for 0..bars-1 -> 0..w-1
  function idxToX(i) {
    const bin = i; // 0..bars-1
    if (s <= 1.0000001) {
      // linear spacing across canvas width
      return (bin / (bars - 1)) * (w - 1);
    } else {
      const a = s - 1;
      const denom = Math.log(1 + a * (bars - 1));
      const t = Math.log(1 + a * bin) / denom;
      return t * (w - 1);
    }
  }

  // draw background
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, w, h);

  // precompute x positions
  const xs = new Array(bars);
  for (let i = 0; i < bars; i++) xs[i] = idxToX(i);

  // draw each bar (value 0 => bottom, 1 => top)
  ctx.fillStyle = "white";
  for (let i = 0; i < bars; i++) {
    const val = Math.max(0, Math.min(1, harmonics[i] || 0));
    const x = xs[i];
    // estimate bar width by distance to next x (or previous if last)
    const nextX = (i < bars - 1) ? xs[i + 1] : (i > 0 ? xs[i] + (xs[i] - xs[i - 1]) : x + 1);
    let bw = Math.max(1, Math.round(nextX - x));
    // center the bar on x
    const bx = Math.floor(x - bw / 2);
    const by = Math.round((1 - val) * (h - 1));
    const barH = h - by;
    ctx.fillRect(bx, by, bw, barH);
  }
}

// --- pointer interaction (drag to edit) ---
let editingHarmonics = false;
const canvas = document.getElementById("harmonicsEditor");

// helper to handle pointer coordinates -> nearest bar -> update harmonics
function _handleHarmonicsPointer(e) {
  if (!canvas) return;
  // get coordinates relative to canvas
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const w = canvas.width;
  const h = canvas.height;
  const bars = 100;
  const ch = currentChannel;
  const s = logScaleVal[ch];

  function idxToX(i) {
    const bin = i;
    if (s <= 1.0000001) {
      return (bin / (bars - 1)) * (w - 1);
    } else {
      const a = s - 1;
      const denom = Math.log(1 + a * (bars - 1));
      const t = Math.log(1 + a * bin) / denom;
      return t * (w - 1);
    }
  }

  // find nearest bar index
  let bestI = 0;
  let bestDist = Infinity;
  for (let i = 0; i < bars; i++) {
    const xi = idxToX(i);
    const d = Math.abs(xi - x);
    if (d < bestDist) { bestDist = d; bestI = i; }
  }
  info.innerHTML = `Harmonic: ${bestI+1}x<br>Multiplier: ${harmonics[bestI].toFixed(2)}<br>`

  // convert y -> harmonic value (clamped 0..1). y=0 -> top -> val=1; y=h-1 -> bottom -> val=0
  const newVal = Math.max(0, Math.min(1, 1 - (y / (h - 1))));
  if (editingHarmonics) harmonics[bestI] = newVal;
  updateAllVariables(null);
  // redraw
  renderHarmonicsCanvas();
}

// pointerdown -> start editing and capture pointer
if (canvas) {
  canvas.addEventListener("pointerdown", (e) => {
    editingHarmonics = true;
    harmonicsPreset.value = "custom";
    try { canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); } catch (err) {}
    _handleHarmonicsPointer(e);
    e.preventDefault();
  });

  // pointermove -> update if editing
  canvas.addEventListener("pointermove", (e) => {
    _handleHarmonicsPointer(e);
    e.preventDefault();
    updateBrushPreview();
  });

  // pointerup -> stop editing and release capture
  document.addEventListener("pointerup", (e) => {
    if (!editingHarmonics) return;
    editingHarmonics = false;
    try { canvas.releasePointerCapture && canvas.releasePointerCapture(e.pointerId); } catch (err) {}
  });
}

harmonicsPreset.addEventListener("input", ()=>{
  const e = harmonicsPreset.value;
  if (e === "sine") {
    harmonics = Array(100).fill(0); harmonics[0] = 1;
  } else if (e === "triangle") {
    harmonics = new Array(100).fill(0);
    for (let i = 0; i < 100; i++) {
      const n = i + 1;
      if (n % 2 === 1) harmonics[i] = 1 / (n * n); // odd harmonics, 1/n^2
    }
  } else if (e === "square") {
    harmonics = new Array(100).fill(0);
    for (let i = 0; i < 100; i++) {
      const n = i + 1;
      if (n % 2 === 1) harmonics[i] = 1 / n; // odd harmonics, 1/n
    }
  } else if (e === "saw") {
    harmonics = new Array(100);
    for (let i = 0; i < 100; i++) harmonics[i] = 1 / (i + 1); // all harmonics, 1/n
  } else if (e === "custom") {
    toggleSection(document.getElementById("brushHarmonicsEditorDivToggleBtn"));
  }
  renderHarmonicsCanvas();
  updateBrushPreview();
});
