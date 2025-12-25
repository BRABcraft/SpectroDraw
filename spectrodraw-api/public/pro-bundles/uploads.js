
// ---------- Generic helpers (works for channels OR uploads) ----------

function createBufferForItem(item) {
  const outChannels = 2;
  const len = item && item.pcm ? item.pcm.length : 0;
  const sr = item && item.sampleRate ? item.sampleRate : sampleRate;
  const buf = audioCtx.createBuffer(outChannels, Math.max(1, len), sr);
  const left = buf.getChannelData(0);
  const right = buf.getChannelData(1);

  if (!item || !item.pcm || len === 0) return buf;

  const device = (item.audioDevice || "both").toLowerCase();
  const vol = (typeof item.volume === "number") ? Math.max(0, Math.min(1, item.volume)) : 1;

  if (device === "left") {
    for (let i = 0; i < len; i++) left[i] = item.pcm[i] * vol;
  } else if (device === "right") {
    for (let i = 0; i < len; i++) right[i] = item.pcm[i] * vol;
  } else if (device === "none") {
    // silence
  } else {
    for (let i = 0; i < len; i++) {
      const s = item.pcm[i] * vol;
      left[i] = s;
      right[i] = s;
    }
  }
  return buf;
}

/**
 * Stop playback for arr[idx]. arr must be the array (channels or uploads).
 */
function stopItem(arr, idx, preserveSamplePos = true) {
  const it = arr[idx];
  if (!it) return;
  if (it._sourceNode) {
    try { it._sourceNode.onended = null; } catch (e) {}
    try { it._sourceNode.stop(); } catch (e) {}
    try { it._sourceNode.disconnect(); } catch (e) {}
    it._sourceNode = null;
  }
  if (it._isPlaying) {
    const elapsedSec = audioCtx.currentTime - (it._startedAt || 0);
    const newPos = Math.floor((it._startOffset || 0) + elapsedSec * (it.sampleRate || sampleRate));
    if (preserveSamplePos) it.samplePos = Math.max(0, Math.min(it.pcm ? it.pcm.length : 0, newPos));
  }
  it._isPlaying = false;
  it._startedAt = null;
  it._startOffset = null;
  if (it._playbackBtn) it._playbackBtn.innerHTML = playHtml;
}

/**
 * Start playback for arr[idx]. Stops other playing items across both arrays.
 */
async function startItem(arr, idx) {
  const it = arr[idx];
  if (!it || !it.pcm || it.pcm.length === 0) return;

  ensureAudioCtx();
  if (audioCtx.state === "suspended") {
    try { await audioCtx.resume(); } catch (e) { console.warn("audioCtx.resume failed", e); }
  }

  // Stop any playing items in both arrays (channels and uploads)
  for (let k = 0; k < channels.length; k++) if (channels[k] && channels[k]._isPlaying) stopItem(channels, k, true);
  for (let k = 0; k < uploads.length; k++) if (uploads[k] && uploads[k]._isPlaying) stopItem(uploads, k, true);

  // Build buffer/source
  const buf = createBufferForItem(it);
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.loop = false;

  // connect
  try {
    const target = _getPlaybackTarget();
    src.connect(target);
  } catch (e) {
    try { src.connect(audioCtx.destination); } catch (e2) { console.warn("connect fallback failed", e2); }
  }

  // start offset (in samples -> seconds)
  const startOffsetSamples = (typeof it.samplePos === "number") ? it.samplePos : 0;
  const offsetSec = Math.max(0, Math.min(startOffsetSamples, it.pcm.length - 1)) / (it.sampleRate || sampleRate);

  // metadata
  it._sourceNode = src;
  it._startOffset = startOffsetSamples;
  it._startedAt = audioCtx.currentTime;
  it._isPlaying = true;

  if (it._playbackBtn) it._playbackBtn.innerHTML = pauseHtml;

  src.onended = () => {
    if (it && it.pcm) it.samplePos = it.pcm.length;
    it._isPlaying = false;
    it._sourceNode = null;
    it._startedAt = null;
    it._startOffset = null;
    if (it._playbackBtn) it._playbackBtn.innerHTML = playHtml;
  };

  try {
    src.start(0, offsetSec);
  } catch (e) {
    // fallback bookkeeping if start with offset fails
    try {
      src.start(0);
      it._startOffset = startOffsetSamples;
      it._startedAt = audioCtx.currentTime - offsetSec;
    } catch (e2) {
      console.warn("start failed", e, e2);
    }
  }
}

