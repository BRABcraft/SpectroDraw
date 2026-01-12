(function() {
    const transitionTime = 820; 
    const testingTutorial = true;
    const steps = [{
            id: 'spectrogram',
            label: 'Welcome to SpectroDraw!',
            subtitle: 'Click & drag to draw (mouseup to finish)',
            target: '#canvas, #timeline, #logscale, #freq',
            dialog: "Welcome! This is the spectrogram. It’s a visual map of your\nsound. 👉 Click and drag your mouse across it to draw.",
            waitFor: {
                type: 'mouseup',
                selector: '#canvas'
            },
            showNext: false,
            preAction: null,
            mouseLoop: true,
            dialogOffset: { x: 600, y: 108 },
            dialogOffsetMob: { x: 10, y: 300 }
        },
        {
            id: 'playPause',
            label: 'Play / Pause',
            subtitle: 'Press Spacebar or click Play',
            target: '#playPause, #stop, #canvas, #timeline, #logscale, #freq',
            dialog: "Press Spacebar to play or pause your audio at any time. 🎵",
            waitFor: {
                type: 'complexPlayback',
            },
            showNext: false,
            preAction: null,
            mouseLoop: false,
            dialogOffset: { x: 208, y: 108 },
        },
        {
            id: 'addSound',
            label: 'Add audio / presets',
            subtitle: 'Upload a file or choose a preset',
            target: '#fileB, #presets, #rec, #canvas, #timeline, #logscale, #freq, #midiv',
            dialog: "Let’s add some sound! Upload an audio or video file, record\nwith your microphone, or pick one of the built-in presets.",
            waitFor: {
                type: 'renderCycle',
                varName: 'rendering'
            }, 
            showNext: false,
            preAction: null,
            mouseLoop: false,
            dialogOffset: { x: 258, y: 108 }
        },
        {
            id: 'tools',
            label: 'Tools: Rectangle, Line, Blur, Eraser, Amplify, Image',
            subtitle: 'Try one of the tools',
            target: '#colorBtn, #noiseRemoverBtn, #brushBtn, #rectBtn, #lineBtn, #blurBtn, #eraserBtn, #amplifierBtn, #imageBtn, #playPause, #stop, #canvas, #timeline, #logscale, #freq, #overlay, #d1',
            dialog: "Check out the different tools: Brush, rectangle, line, and\nImage Overlay (turns pictures into sound)! Try the different tool\neffects: Color, Blur, Eraser, Amplifier, and Noise Removal! 🖌️🎶",
            waitFor: {
                type: 'oneToolClickOrNext',
                selector: '.tool-btn'
            },
            showNext: true,
            preAction: null,
            mouseLoop: false,
            dialogOffset: { x: 358, y: 58 }
        },
        {
            id: 'brushSettings',
            label: 'Brush settings',
            subtitle: 'Try changing the brush settings',
            target: '#colorBtn, #noiseRemoverBtn, #brushBtn, #rectBtn, #lineBtn, #blurBtn, #eraserBtn, #amplifierBtn, #imageBtn, #playPause, #stop, #canvas, #timeline, #logscale, #freq, #overlay, #d1',
            dialog: "Try changing the brush settings while using tools like Brush, Image, Line, or Amplify to discover different effects! 🔍🎨",
            waitFor: {
                type: 'modifyBrush',
                selectors: ['#brushSettings, #canvas, #timeline, #logscale, #freq']
            },
            showNext: true,
            preAction: null,
            mouseLoop: false,
            dialogOffset: { x: 368, y: 500 }
        },
        {
            id: 'changeFFT',
            label: 'FFT parameters',
            subtitle: 'These control the quality of the spectrogram',
            target: '#fftParameters, #canvas, #timeline, #logscale, #freq',
            dialog: "Play around with the pitch and time resolution and see how they\nshape audio quality and phase (color).",
            waitFor: {
                type: 'awaitNext'
            }, 
            showNext: true,
            preAction: null,
            mouseLoop: false,
            dialogOffset: { x: 378, y: 128 }
        },
        {
            id: 'save',
            label: 'Download / Export',
            subtitle: 'Download Audio or Spectrogram',
            target: '#downloadWav, #downloadButton',
            dialog: "Ready to save? Click Download Audio or Download Spectrogram to export your work.",
            waitFor: {
                type: 'clickEither',
                selectors: ['#downloadWav', '#downloadButton']
            },
            showNext: false,
            preAction: null,
            mouseLoop: false,
            dialogOffset: { x: 718, y: 58 }
        },
        {
            id: 'midi',
            label: 'Export MIDI (piano)',
            subtitle: 'Open piano, export MIDI (pulsing export button)',
            target: '#pianoBtn, #exportMIDI, .left-panel',
            dialog: "Want to make music notation? Try exporting as a MIDI file (you can even turn it into sheet music later). 🎹",
            waitFor: {
                type: 'clickThenNext',
                clickSelector: '#exportMIDI'
            },
            showNext: true,
            preAction: function() {
                const piano = document.getElementById('pianoBtn');
                if (piano) piano.click(); 
            },
            mouseLoop: false,
            dialogOffset: { x: 308, y: 500 }
        },
        {
            id: 'equalizer',
            label: 'Equalizer',
            subtitle: 'Open EQ and tweak points',
            target: '#eqBtn, #eqCanvas, .left-panel',
            dialog: "Finally, open the Equalizer and tweak some points — hear how it\nchanges your sound in real time.",
            preAction: function() {
                const eq = document.getElementById('eqBtn');
                if (eq) eq.click();
            },
            waitFor: {
                type: 'eqCanvasClick',
            }, 
            showNext: true,
            mouseLoop: false,
            mouseLoopSelector: '#eqCanvas',
            dialogOffset: { x: 408, y: 308 }
        },
        {
            id: 'done',
            label: 'Done',
            subtitle: 'Finish the tutorial',
            target: '#resetButton',
            dialog: "That’s it! 🎉 You’ve completed the tutorial. Clicking this button\nresets the spectrogram to silence. Now go make something\namazing.",
            preAction: function() {
                const general = document.getElementById('settingsBtn');
                if (general) general.click();
            },
            waitFor: {
                type: 'none'
            },
            showNext: true,
            dialogOffset: { x: 708, y: 108 }
        }
    ];
    const dialog = document.getElementById('tutorialDialog');
    const tdTitle = document.getElementById('tdTitle');
    const tdText = document.getElementById('tdText');
    const tdActions = document.getElementById('tdActions');
    const skipAll = document.getElementById('tutorialSkip');
    let activeStepIndex = 0;
    let highlightEls = []; 
    let markerEls = []; 
    let spotlightOverlay = null; 
    let _spotlightMaskId = null; 
    let arrowEl = null;
    let pollers = [];
    let savedInlineStyles = new Map();
    function safeSetText(node, text) {
        if (!node) return;
        node.textContent = text;
    }
    function fadeInText(el, speed = 25) {
        if (!el) return;
        const text = el.textContent || '';
        el.innerHTML = '';
        const lines = text.split('\n');
        let totalIndex = 0; // cumulative index across all lines

        lines.forEach((line, lineIndex) => {
            const units = line.match(/(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\S|\s)/gu) || [];

            units.forEach((unit, unitIndex) => {
                const span = document.createElement('span');
                span.textContent = unit === ' ' ? '\u00A0' : unit;
                span.style.opacity = 0;
                span.style.display = 'inline-block';
                span.style.transition = 'opacity 0.3s ease';
                el.appendChild(span);

                // Delay based on total number of previous characters
                const delay = (totalIndex + unitIndex) * speed;
                setTimeout(() => {
                    span.style.opacity = 1;
                }, delay);
            });

            totalIndex += units.length;

            if (lineIndex < lines.length - 1) {
                el.appendChild(document.createElement('br'));
                // also add a small pause between lines if you want
                totalIndex += 5; // optional extra delay before next line starts
            }
        });
    }
    function openStep(index) {
        if (!playingTutorial) return;
        try {
            if (typeof index !== 'number' || index < 0 || index >= steps.length) index = 0;
            restoreHighlight();
            activeStepIndex = index;
            const s = steps[index];
            if (!s) return;
            document.querySelectorAll('.tutorial-step-btn').forEach(b => b.classList.remove('active'));
            safeSetText(tdTitle, s.label);
            safeSetText(tdText, s.dialog);
            if (tdActions) tdActions.innerHTML = '';
            if (index != steps.length - 1) {
                const skipBtn = document.createElement('button');
                skipBtn.textContent = 'Skip tutorial';
                skipBtn.addEventListener('click', finishTutorial);
                if (tdActions) tdActions.appendChild(skipBtn);
            }
            if (s.showNext) {
                const nextBtn = document.createElement('button');
                nextBtn.className = 'primary';
                nextBtn.textContent = (index === steps.length - 1) ? 'Finish' : 'Next';
                if (s.id === 'tools' || s.id === 'midi' || s.id === 'equalizer' || s.id === 'brushSettings') {
                    nextBtn.disabled = true;
                    nextBtn.classList.add('disabled');
                }
                nextBtn.addEventListener('click', () => {
                    if (index === steps.length - 1) {
                        finishTutorial();
                    } else {
                        finishStepAndAdvance();
                    }
                });
                if (tdActions) tdActions.appendChild(nextBtn);
                s._nextBtn = nextBtn;
            }
            if (dialog) {
                dialog.classList.remove('hide');
                dialog.classList.add('show');
                setTimeout(() => {
                    fadeInText(tdText, 25); 
                }, 60);
                dialog.style.transform = 'translateY(8px)';
                setTimeout(() => {
                    dialog.style.transform = 'translateY(0)';
                }, 1);
            }
            setTimeout(() => {
                try {
                    setupHighlightFor(s);
                    if (typeof s.preAction === 'function') {
                    try { s.preAction(); } catch (e) { console.warn('preAction error', e); }
                    if (highlightEls && highlightEls.length) {
                        updateSpotlightMask(highlightEls);
                    } else {
                        setupHighlightFor(s);
                    }
                    }
                    try { positionDialogForStep(s); } catch (e) {}
                    startWaitingFor(s);
                } catch (e) {
                    console.warn('openStep inner error', e);
                }
            }, 180);
        } catch (err) {
            console.error('openStep error', err);
        }
    }
    function positionDialogForStep(step) {
        if (!dialog) return;
        dialog.style.position = 'fixed';
        dialog.style.zIndex = '100001';
        dialog.style.maxWidth = '420px';
        const off = (window.innerWidth<=700) ? step.dialogOffsetMob : step.dialogOffset;
        dialog.style.right = '';
        dialog.style.bottom = '';
        dialog.style.left = `${off.x}px`;
        dialog.style.top  = `${off.y}px`;
    }
    function setupHighlightFor(step) {
        restoreHighlight();
        if (!step) return;
        const sel = step.target;
        if (!sel) {
            return;
        }
        const targets = [];
        try {
            const all = document.querySelectorAll(sel);
            all.forEach(n => targets.push(n));
            const uniqTargets = Array.from(new Set(targets));
            if (!uniqTargets.length) return;
            highlightEls = uniqTargets.slice();
            createOrUpdateSpotlight(highlightEls, step);
            uniqTargets.forEach(targetEl => {
                savedInlineStyles.set(targetEl, {
                    position: targetEl.style.position || '',
                    boxShadow: targetEl.style.boxShadow || '',
                    outline: targetEl.style.outline || ''
                });
                if (step.pulseOutline) {
                    targetEl.classList.add('tutorial-pulse-outline');
                    const mk = document.createElement('div');
                    mk.className = 'tutorial-target-marker';
                    mk.style.position = 'fixed';
                    mk.style.pointerEvents = 'none';
                    mk.style.borderRadius = '8px';
                    mk.style.boxSizing = 'border-box';
                    mk.style.border = '2px solid rgba(255,255,255,0.06)';
                    mk.style.boxShadow = '0 20px 50px rgba(0,0,0,0.6)';
                    mk.style.transition = 'left 160ms ease, top 160ms ease, width 160ms ease, height 160ms ease';
                    document.body.appendChild(mk);
                    markerEls.push(mk);
                    positionMarkerOver(targetEl, mk);
                }
            });
            const reposition = () => {
                try {
                    updateSpotlightMask(highlightEls);
                    highlightEls.forEach((el, i) => {
                        if (markerEls[i]) positionMarkerOver(el, markerEls[i]);
                    });
                    if (step._arrowEl && highlightEls[0]) {
                        positionArrowToTarget(step._arrowEl, highlightEls[0]);
                    }
                    try { positionDialogForStep(step); } catch (e) {}
                } catch (e) {}
            };
            window.addEventListener('resize', reposition);
            window.addEventListener('scroll', reposition, true);
            step._reposition = reposition;
            if (step.id === 'addSound') {
                document.querySelector('#fileB').classList.add('tutorial-pulse-glow');
                document.querySelector('#presets').classList.add('tutorial-pulse-glow');
                document.querySelector('#rec').classList.add('tutorial-pulse-glow');
            } else if (step.id === 'midi') {
                document.querySelector('#exportMIDI').classList.add('tutorial-pulse-glow');
            } else if (step.id === 'playPause') {
                document.querySelector('#playPause').classList.add('tutorial-pulse-glow');
                document.querySelector('#stop').classList.add('tutorial-pulse-glow');
            } else if (step.id === 'done') {
                document.querySelector('#resetButton').classList.add('tutorial-pulse-glow');
            } else if (step.id === 'changeFFT') {
                document.querySelector('#fftSize').classList.add('tutorial-pulse-glow');
                document.querySelector('#hopSize').classList.add('tutorial-pulse-glow');
            }
        } catch (e) {
            console.warn('setupHighlightFor error', e);
        }
    }
    function createOrUpdateSpotlight(targetEls, step) {
        if (!_spotlightMaskId) {
            _spotlightMaskId = 'tutorial-spotlight-mask-' + Math.floor(Math.random() * 1e9);
        }
        if (!spotlightOverlay) {
            const ns = "http://www.w3.org/2000/svg";
            const svg = document.createElementNS(ns, 'svg');
            svg.classList.add('tutorial-spotlight'); 
            svg.setAttribute('width', '100%');
            svg.setAttribute('height', '100%');
            svg.setAttribute('viewBox', '0 0 ' + window.innerWidth + ' ' + window.innerHeight);
            svg.style.position = 'fixed';
            svg.style.left = '0';
            svg.style.top = '0';
            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.pointerEvents = 'none';
            svg.style.zIndex = '99990'; 
            svg.style.touchAction = 'none';
            svg.setAttribute('aria-hidden', 'true');
            const defs = document.createElementNS(ns, 'defs');
            const mask = document.createElementNS(ns, 'mask');
            mask.setAttribute('id', _spotlightMaskId);
            const baseRect = document.createElementNS(ns, 'rect');
            baseRect.setAttribute('x', '0');
            baseRect.setAttribute('y', '0');
            baseRect.setAttribute('width', '100%');
            baseRect.setAttribute('height', '100%');
            baseRect.setAttribute('fill', 'white'); 
            mask.appendChild(baseRect);
            defs.appendChild(mask);
            svg.appendChild(defs);
            const overlayRect = document.createElementNS(ns, 'rect');
            overlayRect.setAttribute('x', '0');
            overlayRect.setAttribute('y', '0');
            overlayRect.setAttribute('width', '100%');
            overlayRect.setAttribute('height', '100%');
            overlayRect.setAttribute('fill', 'rgba(0,0,0,0.8)');
            overlayRect.setAttribute('mask', `url(#${_spotlightMaskId})`);
            svg.appendChild(overlayRect);
            document.body.appendChild(svg);
            spotlightOverlay = svg;
        }
        updateSpotlightMask(targetEls);
    }
    window.addEventListener('resize', function() {
        if (spotlightOverlay) {
            spotlightOverlay.setAttribute(
                'viewBox',
                '0 0 ' + window.innerWidth + ' ' + window.innerHeight
            );
        }
        if (highlightEls && highlightEls.length) {
            updateSpotlightMask(highlightEls);
        }
    });
    function _getMaskAndOverlay() {
        if (!spotlightOverlay) return {};
        const mask = spotlightOverlay.querySelector('mask#' + _spotlightMaskId);
        const overlayRect = spotlightOverlay.querySelector('rect[mask]'); 
        return { mask, overlayRect };
    }
    function updateSpotlightMask(targetEls, { animate = true } = {}) {
        if (!spotlightOverlay) return;
        const ns = "http://www.w3.org/2000/svg";
        const { mask } = _getMaskAndOverlay();
        if (!mask) return;
        const base = mask.children[0];
        if (!base) return;
        const newKeys = new Set();
        const newHoleDefs = [];
        targetEls.forEach(el => {
            try {
                const r = el.getBoundingClientRect();
                if (r.width <= 0 || r.height <= 0) return;
                const pad = 8;
                const x = Math.max(0, Math.floor(r.left) - pad);
                const y = Math.max(0, Math.floor(r.top) - pad);
                const w = Math.floor(r.width) + pad * 2;
                const h = Math.floor(r.height) + pad * 2;
                const key = `${x}:${y}:${w}:${h}`;
                newKeys.add(key);
                newHoleDefs.push({ key, x, y, w, h });
            } catch (e) {
                console.warn('spotlight: getBoundingClientRect failed', e);
            }
        });
        const existing = Array.from(mask.querySelectorAll('rect.tutorial-hole'));
        const existingMap = new Map();
        existing.forEach(node => {
            const k = node.getAttribute('data-hole-key');
            if (k) existingMap.set(k, node);
        });
        existingMap.forEach((node, key) => {
            if (!newKeys.has(key)) {
                try {
                    node.style.transition = `fill-opacity ${transitionTime}ms ease`;
                    node.setAttribute('fill-opacity', '0');
                    setTimeout(() => {
                        try { node.remove(); } catch (e) {}
                    }, transitionTime + 40);
                    // console.log('removed', node)
                } catch (e) {
                    console.warn('spotlight: failed removing old hole', e);
                }
            }
        });
        newHoleDefs.forEach(def => {
            const { key, x, y, w, h } = def;
            try {
                const hole = document.createElementNS(ns, 'rect');
                hole.classList.add('tutorial-hole');
                hole.setAttribute('data-hole-key', key);
                hole.setAttribute('x', x);
                hole.setAttribute('y', y);
                hole.setAttribute('width', w);
                hole.setAttribute('height', h);
                hole.setAttribute('rx', '8');
                hole.setAttribute('ry', '8');
                hole.setAttribute('fill', 'black');
                hole.setAttribute('fill-opacity', '0');
                hole.style.transition = `fill-opacity ${transitionTime}ms ease`;
                mask.appendChild(hole);
                requestAnimationFrame(() => {
                    try { hole.setAttribute('fill-opacity', '1'); } catch (e) {}
                });
            } catch (e) {
                console.warn('spotlight: failed creating hole', e);
            }
        });
    }
    function positionMarkerOver(el, marker) {
        if (!marker || !el || !el.getBoundingClientRect) return;
        const r = el.getBoundingClientRect();
        marker.style.left = Math.max(8, r.left - 8) + 'px';
        marker.style.top = Math.max(8, r.top - 8) + 'px';
        marker.style.width = (r.width + 16) + 'px';
        marker.style.height = (r.height + 16) + 'px';
    }
    function positionArrowToTarget(arrow, targetEl) {
        if (!arrow || !targetEl) return;
        const t = targetEl.getBoundingClientRect();
        const a = arrow.parentElement?.getBoundingClientRect ? arrow.parentElement.getBoundingClientRect() : {
            left: 0,
            top: 0,
            width: 0,
            height: 0
        };
        const fromX = a.left + a.width / 2;
        const fromY = a.top + a.height / 2;
        const toX = t.left + t.width / 2;
        const toY = t.top + t.height / 2;
        const angle = Math.atan2(toY - fromY, toX - fromX) * 180 / Math.PI;
        arrow.style.transform = `translate(0px, -50%) rotate(${angle}deg)`;
        const dx = toX - fromX;
        const dy = toY - fromY;
        const dist = Math.min(Math.hypot(dx, dy), 420);
        const shift = Math.min(90, dist / 3 + 20);
        arrow.style.right = -(shift + 36) + 'px';
        arrow.style.top = '50%';
    }
    function restoreHighlight() {
        if (highlightEls && highlightEls.length) {
            highlightEls.forEach(el => {
                const saved = savedInlineStyles.get(el);
                if (saved) {
                    try {
                        el.style.position = saved.position;
                        el.style.boxShadow = saved.boxShadow;
                        el.style.outline = saved.outline;
                    } catch (e) {}
                }
                try { el.classList.remove('tutorial-pulse-outline'); } catch (e) {}
                savedInlineStyles.delete(el);
            });
            highlightEls = [];
        }
        if (markerEls && markerEls.length) {
            markerEls.forEach(m => { try { m.remove(); } catch (e) {} });
            markerEls = [];
        }
        if (spotlightOverlay) {
            try { updateSpotlightMask([]); } catch (e) {}
        }
        document.querySelectorAll(
            '#fileB, #presets, #rec, #exportMIDI, #playPause, #stop, #resetButton, #fftSize, #hopSize'
        ).forEach(el => el.classList.remove('tutorial-pulse-glow'));
        steps.forEach(s => {
            if (s._reposition) {
                window.removeEventListener('resize', s._reposition);
                window.removeEventListener('scroll', s._reposition, true);
                delete s._reposition;
            }
        });
    }
    function clearPollers() {
        pollers.forEach(p => {
            try {
                if (p.type === 'interval') {
                    clearInterval(p.id);
                } else if (p.type === 'event') {
                    const {
                        node,
                        ev,
                        fn
                    } = p;
                    if (node && ev && fn) node.removeEventListener(ev, fn);
                } else if (p.type === 'timeout') {
                    clearTimeout(p.id);
                } else if (p.type === 'cleanup') {
                    try {
                        if (typeof p.fn === 'function') p.fn();
                    } catch (e) {}
                }
            } catch (e) {}
        });
        pollers = [];
    }
    function startWaitingFor(step) {
        clearPollers();
        if (!step) return;
        const w = step.waitFor || {
            type: 'none'
        };
        const attachMouseFade = (el, animEl) => {
            if (!el || !animEl) return;
            const onMove = () => animEl.style.opacity = '0.15';
            const onLeave = () => animEl.style.opacity = '0.95';
            el.addEventListener('mousemove', onMove, {
                once: true
            });
            setTimeout(() => {
                el.removeEventListener('mousemove', onMove);
            }, 900);
        };
        let mouseLoopEl = null;
        if (step.mouseLoop) {
            const loopTarget = step.mouseLoopSelector 
                ? document.querySelector(step.mouseLoopSelector) 
                : document.querySelector(step.target);
            if (loopTarget) {
                mouseLoopEl = document.createElement('div');
                mouseLoopEl.style.position = 'absolute';
                mouseLoopEl.id = 'mouseloop';
                mouseLoopEl.style.pointerEvents = 'auto';
                mouseLoopEl.style.cursor = 'crosshair';
                mouseLoopEl.style.zIndex = 1000000;
                let mlLeft = 600, mlTop = 250;
                mouseLoopEl.innerHTML = `
                    <img src="mouseloop.gif" width="500" height="500"
                    style="opacity:1; filter: drop-shadow(0 6px 14px rgba(0,0,0,0.6));
                        position:fixed; left:${mlLeft}px; top:${mlTop}px" />`;
                document.body.appendChild(mouseLoopEl);
                mouseLoopEl.style.transition = 'opacity 0.8s ease';
                const fadeHandler = (e) => {
                    mouseLoopEl.style.pointerEvents = 'none';
                    canvasMouseDown(e, false);
                    setTimeout(() => {
                        mouseLoopEl.style.opacity = '0';
                        setTimeout(() => mouseLoopEl.remove(), 800);
                    }, 3000); 
                };
                mouseLoopEl.addEventListener('pointerdown', (e) => fadeHandler(e), { once: true });
                pollers.push({
                    type: 'event',
                    node: loopTarget,
                    ev: 'pointermove',
                    fn: (e) => {
                    }
                });
            }
        }
        if (w.type === 'mouseup' && w.selector) {
            const node = document.querySelector(w.selector);
            if (node) {
                const fn = () => {
                    stepCompleted(step);
                };
                node.addEventListener('pointerup', fn, {
                    once: true
                });
                pollers.push({
                    type: 'event',
                    node,
                    ev: 'pointerup',
                    fn
                });
            } else {
                const fallback = document.getElementById('canvas');
                if (fallback) {
                    const fn = () => stepCompleted(step);
                    fallback.addEventListener('pointerup', fn, {
                        once: true
                    });
                    pollers.push({
                        type: 'event',
                        node: fallback,
                        ev: 'pointerup',
                        fn
                    });
                } else {
                    const tid = setTimeout(() => stepCompleted(step), 900);
                    pollers.push({
                        type: 'interval',
                        id: tid
                    });
                }
            }
            return;
        }
        if (w.type === 'complexPlayback') {
            const id = setInterval(() => {
                try {
                    if (typeof playing !== 'undefined' &&
                        typeof currentCursorX !== 'undefined' &&
                        typeof specWidth !== 'undefined') {
                        if (playing && (currentCursorX > (specWidth * 0.9))) {
                            clearInterval(id);
                            stepCompleted(step);
                        }
                    }
                } catch (e) {
                }
            }, transitionTime + 40);
            pollers.push({ type: 'interval', id });
            return;
        }
        if (w.type === 'renderCycle') {
            const varNames = ['rendering', 'recording'];
            const sawTrue = {};
            varNames.forEach(name => sawTrue[name] = false);
            const id = setInterval(() => {
                try {
                    for (const name of varNames) {
                        const val = (name === 'rendering')?rendering : recording;
                        if (!sawTrue[name] && val === true) {
                            sawTrue[name] = true;
                        }
                        if (sawTrue[name] && val === false) {
                            clearInterval(id);
                            stepCompleted(step);
                            return;
                        }
                    }
                } catch (e) {}
            }, transitionTime);
            pollers.push({ type: 'interval', id });
            (function() {
                const file = document.querySelector('#file');
                const presets = document.querySelector('#presets');
                if (file) {
                    const fn = () => {
                        clearInterval(id);
                        stepCompleted(step);
                    };
                    file.addEventListener('change', fn, { once: true });
                    pollers.push({ type: 'event', node: file, ev: 'change', fn });
                }
                if (presets) {
                    const fn2 = () => {
                        clearInterval(id);
                        stepCompleted(step);
                    };
                    presets.addEventListener('change', fn2, { once: true });
                    pollers.push({ type: 'event', node: presets, ev: 'change', fn: fn2 });
                }
            })();
            return;
        }
        if (w.type === 'oneToolClickOrNext') {
            const nodes = document.querySelectorAll(w.selector);
            if (nodes && nodes.length) {
                const fn = () => {
                    if (step._nextBtn) {
                        step._nextBtn.disabled = false;
                        step._nextBtn.classList.remove('disabled');
                    }
                };
                nodes.forEach(n => n.addEventListener('click', fn, { once: true }));
                pollers.push({ type: 'event', node: document, ev: 'click', fn });
            }
            return;
        }
        if (w.type === 'modifyBrush') {
            const container = document.querySelector('#brushSettings');
            if (container && step._nextBtn) {
                const inputs = container.querySelectorAll('input, select, textarea, button');
                const fn = () => {
                    step._nextBtn.disabled = false;
                    step._nextBtn.classList.remove('disabled');
                };
                inputs.forEach(input => {
                    input.addEventListener('input', fn, { once: true });
                    input.addEventListener('change', fn, { once: true });
                    pollers.push({ type: 'event', node: input, ev: 'input', fn });
                    pollers.push({ type: 'event', node: input, ev: 'change', fn });
                });
            }
            return;
        }
        if (w.type === 'awaitNext') {
            if (step._nextBtn) {
                step._nextBtn.disabled = false;
                step._nextBtn.classList.remove('disabled');
            }
            return;
        }
        if (w.type === 'clickEither') {
            const selectors = w.selectors || [];
            let attached = false;
            selectors.forEach(sel => {
                const node = document.querySelector(sel);
                if (node) {
                    const fn = () => stepCompleted(step);
                    node.addEventListener('click', fn, {
                        once: true
                    });
                    pollers.push({
                        type: 'event',
                        node,
                        ev: 'click',
                        fn
                    });
                    attached = true;
                }
            });
            if (!attached) {
                setTimeout(() => stepCompleted(step), 1600);
            }
            return;
        }
        if (w.type === 'clickThenNext') {
            const node = document.querySelector(w.clickSelector);
            if (node) {
                const fn = () => {
                    step._clicked = true;
                    if (step._nextBtn) {
                        step._nextBtn.disabled = false;
                        step._nextBtn.classList.remove('disabled');
                    }
                };
                node.addEventListener('click', fn, { once: true });
                pollers.push({ type: 'event', node, ev: 'click', fn });
            }
            return;
        }
        if (w.type === 'eqCanvasClick') {
            const node = document.querySelector('#eqCanvas');
            if (node) {
                const fn = () => {
                    if (step._nextBtn) {
                        step._nextBtn.disabled = false;
                        step._nextBtn.classList.remove('disabled');
                    }
                };
                node.addEventListener('click', fn, { once: true });
                pollers.push({ type: 'event', node, ev: 'click', fn });
            }
            return;
        }
        setTimeout(() => stepCompleted(step), 900);
    }
    function _waitForDialogHidden(timeout = 520) {
        return new Promise(resolve => {
            if (!dialog) return resolve();
            const cs = getComputedStyle(dialog);
            if (cs.opacity === '0' || cs.display === 'none' || dialog.classList.contains('hide')) {
                return setTimeout(resolve, 8);
            }
            let resolved = false;
            const cleanup = () => {
                if (resolved) return;
                resolved = true;
                dialog.removeEventListener('transitionend', onTrans);
                dialog.removeEventListener('animationend', onAnim);
                clearTimeout(tid);
                resolve();
            };
            function onTrans(ev) {
                if (ev.propertyName && ev.propertyName.toLowerCase().includes('opacity')) cleanup();
            }
            function onAnim(ev) {
                cleanup();
            }
            dialog.addEventListener('transitionend', onTrans);
            dialog.addEventListener('animationend', onAnim);
            const tid = setTimeout(cleanup, timeout);
        });
    }
    async function stepCompleted(step) {
        dialog.classList.remove('show');
        dialog.classList.add('hide');
        restoreHighlight();
        clearPollers();
        const nextIndex = Math.min(steps.indexOf(step) + 1, steps.length - 1);
        const waitType = step.waitFor?.type || 'none';
        if (step.showNext && (waitType === 'clickThenNext' || waitType === 'awaitNext')) {
            dialog.classList.remove('hide');
            dialog.classList.add('show');
            return;
        }
        if (step.id === 'done') {
            dialog.classList.remove('hide');
            dialog.classList.add('show');
            return;
        }
        await _waitForDialogHidden();
        try {
            const nextStep = steps[nextIndex];
            if (nextStep) positionDialogForStep(nextStep);
        } catch (e) {}
        openStep(nextIndex);
    }
    function finishStepAndAdvance() {
        const s = steps[activeStepIndex];
        if (s.waitFor && s.waitFor.type === 'clickThenNext' && !s._clicked) {
            dialog.animate([
                { transform: 'translateX(0)' },
                { transform: 'translateX(-8px)' },
                { transform: 'translateX(8px)' },
                { transform: 'translateX(0)' }
            ], { duration: 240 });
            return;
        }
        dialog.classList.remove('show');
        dialog.classList.add('hide');
        restoreHighlight();
        clearPollers();
        const nextIndex = Math.min(activeStepIndex + 1, steps.length - 1);
        _waitForDialogHidden().then(() => {
            try {
                const nextStep = steps[nextIndex];
                if (nextStep) positionDialogForStep(nextStep);
            } catch (e) {}
            openStep(nextIndex);
        });
    }
    function finishTutorial() {
        playingTutorial = false;
        restoreHighlight();
        clearPollers();
        localStorage.setItem('tutorialSeen', 'true');
        const tutorialDialog = document.getElementById('tutorialDialog');
        const tutorialSpotlight = document.querySelector('.tutorial-spotlight');
        const mouseLoop = document.getElementById('mouseloop');
        if (tutorialSpotlight) {
            try { tutorialSpotlight.remove(); } catch (e) {}
            spotlightOverlay = null;
        }
        if (mouseLoop) mouseLoop.style.display = 'none';
        if (tutorialDialog) tutorialDialog.style.display = 'none';
        try {
            setTimeout(() => {
                try {
                    showReplayTutorialBox();
                } catch (e) {}
            }, 3000);
        } catch (e) { console.warn('delayed replay show failed', e); }
    }
    document.addEventListener('DOMContentLoaded', () => {
        const seen = localStorage.getItem('tutorialSeen') && !testingTutorial;
        if (!seen) {
            playingTutorial = true;
            brushBrightnessEl.value=50;brushBrightnessInput.value=50;brushBrightness=50;
            openStep(0);
        } else {
            document.getElementById('tutorialDialog').style.display = 'none';
            let ts = document.querySelector('.tutorial-spotlight'); if (ts) ts.style.display = 'none';
            ts = document.getElementById('mouseloop'); if (ts) ts.style.display = 'none';
        }
    });
    function showReplayTutorialBox() {
        try {
            if (localStorage.getItem('tutorialReplayHidden') === 'true' && !testingTutorial) return;
            if (document.getElementById('replayTutorialBox')) return;
            const box = document.createElement('div');
            box.id = 'replayTutorialBox';
            box.style.position = 'fixed';
            box.style.top = '5px';
            box.style.right = '20px';
            box.style.zIndex = '100005';
            box.style.display = 'flex';
            box.style.alignItems = 'center';
            box.style.gap = '8px';
            box.style.padding = '8px 10px';
            box.style.borderRadius = '10px';
            box.style.boxShadow = '0 10px 30px rgba(0,0,0,0.35)';
            box.style.background = 'rgba(22,22,22,0.95)';
            box.style.color = '#fff';
            box.style.fontSize = '13px';
            box.style.opacity = '0';
            box.style.transform = 'translateY(8px)';
            box.style.transition = 'opacity 420ms ease, transform 420ms ease';
            box.style.pointerEvents = 'auto';
            box.setAttribute('role', 'dialog');
            box.setAttribute('aria-label', 'Replay tutorial');
            const btn = document.createElement('button');
            btn.id = 'replayTutorialBtn';
            btn.type = 'button';
            btn.textContent = 'Replay tutorial';
            btn.style.border = 'none';
            btn.style.padding = '6px 10px';
            btn.style.borderRadius = '8px';
            btn.style.cursor = 'pointer';
            btn.style.fontSize = '13px';
            btn.style.background = 'var(--accent-gradient)';
            btn.style.color = '#000';
            btn.style.boxShadow = '0 6px 18px rgba(31,142,241,0.15)';
            btn.onfocus = () => btn.style.outline = '2px solid rgba(255,255,255,0.12)';
            btn.onblur = () => btn.style.outline = 'none';
            const close = document.createElement('button');
            close.id = 'replayTutorialClose';
            close.type = 'button';
            close.innerHTML = '&times;';
            close.title = "Don't show again";
            close.setAttribute('aria-label', "Don't show this again");
            close.style.border = 'none';
            close.style.background = 'transparent';
            close.style.color = 'rgba(255,255,255,0.9)';
            close.style.fontSize = '16px';
            close.style.cursor = 'pointer';
            close.style.padding = '4px';
            close.style.marginLeft = '2px';
            box.appendChild(btn);
            box.appendChild(close);
            document.body.appendChild(box);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    box.style.opacity = '1';
                    box.style.transform = 'translateY(0)';
                });
            });
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                try {
                    box.style.opacity = '0';
                    box.style.transform = 'translateY(8px)';
                    setTimeout(() => { try { box.remove(); } catch (e) {} }, 420);
                    playingTutorial = true;
                    try { openStep(0); document.getElementById("tutorialDialog").style.display = '';} catch (err) { console.warn('openStep failed', err); }
                } catch (err) {
                    console.warn('replay click error', err);
                }
            });
            close.addEventListener('click', (e) => {
                e.preventDefault();
                try {
                    localStorage.setItem('tutorialReplayHidden', 'true');
                    box.style.opacity = '0';
                    box.style.transform = 'translateY(8px)';
                    setTimeout(() => { try { box.remove(); } catch (e) {} }, 420);
                } catch (err) {
                    console.warn('replay close error', err);
                }
            });
        } catch (err) {
            console.warn('showReplayTutorialBox error', err);
        }
    }
    window.showAppTutorial = function() {
        localStorage.removeItem('tutorialSeen');
        const existing = document.getElementById('replayTutorialBox');
        if (existing) {
            try { existing.remove(); } catch (e) {}
        }
        openStep(0);
    };
    (function setupImageToolMouseLoopHint() {
        try {
            const STORAGE_KEY = 'imageMouseLoopShown';
            let lastMousePos = { x: -1, y: -1 };
            let hoverTimerId = null;
            let checkerIntervalId = null;
            let createdMouseLoop = false;
            const updateMousePos = (ev) => {
                lastMousePos.x = ev.clientX;
                lastMousePos.y = ev.clientY;
            };
            window.addEventListener('mousemove', updateMousePos, { passive: true });
            window.addEventListener('pointermove', updateMousePos, { passive: true });
            function isMouseOverCanvas() {
                try {
                    const canvasEl = document.getElementById('canvas');
                    if (!canvasEl) return false;
                    if (lastMousePos.x < 0) return false;
                    const r = canvasEl.getBoundingClientRect();
                    return lastMousePos.x >= r.left && lastMousePos.x <= r.right &&
                        lastMousePos.y >= r.top  && lastMousePos.y <= r.bottom;
                } catch (e) { return false; }
            }
            function clearHoverTimer() {
                if (hoverTimerId) {
                    clearTimeout(hoverTimerId);
                    hoverTimerId = null;
                }
            }
            function tryCreateMouseLoop(evLike) {
                if (createdMouseLoop) return;
                let mouseLoopEl = document.createElement('div');
                createdMouseLoop = true;
                try { localStorage.setItem(STORAGE_KEY, 'true'); } catch (e) {}
                const canvasEl = document.getElementById('canvas');
                const ml = document.createElement('div');
                ml.id = 'mouseloop';
                ml.style.position = 'fixed';
                ml.style.pointerEvents = 'auto';
                ml.style.cursor = 'crosshair';
                ml.style.zIndex = 1000000;
                ml.style.transition = 'opacity 1.8s ease';
                ml.style.opacity = '1';
                let mlLeft = 900, mlTop = 400;
                try {
                    if (canvasEl) {
                        const r = canvasEl.getBoundingClientRect();
                        mlLeft = Math.max(8, Math.floor(r.left + (r.width / 2) - 150));
                        mlTop  = Math.max(8, Math.floor(r.top + (r.height / 2) - 150));
                    }
                } catch (e) {}
                ml.innerHTML = `
                    <img src="click.gif" width="300" height="300"
                        style="opacity:1; filter: drop-shadow(0 6px 14px rgba(0,0,0,0.6));
                        position:fixed; left:${mlLeft}px; top:${mlTop}px" />`;
                document.body.appendChild(ml);
                const fadeHandler = (ev) => {
                    try {
                        ml.style.pointerEvents = 'none';
                        try { canvasMouseDown(ev, false); } catch (err) {  }
                    } catch (e) {}
                    setTimeout(() => {
                        ml.style.opacity = '0';
                        setTimeout(() => { try { ml.remove(); } catch (e) {} }, 800);
                    }, 3000);
                };
                ml.addEventListener('pointerdown', (ev) => fadeHandler(ev), { once: true });
                const removeOnTutorialStart = () => { try { if (ml.parentElement) ml.remove(); } catch(e){} };
                window.addEventListener('tutorialStartRemoveMouseloop', removeOnTutorialStart, { once: true });
            }
            const storageSaysShown = () => {
                try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch (e) { return false; }
            };
            checkerIntervalId = window.setInterval(() => {
                try {
                    if (createdMouseLoop) return;
                    if (typeof playingTutorial !== 'undefined' && playingTutorial && !testingTutorial) return;
                    if (storageSaysShown() && !testingTutorial) {
                        createdMouseLoop = true;
                        return;
                    }
                    if (typeof currentTool === 'undefined' || currentTool !== 'image' || !isMouseOverCanvas()) {
                        clearHoverTimer();
                        return;
                    }
                    if (!hoverTimerId) {
                        hoverTimerId = setTimeout(() => {
                            tryCreateMouseLoop({ clientX: lastMousePos.x, clientY: lastMousePos.y });
                            hoverTimerId = null;
                        }, testingTutorial ? 100 : 10000); 
                    }
                } catch (e) {
                    console.warn('image mouseloop checker error', e);
                }
            }, 50);
            window.addEventListener('beforeunload', () => {
                try { clearHoverTimer(); clearInterval(checkerIntervalId); } catch (e) {}
            });
            const tutorialWatcher = setInterval(() => {
                try {
                    if ((typeof playingTutorial !== 'undefined') && playingTutorial) {
                        window.dispatchEvent(new Event('tutorialStartRemoveMouseloop'));
                    }
                } catch (e) {}
            }, 800);
            const stopWatcherIfDone = setInterval(() => {
                if (createdMouseLoop) {
                    clearInterval(tutorialWatcher);
                    clearInterval(stopWatcherIfDone);
                }
            }, 1000);
        } catch (err) {
            console.warn('setupImageToolMouseLoopHint failed', err);
        }
    })();
})();