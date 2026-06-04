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
    return {
        immediateMessage: null,
        needsBlob: true
    };
}

function commandForBlobType(type) {
    return type === 'save' ? 'save-image' : 'export-image';
}

const api = { resolveSaveStart, commandForBlobType };

if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}
if (typeof globalThis !== 'undefined') {
    globalThis.VsimageSaveExportLogic = api;
}