// ---------- Unified UI update loop (channels + uploads) ----------
function updateAllPlayUI() {
  const updateForArray = (arr, prefix) => {
    for (let i = 0; i < arr.length; i++) {
      const it = arr[i];
      if (!it) continue;
      const slider = document.getElementById(`timeSlider_${prefix}${i}`);
      const label = document.getElementById(`timeLabel_${prefix}${i}`);

      let posSamples = it.samplePos;
      if (it._isPlaying && it._startedAt != null) {
        const elapsed = audioCtx.currentTime - it._startedAt;
        posSamples = Math.floor((it._startOffset || 0) + elapsed * (it.sampleRate || sampleRate));
      }
      const total = it.pcm ? it.pcm.length : 0;
      if (slider) {
        slider.min = 0;
        slider.max = total;
        if (!slider.matches(":active")) slider.value = Math.min(total, Math.max(0, posSamples));
      }
      if (label) {
        const curMs = (posSamples / (it.sampleRate || sampleRate)) * 1000;
        const totMs = (total / (it.sampleRate || sampleRate)) * 1000;
        label.innerText = `${msToMS(curMs)}/${msToMS(totMs)}`;
      }
    }
  };

  if (channels) updateForArray(channels, "c");
  if (uploads) updateForArray(uploads, "u");
  requestAnimationFrame(updateAllPlayUI);
}
requestAnimationFrame(updateAllPlayUI);
const msToMS = ms => (ms/6e4|0)+":"+ (ms/1e3%60|0).toString().padStart(2,"0");

// ---------- Wiring: use stopItem(startItem) when building UI ----------

