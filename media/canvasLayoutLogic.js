'use strict';

function computeCanvasViewportLayout(viewportW, viewportH, canvasW, canvasH) {
    return {
        contentWidth: Math.max(viewportW, canvasW),
        contentHeight: Math.max(viewportH, canvasH),
        marginLeft: 0,
        marginTop: 0
    };
}

const api = {
    computeCanvasViewportLayout
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}
if (typeof globalThis !== 'undefined') {
    globalThis.VsimageCanvasLayoutLogic = api;
}
