'use strict';

/**
 * Pure save/export message decisions.
 * Loaded in the webview as globalThis.VsimageSaveExportLogic; required from Node tests.
 */

function resolveSaveStart(type, isDocumentEditor) {
    if (type === 'save' && isDocumentEditor) {
        return {
            immediateMessage: { command: 'save-document' },
            needsBlob: false
        };
    }
    if (type === 'save') {
        return {
            immediateMessage: { command: 'save-image' },
            needsBlob: false
        };
    }
    if (type === 'export') {
        return {
            immediateMessage: { command: 'export-image' },
            needsBlob: false
        };
    }
    return {
        immediateMessage: null,
        needsBlob: true
    };
}

function commandForBlobType(type) {
    return type === 'save' ? 'save-image' : 'export-image';
}

function resolveMimeTypeForPath(filePath, fallbackMimeType) {
    const normalizedFallback = fallbackMimeType || 'image/png';
    const lowerPath = String(filePath || '').toLowerCase();
    if (lowerPath.endsWith('.png')) {
        return 'image/png';
    }
    if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) {
        return 'image/jpeg';
    }
    if (lowerPath.endsWith('.webp')) {
        return 'image/webp';
    }
    if (lowerPath.endsWith('.gif')) {
        return 'image/gif';
    }
    return normalizedFallback;
}

const api = { resolveSaveStart, commandForBlobType, resolveMimeTypeForPath };

if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}
if (typeof globalThis !== 'undefined') {
    globalThis.VsimageSaveExportLogic = api;
}