function renderUploads() {
  // helper: friendly ms -> mm:ss
  const msToMS = ms => (ms/6e4|0) + ":" + (ms/1e3%60|0).toString().padStart(2,"0");

  function buildSampleRow(name, pcm, samplePos, sampleRate, s) {
    // ensure numeric defaults so UI shows something stable
    const pos = Number.isFinite(samplePos) ? samplePos : 0;
    const sr = sampleRate || sampleRate === 0 ? sampleRate : window.sampleRate;
    const totalMs = pcm && pcm.length ? msToMS((pcm.length / (sr || window.sampleRate)) * 1000) : "0:00";
    const curMs = msToMS((pos / (sr || window.sampleRate)) * 1000);
    return `
    <div class="sample-row" data-sample-id="${s}">
      <div class="sample-controls">
        <p style="margin:0;">${name}</p>
        ${
          s[0] === "u"
            ? `<button id="moreBtn_${s}" class="more-btn">
                <span style="transform: translateY(-3px); display:inline-block;">...</span>
              </button>`
            : ``
        }
      </div>
      <div class="sample-controls" id="sample_${s}">
        <label for="timeSlider_${s}" id="timeLabel_${s}" style="font-size:14px;">${curMs}/${totalMs}</label>
        <button class="sampleButton" id="samplePlayback_${s}">${playHtml}</button>
        <input type="range" min="0" max="${pcm ? pcm.length : 0}" value="${pos}" class="mini-slider" id="timeSlider_${s}">
        <button class="sampleButton" id="sampleReplace_${s}" title="Drag to overwrite sample onto spectrogram">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" fill="white" stroke="black" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3,3 16,14 11,14 13,20 9,21 7,15 3,17 3,3"></polyline>
            <path fill="white" stroke="black" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" d="m15,15 l6,0 l4,4 l-4,0 l0,-4 l-6,0 l0,12.5 l10,0 l0,-8.5l-4,-4z"/>
          </svg>
        </button>
        <button class="sampleButton" id="sampleInsert_${s}" title="Drag to insert sample into spectrogram">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" fill="white" stroke="black" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3,3 16,14 11,14 13,20 9,21 7,15 3,17 3,3"></polyline>
            <path fill="none" stroke="#0f0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m15,22.5 l15,0z m7.5,-7.5 l0,15z"/>
          </svg>
        </button>
      </div>
    </div>
  `;
  }

  // 1) Build HTML strings for both sections (do not set innerHTML repeatedly)
  const uploadsContainer = document.getElementById("uploadsWrapper");
  const channelsContainer = document.getElementById("channelsSampleWrapper");
  if (!uploadsContainer || !channelsContainer) {
    console.warn("Missing containers: uploadsWrapper or channelsSampleWrapper");
    return;
  }

  let uploadsHtml = "";
  for (let i = 0; i < uploads.length; i++) {
    const u = uploads[i];
    // ensure samplePos exists
    if (!Number.isFinite(u.samplePos)) u.samplePos = 0;
    uploadsHtml += buildSampleRow(u.name || `Upload ${i}`, u.pcm || new Float32Array(0), u.samplePos, u.sampleRate || sampleRate, "u" + i);
  }

  let channelsHtml = "";
  for (let i = 0; i < channels.length; i++) {
    const ch = channels[i];
    if (!Number.isFinite(ch.samplePos)) ch.samplePos = 0;
    channelsHtml += buildSampleRow("Channel " + i, ch.pcm || new Float32Array(0), ch.samplePos, ch.sampleRate || sampleRate, "c" + i);
  }

  // 2) Set HTML once
  uploadsContainer.innerHTML = uploadsHtml;
  channelsContainer.innerHTML = channelsHtml;

  // 3) Attach listeners for uploads
  for (let i = 0; i < uploads.length; i++) {
    const u = uploads[i];
    const playbackBtn = document.getElementById("samplePlayback_u" + i);
    const timeSlider = document.getElementById("timeSlider_u" + i);
    const sampleReplace = document.getElementById("sampleReplace_u" + i);
    const sampleInsert = document.getElementById("sampleInsert_u" + i);
    const timeLabel = document.getElementById("timeLabel_u" + i);

    u._playbackBtn = playbackBtn;

    if (timeSlider) {
      timeSlider.min = 0;
      timeSlider.max = u.pcm ? u.pcm.length : 0;
      timeSlider.value = u.samplePos || 0;

      // robust numeric parsing + immediate UI update
      timeSlider.addEventListener("input", (e) => {
        const v = Number(e.target.value);
        const newSample = Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
        u.samplePos = Math.min(u.pcm ? u.pcm.length : 0, newSample);

        if (timeLabel) {
          const curMs = (u.samplePos / (u.sampleRate || sampleRate)) * 1000;
          const totMs = (u.pcm ? u.pcm.length : 0) / (u.sampleRate || sampleRate) * 1000;
          timeLabel.innerText = `${msToMS(curMs)}/${msToMS(totMs)}`;
        }

        if (u._isPlaying) {
          stopItem(uploads, i, true);
          startItem(uploads, i);
        } else {
          // keep thumb where user put it
          timeSlider.value = String(u.samplePos);
        }
      });

      timeSlider.addEventListener("pointerdown", () => {
        u._dragging = true;
        if (u._isPlaying) {
          u._wasPlayingDuringDrag = true;
          stopItem(uploads, i, true);
        } else {
          u._wasPlayingDuringDrag = false;
        }
      });
      timeSlider.addEventListener("pointerup", () => {
        u._dragging = false;
        if (u._wasPlayingDuringDrag) {
          u._wasPlayingDuringDrag = false;
          startItem(uploads, i);
        }
      });
    }
    let us = [], name=[]; for (let c =0;c<channelCount;c++) if (uploads[c].uuid === u.uuid){us.push(uploads[c]); name.push(uploads[c].name);}
    sampleReplace.addEventListener("pointerdown", (ev) => startDrag(syncChannels?us:[u], ev, name,false));
    sampleInsert.addEventListener("pointerdown", (ev) => startDrag(syncChannels?us:[u], ev, name,true));

    if (playbackBtn) {
      playbackBtn.addEventListener("click", async () => {
        if (!u.pcm || u.pcm.length === 0) return;
        if (u._isPlaying) stopItem(uploads, i, true);
        else await startItem(uploads, i);
      });
    }
    const moreBtn = document.getElementById("moreBtn_u" + i);
    if (moreBtn) {
      moreBtn.addEventListener("click", (ev) => {
        ev.stopPropagation(); // avoid bubbling causing other handlers to run
        window._showItemContextMenu(ev, uploads, i);
      });
    }
  }

  // 4) Attach listeners for channels
  for (let i = 0; i < channels.length; i++) {
    const ch = channels[i];
    const playbackBtn = document.getElementById("samplePlayback_c" + i);
    const timeSlider = document.getElementById("timeSlider_c" + i);
    const sampleReplace = document.getElementById("sampleReplace_c" + i);
    const sampleInsert = document.getElementById("sampleInsert_c" + i);
    const timeLabel = document.getElementById("timeLabel_c" + i);

    ch._playbackBtn = playbackBtn;

    if (timeSlider) {
      timeSlider.min = 0;
      timeSlider.max = ch.pcm ? ch.pcm.length : 0;
      timeSlider.value = ch.samplePos || 0;

      timeSlider.addEventListener("input", (e) => {
        const v = Number(e.target.value);
        const newSample = Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
        ch.samplePos = Math.min(ch.pcm ? ch.pcm.length : 0, newSample);

        if (timeLabel) {
          const curMs = (ch.samplePos / (ch.sampleRate || sampleRate)) * 1000;
          const totMs = (ch.pcm ? ch.pcm.length : 0) / (ch.sampleRate || sampleRate) * 1000;
          timeLabel.innerText = `${msToMS(curMs)}/${msToMS(totMs)}`;
        }

        if (ch._isPlaying) {
          stopItem(channels, i, true);
          startItem(channels, i);
        } else {
          timeSlider.value = String(ch.samplePos);
        }
      });

      timeSlider.addEventListener("pointerdown", () => {
        ch._dragging = true;
        if (ch._isPlaying) { ch._wasPlayingDuringDrag = true; stopItem(channels, i, true); }
        else ch._wasPlayingDuringDrag = false;
      });
      timeSlider.addEventListener("pointerup", () => {
        ch._dragging = false;
        if (ch._wasPlayingDuringDrag) { ch._wasPlayingDuringDrag = false; startItem(channels, i); }
      });
    }
    let chs = [], name=[]; for (let c =0;c<channelCount;c++) if (channels[c].uuid === ch.uuid){chs.push(channels[c]); name.push("Channel "+c);}
    sampleReplace.addEventListener("pointerdown", (ev) => {startDrag(syncChannels?chs:[ch], ev, name,false)});
    sampleInsert.addEventListener("pointerdown", (ev) => startDrag(syncChannels?chs:[ch], ev, name,true));

    if (playbackBtn) {
      playbackBtn.addEventListener("click", async () => {
        if (!ch.pcm || ch.pcm.length === 0) return;
        if (ch._isPlaying) stopItem(channels, i, true);
        else await startItem(channels, i);
      });
    }
    const moreBtn = document.getElementById("moreBtn_c" + i);
    if (moreBtn) {
      moreBtn.addEventListener("click", (ev) => {
        ev.stopPropagation(); // avoid bubbling causing other handlers to run
        window._showItemContextMenu(ev, uploads, i);
      });
    }
  }

  const imageSection = document.getElementById("imageGallery");
  // build HTML string (one write)
  let imagesHtml = "";
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    imagesHtml += `
      <div class="thumb${(selectedImage===i) ? " selected" : ""}" role="listitem" aria-label="${img.name}" style="position:relative;">
        <img src="${img.src}" alt="${img.name}" style="width:100%;height:100%;object-fit:contain;display:block;">
        <button id="moreBtn_i${i}" class="more-btn" aria-haspopup="true" aria-expanded="false"
                style="position:absolute; top:4px; right:4px; width:26px; height:26px; padding:0; border-radius:6px; border:1px solid rgba(255,255,255,0.06); background:rgba(0,0,0,0.45); color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer;">
          <span style="transform: translateY(-3px); display:inline-block;">...</span>
        </button>
      </div>
    `;
  }
  imageSection.innerHTML = imagesHtml;

  // wire the click handlers for each image thumb (after DOM insertion)
  for (let i = 0; i < images.length; i++) {
    // clicking the image should select it
    const imgEl = imageSection.querySelector(`img[src="${images[i].src}"]`);
    if (imgEl) {
      imgEl.addEventListener("click", () => {
        selectedImage = i;
        renderUploads();
        updateBrushPreview && updateBrushPreview();
      });
    }

    // more button for images — shows the shared context menu for images array
    const moreBtnImg = document.getElementById("moreBtn_i" + i);
    if (moreBtnImg) {
      moreBtnImg.addEventListener("click", (ev) => {
        ev.stopPropagation();
        // show context menu for images array at cursor
        window._showItemContextMenu(ev, images, i);
      });
    }
  }
}

