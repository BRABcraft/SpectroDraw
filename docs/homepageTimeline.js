// homepageTimeline.js
(function(){
  // run after DOM ready so we can safely find footer / existing section
  function onceReady(fn){
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else fn();
  }

  onceReady(function(){
    /* ====== data list: add/remove/modify rows here ====== */
    const examples = [
      { id: 'bomb', title: 'Bomb SFX', img: 'assets/bomb.jpg', audio: 'assets/bomb.mp3', duration: 10 },
      { id: 'birds', title: 'Bird SFX', img: 'assets/bird.jpg', audio: 'assets/bird.mp3', duration: 10 },
      { id: 'mona', title: 'Mona Lisa', img: 'assets/monaLisa.jpg', audio: 'assets/monaLisa.mp3', duration: 10 },
      { id: 'pitchAlignDemo', title: 'Microtones', img: 'assets/pitchAlignDemo.jpg', audio: 'assets/pitchAlignDemo.mp3', duration: 10 },
    ];

    /* ====== find or create the section ====== */
    let section = document.querySelector('section[aria-labelledby="generate-heading"]');
    if (!section) {
      section = document.createElement('section');
      section.setAttribute('aria-labelledby', 'generate-heading');
      // insert before footer if available, else append to body
      const footer = document.querySelector('footer');
      if (footer && footer.parentNode) footer.parentNode.insertBefore(section, footer);
      else document.body.appendChild(section);
    } else {
      // clear existing content if any
      section.innerHTML = '';
    }
    section.className = 'examples-section';

    /* ====== required innerHTML (must include .examples-list) ====== */
    section.innerHTML = `
      <div class="container" style="display:flex;flex-direction:column;gap:1.25rem;">
        <div style="display:flex;gap:1rem;align-items:center;flex-direction:column">
          <div class="section-title">Spectral Workflows</div>
          <h3 id="generate-heading" class="section-head" style="text-align:center">What can SpectroDraw create?</h3>
          <p class="section-copy" style="text-align:center">With SpectroDraw, you can create any sound effect easily.</p>
          <div style="margin-top:.9rem">
            <a class="btn btn-primary" href="/app"><span>Start Generating</span></a>
          </div>
        </div>

        <div class="examples-list" role="list" style="margin-top:1rem;"></div>
      </div>
    `;

    /* ====== create rows inside .examples-list ====== */
    let listWrap = section.querySelector('.examples-list');
    if (!listWrap) {
      console.error('Failed to find .examples-list after injecting section HTML');
      return;
    }

    examples.forEach(item => {
      const row = document.createElement('div');
      row.className = 'example-row';
      row.dataset.audio = item.audio;
      if (item.duration) row.dataset.duration = item.duration;

      row.innerHTML = `
        <div class="example-left">
          <div class="example-title">${escapeHtml(item.title)}</div>
          <button class="play-btn" aria-label="Play ${escapeHtml(item.title)}">►</button>
        </div>

        <div class="example-right">
          <div class="image-wrap" role="button" tabindex="0" aria-label="${escapeHtml(item.title)} preview">
            <img src="${escapeAttr(item.img)}" alt="${escapeHtml(item.title)}">
            <div class="cursor-line" aria-hidden="true"></div>
          </div>

          <div class="timeline-wrap">
            <input class="scrub" type="range" min="0" max="100" value="0" aria-label="${escapeHtml(item.title)} timeline"/>
            <div class="time-labels"><span class="time-current">0:00</span><span class="time-total">0:00</span></div>
          </div>
        </div>
      `;
      listWrap.appendChild(row);
    });

    /* ====== playback wiring ====== */
    // REPLACES previous wirePlayback() implementation
    (function wirePlaybackSmooth(){
    function formatTime(seconds){
        if (!isFinite(seconds)) return '0:00';
        const s = Math.max(0, Math.floor(seconds));
        const m = Math.floor(s/60);
        const ss = String(s%60).padStart(2,'0');
        return `${m}:${ss}`;
    }

    const allAudios = new Set();

    // helper to get image width (track width) and update scrub max/step
    function ensureTrackConfig(row) {
        const imgWrap = row.querySelector('.image-wrap');
        const scrub = row.querySelector('.scrub');
        if (!imgWrap || !scrub) return 0;
        const width = Math.max(1, Math.round(imgWrap.clientWidth)); // px
        // set scrub to use pixel units for 1px precision
        scrub.min = 0;
        scrub.max = width;
        scrub.step = 1;
        return width;
    }

    // attach a resize observer for responsive layouts
    const ro = new ResizeObserver(entries => {
        entries.forEach(e => {
        const row = e.target.closest('.example-row');
        if (row) {
            ensureTrackConfig(row);
        }
        });
    });

    document.querySelectorAll('.example-row').forEach(row => {
        const scrub = row.querySelector('.scrub');
        const cursor = row.querySelector('.cursor-line');
        const playBtn = row.querySelector('.play-btn');
        const timeCurrent = row.querySelector('.time-current');
        const timeTotal = row.querySelector('.time-total');
        const imgWrap = row.querySelector('.image-wrap');

        const audioSrc = row.dataset.audio;
        const fallbackDuration = Number(row.dataset.duration) || 10;

        // create audio
        const audio = new Audio(audioSrc);
        audio.preload = 'metadata';
        audio.crossOrigin = 'anonymous';
        row._audio = audio;
        allAudios.add(audio);

        // set initial labels
        timeTotal.textContent = formatTime(fallbackDuration);
        timeCurrent.textContent = '0:00';

        // compute track width and configure scrub
        let trackWidth = ensureTrackConfig(row);
        if (imgWrap) ro.observe(imgWrap);

        // update cursor from pixel value (0..trackWidth)
        function updateCursorFromPx(px) {
        const clampedPx = Math.max(0, Math.min(trackWidth, px));
        // use subpixel positioning (no rounding) for smooth visuals
        cursor.style.left = clampedPx + 'px';
        const dur = audio.duration || fallbackDuration;
        const curSec = (trackWidth > 0) ? (clampedPx / trackWidth) * dur : 0;
        timeCurrent.textContent = formatTime(curSec);
        }

        // when metadata loads -> set real duration and initialize positions
        audio.addEventListener('loadedmetadata', () => {
        const dur = audio.duration || fallbackDuration;
        timeTotal.textContent = formatTime(dur);
        // ensure track width is fresh
        trackWidth = ensureTrackConfig(row);
        // init scrub value from audio.currentTime
        const initPx = (audio.currentTime / dur) * trackWidth || 0;
        scrub.value = Math.round(initPx);
        updateCursorFromPx(initPx);
        });

        // RAF loop for smooth updates while playing
        let rafId = null;
        function startRaf() {
        if (rafId) return;
        function frame() {
            if (!audio || audio.paused || isScrubbing) { rafId = null; return; }
            const dur = audio.duration || fallbackDuration;
            const pct = dur ? (audio.currentTime / dur) : 0;
            const px = pct * trackWidth;
            // update scrub and cursor with pixel precision
            scrub.value = Math.round(px);
            updateCursorFromPx(px);
            rafId = requestAnimationFrame(frame);
        }
        rafId = requestAnimationFrame(frame);
        }
        function stopRaf() {
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        }

        // pause other audios utility
        function pauseAllExcept(target) {
        allAudios.forEach(a => {
            if (a !== target) {
            try { a.pause(); } catch(e){}
            const otherRow = [...document.querySelectorAll('.example-row')].find(r => r._audio === a);
            if (otherRow) {
                const btn = otherRow.querySelector('.play-btn');
                btn && (btn.textContent = '►', btn.classList.remove('playing'));
            }
            }
        });
        }

        // update play button UI
        function updatePlayUI(isPlaying){
        if (isPlaying) { playBtn.classList.add('playing'); playBtn.textContent = '❚❚'; startRaf(); }
        else { playBtn.classList.remove('playing'); playBtn.textContent = '►'; stopRaf(); }
        }

        // play/pause handler
        playBtn.addEventListener('click', async () => {
        if (audio.paused) {
            pauseAllExcept(audio);
            try { await audio.play(); updatePlayUI(true); }
            catch(err){ console.error('play() failed:', err); updatePlayUI(false); }
        } else {
            audio.pause();
            updatePlayUI(false);
        }
        });

        // clicking image toggles
        imgWrap.addEventListener('click', () => { playBtn.click(); });
        imgWrap.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playBtn.click(); } });

        // Scrub interaction (pixel-precise)
        let isScrubbing = false;

        // ensure scrub max matches trackWidth on layout/resizes
        function refreshTrack() {
        trackWidth = ensureTrackConfig(row);
        }
        window.addEventListener('resize', refreshTrack);

        // input event: user is dragging — update cursor live but do not seek audio
        scrub.addEventListener('input', e => {
        isScrubbing = true;
        const px = Number(e.target.value);
        updateCursorFromPx(px);
        });

        // pointerdown (start drag)
        scrub.addEventListener('pointerdown', () => {
        isScrubbing = true;
        // for robust dragging keep pointer capture on the input
        try { scrub.setPointerCapture && scrub.setPointerCapture(event.pointerId); } catch(e){}
        // pause RAF to avoid fights; we'll resume on commit if needed
        stopRaf();
        });

        // commit on release: set audio.currentTime to new time and resume if was playing
        function commitScrub() {
        const px = Number(scrub.value);
        const dur = audio.duration || fallbackDuration;
        const newTime = (trackWidth > 0) ? (px / trackWidth) * dur : 0;
        const wasPlaying = !audio.paused;
        if (isFinite(audio.duration) && audio.duration > 0) {
            try { audio.currentTime = Math.min(newTime, audio.duration); }
            catch(e){ console.warn('seek failed:', e); }
        } else {
            const onLoaded = () => { audio.currentTime = Math.min(newTime, audio.duration || newTime); audio.removeEventListener('loadedmetadata', onLoaded); };
            audio.addEventListener('loadedmetadata', onLoaded);
        }
        updateCursorFromPx(px);
        isScrubbing = false;
        if (wasPlaying) {
            pauseAllExcept(audio);
            audio.play().then(()=> updatePlayUI(true)).catch(()=> updatePlayUI(false));
        }
        }

        scrub.addEventListener('pointerup', commitScrub);
        scrub.addEventListener('change', commitScrub); // keyboard commit
        scrub.addEventListener('mouseup', commitScrub);
        scrub.addEventListener('touchend', commitScrub);

        // When audio ends naturally
        audio.addEventListener('ended', () => {
        updatePlayUI(false);
        scrub.value = trackWidth;
        updateCursorFromPx(trackWidth);
        });

        // if audio is paused externally (e.g. another row started), keep UI consistent
        audio.addEventListener('pause', () => updatePlayUI(false));
        audio.addEventListener('play', () => updatePlayUI(true));
    });
    })();


  }); // onceReady

  /* ====== simple HTML-escape helpers for safety ====== */
  function escapeHtml(str){ return String(str).replace(/[&<>"']/g, s=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[s]); }
  function escapeAttr(s){ return String(s).replace(/"/g,'&quot;'); }

})();
