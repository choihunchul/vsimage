'use strict';

/**
 * Pure helpers for resize sidebar panel state after image load, resize, or crop.
 */

const RESIZE_SCALE_MIN = 10;
const RESIZE_SCALE_MAX = 200;
const RESIZE_SCALE_DEFAULT = 100;

/** Default downscale step (0.75 ≈ 25% smaller per step). Resize apply uses 50% halve in editor. */
const RESIZE_DOWNSCALE_STEP_FACTOR = 0.75;
const RESIZE_DOWNSCALE_STOP_RATIO = 1.02;
const RESIZE_DOWNSCALE_MAX_STEPS = 80;

function buildResizePanelFromImage(originalWidth, originalHeight) {
    const width = Math.max(0, Math.round(originalWidth));
    const height = Math.max(0, Math.round(originalHeight));
    return {
        baseWidth: width,
        baseHeight: height,
        width,
        height,
        scalePercent: RESIZE_SCALE_DEFAULT,
        widthPlaceholder: width > 0 ? String(width) : ''
    };
}

function buildResizePanelFromCrop(cropData) {
    if (!cropData) {
        return buildResizePanelFromImage(0, 0);
    }
    const width = Math.max(1, Math.round(cropData.width));
    const height = Math.max(1, Math.round(cropData.height));
    return {
        baseWidth: width,
        baseHeight: height,
        width,
        height,
        scalePercent: RESIZE_SCALE_DEFAULT,
        widthPlaceholder: String(width)
    };
}

/** After destructive resize/crop, panel should reflect the new image, not cleared zeros. */
function shouldSyncResizePanelFromImage(cropEnabled, cropped) {
    return !cropEnabled || !cropped;
}

function shouldUpdateResizeInputsFromCrop(cropEnabled, cropped) {
    return !!cropEnabled && !!cropped;
}

function clampResizeScalePercent(percent) {
    return Math.min(RESIZE_SCALE_MAX, Math.max(RESIZE_SCALE_MIN, Math.round(percent)));
}

function percentFromResizeWidth(inputWidth, baseWidth) {
    const width = Math.round(Number(inputWidth));
    if (!width || width <= 0 || !baseWidth || baseWidth <= 0) {
        return null;
    }
    return clampResizeScalePercent((width / baseWidth) * 100);
}

function normalizeResizeDimensionValue(value) {
    if (value === '' || value === null || value === undefined) {
        return '';
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return '';
    }
    return String(Math.max(1, Math.trunc(numeric)));
}

function dimensionsFromResizeScalePercent(percent, baseWidth, baseHeight) {
    const scale = clampResizeScalePercent(percent) / 100;
    return {
        width: Math.max(1, Math.round(baseWidth * scale)),
        height: Math.max(1, Math.round(baseHeight * scale))
    };
}

function shouldDisableResizeApplyButton(scalePercent) {
    return clampResizeScalePercent(Number(scalePercent) || RESIZE_SCALE_DEFAULT) === RESIZE_SCALE_DEFAULT;
}

function resolveResizePreviewZoomRatio(scalePercent) {
    return clampResizeScalePercent(Number(scalePercent) || RESIZE_SCALE_DEFAULT) / 100;
}

/** Default % shown when rebuilding i18n labels (resize scale must stay 100, not quality 80). */
function defaultPercentForLabelSpanId(spanId) {
    if (spanId === 'resizeScaleVal') {
        return String(RESIZE_SCALE_DEFAULT);
    }
    if (spanId === 'sharpenVal') {
        return '0';
    }
    if (spanId === 'qualityVal' || spanId === 'copyQualityVal') {
        return '80';
    }
    return '80';
}

function resolvePercentLabelMeta(labelElement, labelInnerHtml) {
    if (labelElement && labelElement.getAttribute) {
        const spanId = labelElement.getAttribute('data-percent-id');
        if (spanId) {
            return {
                valueId: spanId,
                inputId: labelElement.getAttribute('data-percent-input') || null,
                defaultValue: labelElement.getAttribute('data-percent-default')
                    || defaultPercentForLabelSpanId(spanId)
            };
        }
    }
    return resolveI18nPercentLabel(labelInnerHtml || '');
}

/**
 * Zoom ratio to fit image in viewport (may exceed 1 for small images).
 */
function getViewportFillRatio(availW, availH, imageW, imageH) {
    const w = Math.max(1, Number(imageW) || 1);
    const h = Math.max(1, Number(imageH) || 1);
    const aw = Math.max(1, Number(availW) || 1);
    const ah = Math.max(1, Number(availH) || 1);
    return Math.min(aw / w, ah / h);
}