function shiftSpritesForInsert(ch, start, insertLen) {
  if (!Array.isArray(sprites) || insertLen <= 0) return;
  for (let s = 0; s < sprites.length; s++) {
    const sprite = sprites[s];
    if (!sprite || !sprite.pixels) continue;
    const map = sprite.pixels[ch];
    if (!map || !(map instanceof Map)) continue;
    const keysToShift = Array.from(map.keys()).filter(k => k >= start).sort((a,b) => b - a);
    if (keysToShift.length === 0) continue;
    for (const oldX of keysToShift) {
      const value = map.get(oldX);
      map.delete(oldX);
      map.set(oldX + insertLen, value);
    }
    let minC = Infinity, maxC = -Infinity;
    for (const k of map.keys()) {
      if (k < minC) minC = k;
      if (k > maxC) maxC = k;
    }
    sprite.minCol = (minC === Infinity) ? Infinity : minC;
    sprite.maxCol = (maxC === -Infinity) ? -Infinity : maxC;
  }
}

async function commitSample(sample, x, insert = false) {
  if (draggingSample.length === 0 || !sample || !sample[0].pcm || x < -30) {draggingSample = []; return;}
  let $s = syncChannels ? 0 : currentChannel;
  let $e = syncChannels ? channelCount : currentChannel + 1;
  let idx = 0;
  for (let ch = $s; ch < $e; ch++) {
    const start = Math.max(0, x * hop);
    const end = start + sample[idx].pcm.length;
    if (!channels[ch].pcm || channels[ch].pcm.length === 0) {
      channels[ch].pcm = sample[idx].pcm.slice(0);
      emptyAudioLengthEl.value = channels[ch].pcm.length / sampleRate;
      document.getElementById("emptyAudioLengthInput").value = emptyAudioLengthEl.value;
      drawTimeline();
    } else if (insert) {
      const existing = channels[ch].pcm;
      const newLen = Math.max(existing.length, start) + sample[idx].pcm.length;
      const newPCM = new Float32Array(newLen);
      newPCM.set(existing.subarray(0, Math.min(existing.length, start)), 0);
      newPCM.set(sample[idx].pcm, start);
      if (start < existing.length) newPCM.set(existing.subarray(start), start + sample[idx].pcm.length);
      channels[ch].pcm = newPCM;
      emptyAudioLengthEl.value = channels[ch].pcm.length / sampleRate;
      document.getElementById("emptyAudioLengthInput").value = emptyAudioLengthEl.value;
      drawTimeline();
      shiftSpritesForInsert(ch, x, Math.floor(sample[idx].pcm.length/hop));
    } else if (sample[idx].pcm.length > channels[ch].pcm.length) {
      channels[ch].pcm = sample[idx].pcm.slice(0);
      emptyAudioLengthEl.value = channels[ch].pcm.length / sampleRate;
      document.getElementById("emptyAudioLengthInput").value = emptyAudioLengthEl.value;
      drawTimeline();
    } else if (channels[ch].pcm.length < end) {
      const newPCM = new Float32Array(end);
      newPCM.set(channels[ch].pcm, 0);
      newPCM.set(sample[idx].pcm, start);
      channels[ch].pcm = newPCM;
      emptyAudioLengthEl.value = channels[ch].pcm.length / sampleRate;
      document.getElementById("emptyAudioLengthInput").value = emptyAudioLengthEl.value;
      drawTimeline();
    } else {
      channels[ch].pcm.set(sample[idx].pcm, start);
    }
    if (syncChannels) idx++;
  }
  //simpleRestartRender(0,Math.floor(emptyAudioLengthEl.value*sampleRate/hop));
  restartRender(false);
  await waitFor(() => !rendering);
  for (let ch = 0; ch < channelCount; ch++) renderSpectrogramColumnsToImageBuffer(0, framesTotal, ch);
  autoSetNoiseProfile();
  draggingSample = [];
  idx = 0;
  for (let ch = $s; ch < $e; ch++) {
    console.log("Creating sprite for channel", ch);
    newUploadSprite({
      ch,
      minCol:Math.floor(x),
      maxCol:Math.floor(x+sample[0].pcm.length/hop),
      name:sample[idx].name,
      pcm:sample[idx].pcm
    });
    if (syncChannels) idx++;
  }
}

