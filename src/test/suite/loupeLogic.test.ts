import * as assert from 'assert';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logic = require(path.join(__dirname, '../../../../media/loupeLogic.js')) as {
    clampNaturalRect: (
        x: number, y: number, width: number, height: number, naturalWidth: number, naturalHeight: number
    ) => { x: number; y: number; width: number; height: number };
    getNaturalRectFromPoints: (
        start: { x: number; y: number },
        end: { x: number; y: number },
        minDrag: number,
        naturalWidth: number,
        naturalHeight: number
    ) => { x: number; y: number; width: number; height: number };
    naturalRectToClientBounds: (
        rect: { x: number; y: number; width: number; height: number },
        imageData: { left: number; top: number; width: number; height: number; naturalWidth: number; naturalHeight: number },
        containerRect: { left: number; top: number }
    ) => { left: number; top: number; width: number; height: number } | null;
};

suite('Zoom loupe logic', () => {
    test('clamps natural rectangles inside the image', () => {
        assert.deepStrictEqual(logic.clampNaturalRect(95, 70, 20, 20, 100, 80), {
            x: 80,
            y: 60,
            width: 20,
            height: 20
        });
    });

    test('enforces minimum drag size when building a selection rectangle', () => {
        assert.deepStrictEqual(logic.getNaturalRectFromPoints(
            { x: 10, y: 15 },
            { x: 12, y: 17 },
            16,
            100,
            80
        ), {
            x: 10,
            y: 15,
            width: 16,
            height: 16
        });
    });

    test('maps natural selection bounds into client coordinates', () => {
        assert.deepStrictEqual(logic.naturalRectToClientBounds(
            { x: 10, y: 20, width: 30, height: 40 },
            { left: 5, top: 7, width: 200, height: 160, naturalWidth: 100, naturalHeight: 80 },
            { left: 100, top: 200 }
        ), {
            left: 125,
            top: 247,
            width: 60,
            height: 80
        });
    });

    test('rejects client mapping when the image dimensions are unavailable', () => {
        assert.strictEqual(logic.naturalRectToClientBounds(
            { x: 0, y: 0, width: 1, height: 1 },
            { left: 0, top: 0, width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 },
            { left: 0, top: 0 }
        ), null);
    });
});
