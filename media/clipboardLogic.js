'use strict';

/**
 * Pure clipboard option decisions.
 * Loaded in the webview as globalThis.VsimageClipboardLogic; required from Node tests.
 */

const COPY_FORMATS = new Set(['image/png', 'image/jpeg', 'image/webp']);

function shouldShowQuality(format) {
    return format === 'image/jpeg' || format === 'image/webp';
}

function resolveCopyFormat(format) {
    return COPY_FORMATS.has(format) ? format : 'image/png';
}

function resolveCopyQuality(value, fallback) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveSelectionOnly(hasSelection, savedScope) {
    if (hasSelection) {
        return true;
    }
    return false;
}

function canWriteClipboardImage(clipboardWrite, clipboardItemCtor) {
    return typeof clipboardWrite === 'function' && typeof clipboardItemCtor === 'function';
}

const api = {
    shouldShowQuality,
    resolveCopyFormat,
    resolveCopyQuality,
    resolveSelectionOnly,
    canWriteClipboardImage
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}
if (typeof globalThis !== 'undefined') {
    globalThis.VsimageClipboardLogic = api;
}