function newUploadSprite(data) {
  let pixelmap=[];
  const width = (data.maxCol-data.minCol);
  const size = width * fftSize;
  let pcm = data.pcm, mags = new Float32Array(size), phases = new Float32Array(size);
  for(let c=0;c<channelCount;c++) pixelmap.push((syncChannels||c==currentChannel)?(new Map()):null);
  x=0;
  for (let pos = 0; pos < pcm.length; pos += hop) {
    const re = new Float32Array(fftSize);
    const im = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) { re[i] = (pcm[i+pos] || 0); im[i] = 0; }
    fft_inplace(re, im);
    for (let bin = 0; bin < fftSize; bin++) {
      const mag = Math.hypot(re[bin] || 0, im[bin] || 0);
      const phase = Math.atan2(im[bin] || 0, re[bin] || 0);
      const idx = x * fftSize + bin; 
      mags[idx] = mag;
      phases[idx] = phase;
    }
    x++;
  }
  sprites.push({
    id: nextSpriteId++,
    effect: {tool: "sample", phaseShift:0, amp:1},
    pixels: pixelmap,
    minCol: data.minCol,
    maxCol: data.maxCol,
    ch: data.ch,
    enabled: true,
    createdAt: performance.now(),
    fadePoints: defaultFadePoints,
    spriteFade: [],
    prevSpriteFade: [],
    name: data.name
  });
  const prevMags = new Float32Array(size), prevPhases = new Float32Array(size);
  for (let i = 0; i < size; i++) {prevMags[i] = Math.random() * 0.00001;prevPhases[i] = Math.random() * 2*Math.PI;}
  for (let i=0;i<mags.length;i++){
    let x = Math.floor(i / fftSize) + data.minCol, y = i % fftSize;
    addPixelToSprite(sprites[sprites.length-1], x, y, prevMags[i], prevPhases[i], mags[i], phases[i], data.ch);
  }
  renderSpritesTable();
}


