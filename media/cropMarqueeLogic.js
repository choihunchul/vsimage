'use strict';

/**
 * Pure helpers for crop marquee double-click (full image ↔ trim to content).
 * Loaded in the webview as globalThis.VsimageCropMarqueeLogic; required from Node tests.
 */

function clampCropBox(x, y, width, height, originalWidth, originalHeight) {
    const boxWidth = Math.max(1, Math.min(originalWidth, Math.round(width)));
    const boxHeight = Math.max(1, Math.min(originalHeight, Math.round(height)));
    const maxX = Math.max(0, originalWidth - boxWidth);
    const maxY = Math.max(0, originalHeight - boxHeight);

    return {
        x: Math.max(0, Math.min(maxX, Math.round(x))),
        y: Math.max(0, Math.min(maxY, Math.round(y))),
        width: boxWidth,
        height: boxHeight
    };
}

function fullImageCropBounds(originalWidth, originalHeight) {
    return clampCropBox(0, 0, originalWidth, originalHeight, originalWidth, originalHeight);
}

function isMarqueeFullImageNatural(cropData, originalWidth, originalHeight, tolerance = 2) {
    if (!cropData || originalWidth <= 0 || originalHeight <= 0) {
        return false;
    }
    return cropData.x <= tolerance
        && cropData.y <= tolerance
        && Math.abs(cropData.width - originalWidth) <= tolerance
        && Math.abs(cropData.height - originalHeight) <= tolerance;
}

function isPointInCropSelection(point, cropData) {
    if (!point || !cropData) {
        return false;
    }
    return point.x >= cropData.x
        && point.x < cropData.x + cropData.width
        && point.y >= cropData.y
        && point.y < cropData.y + cropData.height;
}

/** @returns {'trimToContent'|'expandToFull'|null} */
function getMarqueeDblClickToggleAction(cropData, originalWidth, originalHeight, tolerance = 2) {
    if (!cropData || originalWidth <= 0 || originalHeight <= 0) {
        return null;
    }
    return isMarqueeFullImageNatural(cropData, originalWidth, originalHeight, tolerance)
        ? 'trimToContent'
        : 'expandToFull';
}

function canHandleMarqueeDblClick(state) {
    if (!state.hasCropper || !state.cropEnabled || !state.cropped) {
        return false;
    }
    if (state.eyedropperActive || state.magicWandMode || state.colorPickerMode || state.spacePressed || state.zLoupeActive) {
        return false;
    }
    if (!state.targetInCanvas) {
        return false;
    }
    if (state.targetInToolbar || state.targetInModal) {
        return false;
    }
    return true;
}

function shouldInvokeMarqueeDblClickToggle(state, point, cropData) {
    if (!canHandleMarqueeDblClick(state)) {
        return false;
    }
    return isPointInCropSelection(point, cropData);
}

function canHandleImageZoomDblClick(state) {
    if (!state.hasCropper) {
        return false;
    }
    if (state.eyedropperActive || state.magicWandMode || state.colorPickerMode || state.spacePressed || state.zLoupeActive) {
        return false;
    }
    if (!state.targetInCanvas) {
        return false;
    }
    if (state.targetInToolbar || state.targetInModal) {
        return false;
    }
    return true;
}

/** Double-click on image (no active marquee hit) toggles 100% ↔ viewport fit. */
function shouldInvokeImageZoomDblClick(state, point, cropData) {
    if (!point || !canHandleImageZoomDblClick(state)) {
        return false;
    }
    if (state.cropEnabled && state.cropped && cropData && isPointInCropSelection(point, cropData)) {
        return false;
    }
    return true;
}

const api = {
    clampCropBox,
    fullImageCropBounds,
    isMarqueeFullImageNatural,
    isPointInCropSelection,
    getMarqueeDblClickToggleAction,
    canHandleMarqueeDblClick,
    shouldInvokeMarqueeDblClickToggle,
    canHandleImageZoomDblClick,
    shouldInvokeImageZoomDblClick
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}
if (typeof globalThis !== 'undefined') {
    globalThis.VsimageCropMarqueeLogic = api;
}
