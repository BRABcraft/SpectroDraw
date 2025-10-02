(function() {
    // ------- Steps definition (follow exact actions you gave) -------
    const steps = [{
            id: 'spectrogram',
            label: 'Spectrogram: draw',
            subtitle: 'Click & drag to draw (mouseup to finish)',
            target: '#canvas, #timeline, #logscale, #freq, #overlay',
            dialog: "Welcome! This is the spectrogram. It’s a visual map of your sound. 👉 Click and drag your mouse across it to draw.",
            waitFor: {
                type: 'mouseup',
                selector: '#canvas'
            },
            showNext: false,
            preAction: null,
            mouseLoop: true
        },
        {
            id: 'playPause',
            label: 'Play / Pause',
            subtitle: 'Press Spacebar or click Play',
            target: '#playPause, #stop, #canvas, #timeline, #logscale, #freq, #overlay',
            dialog: "Press Spacebar to play or pause your audio at any time. 🎵",
            // Condition: user pressed play AND (playing && currentCursorX > specWidth*0.9)
            waitFor: {
                type: 'complexPlayback',
            },
            showNext: false,
            preAction: null,
            mouseLoop: false,
        },
        {
            id: 'addSound',
            label: 'Add audio / presets',
            subtitle: 'Upload a file or choose a preset',
            target: '#fileB, #presets',
            dialog: "Let’s add some sound! Upload an audio or video file, or pick one of the built-in presets.",
            waitFor: {
                type: 'renderCycle',
                varName: 'rendering'
            }, // wait rendering==true then rendering==false
            showNext: false,
            preAction: null,
            mouseLoop: false
        },
        {
            id: 'tools',
            label: 'Tools: Rectangle, Line, Blur, Eraser, Amp, Image',
            subtitle: 'Try one of the tools',
            target: '#brushBtn, #rectBtn, #lineBtn, #blurBtn, #eraserBtn, #amplifierBtn, #imageBtn, #playPause, #stop, #canvas, #timeline, #logscale, #freq, #overlay, #d1',
            dialog: "Try out the tools: Rectangle, Line, Blur, Eraser, Amplifier, and Image Overlay (turns pictures into sound!). 🖼️🎶",
            waitFor: {
                type: 'oneToolClickOrNext',
                selector: '.tool-btn'
            },
            showNext: true,
            preAction: null,
            mouseLoop: false
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
            mouseLoop: false
        },
        {
            id: 'midi',
            label: 'Export MIDI (piano)',
            subtitle: 'Open piano, export MIDI (pulsing export button)',
            target: '#pianoBtn, #exportMIDI, .left-panel',
            dialog: "Want to make music notation? Try exporting as a MIDI file (you can even turn it into sheet music later). 🎹",
            // Pre-click piano, pulse export button, wait until exportMIDI clicked AND user clicks Next
            waitFor: {
                type: 'clickThenNext',
                clickSelector: '#exportMIDI'
            },
            showNext: true,
            preAction: function() {
                const piano = document.getElementById('pianoBtn');
                if (piano) piano.click(); // user asked to programmatically open it
            },
            mouseLoop: false,
            pulseExport: true
        },
        {
            id: 'equalizer',
            label: 'Equalizer',
            subtitle: 'Open EQ and tweak points',
            target: '#eqBtn, #eqCanvas, .left-panel',
            dialog: "Finally, open the Equalizer and tweak some points — hear how it changes your sound in real time.",
            preAction: function() {
                const eq = document.getElementById('eqBtn');
                if (eq) eq.click();
            },
            waitFor: {
                type: 'eqCanvasClick',
            }, // waits for user to click Next after viewing / tweaking
            showNext: true,
            mouseLoop: true,
            mouseLoopSelector: '#eqCanvas'
        },
        {
            id: 'done',
            label: 'Done',
            subtitle: 'Finish the tutorial',
            target: null,
            dialog: "That’s it! 🎉 You’ve completed the tutorial. Now go make something amazing.",
            waitFor: {
                type: 'none'
            },
            showNext: true
        }
    ];

    // ------- helpers / state -------
    const dialog = document.getElementById('tutorialDialog');
    const tdTitle = document.getElementById('tdTitle');
    const tdText = document.getElementById('tdText');
    const tdActions = document.getElementById('tdActions');
    const skipAll = document.getElementById('tutorialSkip');

    let activeStepIndex = 0;
    // support multiple highlighted elements & markers
    let highlightEls = []; // array of currently highlighted DOM nodes
    let markerEls = []; // array of corresponding marker overlay elements
    let spotlightOverlay = null; // SVG overlay element that darkens page with holes
    let _spotlightMaskId = null; // array of corresponding marker overlay elements
    let arrowEl = null;
    let pollers = [];
    let savedInlineStyles = new Map();

    // safe DOM helpers
    function safeSetText(node, text) {
        if (!node) return;
        node.textContent = text;
    }

    function safeAddClass(node, cls) {
        if (!node) return;
        node.classList.add(cls);
    }

    function safeRemoveClass(node, cls) {
        if (!node) return;
        node.classList.remove(cls);
    }

    // show initial (open first automatically)
    function openStep(index) {
        try {
            // bounds check
            if (typeof index !== 'number' || index < 0 || index >= steps.length) index = 0;
            // restore previous highlight if any
            restoreHighlight();
            activeStepIndex = index;
            const s = steps[index];
            if (!s) return;

            // set rails active (if rail buttons exist)
            document.querySelectorAll('.tutorial-step-btn').forEach(b => b.classList.remove('active'));

            // show dialog (if dialog exists)
            safeSetText(tdTitle, s.label);
            safeSetText(tdText, s.dialog);

            // actions: clear
            if (tdActions) tdActions.innerHTML = '';

            // Skip always present
            const skipBtn = document.createElement('button');
            skipBtn.textContent = 'Skip tutorial';
            skipBtn.addEventListener('click', finishTutorial);
            if (tdActions) tdActions.appendChild(skipBtn);

            // Next presence depends on step.showNext
            if (s.showNext) {
                const nextBtn = document.createElement('button');
                nextBtn.className = 'primary';
                nextBtn.textContent = (index === steps.length - 1) ? 'Finish' : 'Next';

                // 🔒 Disable Next if this is the tools step
                if (s.id === 'tools' || s.id === 'midi' || s.id === 'equalizer') {
                    nextBtn.disabled = true;
                    nextBtn.classList.add('disabled');
                }

                nextBtn.addEventListener('click', () => {
                    finishStepAndAdvance();
                });
                if (tdActions) tdActions.appendChild(nextBtn);

                // keep reference for later
                s._nextBtn = nextBtn;
            }


            if (dialog) {
                // show dialog with fade animation
                dialog.classList.remove('hide');
                dialog.classList.add('show');

                // slight delay and entrance animation for dialog
                dialog.style.transform = 'translateY(8px)';
                setTimeout(() => {
                    dialog.style.transform = 'translateY(0)';
                }, 1);
            }

            // position / highlight target after a short delay so DOM layout settles
            setTimeout(() => {
                try {
                    setupHighlightFor(s);
                    if (typeof s.preAction === 'function') {
                        try {
                            s.preAction();
                        } catch (e) {
                            console.warn('preAction error', e);
                        }
                        if (highlightEls && highlightEls.length) {
                            updateSpotlightMask(highlightEls);
                        } else {
                            setupHighlightFor(s);
                        }
                    }
                    startWaitingFor(s);
                } catch (e) {
                    console.warn('openStep inner error', e);
                }
            }, 180);
        } catch (err) {
            console.error('openStep error', err);
        }
    }

    // highlight logic: raise target element & position marker & move arrow to point to the element
    function setupHighlightFor(step) {
        // clear any previous highlight state
        restoreHighlight();
        if (!step) return;
        const sel = step.target;
        if (!sel) {
            // center bubble only, no highlight
            return;
        }

        const targets = [];

        try {
            // If comma-separated, treat each token as an individual selector and
            // highlight the first match for each token.
            if (typeof sel === 'string' && sel.includes(',')) {
                const parts = sel.split(',').map(s => s.trim()).filter(Boolean);
                for (const p of parts) {
                    try {
                        const node = document.querySelector(p);
                        if (node) targets.push(node);
                    } catch (e) {}
                }
            } else if (typeof sel === 'string') {
                // If single selector, highlight all matches
                try {
                    const all = document.querySelectorAll(sel);
                    if (all && all.length) {
                        all.forEach(n => targets.push(n));
                    }
                } catch (e) {}
            } else {
                // If an array or NodeList passed in, add them all
                try {
                    if (sel && sel.length) {
                        for (let i = 0; i < sel.length; i++) {
                            if (sel[i]) targets.push(sel[i]);
                        }
                    }
                } catch (e) {}
            }

            // dedupe targets
            const uniqTargets = Array.from(new Set(targets));
            if (!uniqTargets.length) return;

            // record highlighted elements (but DO NOT permanently change their z-index)
            highlightEls = uniqTargets.slice();

            // create or update the spotlight overlay (masked dark overlay with transparent holes)
            createOrUpdateSpotlight(highlightEls, step);

            // create optional decorative markers for steps that asked for pulseOutline
            uniqTargets.forEach(targetEl => {
                savedInlineStyles.set(targetEl, {
                    position: targetEl.style.position || '',
                    boxShadow: targetEl.style.boxShadow || '',
                    outline: targetEl.style.outline || ''
                });

                // do not force z-index changes on the target anymore
                if (step.pulseOutline) {
                    // add class for pulsing outline so CSS can animate it
                    targetEl.classList.add('tutorial-pulse-outline');

                    // optional marker element (visual box) — we still create it if pulseOutline is requested
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

            // reposition handler updates mask + markers on resize / scroll
            const reposition = () => {
                try {
                    updateSpotlightMask(highlightEls);
                    // reposition markers if present
                    highlightEls.forEach((el, i) => {
                        if (markerEls[i]) positionMarkerOver(el, markerEls[i]);
                    });
                    if (step._arrowEl && highlightEls[0]) {
                        positionArrowToTarget(step._arrowEl, highlightEls[0]);
                    }
                } catch (e) {}
            };
            window.addEventListener('resize', reposition);
            window.addEventListener('scroll', reposition, true);
            step._reposition = reposition;

            // special pulsing for exportMIDI if requested
            if (step.pulseExport) {
                const exportBtn = document.querySelector('#exportMIDI');
                if (exportBtn) exportBtn.classList.add('tutorial-pulse-glow');
            }

        } catch (e) {
            console.warn('setupHighlightFor error', e);
        }
    }

    // Create or update the SVG spotlight overlay that darkens the page except for holes over targets
    // Create or update the SVG spotlight overlay that darkens the page except for holes over targets
    function createOrUpdateSpotlight(targetEls, step) {
        // ensure a stable id for the mask (one per tutorial instance)
        if (!_spotlightMaskId) {
            _spotlightMaskId = 'tutorial-spotlight-mask-' + Math.floor(Math.random() * 1e9);
        }

        // make the overlay if it doesn't exist
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
            // MAKE THE OVERLAY NOT BLOCK POINTERS so everything underneath stays clickable
            svg.style.pointerEvents = 'none';
            svg.style.zIndex = '99990'; // visual stacking — dialog should be above this if needed
            svg.style.touchAction = 'none';
            svg.setAttribute('aria-hidden', 'true');

            // defs + mask
            const defs = document.createElementNS(ns, 'defs');
            const mask = document.createElementNS(ns, 'mask');
            mask.setAttribute('id', _spotlightMaskId);

            // ---------- IMPORTANT: BASE RECT WHITE (show overlay everywhere by default) ----------
            // white => mask shows the overlay; black => hides overlay
            // We want overlay visible everywhere except holes, so base is white and holes are black.
            const baseRect = document.createElementNS(ns, 'rect');
            baseRect.setAttribute('x', '0');
            baseRect.setAttribute('y', '0');
            baseRect.setAttribute('width', '100%');
            baseRect.setAttribute('height', '100%');
            baseRect.setAttribute('fill', 'white'); // white = show overlay by default
            mask.appendChild(baseRect);

            defs.appendChild(mask);
            svg.appendChild(defs);

            // the visible overlay rectangle that will be masked; fill is semi-opaque dark
            const overlayRect = document.createElementNS(ns, 'rect');
            overlayRect.setAttribute('x', '0');
            overlayRect.setAttribute('y', '0');
            overlayRect.setAttribute('width', '100%');
            overlayRect.setAttribute('height', '100%');
            overlayRect.setAttribute('fill', 'rgba(0,0,0,0.6)');
            overlayRect.setAttribute('mask', `url(#${_spotlightMaskId})`);
            svg.appendChild(overlayRect);

            document.body.appendChild(svg);
            spotlightOverlay = svg;

            // NOTE: no event forwarding is attached — overlay does not capture events (pointer-events: none).
        }

        // update mask shapes based on current bounding boxes
        updateSpotlightMask(targetEls);
    }


    // Build/update the mask inside the SVG using the targets' bounding boxes
    // Build/update the mask inside the SVG using the targets' bounding boxes
    function updateSpotlightMask(targetEls) {
        if (!spotlightOverlay) return;
        const ns = "http://www.w3.org/2000/svg";
        const mask = spotlightOverlay.querySelector('mask#' + _spotlightMaskId);
        if (!mask) return;

        // Ensure the svg's viewBox matches current viewport (helps when viewport size changed)
        try {
            spotlightOverlay.setAttribute('viewBox', '0 0 ' + window.innerWidth + ' ' + window.innerHeight);
        } catch (e) {}

        // remove all previous hole shapes (keep the baseRect at index 0)
        while (mask.childElementCount > 1) mask.removeChild(mask.lastChild);

        // add BLACK shapes for each target bounding rect (black area in mask = hide overlay = show underlying content)
        targetEls.forEach(el => {
            try {
                const r = el.getBoundingClientRect();
                // skip zero-sized rects
                if (r.width <= 0 || r.height <= 0) return;
                const hole = document.createElementNS(ns, 'rect');
                // make hole slightly larger for padding & rounded corners using rx/ry
                const pad = 8;
                hole.setAttribute('x', Math.max(0, Math.floor(r.left) - pad));
                hole.setAttribute('y', Math.max(0, Math.floor(r.top) - pad));
                hole.setAttribute('width', Math.floor(r.width) + pad * 2);
                hole.setAttribute('height', Math.floor(r.height) + pad * 2);
                hole.setAttribute('rx', '8');
                hole.setAttribute('ry', '8');
                hole.setAttribute('fill', 'black'); // black => hide the overlay at this spot (make it transparent)
                mask.appendChild(hole);
            } catch (e) {}
        });
    }


    function positionMarkerOver(el, marker) {
        if (!marker || !el || !el.getBoundingClientRect) return;
        const r = el.getBoundingClientRect();
        // keep marker inside viewport and use fixed positioning so it follows on scroll
        marker.style.left = Math.max(8, r.left - 8) + 'px';
        marker.style.top = Math.max(8, r.top - 8) + 'px';
        marker.style.width = (r.width + 16) + 'px';
        marker.style.height = (r.height + 16) + 'px';
    }

    // arrow positioning: compute vector from rail button to target element and rotate arrow to point
    function positionArrowToTarget(arrow, targetEl) {
        if (!arrow || !targetEl) return;
        // get center points
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
        // angle in degrees
        const angle = Math.atan2(toY - fromY, toX - fromX) * 180 / Math.PI;
        // position arrow element near rail button with CSS rotation so the arrow points toward the target
        arrow.style.transform = `translate(0px, -50%) rotate(${angle}deg)`;
        // move arrow outward to better aim
        const dx = toX - fromX;
        const dy = toY - fromY;
        const dist = Math.min(Math.hypot(dx, dy), 420);
        // shift arrow outwards based on distance (so it doesn't overlap)
        const shift = Math.min(90, dist / 3 + 20);
        arrow.style.right = -(shift + 36) + 'px';
        arrow.style.top = '50%';
    }

    function restoreHighlight() {
        // restore element styles for all highlighted elements
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
                // remove pulsing class if present
                try {
                    el.classList.remove('tutorial-pulse-outline');
                } catch (e) {}
                savedInlineStyles.delete(el);
            });
            highlightEls = [];
        }

        // remove all marker overlays
        if (markerEls && markerEls.length) {
            markerEls.forEach(m => {
                try {
                    m.remove();
                } catch (e) {}
            });
            markerEls = [];
        }

        // remove spotlight overlay if present
        if (spotlightOverlay) {
            try {
                const mask = spotlightOverlay.querySelector('mask#' + _spotlightMaskId);
                if (mask) {
                    // remove all hole shapes (keep baseRect at index 0)
                    while (mask.childElementCount > 1) mask.removeChild(mask.lastChild);
                }
                // keep spotlightOverlay and _spotlightMaskId so next step updates mask without recreating SVG
            } catch (e) {}
        }

        // remove pulsing export class
        const exportBtn = document.querySelector('#exportMIDI');
        if (exportBtn) exportBtn.classList.remove('tutorial-pulse-glow');

        // remove reposition listeners saved on step objects
        steps.forEach(s => {
            if (s._reposition) {
                window.removeEventListener('resize', s._reposition);
                window.removeEventListener('scroll', s._reposition, true);
                delete s._reposition;
            }
        });
    }


    // waiting / pollers
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
                    // arbitrary cleanup function to run
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

        // fade mouse-loop if user moves mouse over animations
        const attachMouseFade = (el, animEl) => {
            if (!el || !animEl) return;
            const onMove = () => animEl.style.opacity = '0.15';
            const onLeave = () => animEl.style.opacity = '0.95';
            el.addEventListener('mousemove', onMove, {
                once: true
            });
            // when pointer moves off, restore next time after a delay
            setTimeout(() => {
                el.removeEventListener('mousemove', onMove);
            }, 900);
        };

        // mouse loop for canvas: add a small animated cursor path near the target
        let mouseLoopEl = null;
        if (step.mouseLoop) {
            const loopTarget = step.mouseLoopSelector ? document.querySelector(step.mouseLoopSelector) : document.querySelector(step.target);
            if (loopTarget) {
                mouseLoopEl = document.createElement('div');
                mouseLoopEl.style.position = 'absolute';
                mouseLoopEl.style.pointerEvents = 'none';
                mouseLoopEl.style.zIndex = 100000;
                mouseLoopEl.innerHTML = `<svg viewBox="0 0 60 60" width="48" height="48" style="opacity:0.95; filter: drop-shadow(0 6px 14px rgba(0,0,0,0.6))">
    <circle cx="10" cy="30" r="4" fill="white" />
    <circle cx="30" cy="30" r="3" fill="white" />
    <circle cx="50" cy="30" r="2" fill="white" />
</svg>`;
                document.body.appendChild(mouseLoopEl);
                const posLoop = () => {
                    try {
                        const r = loopTarget.getBoundingClientRect();
                        mouseLoopEl.style.left = (r.left + r.width * 0.6) + 'px';
                        mouseLoopEl.style.top = (r.top + r.height * 0.5 - 24) + 'px';
                    } catch (e) {}
                };
                posLoop();
                const id = setInterval(posLoop, 260);
                pollers.push({
                    type: 'interval',
                    id
                });
                // fade-out when user moves mouse over target
                const fadeHandler = () => mouseLoopEl.style.opacity = '0.12';
                loopTarget.addEventListener('mousemove', fadeHandler, {
                    once: true
                });
                pollers.push({
                    type: 'event',
                    node: loopTarget,
                    ev: 'mousemove',
                    fn: fadeHandler
                });
            }
        }

        // now implement wait types requested
        if (w.type === 'mouseup' && w.selector) {
            const node = document.querySelector(w.selector);
            if (node) {
                const fn = () => {
                    stepCompleted(step);
                };
                node.addEventListener('mouseup', fn, {
                    once: true
                });
                pollers.push({
                    type: 'event',
                    node,
                    ev: 'mouseup',
                    fn
                });
            } else {
                // fallback: allow user to click the canvas (the element might not exist)
                const fallback = document.getElementById('canvas');
                if (fallback) {
                    const fn = () => stepCompleted(step);
                    fallback.addEventListener('mouseup', fn, {
                        once: true
                    });
                    pollers.push({
                        type: 'event',
                        node: fallback,
                        ev: 'mouseup',
                        fn
                    });
                } else {
                    // nothing to wait for; finish after short delay
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
                    // ignore errors and keep polling
                }
            }, 260);
            pollers.push({ type: 'interval', id });
            return;
        }

        if (w.type === 'renderCycle') {
            // wait for rendering variable to go true then false
            const varName = w.varName || 'rendering';
            let sawTrue = false;
            const id = setInterval(() => {
                try {
                    const val = window[varName];
                    if (!sawTrue && val === true) sawTrue = true;
                    if (sawTrue && val === false) {
                        clearInterval(id);
                        stepCompleted(step);
                    }
                } catch (e) {}
            }, 220);
            pollers.push({
                type: 'interval',
                id
            });
            // fallback: listen for file input change or preset change
            (function() {
                const file = document.querySelector('#file');
                const presets = document.querySelector('#presets');
                if (file) {
                    const fn = () => {
                        clearInterval(id);
                        stepCompleted(step);
                    };
                    file.addEventListener('change', fn, {
                        once: true
                    });
                    pollers.push({
                        type: 'event',
                        node: file,
                        ev: 'change',
                        fn
                    });
                }
                if (presets) {
                    const fn2 = () => {
                        clearInterval(id);
                        stepCompleted(step);
                    };
                    presets.addEventListener('change', fn2, {
                        once: true
                    });
                    pollers.push({
                        type: 'event',
                        node: presets,
                        ev: 'change',
                        fn: fn2
                    });
                }
            })();
            return;
        }

        if (w.type === 'oneToolClickOrNext') {
            const nodes = document.querySelectorAll(w.selector);
            if (nodes && nodes.length) {
                const fn = () => {
                    // ✅ Just enable Next button, do not complete step yet
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
                // finish after a friendly timeout so tutorial doesn't hang if UI ids changed
                setTimeout(() => stepCompleted(step), 1600);
            }
            return;
        }

        if (w.type === 'clickThenNext') {
            const node = document.querySelector(w.clickSelector);
            if (node) {
                const fn = () => {
                    // mark click happened
                    step._clicked = true;
                    // ✅ enable Next button now that export was clicked
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

        // none -> finish quickly
        setTimeout(() => stepCompleted(step), 900);
    }

    // called when a step is done
    function stepCompleted(step) {
        dialog.classList.remove('show');
        dialog.classList.add('hide');

        restoreHighlight();
        clearPollers();

        const nextIndex = Math.min(steps.indexOf(step) + 1, steps.length - 1);

        // Only auto-advance for steps that have actual actions
        const waitType = step.waitFor?.type || 'none';
        if (step.showNext && (waitType === 'clickThenNext' || waitType === 'awaitNext')) {
            // don't auto-advance, let user click Next
            dialog.classList.remove('hide');
            dialog.classList.add('show');
            return;
        }

        // Prevent auto-advance for the last step
        if (step.id === 'done') {
            dialog.classList.remove('hide');
            dialog.classList.add('show');
            return;
        }

        setTimeout(() => {
            restoreHighlight();
            clearPollers();
            const nextIndex = Math.min(steps.indexOf(step) + 1, steps.length - 1);

            openStep(nextIndex); // open next step
        }, 360);
    }

    // finish from Next button (or finish step manually)
    function finishStepAndAdvance() {
        const s = steps[activeStepIndex];
        // If this step required a click (clickThenNext) ensure click happened
        if (s.waitFor && s.waitFor.type === 'clickThenNext' && !s._clicked) {
            // shake dialog to indicate required action
            dialog.animate([{
                transform: 'translateX(0)'
            }, {
                transform: 'translateX(-8px)'
            }, {
                transform: 'translateX(8px)'
            }, {
                transform: 'translateX(0)'
            }], {
                duration: 240
            });
            return;
        }
        // close current and go to next
        dialog.classList.remove('show');
        dialog.classList.add('hide');
        restoreHighlight();
        clearPollers();
        setTimeout(() => openStep(Math.min(activeStepIndex + 1, steps.length - 1)), 420);
    }

    // final skip/finish
    function finishTutorial() {
        // restore everything & clear pollers
        restoreHighlight();
        clearPollers();
        // mark tutorial seen
        localStorage.setItem('tutorialSeen', 'true');
        // hide overlay
        const panel = document.getElementById('tutorialOverlayPanel');
        if (panel) panel.style.display = 'none';
    }

    // wire skip global
    skipAll.addEventListener('click', finishTutorial);

    // helper: start tutorial on first visit (or call window.showAppTutorial to force)
    document.addEventListener('DOMContentLoaded', () => {
        const seen = localStorage.getItem('tutorialSeen')  // && false;
        if (!seen) {
            // open first step automatically
            openStep(0);
        } else {
            // keep the rail visible so user can open steps anytime if seen
            // (you asked "all buttons should be on one tutorial page" — we'll show rail anyway)
            // If you'd rather hide until re-open, set panel display none here.
        }
    });

    // expose manual opener
    window.showAppTutorial = function() {
        localStorage.removeItem('tutorialSeen');
        const panel = document.getElementById('tutorialOverlayPanel');
        if (panel) panel.style.display = 'block';
        openStep(0);
    };

})();
(function logStack(el) {
    el = el || document.querySelector('header');
    if (!el) {
        console.warn('no header found');
        return;
    }
    console.group('stack chain for', el);
    while (el) {
        const cs = getComputedStyle(el);
        console.log(el.tagName + (el.id ? '#' + el.id : ''), {
            position: cs.position,
            zIndex: cs.zIndex,
            transform: cs.transform,
            opacity: cs.opacity,
            isolation: cs.isolation,
            willChange: cs.willChange,
            filter: cs.filter
        });
        el = el.parentElement;
    }
    console.groupEnd();
})();