(function() {
  // create menu once
  let menu = document.getElementById("itemContextMenu");
  if (!menu) {
    menu = document.createElement("div");
    menu.id = "itemContextMenu";
    Object.assign(menu.style, {
      position: "fixed",
      left: "0px",
      top: "0px",
      display: "none",
      zIndex: 999999,
      background: "#1b1b1b",
      border: "1px solid rgba(255,255,255,0.06)",
      padding: "8px",
      borderRadius: "6px",
      boxShadow: "0 8px 24px rgba(0,0,0,0.8)",
      minWidth: "120px",
    });

    // inner button
    const delBtn = document.createElement("button");
    delBtn.id = "contextDeleteBtn";
    delBtn.textContent = "Delete";
    Object.assign(delBtn.style, {
      display: "block",
      width: "100%",
      padding: "8px 10px",
      borderRadius: "6px",
      border: "none",
      background: "#ff4d4f",
      color: "white",
      cursor: "pointer",
      textAlign: "center",
      fontWeight: "600",
    });
    menu.appendChild(delBtn);
    document.body.appendChild(menu);
  }
  let currentTarget = null;
  function hideMenu() {
    if (!menu) return;
    menu.style.display = "none";
    currentTarget = null;
    document.removeEventListener("mousedown", onDocMouseDown, true);
    document.removeEventListener("keydown", onDocKeyDown, true);
  }
  function onDocMouseDown(e) {
    if (!menu) return;
    if (menu.contains(e.target)) return;
    hideMenu();
  }
  function onDocKeyDown(e) {
    if (e.key === "Escape") hideMenu();
  }
  function showMenuAt(x, y, arr, idx) {
    if (!menu) return;
    currentTarget = { arr, idx };
    const pad = 8;
    menu.style.display = "block";
    menu.style.left = `${Math.max(pad, Math.min(window.innerWidth - menu.offsetWidth - pad, x))}px`;
    menu.style.top  = `${Math.max(pad, Math.min(window.innerHeight - menu.offsetHeight - pad, y))}px`;
    document.addEventListener("mousedown", onDocMouseDown, true);
    document.addEventListener("keydown", onDocKeyDown, true);
  }
  const deleteBtn = document.getElementById("contextDeleteBtn");
  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!currentTarget) return hideMenu();
    const { arr, idx } = currentTarget;
    if (Array.isArray(arr) && typeof idx === "number" && idx >= 0 && idx < arr.length) {
      stopItem(uploads, idx, false);
      arr.splice(idx, 1);
      if (arr === images) {
        if (images.length === 0) {
          document.getElementById("brushBtn").click();
        }
        else if (typeof selectedImage === "number") {
          if (selectedImage === idx) {
            selectedImage = arr.length ? Math.min(idx, arr.length - 1) : -1;
          } else if (selectedImage > idx) {
            selectedImage = selectedImage - 1;
          }
        } else {
          selectedImage = -1;
        }
      }
      try { renderUploads(); } catch (err) { console.warn("renderUploads missing", err); }
    }
    hideMenu();
  });
  window._showItemContextMenu = function(event, arr, idx) {
    const x = event.clientX || (event.touches && event.touches[0] && event.touches[0].clientX) || 0;
    const y = event.clientY || (event.touches && event.touches[0] && event.touches[0].clientY) || 0;
    showMenuAt(x, y, arr, idx);
  };
})();


