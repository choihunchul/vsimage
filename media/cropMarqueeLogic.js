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

function hasValidCropBox(cropData) {
    return Boolean(cropData)
        && Number(cropData.width) > 0
        && Number(cropData.height) > 0;
}

function resolveMarqueeKeyboardStep(shiftKey) {
    return shiftKey ? 10 : 1;
}

function constrainPixelMoveDelta(deltaX, deltaY) {
    const dx = Number(deltaX) || 0;
    const dy = Number(deltaY) || 0;
    if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) {
        return { deltaX: 0, deltaY: 0 };
    }

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const signX = dx < 0 ? -1 : 1;
    const signY = dy < 0 ? -1 : 1;
    const tan22_5 = Math.tan(Math.PI / 8);

    if (absY / absX < tan22_5) {
        return { deltaX: Math.round(dx), deltaY: 0 };
    }
    if (absY / absX > 1 / tan22_5) {
        return { deltaX: 0, deltaY: Math.round(dy) };
    }

    const magnitude = Math.round(Math.max(absX, absY));
    return { deltaX: signX * magnitude, deltaY: signY * magnitude };
}

function resolveModifierMarqueeBox(state) {
    if (!state || !state.startPoint || !state.currentPoint) {
        return null;
    }

    const {
        startCropData,
        startPoint,
        currentPoint,
        originalWidth,
        originalHeight,
        shiftKey,
        altKey,
        spacePressed
    } = state;

    const hasStartBox = hasValidCropBox(startCropData);

    if (spacePressed && hasStartBox) {
        let deltaX = currentPoint.x - startPoint.x;
        let deltaY = currentPoint.y - startPoint.y;
        if (shiftKey) {
            const constrained = constrainPixelMoveDelta(deltaX, deltaY);
            deltaX = constrained.deltaX;
            deltaY = constrained.deltaY;
        }
        return clampCropBox(
            startCropData.x + deltaX,
            startCropData.y + deltaY,
            startCropData.width,
            startCropData.height,
            originalWidth,
            originalHeight
        );
    }

    if (!altKey) {
        return null;
    }

    const anchorX = hasStartBox ? startCropData.x + (startCropData.width / 2) : startPoint.x;
    const anchorY = hasStartBox ? startCropData.y + (startCropData.height / 2) : startPoint.y;
    let vectorX = currentPoint.x - anchorX;
    let vectorY = currentPoint.y - anchorY;
    if (shiftKey) {
        const constrained = constrainPixelMoveDelta(vectorX, vectorY);
        vectorX = constrained.deltaX;
        vectorY = constrained.deltaY;
    }
    let halfWidth = Math.abs(vectorX);
    let halfHeight = Math.abs(vectorY);

    return clampCropBox(
        anchorX - halfWidth,
        anchorY - halfHeight,
        halfWidth * 2,
        halfHeight * 2,
        originalWidth,
        originalHeight
    );
}

function resolveDragMarqueeBox(state) {
    if (!state || !state.startPoint || !state.currentPoint) {
        return null;
    }

    const {
        startPoint,
        currentPoint,
        originalWidth,
        originalHeight,
        shiftKey
    } = state;

    let endX = currentPoint.x;
    let endY = currentPoint.y;
    if (shiftKey) {
        const constrained = constrainPixelMoveDelta(endX - startPoint.x, endY - startPoint.y);
        endX = startPoint.x + constrained.deltaX;
        endY = startPoint.y + constrained.deltaY;
    }

    const x = Math.min(startPoint.x, endX);
    const y = Math.min(startPoint.y, endY);
    const width = Math.abs(endX - startPoint.x);
    const height = Math.abs(endY - startPoint.y);

    return clampCropBox(x, y, width || 1, height || 1, originalWidth, originalHeight);
}

