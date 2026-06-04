import * as assert from 'assert';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logic = require(path.join(__dirname, '../../../../media/magicWandLogic.js')) as {
    floodFillPixels: (
        pixels: Uint8ClampedArray,
        width: number,
        height: number,
        startX: number,
        startY: number,
        tolerance: number
    ) => { mask: Uint8Array; count: number; bounds: { x: number; y: number; width: number; height: number } } | null;
};

suite('Magic wand logic', () => {
    const pixels = new Uint8ClampedArray([
        10, 10, 10, 255, 10, 10, 10, 255, 250, 250, 250, 255,
        10, 10, 10, 255, 12, 12, 12, 255, 250, 250, 250, 255
    ]);

    test('selects a connected region within RGBA tolerance', () => {
        const result = logic.floodFillPixels(pixels, 3, 2, 0, 0, 2);

        assert.ok(result);
        assert.strictEqual(result.count, 4);
        assert.deepStrictEqual(result.bounds, { x: 0, y: 0, width: 2, height: 2 });
        assert.deepStrictEqual(Array.from(result.mask), [1, 1, 0, 1, 1, 0]);
    });

    test('does not cross disconnected pixels with a different color', () => {
        const result = logic.floodFillPixels(pixels, 3, 2, 2, 0, 2);

        assert.ok(result);
        assert.strictEqual(result.count, 2);
        assert.deepStrictEqual(result.bounds, { x: 2, y: 0, width: 1, height: 2 });
    });

    test('rejects a seed outside the image', () => {
        assert.strictEqual(logic.floodFillPixels(pixels, 3, 2, -1, 0, 2), null);
        assert.strictEqual(logic.floodFillPixels(pixels, 3, 2, 3, 0, 2), null);
    });
});
