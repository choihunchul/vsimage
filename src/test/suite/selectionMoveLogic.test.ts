import * as assert from 'assert';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logic = require(path.join(__dirname, '../../../../media/selectionMoveLogic.js')) as {
    computeMovedBounds: (
        source: { x: number; y: number; width: number; height: number },
        deltaX: number,
        deltaY: number,
        imageWidth: number,
        imageHeight: number
    ) => { x: number; y: number; width: number; height: number } | null;
    hasPixelMoveDelta: (deltaX: number, deltaY: number) => boolean;
    constrainPixelMoveDelta: (deltaX: number, deltaY: number) => { deltaX: number; deltaY: number };
};

suite('Selection move logic', () => {
    test('computeMovedBounds shifts the selection and keeps its size', () => {
        const moved = logic.computeMovedBounds(
            { x: 10, y: 20, width: 30, height: 40 },
            5,
            -3,
            200,
            150
        );
        assert.deepStrictEqual(moved, { x: 15, y: 17, width: 30, height: 40 });
    });

    test('computeMovedBounds clamps against image edges', () => {
        const moved = logic.computeMovedBounds(
            { x: 10, y: 20, width: 30, height: 40 },
            500,
            -500,
            200,
            150
        );
        assert.deepStrictEqual(moved, { x: 170, y: 0, width: 30, height: 40 });
    });

    test('hasPixelMoveDelta ignores tiny jitter', () => {
        assert.strictEqual(logic.hasPixelMoveDelta(0.2, 0.1), false);
        assert.strictEqual(logic.hasPixelMoveDelta(1, 0), true);
    });

    test('constrainPixelMoveDelta snaps to horizontal, vertical, and 45-degree diagonals', () => {
        assert.deepStrictEqual(logic.constrainPixelMoveDelta(12, 2), { deltaX: 12, deltaY: 0 });
        assert.deepStrictEqual(logic.constrainPixelMoveDelta(2, 12), { deltaX: 0, deltaY: 12 });
        assert.deepStrictEqual(logic.constrainPixelMoveDelta(10, 8), { deltaX: 10, deltaY: 10 });
        assert.deepStrictEqual(logic.constrainPixelMoveDelta(-10, 8), { deltaX: -10, deltaY: 10 });
        assert.deepStrictEqual(logic.constrainPixelMoveDelta(-7, -9), { deltaX: -9, deltaY: -9 });
    });
});
