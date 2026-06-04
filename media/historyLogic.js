'use strict';

/**
 * Pure history stack transitions.
 * Loaded in the webview as globalThis.VsimageHistoryLogic; required from Node tests.
 */

function trimSnapshots(entries, max) {
    return entries.length > max
        ? entries.slice(entries.length - max)
        : entries.slice();
}

function restoreSnapshot(entries, index) {
    if (index < 0 || index >= entries.length) {
        return null;
    }
    return {
        entry: entries[index],
        remaining: entries.slice(0, index)
    };
}

const api = { trimSnapshots, restoreSnapshot };

if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}
if (typeof globalThis !== 'undefined') {
    globalThis.VsimageHistoryLogic = api;
}