let __dragBox = null;
let __dragState = null;
let __dragRAF = null;

// Config: visual offset (bottom-left of cursor) and physics
const DRAG_BOX_OFFSET = { x: -40, y: 28 }; // bottom-left relative to pointer
const PHYS_STIFFNESS = 400.0; // spring constant
const PHYS_DAMPING = 18.0;    // damping multiplier
const PHYS_MAX_DT = 0.03;     // clamp dt for stability

function spawnDragBox(name) {
  // create once
  if (!__dragBox) {
    __dragBox = document.createElement("div");
    __dragBox.id = "dragPreviewBox";
    Object.assign(__dragBox.style, {
      position: "fixed",
      left: "0px",
      top: "0px",
      zIndex: "99999",
      pointerEvents: "none",
      transform: "translate3d(-9999px,-9999px,0)",
      transition: "none",
      padding: "8px 10px",
      borderRadius: "8px",
      background: "rgba(20,20,20,0.95)",
      color: "#fff",
      fontSize: "13px",
      fontWeight: "600",
      boxShadow: "0 8px 20px rgba(0,0,0,0.6)",
      whiteSpace: "nowrap",
    });
    document.body.appendChild(__dragBox);
  }
  __dragBox.innerHTML = name.join("<br>");
  __dragBox.style.display = "block";
}

