'use strict';

/**
 * Pure rotate and flip transitions.
 * Loaded in the webview as globalThis.VsimageTransformLogic; required from Node tests.
 */

function rotationDelta(action) {
    if (action === 'rotateLeft') {
        return -90;
    }
    if (action === 'rotateRight') {
        return 90;
    }
    return null;
}

function nextFlipState(state, action) {
    return {
        scaleX: action === 'flipH' ? -state.scaleX : state.scaleX,
        scaleY: action === 'flipV' ? -state.scaleY : state.scaleY
    };
}

const api = { rotationDelta, nextFlipState };

if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}
if (typeof globalThis !== 'undefined') {
    globalThis.VsimageTransformLogic = api;
}
