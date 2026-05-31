(function() {
    const vscode = acquireVsCodeApi();
    const imageEl = document.getElementById('image');
    const sidebar = document.getElementById('sidebar');
    const toolbar = document.getElementById('toolbar');
    
    const txtWidth = document.getElementById('txtWidth');
    const txtHeight = document.getElementById('txtHeight');
    const chkLockRatio = document.getElementById('chkLockRatio');
    const btnApplyResize = document.getElementById('btnApplyResize');
    const btnApplyCrop = document.getElementById('btnApplyCrop');

    const selFormat = document.getElementById('selFormat');
    const qualitySection = document.getElementById('qualitySection');
    const rngQuality = document.getElementById('rngQuality');
    const qualityVal = document.getElementById('qualityVal');

    const chkEnableCrop = document.getElementById('chkEnableCrop');
    const lblZoomPercent = document.getElementById('lblZoomPercent');

    let cropper = null;
    let originalWidth = 0;
    let originalHeight = 0;
    let aspectRatio = 0;
    let isCircular = false;
    let scaleX = 1;
    let scaleY = 1;
    let undoStack = [];
    let initialImageSrc = '';
    let isEyedropperActive = false;
    let eraseTargetBounds = null;
    let eyedropperCanvas = null;
    let eyedropperCtx = null;
    let lastSampledColor = null;
    const eyedropperTooltip = document.getElementById('eyedropperTooltip');

    const lblDimensions = document.getElementById('lblDimensions');
    const lblFilename = document.getElementById('lblFilename');

    const dashboard = document.getElementById('dashboard');
    const workspace = document.getElementById('workspace');
    const cardImport = document.getElementById('cardImport');
    const filePicker = document.getElementById('filePicker');
    const cardPaste = document.getElementById('cardPaste');

    const contextMenu = document.getElementById('contextMenu');
    const shortcutOverlay = document.getElementById('shortcutOverlay');

    // Rulers & scroll viewport
    const rulerH = document.getElementById('rulerH');
    const rulerV = document.getElementById('rulerV');
    const canvasScrollArea = document.getElementById('canvasScrollArea');
    const RULER_SIZE = 20; // px — must match CSS --ruler-size

    /** Expand the Cropper.js container to the actual zoomed canvas size so the
     *  scroll area shows the full image. Called after every zoom/ready event. */
    function expandContainerToCanvas() {
        if (!cropper) return;
        const cd = cropper.getCanvasData();
        if (!cd || !cd.width) return;
        const cropperContEl = document.querySelector('.cropper-container');
        const imgContainerEl = document.querySelector('.image-container');
        if (!cropperContEl || !imgContainerEl) return;

        const w = Math.ceil(cd.width);
        const h = Math.ceil(cd.height);

        // Size the cropper container to the canvas
        cropperContEl.style.width    = w + 'px';
        cropperContEl.style.height   = h + 'px';
        cropperContEl.style.overflow = 'visible'; // let canvas show outside box during transitions

        // Resize the image-container wrapper too (drives flex scroll area)
        imgContainerEl.style.width  = w + 'px';
        imgContainerEl.style.height = h + 'px';

        // Shift the canvas to (0,0) so the full zoomed image is visible
        const dx = -cd.left;
        const dy = -cd.top;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
            cropper.move(dx, dy);
        }

        drawRulers();
    }

    function drawRulers() {
        if (!cropper || !rulerH || !rulerV) return;
        const imgData = cropper.getImageData();
        if (!imgData || !imgData.naturalWidth) return;

        // ── use actual DOM positions so coordinate math is always correct ──
        // The Cropper.js canvas element holds the rendered image
        const cropperCanvas = document.querySelector('.cropper-canvas');
        if (!cropperCanvas) return;

        const hRect  = rulerH.getBoundingClientRect();   // horizontal ruler position
        const vRect  = rulerV.getBoundingClientRect();   // vertical ruler position
        const imgRect = cropperCanvas.getBoundingClientRect(); // rendered image position

        // Where the image top-left is, relative to each ruler canvas
        const imgLeft = imgRect.left - hRect.left;
        const imgTop  = imgRect.top  - vRect.top;
        const dispW   = imgRect.width;
        const dispH   = imgRect.height;

        const cw = rulerH.offsetWidth;
        const ch = rulerV.offsetHeight;
        if (cw < 1 || ch < 1) return;

        // ── HiDPI: sync canvas pixel buffer to CSS size ──────────────────
        const dpr = window.devicePixelRatio || 1;
        if (rulerH.width !== Math.round(cw * dpr) || rulerH.height !== Math.round(RULER_SIZE * dpr)) {
            rulerH.width  = Math.round(cw * dpr);
            rulerH.height = Math.round(RULER_SIZE * dpr);
        }
        if (rulerV.width !== Math.round(RULER_SIZE * dpr) || rulerV.height !== Math.round(ch * dpr)) {
            rulerV.width  = Math.round(RULER_SIZE * dpr);
            rulerV.height = Math.round(ch * dpr);
        }

        const hCtx = rulerH.getContext('2d');
        const vCtx = rulerV.getContext('2d');
        hCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        vCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // ── colours ──────────────────────────────────────────────────────
        const BG      = '#1a1a1a';
        const TICK    = '#555';
        const IMGLINE = '#4da6ff';   // image boundary line colour
        const TEXT    = '#888';
        const FONT    = '9px monospace';

        // Clear
        hCtx.fillStyle = BG; hCtx.fillRect(0, 0, cw, RULER_SIZE);
        vCtx.fillStyle = BG; vCtx.fillRect(0, 0, RULER_SIZE, ch);

        // Separator lines
        hCtx.strokeStyle = '#333'; hCtx.lineWidth = 1;
        hCtx.beginPath(); hCtx.moveTo(0, RULER_SIZE - 0.5); hCtx.lineTo(cw, RULER_SIZE - 0.5); hCtx.stroke();
        vCtx.strokeStyle = '#333'; vCtx.lineWidth = 1;
        vCtx.beginPath(); vCtx.moveTo(RULER_SIZE - 0.5, 0); vCtx.lineTo(RULER_SIZE - 0.5, ch); vCtx.stroke();

        // ── scale: natural image pixels per display pixel ─────────────────
        const scaleX = imgData.naturalWidth  / dispW;
        const scaleY = imgData.naturalHeight / dispH;

        // ── nice tick interval (in natural px) ───────────────────────────
        function niceStep(scale) {
            const MIN_SCREEN_GAP = 48; // min px between major ticks
            const rawStep = MIN_SCREEN_GAP * scale;
            const exp  = Math.pow(10, Math.floor(Math.log10(rawStep)));
            const frac = rawStep / exp;
            const nice = frac < 1.5 ? 1 : frac < 3.5 ? 2 : frac < 7.5 ? 5 : 10;
            return nice * exp;
        }
        const stepX = niceStep(scaleX);
        const stepY = niceStep(scaleY);

        // ── horizontal ticks ─────────────────────────────────────────────
        hCtx.font = FONT; hCtx.textBaseline = 'top';
        const startNatX = Math.ceil(-imgLeft * scaleX / stepX) * stepX;
        for (let n = startNatX; n <= imgData.naturalWidth; n += stepX) {
            const x = imgLeft + n / scaleX;
            if (x < 0 || x > cw) continue;
            const isMajor = (Math.round(n / stepX) % 5 === 0);
            const tickH   = isMajor ? 9 : 5;
            hCtx.strokeStyle = TICK; hCtx.lineWidth = 1;
            hCtx.beginPath(); hCtx.moveTo(x, RULER_SIZE - tickH); hCtx.lineTo(x, RULER_SIZE); hCtx.stroke();
            if (isMajor) {
                hCtx.fillStyle  = TEXT;
                hCtx.textAlign  = 'left';
                hCtx.fillText(String(Math.round(n)), x + 2, 2);
            }
        }

        // ── vertical ticks ───────────────────────────────────────────────
        vCtx.font = FONT; vCtx.textBaseline = 'middle';
        const startNatY = Math.ceil(-imgTop * scaleY / stepY) * stepY;
        for (let n = startNatY; n <= imgData.naturalHeight; n += stepY) {
            const y = imgTop + n / scaleY;
            if (y < 0 || y > ch) continue;
            const isMajor = (Math.round(n / stepY) % 5 === 0);
            const tickW   = isMajor ? 9 : 5;
            vCtx.strokeStyle = TICK; vCtx.lineWidth = 1;
            vCtx.beginPath(); vCtx.moveTo(RULER_SIZE - tickW, y); vCtx.lineTo(RULER_SIZE, y); vCtx.stroke();
            if (isMajor) {
                vCtx.save();
                vCtx.fillStyle = TEXT;
                vCtx.translate(RULER_SIZE - tickW - 2, y);
                vCtx.rotate(-Math.PI / 2);
                vCtx.textAlign = 'center';
                vCtx.fillText(String(Math.round(n)), 0, 0);
                vCtx.restore();
            }
        }

        // ── image boundary accent lines ───────────────────────────────────
        const imgRight  = imgLeft + dispW;
        const imgBottom = imgTop  + dispH;

        hCtx.strokeStyle = IMGLINE; hCtx.lineWidth = 1.5;
        [imgLeft, imgRight].forEach(x => {
            if (x >= 0 && x <= cw) {
                hCtx.beginPath(); hCtx.moveTo(x, 0); hCtx.lineTo(x, RULER_SIZE); hCtx.stroke();
            }
        });
        vCtx.strokeStyle = IMGLINE; vCtx.lineWidth = 1.5;
        [imgTop, imgBottom].forEach(y => {
            if (y >= 0 && y <= ch) {
                vCtx.beginPath(); vCtx.moveTo(0, y); vCtx.lineTo(RULER_SIZE, y); vCtx.stroke();
            }
        });
    }

    // Show shortcut cheatsheet while Cmd / Ctrl is held down
    document.addEventListener('keydown', (e) => {
        if ((e.key === 'Meta' || e.key === 'Control') && shortcutOverlay) {
            shortcutOverlay.style.display = 'block';
        }
    });
    document.addEventListener('keyup', (e) => {
        if ((e.key === 'Meta' || e.key === 'Control') && shortcutOverlay) {
            shortcutOverlay.style.display = 'none';
        }
    });
    // Also hide if window loses focus (e.g. Cmd+Tab)
    window.addEventListener('blur', () => {
        if (shortcutOverlay) shortcutOverlay.style.display = 'none';
    });

    // Mode dispatcher
    if (!imageEl || !imageEl.getAttribute('src') || imageEl.getAttribute('src') === '') {
        // Empty editor launcher mode
        dashboard.style.display = 'flex';
        workspace.style.display = 'none';
    } else {
        // Normal file editor mode
        dashboard.style.display = 'none';
        workspace.style.display = 'grid';
        initEditor(imageEl.src);
    }

    // File import triggers
    cardImport.addEventListener('click', () => filePicker.click());
    filePicker.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            loadFile(e.target.files[0]);
        }
    });

    // Clipboard Paste trigger click
    cardPaste.addEventListener('click', () => {
        vscode.postMessage({ command: 'show-toast', text: 'Press Cmd+V / Ctrl+V to paste your clipboard image.' });
    });

    // Global Clipboard paste listener
    document.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let item of items) {
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const file = item.getAsFile();
                loadFile(file);
                return;
            }
        }
    });

    // Global Drag & Drop listeners
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            if (file.type.startsWith('image/')) {
                loadFile(file);
            }
        }
    });

    function loadFile(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            lblFilename.textContent = file.name || 'Pasted Image';
            dashboard.style.display = 'none';
            workspace.style.display = 'grid';
            initEditor(event.target.result);
        };
        reader.readAsDataURL(file);
    }

    function initEditor(src) {
        if (!initialImageSrc) {
            initialImageSrc = src;
        }
        imageEl.src = src;
        
        imageEl.onload = () => {
            originalWidth = imageEl.naturalWidth;
            originalHeight = imageEl.naturalHeight;
            aspectRatio = originalWidth / originalHeight;
            scaleX = 1;
            scaleY = 1;

            lblDimensions.textContent = `${originalWidth} × ${originalHeight}`;
            txtWidth.value = originalWidth;
            txtHeight.value = originalHeight;

            // Show UI panes
            sidebar.style.display = 'flex';
            toolbar.style.display = 'flex';

            // Destroy previous instance
            if (cropper) {
                cropper.destroy();
            }

            // Uncheck crop checkbox and disable aspect presets visually by default on loading a new image
            chkEnableCrop.checked = false;
            syncCropPresetUI();

            // Create Cropper
            cropper = new Cropper(imageEl, {
                aspectRatio: NaN,
                viewMode: 1,
                background: false,
                responsive: true,
                autoCrop: false, // Clean preview on startup, crop overlay appears only when dragging or selecting presets
                ready() {
                    updateZoomIndicator();
                    expandContainerToCanvas();
                    if (cropper.cropped) {
                        updateResizeInputsFromCrop();
                    }
                },
                crop(event) {
                    // If user manually draws crop area, auto check the Enable Crop checkbox
                    if (cropper && cropper.cropped && !chkEnableCrop.checked) {
                        chkEnableCrop.checked = true;
                        syncCropPresetUI();
                        // Reset presets visual status to Free
                        presetButtons.forEach(b => b.classList.remove('active'));
                        const freeBtn = document.querySelector('#cropPresets button[data-ratio="NaN"]');
                        if (freeBtn) freeBtn.classList.add('active');
                    }
                    updateResizeInputsFromCrop();
                },
                zoom(event) {
                    // Update indicator + expand container after zoom finishes
                    setTimeout(() => {
                        updateZoomIndicator();
                        expandContainerToCanvas();
                    }, 0);
                }
            });

            // Redraw rulers while panning (RAF-throttled) — listen on scroll area
            let _rulerRafId = null;
            if (canvasScrollArea) {
                canvasScrollArea.addEventListener('mousemove', () => {
                    if (_rulerRafId) return;
                    _rulerRafId = requestAnimationFrame(() => { drawRulers(); _rulerRafId = null; });
                });
                // Redraw rulers when user scrolls the canvas viewport
                canvasScrollArea.addEventListener('scroll', () => {
                    if (_rulerRafId) return;
                    _rulerRafId = requestAnimationFrame(() => { drawRulers(); _rulerRafId = null; });
                });
            }

            // Redraw rulers when workspace grid resizes
            if (!window._rulerResizeObserver && workspace) {
                window._rulerResizeObserver = new ResizeObserver(() => { setTimeout(drawRulers, 0); });
                window._rulerResizeObserver.observe(workspace);
            }
        };
    }

    function updateResizeInputsFromCrop() {
        if (!cropper) return;
        const data = cropper.getData();
        txtWidth.value = Math.round(data.width);
        txtHeight.value = Math.round(data.height);
    }

    function updateZoomIndicator() {
        if (!cropper) return;
        const data = cropper.getImageData();
        if (data && data.naturalWidth) {
            const percent = Math.round((data.width / data.naturalWidth) * 100);
            lblZoomPercent.textContent = `${percent}%`;
        }
    }

    function syncCropPresetUI() {
        const isEnabled = chkEnableCrop.checked;
        presetButtons.forEach(btn => {
            btn.disabled = !isEnabled;
        });
        if (btnApplyCrop) {
            btnApplyCrop.disabled = !isEnabled;
        }
    }

    // Crop Toggle Checkbox listener
    chkEnableCrop.addEventListener('change', () => {
        if (chkEnableCrop.checked) {
            if (cropper) {
                cropper.crop();
                // Highlight Free preset by default when crop is checked on
                presetButtons.forEach(b => b.classList.remove('active'));
                const freeBtn = document.querySelector('#cropPresets button[data-ratio="NaN"]');
                if (freeBtn) freeBtn.classList.add('active');
                cropper.setAspectRatio(NaN);
                isCircular = false;
                const face = document.querySelector('.cropper-face');
                if (face) face.style.borderRadius = '0';
                updateResizeInputsFromCrop();
            }
        } else {
            if (cropper) {
                cropper.clear();
                // Reset inputs to original dimensions when exiting crop mode
                txtWidth.value = originalWidth;
                txtHeight.value = originalHeight;
            }
            isCircular = false;
            presetButtons.forEach(b => b.classList.remove('active'));
        }
        syncCropPresetUI();
    });

    // Preset Aspect Ratios
    const presetButtons = document.querySelectorAll('#cropPresets button');
    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (!chkEnableCrop.checked) {
                chkEnableCrop.checked = true;
                syncCropPresetUI();
            }

            presetButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (cropper) {
                cropper.crop();
            }

            isCircular = btn.dataset.circle === 'true';

            if (isCircular) {
                // Circle cropping uses 1:1 aspect ratio constraint visually
                cropper.setAspectRatio(1);
                // Apply circle mask preview to crop box
                const face = document.querySelector('.cropper-face');
                if (face) face.style.borderRadius = '50%';
            } else {
                const face = document.querySelector('.cropper-face');
                if (face) face.style.borderRadius = '0';
                
                const ratio = parseFloat(btn.dataset.ratio);
                cropper.setAspectRatio(isNaN(ratio) ? NaN : ratio);
            }
        });
    });

    // Aspect Ratio Lock and Dimension synchronization
    txtWidth.addEventListener('input', () => {
        if (chkLockRatio.checked && aspectRatio) {
            txtHeight.value = Math.round(txtWidth.value / aspectRatio);
        }
    });

    txtHeight.addEventListener('input', () => {
        if (chkLockRatio.checked && aspectRatio) {
            txtWidth.value = Math.round(txtHeight.value * aspectRatio);
        }
    });

    // Toolbar zoom / rotate
    document.getElementById('btnZoomIn').addEventListener('click', () => {
        if (cropper) {
            cropper.zoom(0.1);
            setTimeout(updateZoomIndicator, 0);
        }
    });
    document.getElementById('btnZoomOut').addEventListener('click', () => {
        if (cropper) {
            cropper.zoom(-0.1);
            setTimeout(updateZoomIndicator, 0);
        }
    });
    document.getElementById('btnRotateLeft').addEventListener('click', () => cropper && cropper.rotate(-90));
    document.getElementById('btnRotateRight').addEventListener('click', () => cropper && cropper.rotate(90));
    document.getElementById('btnFlipH').addEventListener('click', () => {
        if (cropper) {
            scaleX = -scaleX;
            cropper.scaleX(scaleX);
        }
    });
    document.getElementById('btnFlipV').addEventListener('click', () => {
        if (cropper) {
            scaleY = -scaleY;
            cropper.scaleY(scaleY);
        }
    });
    document.getElementById('btnReset').addEventListener('click', () => {
        if (cropper) {
            scaleX = 1;
            scaleY = 1;
            if (imageEl.src !== initialImageSrc) {
                undoStack.push(imageEl.src);
                initEditor(initialImageSrc);
            } else {
                cropper.reset();
            }
            isCircular = false;
            chkEnableCrop.checked = false;
            syncCropPresetUI();
            presetButtons.forEach(b => b.classList.remove('active'));
            const face = document.querySelector('.cropper-face');
            if (face) face.style.borderRadius = '0';
            setTimeout(updateZoomIndicator, 50);
        }
    });

    // Format changes display quality slider
    selFormat.addEventListener('change', () => {
        const val = selFormat.value;
        if (val === 'image/jpeg' || val === 'image/webp') {
            qualitySection.style.display = 'block';
        } else {
            qualitySection.style.display = 'none';
        }
    });

    rngQuality.addEventListener('input', () => {
        qualityVal.textContent = rngQuality.value;
    });

    // Apply manual resize dimension changes (destructively crops and resizes on screen)
    btnApplyResize.addEventListener('click', () => {
        if (!cropper) return;
        const targetWidth = parseInt(txtWidth.value, 10);
        const targetHeight = parseInt(txtHeight.value, 10);
        if (targetWidth > 0 && targetHeight > 0) {
            // Push current source to undo stack before mutation
            undoStack.push(imageEl.src);

            // If crop mode is NOT enabled, select the entire image bounds to get a clean full-image resize!
            if (!chkEnableCrop.checked) {
                cropper.crop();
                cropper.setData({
                    x: 0,
                    y: 0,
                    width: originalWidth,
                    height: originalHeight
                });
            }

            // Export cropped & resized image to base64
            let canvas = cropper.getCroppedCanvas({
                width: targetWidth,
                height: targetHeight,
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high'
            });

            // Apply circular mask if circle crop is active
            if (isCircular) {
                const circleCanvas = document.createElement('canvas');
                circleCanvas.width = canvas.width;
                circleCanvas.height = canvas.height;
                const ctx = circleCanvas.getContext('2d');
                
                ctx.beginPath();
                ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(canvas, 0, 0);
                canvas = circleCanvas;
            }

            const newSrc = canvas.toDataURL();
            initEditor(newSrc);
            vscode.postMessage({ command: 'show-toast', text: 'Resize applied. Press Ctrl+Z to undo.' });
        }
    });

    // Apply 1:1 original crop selections (destructively crops on screen keeping original selection pixels scale)
    btnApplyCrop.addEventListener('click', () => {
        if (!cropper) return;
        if (!chkEnableCrop.checked || !cropper.cropped) {
            vscode.postMessage({ command: 'show-toast', text: 'Please enable crop and select a region first.' });
            return;
        }

        // Push current source to undo stack before mutation
        undoStack.push(imageEl.src);

        // Get cropped canvas at original selection pixel bounds
        let canvas = cropper.getCroppedCanvas({
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high'
        });

        // Apply circular mask if circle crop is active
        if (isCircular) {
            const circleCanvas = document.createElement('canvas');
            circleCanvas.width = canvas.width;
            circleCanvas.height = canvas.height;
            const ctx = circleCanvas.getContext('2d');
            
            ctx.beginPath();
            ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(canvas, 0, 0);
            canvas = circleCanvas;
        }

        const newSrc = canvas.toDataURL();
        initEditor(newSrc);
        
        // Reset crop mode checkbox
        chkEnableCrop.checked = false;
        syncCropPresetUI();

        vscode.postMessage({ command: 'show-toast', text: 'Crop applied. Press Ctrl+Z to undo.' });
    });

    // Hook up saving triggers
    const btnSave = document.getElementById('btnSave');
    const btnExport = document.getElementById('btnExport');

    btnSave.addEventListener('click', () => triggerSave('save'));
    btnExport.addEventListener('click', () => triggerSave('export'));

    // Clipboard Copy Engine
    function copyImageToClipboard() {
        if (!cropper) return;
        
        window.editorApi.getCanvasBlob((blob) => {
            if (!blob) {
                vscode.postMessage({ command: 'show-toast', text: 'No image data to copy' });
                return;
            }
            
            navigator.clipboard.write([
                new ClipboardItem({
                    [blob.type]: blob
                })
            ]).then(() => {
                vscode.postMessage({ command: 'show-toast', text: 'Image copied to clipboard!' });
            }).catch((err) => {
                vscode.postMessage({ command: 'show-toast', text: 'Clipboard write failed: ' + err });
            });
        });
    }

    // Selection Erase & Eyedropper Color-Fill Engine
    function endEyedropper() {
        isEyedropperActive = false;
        eraseTargetBounds = null;
        eyedropperCanvas = null;
        eyedropperCtx = null;
        lastSampledColor = null;
        workspace.classList.remove('eyedropper-active');
        if (eyedropperTooltip) {
            eyedropperTooltip.style.display = 'none';
        }
        const face = document.querySelector('.cropper-face');
        if (face) {
            face.style.backgroundColor = 'transparent';
        }
    }

    // Selection Erase & Eyedropper Color-Fill Engine
    function eraseSelection() {
        if (!cropper) return;
        if (!chkEnableCrop.checked || !cropper.cropped) {
            vscode.postMessage({ command: 'show-toast', text: 'Please select a crop region to erase first.' });
            return;
        }

        const data = cropper.getData();
        isEyedropperActive = true;
        eraseTargetBounds = data;
        
        // Cache offscreen representation of the image
        eyedropperCanvas = document.createElement('canvas');
        eyedropperCanvas.width = originalWidth;
        eyedropperCanvas.height = originalHeight;
        eyedropperCtx = eyedropperCanvas.getContext('2d');
        eyedropperCtx.drawImage(imageEl, 0, 0);

        lastSampledColor = null;

        if (eyedropperTooltip) {
            eyedropperTooltip.style.display = 'block';
            eyedropperTooltip.style.left = '-1000px'; // initially position offscreen to avoid jump
            eyedropperTooltip.style.top = '-1000px';
        }

        // Set visual cursor classes
        workspace.classList.add('eyedropper-active');
        vscode.postMessage({ 
            command: 'show-toast', 
            text: 'Eyedropper active. Click on the image to fill with color, or click on the grid to make it transparent.' 
        });
    }

    // Workspace mousemove handler during capture phase to implement Eyedropper real-time live preview and tooltip tracking
    workspace.addEventListener('mousemove', (e) => {
        if (!isEyedropperActive || !eraseTargetBounds) return;

        // Position tooltip to follow the cursor (translate offset slightly)
        if (eyedropperTooltip) {
            eyedropperTooltip.style.left = `${e.clientX + 12}px`;
            eyedropperTooltip.style.top = `${e.clientY + 12}px`;
        }

        const imageData = cropper.getImageData();
        const rect = cropper.container.getBoundingClientRect();
        
        const xInContainer = e.clientX - rect.left;
        const yInContainer = e.clientY - rect.top;
        
        const xInImage = xInContainer - imageData.left;
        const yInImage = yInContainer - imageData.top;

        const isMouseOnImage = xInImage >= 0 && xInImage <= imageData.width && yInImage >= 0 && yInImage <= imageData.height;

        let color = '';
        if (isMouseOnImage && eyedropperCtx) {
            const naturalX = Math.round((xInImage / imageData.width) * imageData.naturalWidth);
            const naturalY = Math.round((yInImage / imageData.height) * imageData.naturalHeight);
            
            const clampedX = Math.max(0, Math.min(originalWidth - 1, naturalX));
            const clampedY = Math.max(0, Math.min(originalHeight - 1, naturalY));

            const pixel = eyedropperCtx.getImageData(clampedX, clampedY, 1, 1).data;
            color = `rgba(${pixel[0]}, ${pixel[1]}, ${pixel[2]}, ${pixel[3] / 255})`;
        } else {
            // Outside: translucent white erase transparent preview hint
            color = 'rgba(255, 255, 255, 0.35)';
        }

        // DOM Write Guard: Only update style if color changed
        if (color !== lastSampledColor) {
            lastSampledColor = color;
            const face = document.querySelector('.cropper-face');
            if (face) {
                face.style.backgroundColor = color;
            }
        }
    }, true);

    // Workspace click handler during capture phase to implement Eyedropper sampling
    workspace.addEventListener('click', (e) => {
        if (!isEyedropperActive || !eraseTargetBounds) return;
        
        // Prevent cropper from intercepting the click and closing
        e.stopPropagation();
        e.preventDefault();

        const imageData = cropper.getImageData();
        const rect = cropper.container.getBoundingClientRect();
        
        const xInContainer = e.clientX - rect.left;
        const yInContainer = e.clientY - rect.top;
        
        const xInImage = xInContainer - imageData.left;
        const yInImage = yInContainer - imageData.top;

        // Check if the click lies inside the actual responsive boundary of the image
        const isClickOnImage = xInImage >= 0 && xInImage <= imageData.width && yInImage >= 0 && yInImage <= imageData.height;

        // Backup current source to undo stack before erase/fill mutation
        undoStack.push(imageEl.src);

        const canvas = document.createElement('canvas');
        canvas.width = originalWidth;
        canvas.height = originalHeight;
        const ctx = canvas.getContext('2d');

        // Draw current image
        ctx.drawImage(imageEl, 0, 0);

        if (isClickOnImage && eyedropperCtx) {
            const naturalX = Math.round((xInImage / imageData.width) * imageData.naturalWidth);
            const naturalY = Math.round((yInImage / imageData.height) * imageData.naturalHeight);
            
            const clampedX = Math.max(0, Math.min(originalWidth - 1, naturalX));
            const clampedY = Math.max(0, Math.min(originalHeight - 1, naturalY));

            const pixel = eyedropperCtx.getImageData(clampedX, clampedY, 1, 1).data;
            const color = `rgba(${pixel[0]}, ${pixel[1]}, ${pixel[2]}, ${pixel[3] / 255})`;

            // Fill target marquee selection with the sampled color
            ctx.fillStyle = color;
            if (isCircular) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(eraseTargetBounds.x + eraseTargetBounds.width / 2, eraseTargetBounds.y + eraseTargetBounds.height / 2, eraseTargetBounds.width / 2, 0, Math.PI * 2);
                ctx.clip();
                ctx.clearRect(eraseTargetBounds.x, eraseTargetBounds.y, eraseTargetBounds.width, eraseTargetBounds.height);
                ctx.fillRect(eraseTargetBounds.x, eraseTargetBounds.y, eraseTargetBounds.width, eraseTargetBounds.height);
                ctx.restore();
            } else {
                ctx.clearRect(eraseTargetBounds.x, eraseTargetBounds.y, eraseTargetBounds.width, eraseTargetBounds.height);
                ctx.fillRect(eraseTargetBounds.x, eraseTargetBounds.y, eraseTargetBounds.width, eraseTargetBounds.height);
            }

            vscode.postMessage({ command: 'show-toast', text: 'Selection filled with color. Press Ctrl+Z to undo.' });
        } else {
            // Erase target marquee selection to transparent
            if (isCircular) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(eraseTargetBounds.x + eraseTargetBounds.width / 2, eraseTargetBounds.y + eraseTargetBounds.height / 2, eraseTargetBounds.width / 2, 0, Math.PI * 2);
                ctx.clip();
                ctx.clearRect(eraseTargetBounds.x, eraseTargetBounds.y, eraseTargetBounds.width, eraseTargetBounds.height);
                ctx.restore();
            } else {
                ctx.clearRect(eraseTargetBounds.x, eraseTargetBounds.y, eraseTargetBounds.width, eraseTargetBounds.height);
            }

            vscode.postMessage({ command: 'show-toast', text: 'Selection erased to transparent. Press Ctrl+Z to undo.' });
        }

        const newSrc = canvas.toDataURL();
        initEditor(newSrc);

        // Turn off eyedropper mode
        endEyedropper();

        // Reset crop mode checkbox
        chkEnableCrop.checked = false;
        syncCropPresetUI();
    }, true); // Capture phase is critical to intercept clicks over Cropper overlays! // Capture phase is critical to intercept clicks over Cropper overlays!

    // Custom Context Menu event listeners
    workspace.addEventListener('contextmenu', (e) => {
        if (workspace.style.display === 'none') return;
        e.preventDefault();
        
        // Display context menu at mouse client position
        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.style.display = 'block';
    });

    // Close menu when clicking elsewhere
    document.addEventListener('click', () => {
        contextMenu.style.display = 'none';
    });

    document.getElementById('ctxCopy').addEventListener('click', (e) => {
        e.stopPropagation();
        contextMenu.style.display = 'none';
        copyImageToClipboard();
    });

    document.getElementById('ctxErase').addEventListener('click', (e) => {
        e.stopPropagation();
        contextMenu.style.display = 'none';
        eraseSelection();
    });

    document.getElementById('ctxFlipH').addEventListener('click', (e) => {
        e.stopPropagation();
        contextMenu.style.display = 'none';
        if (cropper) {
            scaleX = -scaleX;
            cropper.scaleX(scaleX);
        }
    });

    document.getElementById('ctxFlipV').addEventListener('click', (e) => {
        e.stopPropagation();
        contextMenu.style.display = 'none';
        if (cropper) {
            scaleY = -scaleY;
            cropper.scaleY(scaleY);
        }
    });

    document.getElementById('ctxSave').addEventListener('click', (e) => {
        e.stopPropagation();
        contextMenu.style.display = 'none';
        triggerSave('save');
    });

    document.getElementById('ctxUndo').addEventListener('click', (e) => {
        e.stopPropagation();
        contextMenu.style.display = 'none';
        performUndo();
    });

    document.getElementById('ctxReset').addEventListener('click', (e) => {
        e.stopPropagation();
        contextMenu.style.display = 'none';
        document.getElementById('btnReset').click();
    });

    // Global keyboard listener
    document.addEventListener('keydown', (e) => {
        // Guard input elements so typing is not hijacked
        const activeEl = document.activeElement;
        const isInput = activeEl && (
            activeEl.tagName === 'INPUT' || 
            activeEl.tagName === 'SELECT' || 
            activeEl.tagName === 'TEXTAREA' || 
            activeEl.isContentEditable
        );

        if (isInput) {
            // Still allow Save (Cmd+S) and Undo (Cmd+Z) inside input focus
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                triggerSave('save');
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault();
                performUndo();
            }
            return;
        }

        // Save: Cmd+S / Ctrl+S
        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            triggerSave('save');
            return;
        }

        // Undo: Cmd+Z / Ctrl+Z
        if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
            e.preventDefault();
            performUndo();
            return;
        }

        // Copy: Cmd+C / Ctrl+C
        if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
            e.preventDefault();
            copyImageToClipboard();
            return;
        }

        // Selection Erase: Delete / Backspace
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (chkEnableCrop.checked && cropper && cropper.cropped) {
                e.preventDefault();
                eraseSelection();
            }
            return;
        }

        // Zoom In: Cmd/Ctrl + = or Cmd/Ctrl + + or simple key +
        if (((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) || e.key === '+') {
            e.preventDefault();
            if (cropper) {
                cropper.zoom(0.1);
                setTimeout(updateZoomIndicator, 0);
            }
            return;
        }

        // Zoom Out: Cmd/Ctrl + - or Cmd/Ctrl + _ or simple key -
        if (((e.metaKey || e.ctrlKey) && (e.key === '-' || e.key === '_')) || e.key === '-') {
            e.preventDefault();
            if (cropper) {
                cropper.zoom(-0.1);
                setTimeout(updateZoomIndicator, 0);
            }
            return;
        }

        // Rotate Left: [ or Cmd/Ctrl + [
        if (((e.metaKey || e.ctrlKey) && e.key === '[') || e.key === '[') {
            e.preventDefault();
            if (cropper) cropper.rotate(-90);
            return;
        }

        // Rotate Right: ] or Cmd/Ctrl + ]
        if (((e.metaKey || e.ctrlKey) && e.key === ']') || e.key === ']') {
            e.preventDefault();
            if (cropper) cropper.rotate(90);
            return;
        }

        // Reset zoom & selection / Fit screen: Cmd/Ctrl + 0
        if ((e.metaKey || e.ctrlKey) && e.key === '0') {
            e.preventDefault();
            if (cropper) {
                cropper.reset();
                setTimeout(updateZoomIndicator, 50);
            }
            return;
        }

        // Select All (Full image crop selection): Cmd/Ctrl + A
        if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
            e.preventDefault();
            if (cropper) {
                if (!chkEnableCrop.checked) {
                    chkEnableCrop.checked = true;
                    syncCropPresetUI();
                }
                cropper.crop();
                cropper.setData({
                    x: 0,
                    y: 0,
                    width: originalWidth,
                    height: originalHeight
                });
                presetButtons.forEach(b => b.classList.remove('active'));
                const freeBtn = document.querySelector('#cropPresets button[data-ratio="NaN"]');
                if (freeBtn) freeBtn.classList.add('active');
            }
            return;
        }

        // Escape: clear selection, cancel eyedropper, or uncheck crop box
        if (e.key === 'Escape') {
            e.preventDefault();
            if (isEyedropperActive && eraseTargetBounds) {
                // Backup current source to undo stack before erase mutation
                undoStack.push(imageEl.src);

                const canvas = document.createElement('canvas');
                canvas.width = originalWidth;
                canvas.height = originalHeight;
                const ctx = canvas.getContext('2d');

                // Draw current image
                ctx.drawImage(imageEl, 0, 0);

                // Erase target marquee selection to transparent
                if (isCircular) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(eraseTargetBounds.x + eraseTargetBounds.width / 2, eraseTargetBounds.y + eraseTargetBounds.height / 2, eraseTargetBounds.width / 2, 0, Math.PI * 2);
                    ctx.clip();
                    ctx.clearRect(eraseTargetBounds.x, eraseTargetBounds.y, eraseTargetBounds.width, eraseTargetBounds.height);
                    ctx.restore();
                } else {
                    ctx.clearRect(eraseTargetBounds.x, eraseTargetBounds.y, eraseTargetBounds.width, eraseTargetBounds.height);
                }

                const newSrc = canvas.toDataURL();
                initEditor(newSrc);

                endEyedropper();

                // Reset crop mode checkbox
                chkEnableCrop.checked = false;
                syncCropPresetUI();

                vscode.postMessage({ command: 'show-toast', text: 'Selection erased to transparent. Press Ctrl+Z to undo.' });
                return;
            }
            if (cropper) {
                chkEnableCrop.checked = false;
                syncCropPresetUI();
                cropper.clear();
                txtWidth.value = originalWidth;
                txtHeight.value = originalHeight;
                isCircular = false;
                presetButtons.forEach(b => b.classList.remove('active'));
            }
            return;
        }

        // Enter: apply crop selection if crop mode is active
        if (e.key === 'Enter') {
            if (chkEnableCrop.checked && cropper && cropper.cropped) {
                e.preventDefault();
                btnApplyCrop.click();
            }
            return;
        }
    });

    function performUndo() {
        if (undoStack.length > 0) {
            const prevSrc = undoStack.pop();
            initEditor(prevSrc);
            vscode.postMessage({ command: 'show-toast', text: 'Undo successful' });
        } else {
            vscode.postMessage({ command: 'show-toast', text: 'Nothing to undo' });
        }
    }

    function triggerSave(type) {
        if (window.editorApi && window.editorApi.getCanvasBlob) {
            window.editorApi.getCanvasBlob((blob) => {
                if (!blob) return;
                const reader = new FileReader();
                reader.onloadend = () => {
                    vscode.postMessage({
                        command: type === 'save' ? 'save-image' : 'export-image',
                        arrayBuffer: reader.result,
                        mimeType: blob.type
                    });
                };
                reader.readAsArrayBuffer(blob);
            });
        }
    }

    // Expose variables for save & import protocols
    window.editorApi = {
        initEditor,
        getCanvasBlob: function(callback) {
            if (!cropper) return;
            const format = selFormat.value;
            const quality = parseFloat(rngQuality.value) / 100;
            const targetWidth = parseInt(txtWidth.value, 10) || originalWidth;
            const targetHeight = parseInt(txtHeight.value, 10) || originalHeight;

            // If crop mode is NOT enabled, select the entire image bounds to get a clean full-image resize!
            if (!chkEnableCrop.checked) {
                cropper.crop();
                cropper.setData({
                    x: 0,
                    y: 0,
                    width: originalWidth,
                    height: originalHeight
                });
            }

            // Apply cropping with resizing
            let canvas = cropper.getCroppedCanvas({
                width: targetWidth,
                height: targetHeight,
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high'
            });

            // Apply circular mask if circle crop is active
            if (isCircular) {
                const circleCanvas = document.createElement('canvas');
                circleCanvas.width = canvas.width;
                circleCanvas.height = canvas.height;
                const ctx = circleCanvas.getContext('2d');
                
                ctx.beginPath();
                ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(canvas, 0, 0);
                canvas = circleCanvas;
            }

            canvas.toBlob(callback, format, quality);
        }
    };
})();