function isImageSmallerThanViewport(availW, availH, imageW, imageH) {
    return getViewportFillRatio(availW, availH, imageW, imageH) > 1;
}

/**
 * After resize: panel at 100% keeps prior zoom (capped); otherwise fill when view &lt; 100%.
 * @param {number} fillRatio - uncapped viewport fill from getViewportFillRatio
 * @param {number|null} panelScalePercent - resize sidebar scale (10–200)
 * @param {number|null} preferredRatio - zoom ratio before resize (width/naturalWidth)
 */
function resolveZoomRatioAfterResize(fillRatio, panelScalePercent, preferredRatio) {
    const panelAt100 = panelScalePercent == null || panelScalePercent >= 100;
    const cappedFit = Math.min(fillRatio, 1);
    if (panelAt100) {
        let ratio = preferredRatio != null && preferredRatio > 0 ? preferredRatio : cappedFit;
        return Math.min(ratio, cappedFit);
    }
    const prior = preferredRatio != null && preferredRatio > 0 ? preferredRatio : 1;
    if (fillRatio < 1 || prior < 1) {
        return fillRatio;
    }
    return Math.min(prior, fillRatio);
}

function getPercentLabelDisplayValue(meta, labelElement, doc) {
    const documentRef = doc || (typeof document !== 'undefined' ? document : null);
    if (meta.inputId && documentRef) {
        const input = documentRef.getElementById(meta.inputId);
        if (input && input.value != null && String(input.value) !== '') {
            return String(input.value);
        }
    }
    if (labelElement && labelElement.querySelector) {
        const span = labelElement.querySelector(`#${meta.valueId}`);
        if (span && span.textContent != null && String(span.textContent).trim() !== '') {
            return String(span.textContent).trim();
        }
    }
    return meta.defaultValue;
}

