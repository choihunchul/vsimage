'use strict';

/**
 * Pure helpers for moving marquee selection pixels (cut source, paste destination).
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

function computeMovedBounds(sourceBounds, deltaX, deltaY, imageWidth, imageHeight) {
    if (!sourceBounds || imageWidth <= 0 || imageHeight <= 0) {
        return null;
    }

    return clampCropBox(
        sourceBounds.x + deltaX,
        sourceBounds.y + deltaY,
        sourceBounds.width,
        sourceBounds.height,
        imageWidth,
        imageHeight
    );
}

function hasPixelMoveDelta(deltaX, deltaY, epsilon = 0.5) {
    return Math.abs(deltaX) >= epsilon || Math.abs(deltaY) >= epsilon;
}

function constrainPixelMoveDelta(deltaX, deltaY) {
    const cropLogic = typeof globalThis !== 'undefined' ? globalThis.VsimageCropMarqueeLogic : null;
    if (cropLogic && cropLogic.constrainPixelMoveDelta) {
        return cropLogic.constrainPixelMoveDelta(deltaX, deltaY);
    }

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

const api = {
    clampCropBox,
    computeMovedBounds,
    hasPixelMoveDelta,
    constrainPixelMoveDelta
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}
if (typeof globalThis !== 'undefined') {
    globalThis.VsimageSelectionMoveLogic = api;
}
