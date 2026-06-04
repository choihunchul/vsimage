'use strict';

/** Slider 0–100 maps to unsharp amount 0–SHARPEN_MAX_AMOUNT. */
const SHARPEN_MAX_AMOUNT = 0.85;
const SHARPEN_MIN_RADIUS = 1;
const SHARPEN_MAX_RADIUS = 3;

function clampByte(v) {
    return Math.max(0, Math.min(255, Math.round(v)));
}

function amountFromSlider(sliderPercent) {
    const p = Math.max(0, Math.min(100, Number(sliderPercent) || 0));
    return (p / 100) * SHARPEN_MAX_AMOUNT;
}

function blurRadiusForSize(width, height) {
    const minSide = Math.min(width, height);
    if (minSide <= 128) {
        return SHARPEN_MIN_RADIUS;
    }
    if (minSide <= 512) {
        return 2;
    }
    return SHARPEN_MAX_RADIUS;
}

function boxBlurImageData(data, w, h, radius) {
    const src = new Uint8ClampedArray(data.data);
    const out = new Uint8ClampedArray(src.length);
    const size = radius * 2 + 1;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let r = 0;
            let g = 0;
            let b = 0;
            for (let k = -radius; k <= radius; k++) {
                const sx = Math.min(w - 1, Math.max(0, x + k));
                const i = (y * w + sx) * 4;
                r += src[i];
                g += src[i + 1];
                b += src[i + 2];
            }
            const o = (y * w + x) * 4;
            out[o] = r / size;
            out[o + 1] = g / size;
            out[o + 2] = b / size;
            out[o + 3] = src[o + 3];
        }
    }

    const tmp = new Uint8ClampedArray(out);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let r = 0;
            let g = 0;
            let b = 0;
            for (let k = -radius; k <= radius; k++) {
                const sy = Math.min(h - 1, Math.max(0, y + k));
                const i = (sy * w + x) * 4;
                r += tmp[i];
                g += tmp[i + 1];
                b += tmp[i + 2];
            }
            const o = (y * w + x) * 4;
            out[o] = r / size;
            out[o + 1] = g / size;
            out[o + 2] = b / size;
        }
    }

    return { data: out, width: w, height: h };
}

/**
 * Unsharp mask on canvas (mutates pixels).
 * @param {HTMLCanvasElement} canvas
 * @param {number} amount
 * @param {number} [radius]
 */
function applyUnsharpMask(canvas, amount, radius) {
    if (!amount || amount <= 0) {
        return canvas;
    }
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const r = radius != null ? radius : blurRadiusForSize(w, h);
    const original = ctx.getImageData(0, 0, w, h);
    const blurred = boxBlurImageData(original, w, h, r);
    const out = ctx.createImageData(w, h);

    for (let i = 0; i < original.data.length; i += 4) {
        for (let c = 0; c < 3; c++) {
            const idx = i + c;
            out.data[idx] = clampByte(
                original.data[idx] + amount * (original.data[idx] - blurred.data[idx])
            );
        }
        out.data[i + 3] = original.data[i + 3];
    }

    ctx.putImageData(out, 0, 0);
    return canvas;
}

const api = {
    SHARPEN_MAX_AMOUNT,
    amountFromSlider,
    blurRadiusForSize,
    applyUnsharpMask
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}
if (typeof globalThis !== 'undefined') {
    globalThis.VsimageSharpenLogic = api;
}