function resolveI18nPercentLabel(labelInnerHtml) {
    const hasResizeScale = /id=["']resizeScaleVal["']/.test(labelInnerHtml);
    const hasSharpen = /id=["']sharpenVal["']/.test(labelInnerHtml);
    const hasQuality = /id=["'](?:qualityVal|copyQualityVal)["']/.test(labelInnerHtml);
    if (hasSharpen) {
        return { valueId: 'sharpenVal', defaultValue: defaultPercentForLabelSpanId('sharpenVal') };
    }
    if (hasResizeScale) {
        return { valueId: 'resizeScaleVal', defaultValue: defaultPercentForLabelSpanId('resizeScaleVal') };
    }
    if (hasQuality) {
        const qualityMatch = labelInnerHtml.match(/id=["'](qualityVal|copyQualityVal)["']/);
        const valueId = qualityMatch ? qualityMatch[1] : 'qualityVal';
        return { valueId, defaultValue: defaultPercentForLabelSpanId(valueId) };
    }
    return { valueId: 'qualityVal', defaultValue: '80' };
}

function readPercentFromLabelHtml(labelHtml, valueId) {
    const re = new RegExp(`id=["']${valueId}["'][^>]*>([^<]*)`, 'i');
    const match = String(labelHtml).match(re);
    return match ? match[1].trim() : null;
}

function buildI18nPercentLabelHtml(translatedLabel, valueId, value) {
    return `${translatedLabel} (<span id="${valueId}">${value}</span>%)`;
}

/** Span id → range input id (editor syncPercentLabelsFromInputs). */
const PERCENT_LABEL_SYNC_PAIRS = [
    ['resizeScaleVal', 'rngResizeScale'],
    ['sharpenVal', 'rngSharpen'],
    ['qualityVal', 'rngQuality'],
    ['copyQualityVal', 'rngCopyQuality']
];

/**
 * Rebuild percent label HTML for applyI18n (prefers linked range input value).
 * @param {string} translatedLabel
 * @param {{ getAttribute?: Function, innerHTML?: string, querySelector?: Function }} labelElement
 * @param {{ getElementById?: Function }} [doc]
 */
function rebuildPercentLabelHtml(translatedLabel, labelElement, doc) {
    const htmlBefore = labelElement && labelElement.innerHTML ? labelElement.innerHTML : '';
    const meta = resolvePercentLabelMeta(labelElement, htmlBefore);
    const value = getPercentLabelDisplayValue(meta, labelElement, doc);
    return {
        html: buildI18nPercentLabelHtml(translatedLabel, meta.valueId, value),
        valueId: meta.valueId,
        value
    };
}

/** Mirrors editor applyI18n for [data-i18n-label] percent labels (HTML string only). */
function applyI18nPercentLabel(labelHtml, translatedLabel) {
    const meta = resolveI18nPercentLabel(labelHtml);
    const existing = readPercentFromLabelHtml(labelHtml, meta.valueId);
    const value = existing != null && existing !== '' ? existing : meta.defaultValue;
    return buildI18nPercentLabelHtml(translatedLabel, meta.valueId, value);
}

/**
 * Update a percent span inside label HTML. Use after i18n rebuild instead of a cached span ref.
 */
function setPercentInLabelHtml(labelHtml, valueId, value) {
    const re = new RegExp(`(id=["']${valueId}["'][^>]*>)([^<]*)(</span>)`, 'i');
    if (!re.test(labelHtml)) {
        return labelHtml;
    }
    return String(labelHtml).replace(re, `$1${String(value)}$3`);
}

/** Legacy 50% halving steps (benchmark / comparison only). */
function computeHalveDownscaleSteps(srcW, srcH, targetW, targetH) {
    if (targetW >= srcW && targetH >= srcH) {
        return [{ w: targetW, h: targetH }];
    }
    const steps = [];
    let w = srcW;
    let h = srcH;
    while (w > targetW * 2 || h > targetH * 2) {
        w = Math.max(targetW, Math.floor(w / 2));
        h = Math.max(targetH, Math.floor(h / 2));
        steps.push({ w, h });
    }
    const last = steps[steps.length - 1];
    if (!last || last.w !== targetW || last.h !== targetH) {
        steps.push({ w: targetW, h: targetH });
    }
    return steps;
}

/**
 * Stepped downscale sizes from source to target (editor default: 25% per step).
 * @param {number} [stepFactor] - multiply per step (default 0.75)
 */
function computeDownscaleSteps(srcW, srcH, targetW, targetH, stepFactor) {
    const factor = stepFactor != null ? stepFactor : RESIZE_DOWNSCALE_STEP_FACTOR;
    if (targetW >= srcW && targetH >= srcH) {
        return [{ w: targetW, h: targetH }];
    }
    const steps = [];
    let w = srcW;
    let h = srcH;
    let guard = 0;
    while (
        (w > targetW * RESIZE_DOWNSCALE_STOP_RATIO || h > targetH * RESIZE_DOWNSCALE_STOP_RATIO)
        && guard++ < RESIZE_DOWNSCALE_MAX_STEPS
    ) {
        const nw = Math.max(targetW, Math.floor(w * factor));
        const nh = Math.max(targetH, Math.floor(h * factor));
        if (nw === w && nh === h) {
            break;
        }
        steps.push({ w: nw, h: nh });
        w = nw;
        h = nh;
    }
    if (w !== targetW || h !== targetH) {
        steps.push({ w: targetW, h: targetH });
    }
    return steps;
}

const api = {
    RESIZE_SCALE_MIN,
    RESIZE_SCALE_MAX,
    RESIZE_SCALE_DEFAULT,
    RESIZE_DOWNSCALE_STEP_FACTOR,
    RESIZE_DOWNSCALE_STOP_RATIO,
    RESIZE_DOWNSCALE_MAX_STEPS,
    buildResizePanelFromImage,
    buildResizePanelFromCrop,
    shouldSyncResizePanelFromImage,
    shouldUpdateResizeInputsFromCrop,
    clampResizeScalePercent,
    percentFromResizeWidth,
    normalizeResizeDimensionValue,
    dimensionsFromResizeScalePercent,
    shouldDisableResizeApplyButton,
    resolveResizePreviewZoomRatio,
    defaultPercentForLabelSpanId,
    resolvePercentLabelMeta,
    getPercentLabelDisplayValue,
    resolveI18nPercentLabel,
    readPercentFromLabelHtml,
    buildI18nPercentLabelHtml,
    PERCENT_LABEL_SYNC_PAIRS,
    getViewportFillRatio,
    isImageSmallerThanViewport,
    resolveZoomRatioAfterResize,
    rebuildPercentLabelHtml,
    applyI18nPercentLabel,
    setPercentInLabelHtml,
    computeHalveDownscaleSteps,
    computeDownscaleSteps
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}
if (typeof globalThis !== 'undefined') {
    globalThis.VsimageResizePanelLogic = api;
}
