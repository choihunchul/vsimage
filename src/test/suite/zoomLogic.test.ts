import * as assert from 'assert';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logic = require(path.join(__dirname, '../../../../media/zoomLogic.js')) as {
    getImageZoomRatio: (displayWidth: number, naturalWidth: number) => number | null;
    getImageZoomRatioFromData: (imageData: { width: number; naturalWidth: number } | null) => number | null;
    zoomRatioToPercent: (ratio: number) => number;
    computeRatioAfterCropperRelativeZoom: (currentRatio: number, delta: number) => number | null;
    getCanvasSizeForZoomRatio: (
        naturalWidth: number,
        naturalHeight: number,
        ratio: number
    ) => { width: number; height: number } | null;
    resolveFinalZoomRatioAfterCropRestore: (intendedRatio: number, ratioAfterRestore: number | null) => number;
    wouldCancelRelativeZoomOut: (intendedRatio: number, ratioAfterRestore: number, epsilon?: number) => boolean;
    isAtFullZoom: (zoomRatio: number, epsilon?: number) => boolean;
    isImageZoomBelowFull: (zoomRatio: number, epsilon?: number) => boolean;
    resolveToggleZoomTargetRatio: (currentRatio: number, fitRatio: number, epsilon?: number) => number;
    shouldWheelTriggerZoom: (ctrlKey: boolean, metaKey: boolean) => boolean;
};

suite('Zoom logic', () => {
    test('getImageZoomRatio maps display width to natural width', () => {
        assert.strictEqual(logic.getImageZoomRatio(800, 1000), 0.8);
        assert.strictEqual(logic.getImageZoomRatio(1000, 1000), 1);
        assert.strictEqual(logic.getImageZoomRatio(0, 1000), 0);
        assert.strictEqual(logic.getImageZoomRatio(100, 0), null);
    });

    test('getImageZoomRatioFromData reads Cropper imageData shape', () => {
        assert.strictEqual(
            logic.getImageZoomRatioFromData({ width: 500, naturalWidth: 1000 }),
            0.5
        );
        assert.strictEqual(logic.getImageZoomRatioFromData(null), null);
    });

    test('zoomRatioToPercent rounds for toolbar label', () => {
        assert.strictEqual(logic.zoomRatioToPercent(0.8), 80);
        assert.strictEqual(logic.zoomRatioToPercent(1), 100);
        assert.strictEqual(logic.zoomRatioToPercent(0.996), 100);
    });

    test('computeRatioAfterCropperRelativeZoom matches Cropper zoom in/out deltas', () => {
        assert.strictEqual(logic.computeRatioAfterCropperRelativeZoom(1, 0.1), 1.1);
        assert.ok(Math.abs(logic.computeRatioAfterCropperRelativeZoom(0.8, 0.1)! - 0.88) < 1e-9);
        const zoomedOut = logic.computeRatioAfterCropperRelativeZoom(1, -0.1);
        assert.ok(zoomedOut != null && Math.abs(zoomedOut - 1 / 1.1) < 1e-9);
        const from80 = logic.computeRatioAfterCropperRelativeZoom(0.8, -0.1);
        assert.ok(from80 != null && Math.abs(from80 - 0.8 / 1.1) < 1e-9);
        assert.strictEqual(logic.computeRatioAfterCropperRelativeZoom(0.5, 0), 0.5);
    });

    test('getCanvasSizeForZoomRatio prepares a smaller container before zooming out', () => {
        assert.deepStrictEqual(logic.getCanvasSizeForZoomRatio(1000, 800, 0.5), {
            width: 500,
            height: 400
        });
        assert.strictEqual(logic.getCanvasSizeForZoomRatio(0, 800, 0.5), null);
    });

    test('resolveFinalZoomRatioAfterCropRestore keeps intended ratio after setData', () => {
        assert.strictEqual(logic.resolveFinalZoomRatioAfterCropRestore(0.727, 0.8), 0.727);
        assert.strictEqual(logic.resolveFinalZoomRatioAfterCropRestore(1.1, 0.8), 1.1);
        assert.strictEqual(logic.resolveFinalZoomRatioAfterCropRestore(NaN, 0.75), 0.75);
    });

    test('wouldCancelRelativeZoomOut detects zoom-out revert via post-restore ratio', () => {
        assert.strictEqual(logic.wouldCancelRelativeZoomOut(0.727, 0.8), true);
        assert.strictEqual(logic.wouldCancelRelativeZoomOut(0.88, 0.8), false);
        assert.strictEqual(logic.wouldCancelRelativeZoomOut(1.1, 1), false);
    });

    test('isAtFullZoom and isImageZoomBelowFull use shared epsilon', () => {
        assert.strictEqual(logic.isAtFullZoom(1), true);
        assert.strictEqual(logic.isAtFullZoom(0.996), true);
        assert.strictEqual(logic.isAtFullZoom(0.8), false);
        assert.strictEqual(logic.isImageZoomBelowFull(0.8), true);
        assert.strictEqual(logic.isImageZoomBelowFull(1), false);
    });

    test('resolveToggleZoomTargetRatio switches 100% ↔ viewport fit', () => {
        assert.strictEqual(logic.resolveToggleZoomTargetRatio(1, 0.75), 0.75);
        assert.strictEqual(logic.resolveToggleZoomTargetRatio(0.8, 0.75), 1);
        assert.strictEqual(logic.resolveToggleZoomTargetRatio(0.996, 0.6), 0.6);
    });

    test('shouldWheelTriggerZoom requires ctrl or meta on wheel', () => {
        assert.strictEqual(logic.shouldWheelTriggerZoom(true, false), true);
        assert.strictEqual(logic.shouldWheelTriggerZoom(false, true), true);
        assert.strictEqual(logic.shouldWheelTriggerZoom(false, false), false);
    });
});
