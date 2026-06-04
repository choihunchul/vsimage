'use strict';

/**
 * Pure zoom helpers (Cropper.js relative zoom, restore-after-setData, toggle 100% ↔ fit).
 * Loaded in the webview as globalThis.VsimageZoomLogic; required from Node tests.
 */

const DEFAULT_ZOOM_EPSILON = 0.005;
const ZOOM_STEP = 0.1;

function getImageZoomRatio(displayWidth, naturalWidth) {
    const nw = Number(naturalWidth);
    if (!nw || nw <= 0) {
        return null;
    }
    const w = Number(displayWidth) || 0;
    return w / nw;
}

function getImageZoomRatioFromData(imageData) {
    if (!imageData || !imageData.naturalWidth) {
        return null;
    }
    return getImageZoomRatio(imageData.width, imageData.naturalWidth);
}

function zoomRatioToPercent(ratio) {
    return Math.round(Number(ratio) * 100);
}

/**
 * Cropper.js zoom(delta): delta &gt; 0 → ×(1+delta); delta &lt; 0 → ×1/(1−delta).
 * @see Cropper zoom() implementation
 */
function computeRatioAfterCropperRelativeZoom(currentRatio, delta) {
    const cur = Number(currentRatio);
    if (!Number.isFinite(cur) || cur <= 0) {
        return null;
    }
    const d = Number(delta);
    if (!Number.isFinite(d) || d === 0) {
        return cur;
    }
    const factor = d < 0 ? 1 / (1 - d) : 1 + d;
    return cur * factor;
}

function ratioAfterZoomAction(currentRatio, action) {
    if (action === 'zoomIn') {
        return computeRatioAfterCropperRelativeZoom(currentRatio, ZOOM_STEP);
    }
    if (action === 'zoomOut') {
        return computeRatioAfterCropperRelativeZoom(currentRatio, -ZOOM_STEP);
    }
    return null;
}

function getCanvasSizeForZoomRatio(naturalWidth, naturalHeight, ratio) {
    const w = Number(naturalWidth);
    const h = Number(naturalHeight);
    const r = Number(ratio);
    if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(h) || h <= 0 || !Number.isFinite(r) || r <= 0) {
        return null;
    }
    return {
        width: w * r,
        height: h * r
    };
}

/**
 * After marquee setData restore, always re-apply the ratio captured right after zoom(delta).
 */
function resolveFinalZoomRatioAfterCropRestore(intendedRatio, ratioAfterRestore) {
    const intended = Number(intendedRatio);
    if (!Number.isFinite(intended) || intended <= 0) {
        const fallback = Number(ratioAfterRestore);
        return Number.isFinite(fallback) && fallback > 0 ? fallback : 1;
    }
    return intended;
}

/** True when using ratioAfterRestore would undo a zoom-out (regression guard). */
function wouldCancelRelativeZoomOut(intendedRatio, ratioAfterRestore, epsilon = DEFAULT_ZOOM_EPSILON) {
    if (intendedRatio == null || ratioAfterRestore == null) {
        return false;
    }
    return intendedRatio < ratioAfterRestore - epsilon;
}

function isAtFullZoom(zoomRatio, epsilon = DEFAULT_ZOOM_EPSILON) {
    return Math.abs(zoomRatio - 1) < epsilon;
}

function isImageZoomBelowFull(zoomRatio, epsilon = DEFAULT_ZOOM_EPSILON) {
    return Math.abs(zoomRatio - 1) >= epsilon;
}

function resolveToggleZoomTargetRatio(currentRatio, fitRatio, epsilon = DEFAULT_ZOOM_EPSILON) {
    return isAtFullZoom(currentRatio, epsilon) ? fitRatio : 1;
}

function shouldWheelTriggerZoom(ctrlKey, metaKey) {
    return Boolean(ctrlKey || metaKey);
}

const api = {
    DEFAULT_ZOOM_EPSILON,
    ZOOM_STEP,
    getImageZoomRatio,
    getImageZoomRatioFromData,
    zoomRatioToPercent,
    computeRatioAfterCropperRelativeZoom,
    ratioAfterZoomAction,
    getCanvasSizeForZoomRatio,
    resolveFinalZoomRatioAfterCropRestore,
    wouldCancelRelativeZoomOut,
    isAtFullZoom,
    isImageZoomBelowFull,
    resolveToggleZoomTargetRatio,
    shouldWheelTriggerZoom
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}
if (typeof globalThis !== 'undefined') {
    globalThis.VsimageZoomLogic = api;
}
