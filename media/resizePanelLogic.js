'use strict';

/**
 * Pure helpers for resize sidebar panel state after image load, resize, or crop.
 */

const RESIZE_SCALE_MIN = 10;
const RESIZE_SCALE_MAX = 200;
const RESIZE_SCALE_DEFAULT = 100;

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

function dimensionsFromResizeScalePercent(percent, baseWidth, baseHeight) {
    const scale = clampResizeScalePercent(percent) / 100;
    return {
        width: Math.max(1, Math.round(baseWidth * scale)),
        height: Math.max(1, Math.round(baseHeight * scale))
    };
}

/** Default % shown when rebuilding i18n labels (resize scale must stay 100, not quality 80). */
function defaultPercentForLabelSpanId(spanId) {
    if (spanId === 'resizeScaleVal') {
        return String(RESIZE_SCALE_DEFAULT);
    }
    if (spanId === 'qualityVal' || spanId === 'copyQualityVal') {
        return '80';
    }
    return '80';
}

function resolveI18nPercentLabel(labelInnerHtml) {
    const hasResizeScale = /id=["']resizeScaleVal["']/.test(labelInnerHtml);
    const hasQuality = /id=["'](?:qualityVal|copyQualityVal)["']/.test(labelInnerHtml);
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

const api = {
    RESIZE_SCALE_MIN,
    RESIZE_SCALE_MAX,
    RESIZE_SCALE_DEFAULT,
    buildResizePanelFromImage,
    buildResizePanelFromCrop,
    shouldSyncResizePanelFromImage,
    clampResizeScalePercent,
    percentFromResizeWidth,
    dimensionsFromResizeScalePercent,
    defaultPercentForLabelSpanId,
    resolveI18nPercentLabel
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}
if (typeof globalThis !== 'undefined') {
    globalThis.VsimageResizePanelLogic = api;
}