function removeDragBox() {
  if (!__dragBox) return;
  __dragBox.style.display = "none";
  __dragBox.style.transform = "translate3d(-9999px,-9999px,0)";
}
// keep these at top-level so references are stable
function __onPointerMove(e) {
  if (!__dragState) return;
  __dragState.target.x = e.clientX + DRAG_BOX_OFFSET.x;
  __dragState.target.y = e.clientY + DRAG_BOX_OFFSET.y;
}

function __onPointerUp(e) {
  // use the global dragInsert / draggingSample / $x state
  try { commitSample(draggingSample, Math.floor($x), !!dragInsert); } catch (err) { console.warn("commitSample failed", err); }
  stopDrag();
}

function startDrag(items, ev, name, insert) {
  if (!items) return;
  dragInsert = !!insert;
  draggingSample = items;
  spawnDragBox(name);

  const startX = (ev && typeof ev.clientX === "number") ? ev.clientX : window.innerWidth / 2;
  const startY = (ev && typeof ev.clientY === "number") ? ev.clientY : window.innerHeight / 2;
  __dragState = {
    pos: { x: startX + DRAG_BOX_OFFSET.x, y: startY + DRAG_BOX_OFFSET.y },
    vel: { x: 0, y: 0 },
    target: { x: startX + DRAG_BOX_OFFSET.x, y: startY + DRAG_BOX_OFFSET.y },
    lastTs: performance.now()
  };

  // add listeners using named function refs (so they can be removed)
  document.addEventListener("pointermove", __onPointerMove, { passive: true });
  document.addEventListener("pointerup", __onPointerUp);

  if (__dragRAF) cancelAnimationFrame(__dragRAF);
  __dragRAF = requestAnimationFrame(__animateDrag);
}

function stopDrag() {
  // remove the handlers using the same references
  document.removeEventListener("pointermove", __onPointerMove, { passive: true });
  document.removeEventListener("pointerup", __onPointerUp);

  if (__dragRAF) {
    cancelAnimationFrame(__dragRAF);
    __dragRAF = null;
  }
  __dragState = null;
  removeDragBox();

  // DON'T try to remove per-button handlers by recreating anonymous functions here.
  // The renderUploads() call (which sets innerHTML) already removed old elements / handlers.
}


// physics animator (spring + damping)
function __animateDrag(ts) {
  if (!__dragState || !__dragBox) {
    __dragRAF = null;
    return;
  }
  let dt = (ts - __dragState.lastTs) / 1000;
  __dragState.lastTs = ts;
  if (dt <= 0) dt = 0.001;
  if (dt > PHYS_MAX_DT) dt = PHYS_MAX_DT; // clamp for stability

  // For both axes: acceleration = stiffness * (target - pos) - damping * vel
  const dx = __dragState.target.x - __dragState.pos.x;
  const dy = __dragState.target.y - __dragState.pos.y;

  const ax = PHYS_STIFFNESS * dx - PHYS_DAMPING * __dragState.vel.x;
  const ay = PHYS_STIFFNESS * dy - PHYS_DAMPING * __dragState.vel.y;

  // integrate velocity and position (semi-implicit Euler)
  __dragState.vel.x += ax * dt;
  __dragState.vel.y += ay * dt;
  __dragState.pos.x += __dragState.vel.x * dt;
  __dragState.pos.y += __dragState.vel.y * dt;

  // update DOM using translate3d for GPU acceleration
  const tx = Math.round(__dragState.pos.x);
  const ty = Math.round(__dragState.pos.y);
  __dragBox.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;

  // continue if draggingSample still exists
  if (draggingSample) {
    __dragRAF = requestAnimationFrame(__animateDrag);
  } else {
    // cleanup if draggingSample cleared elsewhere
    stopDrag();
  }
}
