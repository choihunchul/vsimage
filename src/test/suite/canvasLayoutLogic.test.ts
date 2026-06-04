import * as assert from 'assert';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const layout = require(path.join(__dirname, '../../../../media/canvasLayoutLogic.js')) as {
    computeCanvasViewportLayout: (
        viewportW: number,
        viewportH: number,
        canvasW: number,
        canvasH: number
    ) => {
        contentWidth: number;
        contentHeight: number;
        marginLeft: number;
        marginTop: number;
    };
};

suite('Canvas viewport layout', () => {
    test('keeps the canvas aligned to viewport origin instead of centering', () => {
        const result = layout.computeCanvasViewportLayout(1200, 900, 400, 300);
        assert.deepStrictEqual(result, {
            contentWidth: 1200,
            contentHeight: 900,
            marginLeft: 0,
            marginTop: 0
        });
    });

    test('expands scroll content for oversized canvases without adding margins', () => {
        const result = layout.computeCanvasViewportLayout(600, 500, 1000, 800);
        assert.deepStrictEqual(result, {
            contentWidth: 1000,
            contentHeight: 800,
            marginLeft: 0,
            marginTop: 0
        });
    });
});
