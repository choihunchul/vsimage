'use strict';

/**
 * Pure color-picker formatting helpers.
 * Loaded in the webview as globalThis.VsimageColorLogic; required from Node tests.
 */

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
    return {
        c: Math.round(((1 - r - k) / (1 - k)) * 100),
        m: Math.round(((1 - g - k) / (1 - k)) * 100),
        y: Math.round(((1 - b - k) / (1 - k)) * 100),
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

const api = { toHexByte, rgbToHsl, rgbToHsv, rgbToCmyk, buildColorFormats };

if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}
if (typeof globalThis !== 'undefined') {
    globalThis.VsimageColorLogic = api;
}
