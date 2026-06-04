'use strict';

/**
 * Pure zoom-loupe coordinate helpers.
 * Loaded in the webview as globalThis.VsimageLoupeLogic; required from Node tests.
 */

function clampNaturalRect(x, y, width, height, naturalWidth, naturalHeight) {
    const w = Math.max(1, Math.min(width, naturalWidth));
    const h = Math.max(1, Math.min(height, naturalHeight));
    const maxX = Math.max(0, naturalWidth - w);
    const maxY = Math.max(0, naturalHeight - h);
    return {
        x: Math.max(0, Math.min(maxX, x)),
        y: Math.max(0, Math.min(maxY, y)),
        width: w,
        height: h
    };
}

function getNaturalRectFromPoints(start, end, minDrag, naturalWidth, naturalHeight) {
    const x0 = Math.min(start.x, end.x);
    const y0 = Math.min(start.y, end.y);
    const x1 = Math.max(start.x, end.x);
    const y1 = Math.max(start.y, end.y);
    return clampNaturalRect(
        x0,
        y0,
        Math.max(minDrag, x1 - x0 + 1),
        Math.max(minDrag, y1 - y0 + 1),
        naturalWidth,
        naturalHeight
    );
}

function naturalRectToClientBounds(rect, imageData, containerRect) {
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

const api = { clampNaturalRect, getNaturalRectFromPoints, naturalRectToClientBounds };

if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}
if (typeof globalThis !== 'undefined') {
    globalThis.VsimageLoupeLogic = api;
}
