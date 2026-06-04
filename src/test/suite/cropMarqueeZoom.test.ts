import * as assert from 'assert';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logic = require(path.join(__dirname, '../../../../media/cropMarqueeLogic.js')) as {
    isValidNaturalCropSnapshot: (data: { x: number; y: number; width: number; height: number } | null) => boolean;
    shouldSnapshotCropForZoom: (
        cropped: boolean,
        data: { x: number; y: number; width: number; height: number } | null
    ) => boolean;
    cloneNaturalCropSnapshot: (
        data: { x: number; y: number; width: number; height: number } | null
    ) => { x: number; y: number; width: number; height: number } | null;
    scaleCropBoxAfterCanvasZoom: (
        prevCanvas: { left: number; top: number; width: number; height: number },
        prevBox: { left: number; top: number; width: number; height: number },
        nextCanvas: { left: number; top: number; width: number; height: number }
    ) => { left: number; top: number; width: number; height: number } | null;
};

const SAMPLE_CROP = { x: 100, y: 50, width: 400, height: 300 };

suite('Crop marquee zoom', () => {
    test('isValidNaturalCropSnapshot rejects empty or zero-size crop', () => {
        assert.strictEqual(logic.isValidNaturalCropSnapshot(null), false);
        assert.strictEqual(logic.isValidNaturalCropSnapshot({ x: 0, y: 0, width: 0, height: 100 }), false);
        assert.strictEqual(logic.isValidNaturalCropSnapshot(SAMPLE_CROP), true);
    });

    test('shouldSnapshotCropForZoom requires cropped state and valid data', () => {
        assert.strictEqual(logic.shouldSnapshotCropForZoom(false, SAMPLE_CROP), false);
        assert.strictEqual(logic.shouldSnapshotCropForZoom(true, null), false);
        assert.strictEqual(logic.shouldSnapshotCropForZoom(true, SAMPLE_CROP), true);
    });

    test('cloneNaturalCropSnapshot copies natural coords for setData after zoom', () => {
        const clone = logic.cloneNaturalCropSnapshot(SAMPLE_CROP);
        assert.deepStrictEqual(clone, SAMPLE_CROP);
        assert.notStrictEqual(clone, SAMPLE_CROP);
    });

    test('natural crop clone is unchanged across zoom (setData contract)', () => {
        const before = logic.cloneNaturalCropSnapshot(SAMPLE_CROP);
        const afterZoom = logic.cloneNaturalCropSnapshot(before);
        assert.deepStrictEqual(afterZoom, before);
    });

    test('scaleCropBoxAfterCanvasZoom doubles box size when canvas doubles', () => {
        const prevCanvas = { left: 0, top: 0, width: 400, height: 400 };
        const prevBox = { left: 40, top: 40, width: 200, height: 100 };
        const nextCanvas = { left: 0, top: 0, width: 800, height: 800 };
        const nextBox = logic.scaleCropBoxAfterCanvasZoom(prevCanvas, prevBox, nextCanvas);
        assert.deepStrictEqual(nextBox, {
            left: 80,
            top: 80,
            width: 400,
            height: 200
        });
    });

    test('scaleCropBoxAfterCanvasZoom returns null when factor is 1', () => {
        const canvas = { left: 10, top: 20, width: 500, height: 400 };
        const box = { left: 60, top: 70, width: 200, height: 150 };
        assert.strictEqual(logic.scaleCropBoxAfterCanvasZoom(canvas, box, canvas), null);
    });

    test('scaleCropBoxAfterCanvasZoom preserves relative offset from canvas', () => {
        const prevCanvas = { left: 20, top: 30, width: 200, height: 200 };
        const prevBox = { left: 70, top: 80, width: 50, height: 50 };
        const nextCanvas = { left: 20, top: 30, width: 100, height: 100 };
        const nextBox = logic.scaleCropBoxAfterCanvasZoom(prevCanvas, prevBox, nextCanvas);
        assert.deepStrictEqual(nextBox, {
            left: 45,
            top: 55,
            width: 25,
            height: 25
        });
    });
});
