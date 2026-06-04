'use strict';

/**
 * Pure magic-wand flood-fill helper.
 * Loaded in the webview as globalThis.VsimageMagicWandLogic; required from Node tests.
 */

function floodFillPixels(pixels, width, height, startX, startY, tolerance) {
    if (!pixels || width <= 0 || height <= 0
        || startX < 0 || startX >= width || startY < 0 || startY >= height) {
        return null;
    }

    const startIdx = startY * width + startX;
    const seed = startIdx * 4;
    const seedColor = [pixels[seed], pixels[seed + 1], pixels[seed + 2], pixels[seed + 3]];
    const mask = new Uint8Array(width * height);
    const visited = new Uint8Array(width * height);
    const stack = [startX, startY];
    let count = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    while (stack.length) {
        const y = stack.pop();
        const x = stack.pop();
        if (x < 0 || x >= width || y < 0 || y >= height) {
            continue;
        }

        const idx = y * width + x;
        if (visited[idx]) {
            continue;
        }
        visited[idx] = 1;

        const pixel = idx * 4;
        const matches = seedColor.every(
            (value, channel) => Math.abs(pixels[pixel + channel] - value) <= tolerance
        );
        if (!matches) {
            continue;
        }

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

const api = { floodFillPixels };

if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}
if (typeof globalThis !== 'undefined') {
    globalThis.VsimageMagicWandLogic = api;
}
