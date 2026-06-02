(function() {
    const vscode = acquireVsCodeApi();
    let isDocumentEditor = false;
    let l10n = {};

    function t(key, replacements) {
        let message = l10n[key] || key;
        if (replacements) {
            Object.keys(replacements).forEach((name) => {
                message = message.replace(new RegExp(`\\{${name}\\}`, 'g'), replacements[name]);
            });
        }
        return message;
    }

    function applyI18n(root) {
        const scope = root || document;
        scope.querySelectorAll('[data-i18n]').forEach((el) => {
            el.textContent = t(el.getAttribute('data-i18n'));
        });
        scope.querySelectorAll('[data-i18n-html]').forEach((el) => {
            el.innerHTML = t(el.getAttribute('data-i18n-html'));
        });
        scope.querySelectorAll('[data-i18n-title]').forEach((el) => {
            el.title = t(el.getAttribute('data-i18n-title'));
        });
        scope.querySelectorAll('[data-i18n-label]').forEach((el) => {
            const meta = resizePanelLogic.resolveI18nPercentLabel(el.innerHTML);
            const valueEl = el.querySelector(`#${meta.valueId}`);
            const value = valueEl ? valueEl.textContent : meta.defaultValue;
            el.innerHTML = `${t(el.getAttribute('data-i18n-label'))} (<span id="${meta.valueId}">${value}</span>%)`;
        });
    }

    function usesMacShortcuts() {
        return /Mac|iPhone|iPod|iPad/i.test(navigator.platform) || navigator.userAgent.includes('Mac');
    }

    function formatShortcut(spec) {
        if (!spec) {
            return '';
        }

        const mod = usesMacShortcuts() ? '⌘' : 'Ctrl';
        const alt = usesMacShortcuts() ? '⌥' : 'Alt';
        return spec
            .replace(/mod\+/gi, `${mod}+`)
            .replace(/alt\+/gi, `${alt}+`)
            .replace(/shift\+/gi, 'Shift+');
    }

    function applyShortcutHints() {
        document.querySelectorAll('[data-shortcut]').forEach((el) => {
            const label = formatShortcut(el.getAttribute('data-shortcut'));
            const badge = el.querySelector('.context-menu-shortcut, .ui-shortcut-badge');
            if (badge) {
                badge.textContent = label;
            }

            const titleKey = el.getAttribute('data-i18n-title');
            if (titleKey) {
                const base = t(titleKey);
                el.title = label ? `${base} (${label})` : base;
            }
        });
    }

    function setShortcutHintsVisible(visible) {
        if (visible && shortcutOverlayDismissed) {
            visible = false;
        }
        document.body.classList.toggle('show-shortcut-hints', visible);
        if (shortcutOverlay) {
            shortcutOverlay.style.display = visible ? 'block' : 'none';
        }
        if (!visible) {
            hideShortcutHintTooltip();
        }
    }

    function updateShortcutHintsFromEvent(e) {
        const modifiersHeld = !!(e && (e.metaKey || e.ctrlKey));
        setShortcutHintsVisible(modifiersHeld && !shortcutOverlayDismissed);
    }

    function dismissShortcutLayers() {
        shortcutOverlayDismissed = true;
        setShortcutHintsVisible(false);
        hideShortcutHintTooltip();
        if (contextMenu) {
            contextMenu.style.display = 'none';
        }
    }

    function hideShortcutHintTooltip() {
        if (shortcutHintTooltip) {
            shortcutHintTooltip.style.display = 'none';
        }
    }

    function showShortcutHintTooltip(el, clientX, clientY) {
        if (!shortcutHintTooltip || !el) {
            return;
        }

        const label = formatShortcut(el.getAttribute('data-shortcut'));
        if (!label) {
            hideShortcutHintTooltip();
            return;
        }

        shortcutHintTooltip.textContent = label;
        shortcutHintTooltip.style.display = 'block';
        shortcutHintTooltip.style.left = `${clientX + 14}px`;
        shortcutHintTooltip.style.top = `${clientY + 14}px`;
    }

    function bindShortcutHintInteractions() {
        document.querySelectorAll('[data-shortcut]').forEach((el) => {
            el.addEventListener('mouseenter', (e) => {
                showShortcutHintTooltip(el, e.clientX, e.clientY);
            });
            el.addEventListener('mousemove', (e) => {
                if (shortcutHintTooltip && shortcutHintTooltip.style.display === 'block') {
                    showShortcutHintTooltip(el, e.clientX, e.clientY);
                }
            });
            el.addEventListener('mouseleave', hideShortcutHintTooltip);
        });
    }

    async function loadWebviewL10n() {
        const body = document.body;
        const enUrl = body.getAttribute('data-l10n-en');
        if (!enUrl) {
            return {};
        }

        const en = await (await fetch(enUrl)).json();
        const lang = body.dataset.lang || 'en';
        if (lang === 'en') {
            return en;
        }

        const localizedUrl = body.getAttribute(`data-l10n-${lang}`);
        if (!localizedUrl) {
            return en;
        }

        try {
            const localized = await (await fetch(localizedUrl)).json();
            return { ...en, ...localized };
        } catch {
            return en;
        }
    }
    const imageEl = document.getElementById('image');
    const sidebar = document.getElementById('sidebar');
    const toolbar = document.getElementById('toolbar');
    
    const txtWidth = document.getElementById('txtWidth');
    const txtHeight = document.getElementById('txtHeight');
    const chkLockRatio = document.getElementById('chkLockRatio');
    const rngResizeScale = document.getElementById('rngResizeScale');
    const resizeScaleVal = document.getElementById('resizeScaleVal');
    const btnApplyResize = document.getElementById('btnApplyResize');
    const btnApplyCrop = document.getElementById('btnApplyCrop');

    const selFormat = document.getElementById('selFormat');
    const qualitySection = document.getElementById('qualitySection');
    const rngQuality = document.getElementById('rngQuality');
    const qualityVal = document.getElementById('qualityVal');

    const chkEnableCrop = document.getElementById('chkEnableCrop');
    const lblZoomPercent = document.getElementById('lblZoomPercent');

    const historyList = document.getElementById('historyList');

    let cropper = null;
    let originalWidth = 0;
    let originalHeight = 0;
    let resizeBaseWidth = 0;
    let resizeBaseHeight = 0;
    let aspectRatio = 0;
    let isCircular = false;
    let scaleX = 1;
    let scaleY = 1;
    const MAX_HISTORY = 30;
    let historyStack = [];
    let initialImageSrc = '';
    let isEyedropperActive = false;
    let isColorPickerMode = false;
    let isMagicWandMode = false;
    let isApplyingMagicWandSelection = false;
    let magicWandMask = null;
    let magicWandBounds = null;
    let magicWandOverlayEl = null;
    let magicWandCanvas = null;
    let magicWandCtx = null;
    let isOptionPressed = false;
    let colorPickerCanvas = null;
    let colorPickerCtx = null;
    let lastPickerPreview = '';
    let eraseTargetBounds = null;
    let eyedropperCanvas = null;
    let eyedropperCtx = null;
    let lastSampledColor = null;
    let initialFitRatio = 1;
    /** Natural-image crop rect; kept in sync on crop changes, not re-read after zoom. */
    let lastNaturalCropData = null;
    const eyedropperTooltip = document.getElementById('eyedropperTooltip');
    const colorPickerTooltip = document.getElementById('colorPickerTooltip');
    const colorPickerSwatch = document.getElementById('colorPickerSwatch');
    const colorPickerPreview = document.getElementById('colorPickerPreview');
    const zoomLoupePanel = document.getElementById('zoomLoupePanel');
    const zoomLoupeCanvas = document.getElementById('zoomLoupeCanvas');
    const zoomLoupeSelection = document.getElementById('zoomLoupeSelection');
    const zoomLoupeCtx = zoomLoupeCanvas ? zoomLoupeCanvas.getContext('2d') : null;
    const Z_LOUPE_PANEL_PX = 200;
    const Z_LOUPE_SPOT_RADIUS = 24;
    const Z_LOUPE_MIN_DRAG = 2;
    const colorModal = document.getElementById('colorModal');
    const colorModalBackdrop = document.getElementById('colorModalBackdrop');
    const colorModalClose = document.getElementById('colorModalClose');
    const colorModalSwatch = document.getElementById('colorModalSwatch');
    const copyModal = document.getElementById('copyModal');
    const copyModalBackdrop = document.getElementById('copyModalBackdrop');
    const copyModalClose = document.getElementById('copyModalClose');
    const copyFormatOptions = document.getElementById('copyFormatOptions');
    const copyQualitySection = document.getElementById('copyQualitySection');
    const rngCopyQuality = document.getElementById('rngCopyQuality');
    const copyQualityVal = document.getElementById('copyQualityVal');
    const btnCopyConfirm = document.getElementById('btnCopyConfirm');
    const copyScopeSection = document.getElementById('copyScopeSection');
    const chkCopySelectionOnly = document.getElementById('chkCopySelectionOnly');
    const copyScopeInfo = document.getElementById('copyScopeInfo');
    const colorFormatList = document.getElementById('colorFormatList');
    const rngMagicWandTolerance = document.getElementById('rngMagicWandTolerance');
    const magicWandToleranceVal = document.getElementById('magicWandToleranceVal');
    const btnMagicWand = document.getElementById('btnMagicWand');

    const lblDimensions = document.getElementById('lblDimensions');
    const lblFilename = document.getElementById('lblFilename');

    const dashboard = document.getElementById('dashboard');
    const workspace = document.getElementById('workspace');
    const cardImport = document.getElementById('cardImport');
    const filePicker = document.getElementById('filePicker');
    const cardPaste = document.getElementById('cardPaste');

    const contextMenu = document.getElementById('contextMenu');
    const shortcutOverlay = document.getElementById('shortcutOverlay');
    const shortcutHintTooltip = document.getElementById('shortcutHintTooltip');
    let shortcutOverlayDismissed = false;

    function notifyDocumentChanged(labelKey) {
        if (!isDocumentEditor) {
            return;
        }
        vscode.postMessage({ command: 'document-changed', label: t(labelKey) });
    }

    function trimHistoryStack() {
        if (historyStack.length > MAX_HISTORY) {
            historyStack = historyStack.slice(historyStack.length - MAX_HISTORY);
        }
    }

    function pushHistorySnapshot(labelKey) {
        if (!imageEl || !imageEl.src) {
            return;
        }
        historyStack.push({
            src: imageEl.src,
            label: labelKey ? t(labelKey) : t('edit.edit')
        });
        trimHistoryStack();
        renderHistoryPanel();
    }

    function renderHistoryPanel() {
        if (!historyList || !imageEl) {
            return;
        }

        historyList.innerHTML = '';

        const currentBtn = document.createElement('button');
        currentBtn.type = 'button';
        currentBtn.className = 'history-item history-item-current';
        currentBtn.disabled = true;
        currentBtn.appendChild(createHistoryThumb(imageEl.src));
        currentBtn.appendChild(createHistoryMeta(t('history.current'), t('history.current')));
        historyList.appendChild(currentBtn);

        for (let i = historyStack.length - 1; i >= 0; i--) {
            const entry = historyStack[i];
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'history-item';
            btn.appendChild(createHistoryThumb(entry.src));
            btn.appendChild(createHistoryMeta(entry.label, `#${i + 1}`));
            btn.addEventListener('click', () => restoreHistorySnapshot(i));
            historyList.appendChild(btn);
        }
    }

    function createHistoryThumb(src) {
        const thumb = document.createElement('img');
        thumb.className = 'history-thumb';
        thumb.src = src;
        thumb.alt = '';
        thumb.loading = 'lazy';
        return thumb;
    }

    function createHistoryMeta(label, step) {
        const meta = document.createElement('div');
        meta.className = 'history-meta';
        const labelEl = document.createElement('span');
        labelEl.className = 'history-label';
        labelEl.textContent = label;
        const stepEl = document.createElement('span');
        stepEl.className = 'history-step';
        stepEl.textContent = step;
        meta.appendChild(labelEl);
        meta.appendChild(stepEl);
        return meta;
    }

    function restoreHistorySnapshot(stackIndex) {
        if (stackIndex < 0 || stackIndex >= historyStack.length) {
            return;
        }
        const entry = historyStack[stackIndex];
        historyStack = historyStack.slice(0, stackIndex);
        initEditor(entry.src);
        vscode.postMessage({
            command: 'show-toast',
            text: t('toast.historyRestored', { label: entry.label })
        });
    }

    function pushUndoSnapshot(labelKey) {
        if (!cropper) {
            return;
        }

        if (!chkEnableCrop.checked) {
            cropper.crop();
            cropper.setData({
                x: 0,
                y: 0,
                width: originalWidth,
                height: originalHeight
            });
        }

        let canvas = cropper.getCroppedCanvas({
            width: originalWidth,
            height: originalHeight,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high'
        });

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

        historyStack.push({
            src: canvas.toDataURL(),
            label: labelKey ? t(labelKey) : t('edit.edit')
        });
        trimHistoryStack();
        renderHistoryPanel();
    }

    function markTransformEdit(labelKey) {
        pushUndoSnapshot(labelKey);
        notifyDocumentChanged(labelKey);
    }

    function respondWithImageData(requestId) {
        if (!window.editorApi || !window.editorApi.getCanvasBlob) {
            vscode.postMessage({ command: 'image-data-response', requestId, arrayBuffer: null, mimeType: 'image/png' });
            return;
        }

        window.editorApi.getCanvasBlob((blob) => {
            if (!blob) {
                vscode.postMessage({ command: 'image-data-response', requestId, arrayBuffer: null, mimeType: 'image/png' });
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                vscode.postMessage({
                    command: 'image-data-response',
                    requestId,
                    arrayBuffer: reader.result,
                    mimeType: blob.type
                });
            };
            reader.readAsArrayBuffer(blob);
        });
    }

    function revertUntitledEditor() {
        historyStack = [];
        renderHistoryPanel();
        endEyedropper();
        endColorPickerMode();
        hideColorModal();
        invalidateColorPickerCanvas();
        invalidateMagicWandCanvas();
        clearMagicWandMask();
        endMagicWandMode(false);
        if (cropper) {
            cropper.destroy();
            cropper = null;
        }
        clearNaturalCropData();
        initialImageSrc = null;
        imageEl.removeAttribute('src');
        imageEl.src = '';
        toolbar.style.display = 'none';
        sidebar.style.display = 'none';
        dashboard.style.display = 'flex';
        workspace.style.display = 'none';
        const untitledName = document.body.dataset.untitledFilename;
        if (untitledName && lblFilename) {
            lblFilename.textContent = untitledName;
        }
    }

    function revertToSource(src, filename) {
        historyStack = [];
        renderHistoryPanel();
        endEyedropper();
        endColorPickerMode();
        hideColorModal();
        invalidateColorPickerCanvas();
        invalidateMagicWandCanvas();
        clearMagicWandMask();
        endMagicWandMode(false);
        initialImageSrc = src;
        if (filename && lblFilename) {
            lblFilename.textContent = filename;
        }
        initEditor(src, { preserveInitialSrc: true });
        vscode.postMessage({ command: 'show-toast', text: t('toast.reverted') });
    }

    window.addEventListener('message', (event) => {
        const message = event.data;
        switch (message.command) {
            case 'request-image-data':
                respondWithImageData(message.requestId);
                break;
            case 'revert-document':
                revertToSource(message.src, message.filename);
                break;
            case 'revert-untitled':
                revertUntitledEditor();
                break;
            case 'perform-undo':
                performUndo({ fromHost: true });
                break;
            case 'document-saved':
                break;
        }
    });

    // Rulers & scroll viewport
    const rulerH = document.getElementById('rulerH');
    const rulerV = document.getElementById('rulerV');
    const canvasScrollArea = document.getElementById('canvasScrollArea');
    const canvasScrollContent = document.getElementById('canvasScrollContent');
    const imageContainer = document.getElementById('imageContainer');
    const RULER_SIZE = 20; // px — must match CSS --ruler-size
    const CANVAS_PADDING = 20; // px — must match .canvas-scroll-content padding
    let expandingContainer = false;
    let expandContainerFrame = null;
    let isSpacePressed = false;
    let isZLoupeActive = false;
    let isZLoupeDragging = false;
    let zLoupeDragStart = null;
    let isPanning = false;
    let lastPanClientX = 0;
    let lastPanClientY = 0;

    function scheduleSyncLayout() {
        if (expandContainerFrame !== null) {
            cancelAnimationFrame(expandContainerFrame);
        }
        expandContainerFrame = requestAnimationFrame(() => {
            expandContainerFrame = null;
            syncLayoutAfterZoom();
        });
    }

    function updateCropInteraction() {
        if (!cropper) {
            return;
        }
        if (isSpacePressed || isZLoupeActive || isEyedropperActive || isColorPickerMode || isMagicWandMode) {
            cropper.setDragMode('none');
            return;
        }
        cropper.setDragMode(chkEnableCrop.checked ? 'crop' : 'none');
    }

    const cropMarqueeLogic = globalThis.VsimageCropMarqueeLogic;
    const resizePanelLogic = globalThis.VsimageResizePanelLogic;

    function clampCropBox(x, y, width, height) {
        return cropMarqueeLogic.clampCropBox(x, y, width, height, originalWidth, originalHeight);
    }

    function initMarqueeToFullImage() {
        setMarqueeToFullImage();
    }

    function setMarqueeToFullImage() {
        if (!cropper) {
            return;
        }
        if (!cropper.cropped) {
            cropper.crop();
        }
        normalizeCanvasOrigin();
        cropper.setData(clampCropBox(0, 0, originalWidth, originalHeight));
        updateResizeInputsFromCrop();
        cacheNaturalCropData();
        scheduleSyncLayout();
    }

    function isCropBoxMatchingCanvas(tolerance = 2) {
        if (!cropper || !cropper.cropped) {
            return false;
        }
        normalizeCanvasOrigin();
        const canvas = cropper.getCanvasData();
        const box = cropper.getCropBoxData();
        if (!canvas?.width || !box?.width) {
            return false;
        }
        return Math.abs(box.left - canvas.left) <= tolerance
            && Math.abs(box.top - canvas.top) <= tolerance
            && Math.abs(box.width - canvas.width) <= tolerance
            && Math.abs(box.height - canvas.height) <= tolerance;
    }

    function isMarqueeFullImageNatural(tolerance = 2) {
        if (!cropper || !cropper.cropped) {
            return false;
        }
        return cropMarqueeLogic.isMarqueeFullImageNatural(
            cropper.getData(true),
            originalWidth,
            originalHeight,
            tolerance
        );
    }

    function ensureCropMarqueeForKeyboard() {
        if (!cropper || !chkEnableCrop.checked) {
            return false;
        }

        if (!cropper.cropped) {
            initMarqueeToFullImage();
        }

        return cropper.cropped;
    }

    function focusCropKeyboardTarget() {
        if (workspace && workspace.style.display !== 'none') {
            workspace.focus({ preventScroll: true });
        }
    }

    function moveCropMarqueeWithArrow(key, shiftKey) {
        if (!ensureCropMarqueeForKeyboard()) {
            return false;
        }
        if (isSpacePressed || isZLoupeActive || isEyedropperActive || isColorPickerMode || isMagicWandMode) {
            return false;
        }

        const data = cropper.getData(true);
        const step = shiftKey ? 10 : 1;
        let nextX = data.x;
        let nextY = data.y;

        switch (key) {
            case 'ArrowLeft':
                nextX -= step;
                break;
            case 'ArrowRight':
                nextX += step;
                break;
            case 'ArrowUp':
                nextY -= step;
                break;
            case 'ArrowDown':
                nextY += step;
                break;
            default:
                return false;
        }

        cropper.setData(clampCropBox(nextX, nextY, data.width, data.height));
        updateResizeInputsFromCrop();
        cacheNaturalCropData();
        focusCropKeyboardTarget();
        return true;
    }

    function resizeCropMarqueeByInset(inset) {
        if (!ensureCropMarqueeForKeyboard()) {
            return false;
        }
        if (isSpacePressed || isZLoupeActive || isEyedropperActive || isColorPickerMode || isMagicWandMode) {
            return false;
        }

        const data = cropper.getData(true);
        const nextX = data.x + inset;
        const nextY = data.y + inset;
        const nextW = data.width - (inset * 2);
        const nextH = data.height - (inset * 2);

        if (nextW < 1 || nextH < 1) {
            return false;
        }

        const clamped = clampCropBox(nextX, nextY, nextW, nextH);
        if (clamped.width === data.width
            && clamped.height === data.height
            && clamped.x === data.x
            && clamped.y === data.y) {
            return false;
        }

        cropper.setData(clamped);
        updateResizeInputsFromCrop();
        cacheNaturalCropData();
        focusCropKeyboardTarget();
        return true;
    }

    function cacheNaturalCropData() {
        if (cropper && chkEnableCrop.checked && cropper.cropped) {
            lastNaturalCropData = cropper.getData(true);
        }
    }

    function clearNaturalCropData() {
        lastNaturalCropData = null;
    }

    function setCropperContainerSize(w, h) {
        if (!cropper || !cropper.cropper) {
            return;
        }
        const el = cropper.cropper;
        el.style.width = w + 'px';
        el.style.height = h + 'px';
        el.style.overflow = 'visible';
        cropper.containerData.width = w;
        cropper.containerData.height = h;
    }

    function preExpandContainerForSize(targetW, targetH) {
        if (!cropper) {
            return;
        }
        const cw = cropper.containerData.width;
        const ch = cropper.containerData.height;
        if (targetW > cw || targetH > ch) {
            setCropperContainerSize(
                Math.max(Math.ceil(targetW), cw),
                Math.max(Math.ceil(targetH), ch)
            );
        }
    }

    function scaleCropBoxAfterZoom(prevCanvas, prevBox) {
        if (!cropper || !prevCanvas || !prevBox || !chkEnableCrop.checked || !cropper.cropped) {
            return;
        }
        const canvas = cropper.getCanvasData();
        if (!canvas.width || !prevCanvas.width) {
            return;
        }
        const factor = canvas.width / prevCanvas.width;
        if (Math.abs(factor - 1) < 0.0001) {
            return;
        }
        const relLeft = prevBox.left - prevCanvas.left;
        const relTop = prevBox.top - prevCanvas.top;
        cropper.setCropBoxData({
            left: canvas.left + relLeft * factor,
            top: canvas.top + relTop * factor,
            width: prevBox.width * factor,
            height: prevBox.height * factor
        });
        cacheNaturalCropData();
    }

    function normalizeCanvasOrigin() {
        if (!cropper) {
            return;
        }
        const canvas = cropper.getCanvasData();
        if (!canvas) {
            return;
        }
        const offsetX = canvas.left;
        const offsetY = canvas.top;
        if (Math.abs(offsetX) < 0.5 && Math.abs(offsetY) < 0.5) {
            return;
        }
        const w = canvas.width;
        const h = canvas.height;
        const box = cropper.cropped ? cropper.getCropBoxData() : null;
        cropper.setCanvasData({ left: 0, top: 0, width: w, height: h });
        if (box) {
            cropper.setCropBoxData({
                left: box.left - offsetX,
                top: box.top - offsetY,
                width: box.width,
                height: box.height
            });
        }
    }

    function snapshotCropState() {
        if (!cropper || !chkEnableCrop.checked || !cropper.cropped) {
            return { canvas: null, box: null };
        }
        return {
            canvas: Object.assign({}, cropper.getCanvasData()),
            box: Object.assign({}, cropper.getCropBoxData())
        };
    }

    /** Keep cropper container, scroll area, and canvas in sync after zoom/rotate. */
    function syncLayoutAfterZoom() {
        if (!cropper || expandingContainer || isPanning) {
            return;
        }

        const canvasData = cropper.getCanvasData();
        if (!canvasData || !canvasData.width) {
            return;
        }

        normalizeCanvasOrigin();

        const syncedCanvas = cropper.getCanvasData();
        const w = Math.ceil(syncedCanvas.width);
        const h = Math.ceil(syncedCanvas.height);
        const imgContainerEl = imageContainer || document.querySelector('.image-container');
        if (!cropper.cropper || !imgContainerEl || !canvasScrollContent || !canvasScrollArea) {
            return;
        }

        expandingContainer = true;
        try {
            setCropperContainerSize(w, h);

            const viewportW = canvasScrollArea.clientWidth;
            const viewportH = canvasScrollArea.clientHeight;
            const totalW = w + (CANVAS_PADDING * 2);
            const totalH = h + (CANVAS_PADDING * 2);
            const contentW = Math.max(viewportW, totalW);
            const contentH = Math.max(viewportH, totalH);

            imgContainerEl.style.width = w + 'px';
            imgContainerEl.style.height = h + 'px';
            imgContainerEl.style.marginLeft = contentW > totalW ? Math.floor((contentW - totalW) / 2) + 'px' : '0';
            imgContainerEl.style.marginTop = contentH > totalH ? Math.floor((contentH - totalH) / 2) + 'px' : '0';

            canvasScrollContent.style.width = contentW + 'px';
            canvasScrollContent.style.height = contentH + 'px';
        } finally {
            expandingContainer = false;
        }

        drawRulers();
        renderMagicWandOverlay();
    }

    function applyZoom(delta) {
        if (!cropper) {
            return;
        }
        const snap = snapshotCropState();
        if (delta > 0 && snap.canvas) {
            preExpandContainerForSize(
                snap.canvas.width * (1 + delta),
                snap.canvas.height * (1 + delta)
            );
        }
        cropper.zoom(delta);
        scaleCropBoxAfterZoom(snap.canvas, snap.box);
        syncLayoutAfterZoom();
    }

    function applyZoomTo(ratio) {
        if (!cropper) {
            return;
        }
        const snap = snapshotCropState();
        const cd = snap.canvas || cropper.getCanvasData();
        if (cd && cd.naturalWidth) {
            preExpandContainerForSize(cd.naturalWidth * ratio, cd.naturalHeight * ratio);
        }
        cropper.zoomTo(ratio);
        if (snap.canvas && snap.box) {
            scaleCropBoxAfterZoom(snap.canvas, snap.box);
        } else if (lastNaturalCropData && chkEnableCrop.checked && cropper.cropped) {
            cropper.setData(lastNaturalCropData);
            updateResizeInputsFromCrop();
            cacheNaturalCropData();
        }
        syncLayoutAfterZoom();
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

    // Show shortcut hints while Cmd / Ctrl is held down
    document.addEventListener('keydown', (e) => {
        updateShortcutHintsFromEvent(e);
    });
    document.addEventListener('keyup', (e) => {
        if (e.key === 'Meta' || e.key === 'Control') {
            shortcutOverlayDismissed = false;
        }
        updateShortcutHintsFromEvent(e);
    });
    window.addEventListener('blur', () => {
        setShortcutHintsVisible(false);
    });

    // Redraw rulers while panning/scrolling (RAF-throttled) — set up once
    let rulerRafId = null;
    function scheduleRulerRedraw() {
        if (rulerRafId !== null) {
            return;
        }
        rulerRafId = requestAnimationFrame(() => {
            drawRulers();
            rulerRafId = null;
        });
    }

    if (canvasScrollArea) {
        canvasScrollArea.addEventListener('scroll', scheduleRulerRedraw);

        canvasScrollArea.addEventListener('mousedown', () => {
            focusCropKeyboardTarget();
        });

        canvasScrollArea.addEventListener('wheel', (e) => {
            if (!cropper) {
                return;
            }

            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                applyZoom(e.deltaY < 0 ? 0.1 : -0.1);
                return;
            }

            const canScrollX = canvasScrollArea.scrollWidth > canvasScrollArea.clientWidth + 1;
            const canScrollY = canvasScrollArea.scrollHeight > canvasScrollArea.clientHeight + 1;
            if (!canScrollX && !canScrollY) {
                return;
            }

            e.preventDefault();
            canvasScrollArea.scrollLeft += e.deltaX;
            canvasScrollArea.scrollTop += e.deltaY;
            scheduleRulerRedraw();
        }, { passive: false, capture: true });
    }

    // Space + drag pan (hand tool)
    function isTypingTarget(el) {
        return el && (
            el.tagName === 'INPUT' ||
            el.tagName === 'SELECT' ||
            el.tagName === 'TEXTAREA' ||
            el.isContentEditable
        );
    }

    function isPanTargetVisible() {
        return workspace && workspace.style.display !== 'none';
    }

    function setPanMode(active) {
        if (canvasScrollArea) {
            canvasScrollArea.classList.toggle('pan-mode', active);
        }
        if (!active && canvasScrollArea) {
            canvasScrollArea.classList.remove('pan-grabbing');
        }
        updateCropInteraction();
    }

    function endPanning() {
        const wasPanning = isPanning;
        isPanning = false;
        if (canvasScrollArea) {
            canvasScrollArea.classList.remove('pan-grabbing');
        }
        if (wasPanning) {
            scheduleSyncLayout();
        }
    }

    document.addEventListener('keydown', (e) => {
        if (e.code !== 'Space' || e.repeat || isTypingTarget(document.activeElement)) {
            return;
        }
        if (!isPanTargetVisible()) {
            return;
        }
        e.preventDefault();
        isSpacePressed = true;
        setPanMode(true);
    });

    document.addEventListener('keyup', (e) => {
        if (e.code !== 'Space') {
            return;
        }
        isSpacePressed = false;
        endPanning();
        setPanMode(false);
        scheduleSyncLayout();
    });

    window.addEventListener('blur', () => {
        isSpacePressed = false;
        endPanning();
        setPanMode(false);
        setZLoupeActive(false);
        scheduleSyncLayout();
    });

    function canUseZLoupe() {
        return !!(cropper && isPanTargetVisible()
            && !isEyedropperActive
            && !isColorPickerMode
            && !isMagicWandMode
            && !isSpacePressed);
    }

    function setZLoupeActive(active) {
        isZLoupeActive = active;
        if (!active) {
            endZLoupeDrag();
            hideZoomLoupe();
        }
        if (canvasScrollArea) {
            canvasScrollArea.classList.toggle('zoom-loupe-active', active && canUseZLoupe());
        }
        updateCropInteraction();
    }

    function endZLoupeDrag() {
        isZLoupeDragging = false;
        zLoupeDragStart = null;
        hideZoomLoupeSelectionOverlay();
    }

    function hideZoomLoupe() {
        if (zoomLoupePanel) {
            zoomLoupePanel.style.display = 'none';
        }
    }

    function hideZoomLoupeSelectionOverlay() {
        if (zoomLoupeSelection) {
            zoomLoupeSelection.style.display = 'none';
        }
    }

    function clampNaturalRect(x, y, width, height) {
        const w = Math.max(1, Math.min(width, originalWidth));
        const h = Math.max(1, Math.min(height, originalHeight));
        const maxX = Math.max(0, originalWidth - w);
        const maxY = Math.max(0, originalHeight - h);
        return {
            x: Math.max(0, Math.min(maxX, x)),
            y: Math.max(0, Math.min(maxY, y)),
            width: w,
            height: h
        };
    }

    function getNaturalRectFromPoints(start, end) {
        const x0 = Math.min(start.x, end.x);
        const y0 = Math.min(start.y, end.y);
        const x1 = Math.max(start.x, end.x);
        const y1 = Math.max(start.y, end.y);
        const width = Math.max(Z_LOUPE_MIN_DRAG, x1 - x0 + 1);
        const height = Math.max(Z_LOUPE_MIN_DRAG, y1 - y0 + 1);
        return clampNaturalRect(x0, y0, width, height);
    }

    function naturalRectToClientBounds(rect) {
        if (!cropper) {
            return null;
        }
        const imageData = cropper.getImageData();
        const containerRect = cropper.container.getBoundingClientRect();
        if (!imageData.width || !imageData.naturalWidth) {
            return null;
        }
        const scaleX = imageData.width / imageData.naturalWidth;
        const scaleY = imageData.height / imageData.naturalHeight;
        return {
            left: containerRect.left + imageData.left + rect.x * scaleX,
            top: containerRect.top + imageData.top + rect.y * scaleY,
            width: rect.width * scaleX,
            height: rect.height * scaleY
        };
    }

    function drawZoomLoupeRegion(rect) {
        if (!zoomLoupePanel || !zoomLoupeCanvas || !zoomLoupeCtx || !ensureColorPickerCanvas()) {
            return;
        }
        zoomLoupePanel.style.display = 'flex';
        zoomLoupeCtx.imageSmoothingEnabled = true;
        zoomLoupeCtx.imageSmoothingQuality = 'high';
        zoomLoupeCtx.clearRect(0, 0, Z_LOUPE_PANEL_PX, Z_LOUPE_PANEL_PX);
        zoomLoupeCtx.drawImage(
            colorPickerCanvas,
            rect.x,
            rect.y,
            rect.width,
            rect.height,
            0,
            0,
            Z_LOUPE_PANEL_PX,
            Z_LOUPE_PANEL_PX
        );
    }

    function updateZoomLoupeSpot(point) {
        const half = Z_LOUPE_SPOT_RADIUS;
        const rect = clampNaturalRect(
            point.x - half,
            point.y - half,
            half * 2 + 1,
            half * 2 + 1
        );
        drawZoomLoupeRegion(rect);
        hideZoomLoupeSelectionOverlay();
    }

    function updateZoomLoupeDrag(start, end) {
        const rect = getNaturalRectFromPoints(start, end);
        drawZoomLoupeRegion(rect);
        const bounds = naturalRectToClientBounds(rect);
        if (!bounds || !zoomLoupeSelection) {
            return;
        }
        zoomLoupeSelection.style.display = 'block';
        zoomLoupeSelection.style.left = `${bounds.left}px`;
        zoomLoupeSelection.style.top = `${bounds.top}px`;
        zoomLoupeSelection.style.width = `${bounds.width}px`;
        zoomLoupeSelection.style.height = `${bounds.height}px`;
    }

    function onZLoupeMouseMove(e) {
        if (!isZLoupeActive || !canUseZLoupe()) {
            return;
        }
        if (isZLoupeDragging && zLoupeDragStart) {
            const point = getImagePointFromEvent(e);
            if (point) {
                updateZoomLoupeDrag(zLoupeDragStart, point);
            }
            return;
        }
        const point = getImagePointFromEvent(e);
        if (!point) {
            hideZoomLoupe();
            return;
        }
        updateZoomLoupeSpot(point);
    }

    function onZLoupeMouseDown(e) {
        if (!isZLoupeActive || !canUseZLoupe() || e.button !== 0) {
            return;
        }
        if (!canvasScrollArea || !canvasScrollArea.contains(e.target)) {
            return;
        }
        if (e.target.closest('.floating-toolbar')) {
            return;
        }
        const point = getImagePointFromEvent(e);
        if (!point) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        isZLoupeDragging = true;
        zLoupeDragStart = point;
        updateZoomLoupeDrag(point, point);
    }

    document.addEventListener('keydown', (e) => {
        if (e.code !== 'KeyZ' || e.repeat || e.metaKey || e.ctrlKey || e.altKey) {
            return;
        }
        if (isTypingTarget(document.activeElement)) {
            return;
        }
        if (!canUseZLoupe()) {
            return;
        }
        e.preventDefault();
        setZLoupeActive(true);
    });

    document.addEventListener('keyup', (e) => {
        if (e.code !== 'KeyZ') {
            return;
        }
        setZLoupeActive(false);
    });

    document.addEventListener('mousedown', onZLoupeMouseDown, true);
    document.addEventListener('mousemove', onZLoupeMouseMove);
    document.addEventListener('mouseup', () => {
        if (isZLoupeDragging) {
            endZLoupeDrag();
        }
    });

    function onPanMouseDown(e) {
        if (!isSpacePressed || !canvasScrollArea || e.button !== 0 || isEyedropperActive || isColorPickerMode || isZLoupeActive) {
            return;
        }
        if (!isPanTargetVisible()) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();
        syncLayoutAfterZoom();
        isPanning = true;
        lastPanClientX = e.clientX;
        lastPanClientY = e.clientY;
        canvasScrollArea.classList.add('pan-grabbing');
    }

    function onPanMouseMove(e) {
        if (!isPanning || !canvasScrollArea) {
            return;
        }
        e.preventDefault();

        const dx = e.clientX - lastPanClientX;
        const dy = e.clientY - lastPanClientY;
        lastPanClientX = e.clientX;
        lastPanClientY = e.clientY;

        canvasScrollArea.scrollLeft -= dx;
        canvasScrollArea.scrollTop -= dy;
        scheduleRulerRedraw();
    }

    document.addEventListener('mousedown', (e) => {
        if (!isSpacePressed || !canvasScrollArea || e.button !== 0 || isEyedropperActive || isColorPickerMode || isZLoupeActive) {
            return;
        }
        if (!isPanTargetVisible()) {
            return;
        }
        if (e.target.closest('.floating-toolbar')) {
            return;
        }
        if (!canvasScrollArea.contains(e.target)) {
            return;
        }
        onPanMouseDown(e);
    }, true);

    document.addEventListener('mousemove', onPanMouseMove);
    document.addEventListener('mouseup', endPanning);

    if (workspace) {
        const rulerResizeObserver = new ResizeObserver(() => {
            scheduleSyncLayout();
        });
        rulerResizeObserver.observe(workspace);
        if (canvasScrollArea) {
            rulerResizeObserver.observe(canvasScrollArea);
        }
    }

    function startEditorMode() {
        if (!imageEl || !imageEl.getAttribute('src') || imageEl.getAttribute('src') === '') {
            dashboard.style.display = 'flex';
            workspace.style.display = 'none';
        } else {
            dashboard.style.display = 'none';
            workspace.style.display = 'grid';
            initEditor(imageEl.src);
        }
    }

    async function bootstrap() {
        try {
            l10n = await loadWebviewL10n();
        } catch (err) {
            console.error('[vsimage] Failed to load translations:', err);
            l10n = {};
        }

        isDocumentEditor = document.body.dataset.documentEditor === 'true';
        applyI18n();
        applyShortcutHints();
        bindShortcutHintInteractions();
        startEditorMode();
    }

    bootstrap();

    // File import triggers
    cardImport.addEventListener('click', () => filePicker.click());
    filePicker.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            loadFile(e.target.files[0]);
        }
    });

    // Clipboard Paste trigger click
    cardPaste.addEventListener('click', () => {
        vscode.postMessage({ command: 'show-toast', text: t('toast.pasteHint') });
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
            lblFilename.textContent = file.name || t('pastedImage');
            dashboard.style.display = 'none';
            workspace.style.display = 'grid';
            initEditor(event.target.result);
            if (isDocumentEditor) {
                notifyDocumentChanged('edit.edit');
            }
        };
        reader.readAsDataURL(file);
    }

    function getViewportFitRatio() {
        if (!canvasScrollArea) {
            return 1;
        }
        const availW = Math.max(1, canvasScrollArea.clientWidth - (CANVAS_PADDING * 2));
        const availH = Math.max(1, canvasScrollArea.clientHeight - (CANVAS_PADDING * 2));
        return Math.min(availW / originalWidth, availH / originalHeight, 1);
    }

    function applyZoomAfterResize(preferredRatio) {
        if (!cropper) {
            return;
        }
        const maxFit = getViewportFitRatio();
        let ratio = preferredRatio != null ? preferredRatio : maxFit;
        ratio = Math.min(ratio, maxFit);
        applyZoomTo(ratio);
        initialFitRatio = maxFit;
        updateZoomIndicator();
    }

    function initEditor(src, options) {
        const preserveInitialSrc = options && options.preserveInitialSrc;
        const afterResize = options && options.afterResize;
        const preserveZoomRatio = options && options.preserveZoomRatio;
        invalidateColorPickerCanvas();
        invalidateMagicWandCanvas();
        clearMagicWandMask();
        endMagicWandMode(false);
        if (!initialImageSrc || preserveInitialSrc) {
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
            syncResizeInputsToOriginal();

            // Show UI panes
            sidebar.style.display = 'flex';
            toolbar.style.display = 'flex';
            renderHistoryPanel();

            // Destroy previous instance
            if (cropper) {
                cropper.destroy();
            }
            clearNaturalCropData();

            // Uncheck crop checkbox and disable aspect presets visually by default on loading a new image
            chkEnableCrop.checked = false;
            syncCropPresetUI();

            // Create Cropper
            cropper = new Cropper(imageEl, {
                aspectRatio: NaN,
                viewMode: 1,
                background: false,
                responsive: false,
                autoCrop: false,
                zoomOnWheel: false,
                zoomable: true,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: false,
                ready() {
                    if (canvasScrollArea) {
                        canvasScrollArea.scrollLeft = 0;
                        canvasScrollArea.scrollTop = 0;
                        if (afterResize) {
                            applyZoomAfterResize(preserveZoomRatio);
                        } else {
                            const fitRatio = getViewportFitRatio();
                            if (fitRatio < 1) {
                                applyZoomTo(fitRatio);
                            }
                        }
                    }
                    updateZoomIndicator();
                    scheduleSyncLayout();
                    requestAnimationFrame(() => {
                        scheduleSyncLayout();
                        if (!afterResize) {
                            captureInitialFitRatio();
                        }
                    });
                    updateCropInteraction();
                    if (resizePanelLogic.shouldSyncResizePanelFromImage(chkEnableCrop.checked, cropper.cropped)) {
                        syncResizeInputsToOriginal();
                    } else {
                        updateResizeInputsFromCrop();
                    }
                    focusCropKeyboardTarget();
                },
                cropmove() {
                    updateResizeInputsFromCrop();
                    cacheNaturalCropData();
                },
                crop() {
                    if (!isApplyingMagicWandSelection) {
                        clearMagicWandMask();
                    }
                    if (cropper && cropper.cropped && !chkEnableCrop.checked) {
                        chkEnableCrop.checked = true;
                        syncCropPresetUI();
                        presetButtons.forEach(b => b.classList.remove('active'));
                        const freeBtn = document.querySelector('#cropPresets button[data-ratio="NaN"]');
                        if (freeBtn) freeBtn.classList.add('active');
                    }
                    updateResizeInputsFromCrop();
                    cacheNaturalCropData();
                },
                zoom() {
                    updateZoomIndicator();
                    requestAnimationFrame(() => {
                        renderMagicWandOverlay();
                    });
                }
            });
        };
    }

    function applyResizePanelState(panel) {
        resizeBaseWidth = panel.baseWidth;
        resizeBaseHeight = panel.baseHeight;
        if (txtWidth) {
            txtWidth.value = panel.width;
            txtWidth.placeholder = panel.widthPlaceholder != null
                ? panel.widthPlaceholder
                : (panel.width > 0 ? String(panel.width) : '');
        }
        if (txtHeight) {
            txtHeight.value = panel.height;
            txtHeight.placeholder = panel.height > 0 ? String(panel.height) : '';
        }
        if (rngResizeScale) {
            rngResizeScale.value = panel.scalePercent;
        }
        if (resizeScaleVal) {
            resizeScaleVal.textContent = String(panel.scalePercent);
        }
    }

    function syncResizeInputsToOriginal() {
        applyResizePanelState(
            resizePanelLogic.buildResizePanelFromImage(originalWidth, originalHeight)
        );
    }

    function applyResizeScale(percent) {
        const dims = resizePanelLogic.dimensionsFromResizeScalePercent(
            percent,
            resizeBaseWidth,
            resizeBaseHeight
        );
        txtWidth.value = dims.width;
        txtHeight.value = dims.height;
    }

    /** Downscale in ~50% steps to reduce blur/aliasing from one-shot canvas resize. */
    function resizeCanvasStepped(source, targetW, targetH) {
        const srcW = source.width;
        const srcH = source.height;
        if (srcW === targetW && srcH === targetH) {
            return source;
        }

        function drawToSize(src, w, h) {
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(src, 0, 0, w, h);
            return canvas;
        }

        if (targetW >= srcW && targetH >= srcH) {
            return drawToSize(source, targetW, targetH);
        }

        let w = srcW;
        let h = srcH;
        let current = source;

        while (w > targetW * 2 || h > targetH * 2) {
            w = Math.max(targetW, Math.floor(w / 2));
            h = Math.max(targetH, Math.floor(h / 2));
            current = drawToSize(current, w, h);
        }

        return drawToSize(current, targetW, targetH);
    }

    function getCroppedCanvasResized(targetW, targetH) {
        const canvas = cropper.getCroppedCanvas({
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high'
        });
        return resizeCanvasStepped(canvas, targetW, targetH);
    }

    function updateResizeScaleFromInputs() {
        if (!rngResizeScale || resizeBaseWidth <= 0) {
            return;
        }
        const percent = resizePanelLogic.percentFromResizeWidth(txtWidth.value, resizeBaseWidth);
        if (percent == null) {
            return;
        }
        rngResizeScale.value = percent;
        if (resizeScaleVal) {
            resizeScaleVal.textContent = String(percent);
        }
    }

    function updateResizeInputsFromCrop() {
        if (!cropper) {
            return;
        }
        applyResizePanelState(resizePanelLogic.buildResizePanelFromCrop(cropper.getData()));
    }

    function updateZoomIndicator() {
        if (!cropper) return;
        const data = cropper.getImageData();
        if (data && data.naturalWidth) {
            const percent = Math.round((data.width / data.naturalWidth) * 100);
            lblZoomPercent.textContent = `${percent}%`;
        }
    }

    function captureInitialFitRatio() {
        initialFitRatio = getViewportFitRatio();
    }

    function toggleZoomView() {
        if (!cropper) {
            return;
        }

        const data = cropper.getImageData();
        if (!data || !data.naturalWidth) {
            return;
        }

        const currentRatio = data.width / data.naturalWidth;
        const at100Percent = Math.abs(currentRatio - 1) < 0.005;
        const fitRatio = getViewportFitRatio();

        applyZoomTo(at100Percent ? fitRatio : 1);
        updateZoomIndicator();
    }

    function syncCropPresetUI() {
        const isEnabled = chkEnableCrop.checked;
        if (workspace) {
            workspace.classList.toggle('crop-active', isEnabled);
        }
        presetButtons.forEach(btn => {
            btn.disabled = !isEnabled;
        });
        if (btnApplyCrop) {
            btnApplyCrop.disabled = !isEnabled;
        }
        updateCropInteraction();
    }

    // Crop Toggle Checkbox listener
    chkEnableCrop.addEventListener('change', () => {
        if (chkEnableCrop.checked) {
            if (cropper) {
                initMarqueeToFullImage();
                // Highlight Free preset by default when crop is checked on
                presetButtons.forEach(b => b.classList.remove('active'));
                const freeBtn = document.querySelector('#cropPresets button[data-ratio="NaN"]');
                if (freeBtn) freeBtn.classList.add('active');
                cropper.setAspectRatio(NaN);
                isCircular = false;
                const face = document.querySelector('.cropper-face');
                if (face) {
                    face.style.borderRadius = '0';
                    face.style.backgroundColor = 'transparent';
                }
                updateResizeInputsFromCrop();
            }
        } else {
            if (cropper) {
                cropper.clear();
            }
            syncResizeInputsToOriginal();
            clearNaturalCropData();
            isCircular = false;
            presetButtons.forEach(b => b.classList.remove('active'));
        }
        syncCropPresetUI();
    });

    function toggleCropModeWithKey() {
        if (!cropper) {
            return;
        }

        endMagicWandMode(false);
        endColorPickerMode();

        const turningOn = !chkEnableCrop.checked;
        chkEnableCrop.checked = turningOn;
        chkEnableCrop.dispatchEvent(new Event('change'));
        focusCropKeyboardTarget();
        vscode.postMessage({
            command: 'show-toast',
            text: t(turningOn ? 'toast.cropActive' : 'toast.cropInactive')
        });
    }

    // Preset Aspect Ratios
    const presetButtons = document.querySelectorAll('#cropPresets button');
    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            ensureCropModeEnabled();

            presetButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (btn.dataset.auto === 'true') {
                autoCropToContent();
                return;
            }

            if (cropper) {
                cropper.crop();
            }

            isCircular = btn.dataset.circle === 'true';

            if (isCircular) {
                // Circle cropping uses 1:1 aspect ratio constraint visually
                cropper.setAspectRatio(1);
                const face = document.querySelector('.cropper-face');
                if (face) {
                    face.style.borderRadius = '50%';
                    face.style.backgroundColor = 'transparent';
                }
            } else {
                const face = document.querySelector('.cropper-face');
                if (face) {
                    face.style.borderRadius = '0';
                    face.style.backgroundColor = 'transparent';
                }
                
                const ratio = parseFloat(btn.dataset.ratio);
                cropper.setAspectRatio(isNaN(ratio) ? NaN : ratio);
            }
        });
    });

    const CONTENT_ALPHA_THRESHOLD = 12;

    function resetCropFaceStyles() {
        const face = document.querySelector('.cropper-face');
        if (face) {
            face.style.borderRadius = '0';
            face.style.backgroundColor = 'transparent';
        }
    }

    function getContentBoundsFromRegion(regionX, regionY, regionW, regionH, useCircle) {
        if (!ensureMagicWandCanvas()) {
            return null;
        }

        const x0 = Math.max(0, Math.round(regionX));
        const y0 = Math.max(0, Math.round(regionY));
        const w = Math.min(originalWidth - x0, Math.round(regionW));
        const h = Math.min(originalHeight - y0, Math.round(regionH));

        if (w <= 0 || h <= 0) {
            return null;
        }

        const pixels = magicWandCtx.getImageData(x0, y0, w, h).data;
        const centerX = w / 2;
        const centerY = h / 2;
        const circleRadius = Math.min(w, h) / 2;
        let minX = w;
        let minY = h;
        let maxX = -1;
        let maxY = -1;

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (useCircle) {
                    const dx = x + 0.5 - centerX;
                    const dy = y + 0.5 - centerY;
                    if ((dx * dx) + (dy * dy) > circleRadius * circleRadius) {
                        continue;
                    }
                }

                const alpha = pixels[((y * w) + x) * 4 + 3];
                if (alpha <= CONTENT_ALPHA_THRESHOLD) {
                    continue;
                }

                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }

        if (maxX < 0) {
            return null;
        }

        return {
            x: x0 + minX,
            y: y0 + minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1
        };
    }

    function applyCropBounds(bounds) {
        clearMagicWandMask();
        normalizeCanvasOrigin();
        cropper.setData(bounds);
        updateResizeInputsFromCrop();
        cacheNaturalCropData();
        scheduleSyncLayout();
    }

    function ensureCropModeEnabled() {
        if (!chkEnableCrop.checked) {
            chkEnableCrop.checked = true;
            syncCropPresetUI();
            if (cropper) {
                initMarqueeToFullImage();
            }
        }
    }

    function autoCropToContent() {
        if (!cropper) {
            return false;
        }

        ensureCropModeEnabled();

        isCircular = false;
        cropper.crop();
        cropper.setAspectRatio(NaN);
        resetCropFaceStyles();

        invalidateMagicWandCanvas();
        const bounds = getContentBoundsFromRegion(0, 0, originalWidth, originalHeight, false);
        if (!bounds) {
            vscode.postMessage({ command: 'show-toast', text: t('toast.trimCropEmpty') });
            return false;
        }

        applyCropBounds(bounds);
        vscode.postMessage({ command: 'show-toast', text: t('toast.trimCropDone') });
        return true;
    }

    function isPointInCropSelection(point) {
        if (!cropper || !chkEnableCrop.checked || !cropper.cropped) {
            return false;
        }
        return cropMarqueeLogic.isPointInCropSelection(point, cropper.getData(true));
    }

    function isMarqueeFullImage() {
        return isMarqueeFullImageNatural();
    }

    function expandCropSelectionToFullImage() {
        if (!cropper || !chkEnableCrop.checked) {
            return false;
        }
        if (isMarqueeFullImage()) {
            return false;
        }
        setMarqueeToFullImage();
        if (!isMarqueeFullImage()) {
            return false;
        }
        applyZoomTo(1);
        updateZoomIndicator();
        presetButtons.forEach(b => b.classList.remove('active'));
        const freeBtn = document.querySelector('#cropPresets button[data-ratio="NaN"]');
        if (freeBtn) {
            freeBtn.classList.add('active');
        }
        cropper.setAspectRatio(NaN);
        isCircular = false;
        resetCropFaceStyles();
        vscode.postMessage({ command: 'show-toast', text: t('toast.trimCropFull') });
        return true;
    }

    function toggleCropMarqueeFullContent() {
        if (!cropper || !chkEnableCrop.checked || !cropper.cropped) {
            return false;
        }

        if (isMarqueeFullImage()) {
            return trimCropSelectionToContent();
        }

        return expandCropSelectionToFullImage();
    }

    function trimCropSelectionToContent() {
        if (!cropper || !chkEnableCrop.checked || !cropper.cropped) {
            return false;
        }

        const cropData = cropper.getData(true);
        const regionX = Math.max(0, Math.round(cropData.x));
        const regionY = Math.max(0, Math.round(cropData.y));
        const regionW = Math.min(originalWidth - regionX, Math.round(cropData.width));
        const regionH = Math.min(originalHeight - regionY, Math.round(cropData.height));

        if (regionW <= 0 || regionH <= 0) {
            return false;
        }

        invalidateMagicWandCanvas();
        const bounds = getContentBoundsFromRegion(regionX, regionY, regionW, regionH, isCircular);
        if (!bounds) {
            vscode.postMessage({ command: 'show-toast', text: t('toast.trimCropEmpty') });
            return false;
        }

        if (bounds.x === regionX && bounds.y === regionY && bounds.width === regionW && bounds.height === regionH) {
            vscode.postMessage({ command: 'show-toast', text: t('toast.trimCropNoChange') });
            return false;
        }

        applyCropBounds(bounds);
        vscode.postMessage({ command: 'show-toast', text: t('toast.trimCropDone') });
        return true;
    }

    function getWorkspaceDblClickState(e) {
        return {
            hasCropper: !!cropper,
            cropEnabled: chkEnableCrop.checked,
            cropped: !!(cropper && cropper.cropped),
            eyedropperActive: isEyedropperActive,
            magicWandMode: isMagicWandMode,
            colorPickerMode: isColorPickerMode,
            spacePressed: isSpacePressed,
            zLoupeActive: isZLoupeActive,
            targetInCanvas: !!(canvasScrollArea && canvasScrollArea.contains(e.target)),
            targetInToolbar: !!e.target.closest('.floating-toolbar'),
            targetInModal: !!(e.target.closest('.color-modal') || e.target.closest('.copy-modal'))
        };
    }

    function onWorkspaceDblClick(e) {
        if (isZLoupeActive) {
            return;
        }
        const point = getImagePointFromEvent(e);
        const cropData = cropper && cropper.cropped ? cropper.getData(true) : null;
        const state = getWorkspaceDblClickState(e);

        if (cropMarqueeLogic.shouldInvokeMarqueeDblClickToggle(state, point, cropData)) {
            e.preventDefault();
            e.stopPropagation();
            toggleCropMarqueeFullContent();
            return;
        }

        if (cropMarqueeLogic.shouldInvokeImageZoomDblClick(state, point, cropData)) {
            e.preventDefault();
            e.stopPropagation();
            toggleZoomView();
        }
    }

    workspace.addEventListener('dblclick', onWorkspaceDblClick, true);

    // Aspect Ratio Lock and Dimension synchronization
    txtWidth.addEventListener('input', () => {
        if (chkLockRatio.checked && aspectRatio) {
            txtHeight.value = Math.round(txtWidth.value / aspectRatio);
        }
        updateResizeScaleFromInputs();
    });

    txtHeight.addEventListener('input', () => {
        if (chkLockRatio.checked && aspectRatio) {
            txtWidth.value = Math.round(txtHeight.value * aspectRatio);
        }
        updateResizeScaleFromInputs();
    });

    if (rngResizeScale) {
        rngResizeScale.addEventListener('input', () => {
            const percent = parseInt(rngResizeScale.value, 10);
            if (resizeScaleVal) {
                resizeScaleVal.textContent = rngResizeScale.value;
            }
            applyResizeScale(percent);
        });
    }

    // Toolbar zoom / rotate
    document.getElementById('btnZoomIn').addEventListener('click', () => {
        if (cropper) {
            applyZoom(0.1);
        }
    });
    document.getElementById('btnZoomOut').addEventListener('click', () => {
        if (cropper) {
            applyZoom(-0.1);
        }
    });
    document.getElementById('btnRotateLeft').addEventListener('click', () => {
        if (cropper) {
            markTransformEdit('edit.rotate');
            cropper.rotate(-90);
            scheduleSyncLayout();
        }
    });
    document.getElementById('btnRotateRight').addEventListener('click', () => {
        if (cropper) {
            markTransformEdit('edit.rotate');
            cropper.rotate(90);
            scheduleSyncLayout();
        }
    });
    document.getElementById('btnFlipH').addEventListener('click', () => {
        if (cropper) {
            markTransformEdit('edit.flipH');
            scaleX = -scaleX;
            cropper.scaleX(scaleX);
        }
    });
    document.getElementById('btnFlipV').addEventListener('click', () => {
        if (cropper) {
            markTransformEdit('edit.flipV');
            scaleY = -scaleY;
            cropper.scaleY(scaleY);
        }
    });
    document.getElementById('btnReset').addEventListener('click', () => {
        toggleZoomView();
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
            pushHistorySnapshot('edit.resize');

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

            let canvas = getCroppedCanvasResized(targetWidth, targetHeight);

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
            let preserveZoomRatio = null;
            if (cropper) {
                const imgData = cropper.getImageData();
                if (imgData && imgData.naturalWidth) {
                    preserveZoomRatio = imgData.width / imgData.naturalWidth;
                }
            }
            initEditor(newSrc, { afterResize: true, preserveZoomRatio });
            notifyDocumentChanged('edit.resize');
            vscode.postMessage({ command: 'show-toast', text: t('toast.resizeApplied') });
        }
    });

    // Apply 1:1 original crop selections (destructively crops on screen keeping original selection pixels scale)
    btnApplyCrop.addEventListener('click', () => {
        if (!cropper) return;
        if (magicWandMask && magicWandBounds) {
            applyMagicWandCrop();
            return;
        }
        if (!chkEnableCrop.checked || !cropper.cropped) {
            vscode.postMessage({ command: 'show-toast', text: t('toast.cropSelectFirst') });
            return;
        }

        pushHistorySnapshot('edit.crop');
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
        chkEnableCrop.checked = false;
        syncCropPresetUI();
        initEditor(newSrc);

        notifyDocumentChanged('edit.crop');
        vscode.postMessage({ command: 'show-toast', text: t('toast.cropApplied') });
    });

    // Hook up saving triggers
    const btnSave = document.getElementById('btnSave');
    const btnExport = document.getElementById('btnExport');

    btnSave.addEventListener('click', () => triggerSave('save'));
    btnExport.addEventListener('click', () => triggerSave('export'));

    const COPY_FORMAT_STORAGE_KEY = 'vsimage.copyFormat';
    const COPY_QUALITY_STORAGE_KEY = 'vsimage.copyQuality';
    const COPY_SCOPE_STORAGE_KEY = 'vsimage.copyScopeSelection';
    let selectedCopyFormat = 'image/png';

    function hasActiveCopySelection() {
        return !!(cropper && chkEnableCrop.checked && cropper.cropped);
    }

    function updateCopyScopeUI() {
        const hasSelection = hasActiveCopySelection();
        if (copyScopeSection) {
            copyScopeSection.style.display = hasSelection ? 'block' : 'none';
        }
        if (!hasSelection || !copyScopeInfo) {
            return;
        }

        const data = cropper.getData(true);
        const width = Math.round(data.width);
        const height = Math.round(data.height);
        copyScopeInfo.textContent = t('copyModal.selectionSize', {
            width: String(width),
            height: String(height)
        });
    }

    function getCopyFormatLabel(mimeType) {
        switch (mimeType) {
            case 'image/jpeg':
                return t('copyModal.formatJpeg');
            case 'image/webp':
                return t('copyModal.formatWebp');
            default:
                return t('copyModal.formatPng');
        }
    }

    function syncCopyQualityVisibility() {
        if (!copyQualitySection) {
            return;
        }
        const showQuality = selectedCopyFormat === 'image/jpeg' || selectedCopyFormat === 'image/webp';
        copyQualitySection.style.display = showQuality ? 'block' : 'none';
    }

    function setSelectedCopyFormat(format) {
        selectedCopyFormat = format;
        if (copyFormatOptions) {
            copyFormatOptions.querySelectorAll('.copy-format-btn').forEach((btn) => {
                btn.classList.toggle('active', btn.dataset.format === format);
            });
        }
        syncCopyQualityVisibility();
    }

    function hideCopyModal() {
        if (copyModal) {
            copyModal.style.display = 'none';
        }
    }

    function showCopyModal() {
        if (!copyModal || !cropper) {
            return;
        }

        const savedFormat = sessionStorage.getItem(COPY_FORMAT_STORAGE_KEY) || 'image/png';
        setSelectedCopyFormat(savedFormat);

        const savedQuality = sessionStorage.getItem(COPY_QUALITY_STORAGE_KEY);
        const quality = savedQuality ? parseInt(savedQuality, 10) : parseInt(rngQuality.value, 10);
        if (rngCopyQuality) {
            rngCopyQuality.value = String(quality);
        }
        if (copyQualityVal) {
            copyQualityVal.textContent = String(quality);
        }

        if (chkCopySelectionOnly) {
            const savedScope = sessionStorage.getItem(COPY_SCOPE_STORAGE_KEY);
            chkCopySelectionOnly.checked = hasActiveCopySelection()
                ? savedScope !== 'full'
                : false;
        }
        updateCopyScopeUI();

        copyModal.style.display = 'flex';
        if (btnCopyConfirm) {
            btnCopyConfirm.focus();
        }
    }

    function performCopyToClipboard(format, qualityPercent, selectionOnly) {
        if (!cropper) {
            return;
        }

        const quality = qualityPercent / 100;
        const useSelection = !!(selectionOnly && hasActiveCopySelection());
        sessionStorage.setItem(COPY_FORMAT_STORAGE_KEY, format);
        sessionStorage.setItem(COPY_QUALITY_STORAGE_KEY, String(qualityPercent));
        sessionStorage.setItem(COPY_SCOPE_STORAGE_KEY, useSelection ? 'selection' : 'full');

        window.editorApi.getCanvasBlob((blob) => {
            if (!blob) {
                vscode.postMessage({ command: 'show-toast', text: t('toast.noImageCopy') });
                return;
            }

            navigator.clipboard.write([
                new ClipboardItem({
                    [blob.type]: blob
                })
            ]).then(() => {
                hideCopyModal();
                let toastText = t('toast.imageCopiedAs', { format: getCopyFormatLabel(format) });
                if (useSelection) {
                    const data = cropper.getData(true);
                    toastText = t('toast.imageCopiedSelection', {
                        format: getCopyFormatLabel(format),
                        width: String(Math.round(data.width)),
                        height: String(Math.round(data.height))
                    });
                }
                vscode.postMessage({ command: 'show-toast', text: toastText });
            }).catch((err) => {
                vscode.postMessage({ command: 'show-toast', text: t('toast.clipboardFailed', { error: String(err) }) });
            });
        }, { format, quality, copySelectionOnly: useSelection });
    }

    function confirmCopyToClipboard() {
        const qualityPercent = rngCopyQuality
            ? parseInt(rngCopyQuality.value, 10)
            : parseInt(rngQuality.value, 10);
        const selectionOnly = chkCopySelectionOnly ? chkCopySelectionOnly.checked : false;
        performCopyToClipboard(selectedCopyFormat, qualityPercent, selectionOnly);
    }

    // Clipboard Copy Engine
    function copyImageToClipboard() {
        if (!cropper) {
            return;
        }
        showCopyModal();
    }

    if (copyFormatOptions) {
        copyFormatOptions.addEventListener('click', (e) => {
            const btn = e.target.closest('.copy-format-btn');
            if (!btn || !btn.dataset.format) {
                return;
            }
            setSelectedCopyFormat(btn.dataset.format);
        });
    }

    if (rngCopyQuality && copyQualityVal) {
        rngCopyQuality.addEventListener('input', () => {
            copyQualityVal.textContent = rngCopyQuality.value;
        });
    }

    if (btnCopyConfirm) {
        btnCopyConfirm.addEventListener('click', confirmCopyToClipboard);
    }

    if (copyModalClose) {
        copyModalClose.addEventListener('click', hideCopyModal);
    }
    if (copyModalBackdrop) {
        copyModalBackdrop.addEventListener('click', hideCopyModal);
    }

    // ── Color Picker (Option/Alt key) ──────────────────────────────────────

    function toHexByte(n) {
        return n.toString(16).padStart(2, '0').toUpperCase();
    }

    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h = 0;
        let s = 0;
        const l = (max + min) / 2;

        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }

        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    }

    function rgbToHsv(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;
        let h = 0;

        if (max !== min) {
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }

        return {
            h: Math.round(h * 360),
            s: max === 0 ? 0 : Math.round((d / max) * 100),
            v: Math.round(max * 100)
        };
    }

    function rgbToCmyk(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const k = 1 - Math.max(r, g, b);
        if (k >= 0.999) {
            return { c: 0, m: 0, y: 0, k: 100 };
        }
        const c = (1 - r - k) / (1 - k);
        const m = (1 - g - k) / (1 - k);
        const y = (1 - b - k) / (1 - k);
        return {
            c: Math.round(c * 100),
            m: Math.round(m * 100),
            y: Math.round(y * 100),
            k: Math.round(k * 100)
        };
    }

    function buildColorFormats(r, g, b, a) {
        const alpha = a / 255;
        const hex = a < 255
            ? `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}${toHexByte(a)}`
            : `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
        const hsl = rgbToHsl(r, g, b);
        const hsv = rgbToHsv(r, g, b);
        const cmyk = rgbToCmyk(r, g, b);

        return [
            { label: 'HEX', value: hex },
            { label: 'RGB', value: `rgb(${r}, ${g}, ${b})` },
            { label: 'RGBA', value: `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})` },
            { label: 'HSL', value: `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` },
            { label: 'HSV', value: `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)` },
            { label: 'CMYK', value: `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)` }
        ];
    }

    function ensureColorPickerCanvas() {
        if (!cropper || !imageEl) {
            return false;
        }
        if (!colorPickerCanvas || colorPickerCanvas.width !== originalWidth || colorPickerCanvas.height !== originalHeight) {
            colorPickerCanvas = document.createElement('canvas');
            colorPickerCanvas.width = originalWidth;
            colorPickerCanvas.height = originalHeight;
            colorPickerCtx = colorPickerCanvas.getContext('2d');
            colorPickerCtx.drawImage(imageEl, 0, 0);
        }
        return true;
    }

    function getImagePointFromEvent(e) {
        if (!cropper) {
            return null;
        }

        const imageData = cropper.getImageData();
        const rect = cropper.container.getBoundingClientRect();
        const xInContainer = e.clientX - rect.left;
        const yInContainer = e.clientY - rect.top;
        const xInImage = xInContainer - imageData.left;
        const yInImage = yInContainer - imageData.top;

        const onImage = xInImage >= 0 && xInImage <= imageData.width && yInImage >= 0 && yInImage <= imageData.height;
        if (!onImage) {
            return null;
        }

        const naturalX = Math.round((xInImage / imageData.width) * imageData.naturalWidth);
        const naturalY = Math.round((yInImage / imageData.height) * imageData.naturalHeight);

        return {
            x: Math.max(0, Math.min(originalWidth - 1, naturalX)),
            y: Math.max(0, Math.min(originalHeight - 1, naturalY))
        };
    }

    function sampleColorAtEvent(e) {
        if (!ensureColorPickerCanvas()) {
            return null;
        }

        const point = getImagePointFromEvent(e);
        if (!point) {
            return null;
        }

        const pixel = colorPickerCtx.getImageData(point.x, point.y, 1, 1).data;
        return {
            r: pixel[0],
            g: pixel[1],
            b: pixel[2],
            a: pixel[3]
        };
    }

    function invalidateColorPickerCanvas() {
        colorPickerCanvas = null;
        colorPickerCtx = null;
    }

    function startColorPickerMode() {
        if (!cropper || isEyedropperActive || !isPanTargetVisible()) {
            return;
        }
        if (isMagicWandMode) {
            return;
        }
        if (isColorPickerMode) {
            return;
        }

        isColorPickerMode = true;
        lastPickerPreview = '';
        ensureColorPickerCanvas();
        workspace.classList.add('color-picker-active');
        if (cropper) {
            updateCropInteraction();
        }

        if (colorPickerTooltip) {
            colorPickerTooltip.style.display = 'flex';
            colorPickerTooltip.style.left = '-1000px';
            colorPickerTooltip.style.top = '-1000px';
        }
    }

    function endColorPickerMode() {
        if (!isColorPickerMode) {
            return;
        }

        isColorPickerMode = false;
        lastPickerPreview = '';
        workspace.classList.remove('color-picker-active');

        if (colorPickerTooltip) {
            colorPickerTooltip.style.display = 'none';
        }

        updateCropInteraction();
    }

    function updateColorPickerPreview(e) {
        if (!isColorPickerMode || !colorPickerTooltip) {
            return;
        }

        colorPickerTooltip.style.left = `${e.clientX + 14}px`;
        colorPickerTooltip.style.top = `${e.clientY + 14}px`;

        const color = sampleColorAtEvent(e);
        if (!color) {
            if (colorPickerPreview) {
                colorPickerPreview.textContent = '—';
            }
            if (colorPickerSwatch) {
                colorPickerSwatch.style.backgroundColor = 'transparent';
            }
            return;
        }

        const formats = buildColorFormats(color.r, color.g, color.b, color.a);
        const preview = formats[0].value;
        const cssColor = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;

        if (preview !== lastPickerPreview) {
            lastPickerPreview = preview;
            if (colorPickerPreview) {
                colorPickerPreview.textContent = preview;
            }
            if (colorPickerSwatch) {
                colorPickerSwatch.style.backgroundColor = cssColor;
            }
        }
    }

    function hideColorModal() {
        if (colorModal) {
            colorModal.style.display = 'none';
        }
        if (colorFormatList) {
            colorFormatList.innerHTML = '';
        }
    }

    function copyTextToClipboard(text) {
        return navigator.clipboard.writeText(text).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        });
    }

    function showColorModal(r, g, b, a) {
        if (!colorModal || !colorFormatList) {
            return;
        }

        const cssColor = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
        const formats = buildColorFormats(r, g, b, a);

        if (colorModalSwatch) {
            colorModalSwatch.style.backgroundColor = cssColor;
        }

        colorFormatList.innerHTML = '';
        formats.forEach((fmt) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'color-format-item';
            btn.innerHTML = `
                <span class="color-format-label">${fmt.label}</span>
                <span class="color-format-value">${fmt.value}</span>
                <span class="color-format-copy">${t('colorModal.copy')}</span>
            `;
            btn.addEventListener('click', () => {
                copyTextToClipboard(fmt.value).then(() => {
                    colorFormatList.querySelectorAll('.color-format-item').forEach((el) => el.classList.remove('copied'));
                    btn.classList.add('copied');
                    btn.querySelector('.color-format-copy').textContent = t('colorModal.copied');
                    vscode.postMessage({ command: 'show-toast', text: t('toast.colorCopied', { format: fmt.label, value: fmt.value }) });
                }).catch(() => {
                    vscode.postMessage({ command: 'show-toast', text: t('toast.colorCopyFailed') });
                });
            });
            colorFormatList.appendChild(btn);
        });

        colorModal.style.display = 'flex';
    }

    function onColorPickerClick(e) {
        if (!isColorPickerMode || isEyedropperActive) {
            return;
        }
        if (e.button !== 0) {
            return;
        }
        if (!canvasScrollArea || !canvasScrollArea.contains(e.target)) {
            return;
        }
        if (e.target.closest('.floating-toolbar') || e.target.closest('.color-modal')) {
            return;
        }

        const color = sampleColorAtEvent(e);
        if (!color) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();
        showColorModal(color.r, color.g, color.b, color.a);
    }

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Alt' || e.repeat || isTypingTarget(document.activeElement)) {
            return;
        }
        if (colorModal && colorModal.style.display === 'flex') {
            return;
        }
        isOptionPressed = true;
        startColorPickerMode();
    });

    document.addEventListener('keyup', (e) => {
        if (e.key !== 'Alt') {
            return;
        }
        isOptionPressed = false;
        endColorPickerMode();
    });

    window.addEventListener('blur', () => {
        isOptionPressed = false;
        endColorPickerMode();
    });

    if (workspace) {
        workspace.addEventListener('mousemove', (e) => {
            if (isColorPickerMode && !isEyedropperActive) {
                updateColorPickerPreview(e);
            }
        }, true);

        workspace.addEventListener('click', onColorPickerClick, true);
    }

    if (colorModalClose) {
        colorModalClose.addEventListener('click', hideColorModal);
    }
    if (colorModalBackdrop) {
        colorModalBackdrop.addEventListener('click', hideColorModal);
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
        if (isOptionPressed) {
            startColorPickerMode();
        }
    }

    // ── Magic Wand (W key) ───────────────────────────────────────────────

    function invalidateMagicWandCanvas() {
        magicWandCanvas = null;
        magicWandCtx = null;
    }

    function ensureMagicWandCanvas() {
        if (!imageEl || !originalWidth || !originalHeight) {
            return false;
        }
        if (magicWandCanvas
            && (magicWandCanvas.width !== originalWidth || magicWandCanvas.height !== originalHeight)) {
            invalidateMagicWandCanvas();
        }
        if (!magicWandCanvas) {
            magicWandCanvas = document.createElement('canvas');
            magicWandCanvas.width = originalWidth;
            magicWandCanvas.height = originalHeight;
            magicWandCtx = magicWandCanvas.getContext('2d', { willReadFrequently: true });
            magicWandCtx.drawImage(imageEl, 0, 0);
        }
        return true;
    }

    function clearMagicWandMask() {
        magicWandMask = null;
        magicWandBounds = null;
        if (magicWandOverlayEl) {
            magicWandOverlayEl.remove();
            magicWandOverlayEl = null;
        }
    }

    function getMagicWandTolerance() {
        if (!rngMagicWandTolerance) {
            return 32;
        }
        return parseInt(rngMagicWandTolerance.value, 10) || 0;
    }

    function floodFillMagicWand(startX, startY, tolerance) {
        if (!ensureMagicWandCanvas()) {
            return null;
        }

        const w = originalWidth;
        const h = originalHeight;
        const pixels = magicWandCtx.getImageData(0, 0, w, h).data;
        const startIdx = startY * w + startX;
        const seed = startIdx * 4;
        const r0 = pixels[seed];
        const g0 = pixels[seed + 1];
        const b0 = pixels[seed + 2];
        const a0 = pixels[seed + 3];

        function matches(idx) {
            const i = idx * 4;
            return Math.abs(pixels[i] - r0) <= tolerance
                && Math.abs(pixels[i + 1] - g0) <= tolerance
                && Math.abs(pixels[i + 2] - b0) <= tolerance
                && Math.abs(pixels[i + 3] - a0) <= tolerance;
        }

        const mask = new Uint8Array(w * h);
        const visited = new Uint8Array(w * h);
        const stack = [startX, startY];
        let count = 0;
        let minX = w;
        let minY = h;
        let maxX = -1;
        let maxY = -1;

        while (stack.length) {
            const y = stack.pop();
            const x = stack.pop();
            const idx = y * w + x;
            if (x < 0 || x >= w || y < 0 || y >= h || visited[idx]) {
                continue;
            }
            if (!matches(idx)) {
                continue;
            }

            visited[idx] = 1;
            mask[idx] = 1;
            count++;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;

            stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
        }

        if (count === 0) {
            return null;
        }

        return {
            mask,
            count,
            bounds: {
                x: minX,
                y: minY,
                width: maxX - minX + 1,
                height: maxY - minY + 1
            }
        };
    }

    function ensureMagicWandOverlay() {
        if (!cropper) {
            return null;
        }
        if (!magicWandOverlayEl) {
            magicWandOverlayEl = document.createElement('canvas');
            magicWandOverlayEl.className = 'magic-wand-overlay';
            cropper.container.appendChild(magicWandOverlayEl);
        }
        return magicWandOverlayEl;
    }

    function renderMagicWandOverlay() {
        if (!magicWandMask || !cropper) {
            if (magicWandOverlayEl) {
                magicWandOverlayEl.style.display = 'none';
            }
            return;
        }

        const overlay = ensureMagicWandOverlay();
        const imgData = cropper.getImageData();
        if (!imgData || !imgData.width) {
            return;
        }

        overlay.width = Math.max(1, Math.ceil(imgData.width));
        overlay.height = Math.max(1, Math.ceil(imgData.height));
        overlay.style.width = `${imgData.width}px`;
        overlay.style.height = `${imgData.height}px`;
        overlay.style.left = `${imgData.left}px`;
        overlay.style.top = `${imgData.top}px`;
        overlay.style.display = 'block';

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = originalWidth;
        maskCanvas.height = originalHeight;
        const maskCtx = maskCanvas.getContext('2d');
        const highlight = maskCtx.createImageData(originalWidth, originalHeight);
        for (let i = 0; i < magicWandMask.length; i++) {
            if (magicWandMask[i]) {
                const j = i * 4;
                highlight.data[j] = 0;
                highlight.data[j + 1] = 120;
                highlight.data[j + 2] = 215;
                highlight.data[j + 3] = 90;
            }
        }
        maskCtx.putImageData(highlight, 0, 0);

        const ctx = overlay.getContext('2d');
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        ctx.drawImage(maskCanvas, 0, 0, overlay.width, overlay.height);
    }

    function applyMagicWandMaskToCanvas(canvas, bounds) {
        if (!magicWandMask || !bounds || !canvas) {
            return canvas;
        }

        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const fullW = originalWidth;

        for (let y = 0; y < bounds.height; y++) {
            for (let x = 0; x < bounds.width; x++) {
                const maskIdx = (bounds.y + y) * fullW + (bounds.x + x);
                if (!magicWandMask[maskIdx]) {
                    const i = (y * bounds.width + x) * 4;
                    data[i + 3] = 0;
                }
            }
        }

        ctx.putImageData(imgData, 0, 0);
        return canvas;
    }

    function applyMagicWandSelection(result) {
        magicWandMask = result.mask;
        magicWandBounds = result.bounds;

        if (!chkEnableCrop.checked) {
            chkEnableCrop.checked = true;
            syncCropPresetUI();
        }

        isApplyingMagicWandSelection = true;
        cropper.crop();
        cropper.setData({
            x: result.bounds.x,
            y: result.bounds.y,
            width: result.bounds.width,
            height: result.bounds.height
        });
        isApplyingMagicWandSelection = false;
        cacheNaturalCropData();

        presetButtons.forEach(b => b.classList.remove('active'));
        const freeBtn = document.querySelector('#cropPresets button[data-ratio="NaN"]');
        if (freeBtn) {
            freeBtn.classList.add('active');
        }

        updateResizeInputsFromCrop();
        renderMagicWandOverlay();
        notifyDocumentChanged('edit.magicWandSelect');
        vscode.postMessage({
            command: 'show-toast',
            text: t('toast.magicWandSelected', { count: result.count })
        });
    }

    function endMagicWandMode(showToast) {
        if (!isMagicWandMode) {
            return;
        }

        isMagicWandMode = false;
        workspace.classList.remove('magic-wand-active');
        if (btnMagicWand) {
            btnMagicWand.classList.remove('active');
        }
        updateCropInteraction();

        if (showToast) {
            vscode.postMessage({ command: 'show-toast', text: t('toast.magicWandInactive') });
        }
    }

    function toggleMagicWandMode(forceState) {
        const next = forceState !== undefined ? forceState : !isMagicWandMode;
        if (next === isMagicWandMode) {
            return;
        }

        if (next) {
            if (!cropper) {
                return;
            }
            endColorPickerMode();
            endEyedropper();
            isMagicWandMode = true;
            workspace.classList.add('magic-wand-active');
            if (btnMagicWand) {
                btnMagicWand.classList.add('active');
            }
            updateCropInteraction();
            vscode.postMessage({ command: 'show-toast', text: t('toast.magicWandActive') });
            return;
        }

        endMagicWandMode(true);
    }

    function onMagicWandClick(e) {
        if (!isMagicWandMode || e.button !== 0) {
            return;
        }
        if (!canvasScrollArea || !canvasScrollArea.contains(e.target)) {
            return;
        }
        if (e.target.closest('.floating-toolbar') || e.target.closest('.color-modal')) {
            return;
        }

        const point = getImagePointFromEvent(e);
        if (!point) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        const result = floodFillMagicWand(point.x, point.y, getMagicWandTolerance());
        if (!result) {
            vscode.postMessage({ command: 'show-toast', text: t('toast.magicWandNoSelection') });
            return;
        }

        applyMagicWandSelection(result);
    }

    function eraseMagicWandSelection() {
        if (!magicWandMask) {
            return;
        }

        pushHistorySnapshot('edit.eraseSelection');
        const data = imgData.data;
        for (let i = 0; i < magicWandMask.length; i++) {
            if (magicWandMask[i]) {
                data[i * 4 + 3] = 0;
            }
        }
        ctx.putImageData(imgData, 0, 0);

        const newSrc = canvas.toDataURL();
        initEditor(newSrc);
        notifyDocumentChanged('edit.eraseSelection');
        vscode.postMessage({ command: 'show-toast', text: t('toast.selectionErased') });
    }

    function applyMagicWandCrop() {
        if (!cropper || !magicWandMask || !magicWandBounds) {
            return;
        }

        pushHistorySnapshot('edit.crop');

        let canvas = cropper.getCroppedCanvas({
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high'
        });
        canvas = applyMagicWandMaskToCanvas(canvas, magicWandBounds);

        const newSrc = canvas.toDataURL();
        chkEnableCrop.checked = false;
        syncCropPresetUI();
        initEditor(newSrc);
        notifyDocumentChanged('edit.crop');
        vscode.postMessage({ command: 'show-toast', text: t('toast.cropApplied') });
    }

    if (rngMagicWandTolerance && magicWandToleranceVal) {
        rngMagicWandTolerance.addEventListener('input', () => {
            magicWandToleranceVal.textContent = rngMagicWandTolerance.value;
        });
    }

    if (btnMagicWand) {
        btnMagicWand.addEventListener('click', () => toggleMagicWandMode());
    }

    workspace.addEventListener('click', onMagicWandClick, true);

    // Selection Erase & Eyedropper Color-Fill Engine
    function eraseSelection() {
        if (!cropper) return;
        if (!chkEnableCrop.checked || !cropper.cropped) {
            vscode.postMessage({ command: 'show-toast', text: t('toast.eraseSelectFirst') });
            return;
        }

        clearMagicWandMask();
        endMagicWandMode(false);

        const data = cropper.getData();
        isEyedropperActive = true;
        endColorPickerMode();
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
            text: t('toast.eyedropperActive')
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

        pushHistorySnapshot(isClickOnImage ? 'edit.fillSelection' : 'edit.eraseSelection');

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

            vscode.postMessage({ command: 'show-toast', text: t('toast.selectionFilled') });
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

            vscode.postMessage({ command: 'show-toast', text: t('toast.selectionErased') });
        }

        const newSrc = canvas.toDataURL();
        initEditor(newSrc);
        notifyDocumentChanged(isClickOnImage ? 'edit.fillSelection' : 'edit.eraseSelection');

        // Turn off eyedropper mode
        endEyedropper();

        // Reset crop mode checkbox
        chkEnableCrop.checked = false;
        syncCropPresetUI();
    }, true); // Capture phase is critical to intercept clicks over Cropper overlays!

    // Custom Context Menu event listeners
    workspace.addEventListener('contextmenu', (e) => {
        if (workspace.style.display === 'none') return;
        e.preventDefault();
        
        // Display context menu at mouse client position
        contextMenu.style.left = `${e.clientX}px`;
        contextMenu.style.top = `${e.clientY}px`;
        contextMenu.style.display = 'block';
    });

    // Close shortcut overlay / context menu when clicking on the canvas or elsewhere
    document.addEventListener('mousedown', (e) => {
        if (e.target.closest('.context-menu')
            || e.target.closest('.color-modal-panel')
            || e.target.closest('.copy-modal')) {
            return;
        }
        dismissShortcutLayers();
    }, true);

    // Close context menu on click (legacy fallback)
    document.addEventListener('click', () => {
        if (contextMenu) {
            contextMenu.style.display = 'none';
        }
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
            markTransformEdit('edit.flipH');
            scaleX = -scaleX;
            cropper.scaleX(scaleX);
        }
    });

    document.getElementById('ctxFlipV').addEventListener('click', (e) => {
        e.stopPropagation();
        contextMenu.style.display = 'none';
        if (cropper) {
            markTransformEdit('edit.flipV');
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
        if (isDocumentEditor) {
            vscode.postMessage({ command: 'undo-request' });
        } else {
            performUndo();
        }
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
                if (isDocumentEditor) {
                    vscode.postMessage({ command: 'undo-request' });
                } else {
                    performUndo();
                }
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
            if (isDocumentEditor) {
                vscode.postMessage({ command: 'undo-request' });
            } else {
                performUndo();
            }
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
            if (magicWandMask) {
                e.preventDefault();
                eraseMagicWandSelection();
            } else if (chkEnableCrop.checked && cropper && cropper.cropped) {
                e.preventDefault();
                eraseSelection();
            }
            return;
        }

        // Crop toggle: C
        if ((e.key === 'c' || e.key === 'C') && !e.metaKey && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            toggleCropModeWithKey();
            return;
        }

        // Magic Wand toggle: W
        if ((e.key === 'w' || e.key === 'W') && !e.metaKey && !e.ctrlKey && !e.altKey) {
            e.preventDefault();
            toggleMagicWandMode();
            return;
        }

        // Zoom In: Cmd/Ctrl + = or Cmd/Ctrl + + or simple key +
        if (((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) || e.key === '+') {
            e.preventDefault();
            if (cropper) {
                applyZoom(0.1);
            }
            return;
        }

        // Zoom Out: Cmd/Ctrl + - or Cmd/Ctrl + _ or simple key -
        if (((e.metaKey || e.ctrlKey) && (e.key === '-' || e.key === '_')) || e.key === '-') {
            e.preventDefault();
            if (cropper) {
                applyZoom(-0.1);
            }
            return;
        }

        // Shrink crop marquee: [ (1px per side)
        if (e.key === '[' && !e.metaKey && !e.ctrlKey && !e.altKey) {
            if (chkEnableCrop.checked && cropper && resizeCropMarqueeByInset(1)) {
                e.preventDefault();
            }
            return;
        }

        // Expand crop marquee: ] (1px per side)
        if (e.key === ']' && !e.metaKey && !e.ctrlKey && !e.altKey) {
            if (chkEnableCrop.checked && cropper && resizeCropMarqueeByInset(-1)) {
                e.preventDefault();
            }
            return;
        }

        // Rotate Left: Cmd/Ctrl + [
        if ((e.metaKey || e.ctrlKey) && e.key === '[') {
            e.preventDefault();
            if (cropper) {
                markTransformEdit('edit.rotate');
                cropper.rotate(-90);
                scheduleSyncLayout();
            }
            return;
        }

        // Rotate Right: Cmd/Ctrl + ]
        if ((e.metaKey || e.ctrlKey) && e.key === ']') {
            e.preventDefault();
            if (cropper) {
                markTransformEdit('edit.rotate');
                cropper.rotate(90);
                scheduleSyncLayout();
            }
            return;
        }

        // Toggle 100% ↔ initial fit: Cmd/Ctrl + 0
        if ((e.metaKey || e.ctrlKey) && e.key === '0') {
            e.preventDefault();
            toggleZoomView();
            return;
        }

        // Move crop marquee: Arrow keys (Shift = 10px)
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            if (chkEnableCrop.checked && cropper) {
                if (moveCropMarqueeWithArrow(e.key, e.shiftKey)) {
                    e.preventDefault();
                }
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

        // Escape: close modals, clear selection, cancel eyedropper, or uncheck crop box
        if (e.key === 'Escape') {
            e.preventDefault();
            if (isZLoupeActive) {
                setZLoupeActive(false);
                return;
            }
            if (copyModal && copyModal.style.display === 'flex') {
                hideCopyModal();
                return;
            }
            if (colorModal && colorModal.style.display === 'flex') {
                hideColorModal();
                return;
            }
            if (isColorPickerMode) {
                isOptionPressed = false;
                endColorPickerMode();
                return;
            }
            if (magicWandMask) {
                clearMagicWandMask();
                if (cropper) {
                    chkEnableCrop.checked = false;
                    syncCropPresetUI();
                    cropper.clear();
                    syncResizeInputsToOriginal();
                }
                return;
            }
            if (isMagicWandMode) {
                endMagicWandMode(true);
                return;
            }
            if (isEyedropperActive && eraseTargetBounds) {
                pushHistorySnapshot('edit.eraseSelection');

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
                notifyDocumentChanged('edit.eraseSelection');

                endEyedropper();

                // Reset crop mode checkbox
                chkEnableCrop.checked = false;
                syncCropPresetUI();

                vscode.postMessage({ command: 'show-toast', text: t('toast.selectionErased') });
                return;
            }
            if (cropper) {
                chkEnableCrop.checked = false;
                syncCropPresetUI();
                cropper.clear();
                syncResizeInputsToOriginal();
                isCircular = false;
                presetButtons.forEach(b => b.classList.remove('active'));
            }
            return;
        }

        // Enter: apply crop selection if crop mode is active
        if (e.key === 'Enter') {
            if (copyModal && copyModal.style.display === 'flex') {
                e.preventDefault();
                confirmCopyToClipboard();
                return;
            }
            if (chkEnableCrop.checked && cropper && cropper.cropped) {
                e.preventDefault();
                btnApplyCrop.click();
            }
            return;
        }
    });

    function performUndo(options) {
        const fromHost = options && options.fromHost;
        if (historyStack.length > 0) {
            const entry = historyStack.pop();
            initEditor(entry.src);
            if (!fromHost) {
                vscode.postMessage({ command: 'show-toast', text: t('toast.undoSuccess') });
            }
        } else if (!fromHost) {
            vscode.postMessage({ command: 'show-toast', text: t('toast.nothingToUndo') });
        }
    }

    function triggerSave(type) {
        if (type === 'save' && isDocumentEditor) {
            vscode.postMessage({ command: 'save-document' });
            return;
        }
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
        getCanvasBlob: function(callback, options) {
            if (!cropper) return;
            const format = (options && options.format) || selFormat.value;
            const quality = (options && options.quality != null)
                ? options.quality
                : parseFloat(rngQuality.value) / 100;
            const targetWidth = parseInt(txtWidth.value, 10) || originalWidth;
            const targetHeight = parseInt(txtHeight.value, 10) || originalHeight;
            const hasSelection = chkEnableCrop.checked && cropper.cropped;
            const copySelectionOnly = options && options.copySelectionOnly;

            let canvas;

            if (copySelectionOnly && hasSelection) {
                canvas = cropper.getCroppedCanvas({
                    imageSmoothingEnabled: true,
                    imageSmoothingQuality: 'high'
                });
            } else if (copySelectionOnly === false) {
                canvas = document.createElement('canvas');
                canvas.width = originalWidth;
                canvas.height = originalHeight;
                canvas.getContext('2d').drawImage(imageEl, 0, 0);
            } else {
                if (!chkEnableCrop.checked) {
                    cropper.crop();
                    cropper.setData({
                        x: 0,
                        y: 0,
                        width: originalWidth,
                        height: originalHeight
                    });
                }

                canvas = getCroppedCanvasResized(targetWidth, targetHeight);
            }

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

            if (magicWandMask && magicWandBounds && !(options && options.copySelectionOnly === false)) {
                canvas = applyMagicWandMaskToCanvas(canvas, magicWandBounds);
            }

            canvas.toBlob(callback, format, quality);
        }
    };
})();