function resolveShiftConstrainedCropBox(state) {
    if (!state || !state.startCropData || !state.startPoint || !state.currentPoint) {
        return null;
    }

    const {
        action,
        startCropData,
        startPoint,
        currentPoint,
        originalWidth,
        originalHeight
    } = state;

    const constrained = constrainPixelMoveDelta(
        currentPoint.x - startPoint.x,
        currentPoint.y - startPoint.y
    );
    const cx = startPoint.x + constrained.deltaX;
    const cy = startPoint.y + constrained.deltaY;
    const left = startCropData.x;
    const top = startCropData.y;
    const right = startCropData.x + startCropData.width;
    const bottom = startCropData.y + startCropData.height;

    switch (action) {
        case 'move':
        case 'all':
            return clampCropBox(
                startCropData.x + constrained.deltaX,
                startCropData.y + constrained.deltaY,
                startCropData.width,
                startCropData.height,
                originalWidth,
                originalHeight
            );
        case 'crop':
            return resolveDragMarqueeBox({
                startPoint,
                currentPoint: { x: cx, y: cy },
                originalWidth,
                originalHeight
            });
        case 'e':
            return clampCropBox(left, top, Math.max(1, cx - left), startCropData.height, originalWidth, originalHeight);
        case 'w':
            return clampCropBox(cx, top, Math.max(1, right - cx), startCropData.height, originalWidth, originalHeight);
        case 's':
            return clampCropBox(left, top, startCropData.width, Math.max(1, cy - top), originalWidth, originalHeight);
        case 'n':
            return clampCropBox(left, cy, startCropData.width, Math.max(1, bottom - cy), originalWidth, originalHeight);
        case 'se':
            return clampCropBox(left, top, Math.max(1, cx - left), Math.max(1, cy - top), originalWidth, originalHeight);
        case 'sw':
            return clampCropBox(cx, top, Math.max(1, right - cx), Math.max(1, cy - top), originalWidth, originalHeight);
        case 'ne':
            return clampCropBox(left, cy, Math.max(1, cx - left), Math.max(1, bottom - cy), originalWidth, originalHeight);
        case 'nw':
            return clampCropBox(cx, cy, Math.max(1, right - cx), Math.max(1, bottom - cy), originalWidth, originalHeight);
        default:
            return null;
    }
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

function isImageZoomBelowFull(zoomRatio, epsilon = 0.005) {
    return Math.abs(zoomRatio - 1) >= epsilon;
}

function shouldInvokeMarqueeDblClickToggle(state, point, cropData, opts) {
    if (!canHandleMarqueeDblClick(state)) {
        return false;
    }
    if (opts && opts.marqueeTargetHit) {
        return true;
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

function shouldAutoEnableMarqueeOnDrag(state) {
    if (!state.hasCropper || state.cropEnabled || state.cropped) {
        return false;
    }
    if (state.eyedropperActive || state.magicWandMode || state.colorPickerMode || state.spacePressed || state.zLoupeActive) {
        return false;
    }
    if (!state.targetInCanvas) {
        return false;
    }
    if (!state.targetOnImage) {
        return false;
    }
    if (state.targetInToolbar || state.targetInModal) {
        return false;
    }
    return true;
}

function isValidNaturalCropSnapshot(cropData) {
    return Boolean(cropData)
        && Number(cropData.width) > 0
        && Number(cropData.height) > 0;
}

/** Whether to keep natural crop across zoom (setData after zoom). */
function shouldSnapshotCropForZoom(cropped, cropData) {
    return Boolean(cropped) && isValidNaturalCropSnapshot(cropData);
}

function cloneNaturalCropSnapshot(cropData) {
    if (!isValidNaturalCropSnapshot(cropData)) {
        return null;
    }
    return {
        x: cropData.x,
        y: cropData.y,
        width: cropData.width,
        height: cropData.height
    };
}

/**
 * Scale crop box in container space when canvas zoom factor changes.
 * @returns {object|null} next crop box or null if no scale needed
 */
function scaleCropBoxAfterCanvasZoom(prevCanvas, prevBox, nextCanvas) {
    if (!prevCanvas || !prevBox || !nextCanvas || !prevCanvas.width) {
        return null;
    }
    const factor = nextCanvas.width / prevCanvas.width;
    if (Math.abs(factor - 1) < 0.0001) {
        return null;
    }
    const relLeft = prevBox.left - prevCanvas.left;
    const relTop = prevBox.top - prevCanvas.top;
    return {
        left: nextCanvas.left + relLeft * factor,
        top: nextCanvas.top + relTop * factor,
        width: prevBox.width * factor,
        height: prevBox.height * factor
    };
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

function hasActiveMarqueeSelection(cropped, cropData) {
    return Boolean(cropped) && hasValidCropBox(cropData);
}

const api = {
    clampCropBox,
    fullImageCropBounds,
    isMarqueeFullImageNatural,
    isPointInCropSelection,
    resolveMarqueeKeyboardStep,
    constrainPixelMoveDelta,
    resolveModifierMarqueeBox,
    resolveDragMarqueeBox,
    resolveShiftConstrainedCropBox,
    getMarqueeDblClickToggleAction,
    canHandleMarqueeDblClick,
    isImageZoomBelowFull,
    shouldInvokeMarqueeDblClickToggle,
    canHandleImageZoomDblClick,
    shouldInvokeImageZoomDblClick,
    shouldAutoEnableMarqueeOnDrag,
    hasActiveMarqueeSelection,
    isValidNaturalCropSnapshot,
    shouldSnapshotCropForZoom,
    cloneNaturalCropSnapshot,
    scaleCropBoxAfterCanvasZoom
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}
if (typeof globalThis !== 'undefined') {
    globalThis.VsimageCropMarqueeLogic = api;
}
