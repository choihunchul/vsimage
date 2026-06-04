import * as assert from 'assert';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logic = require(path.join(__dirname, '../../../../media/resizePanelLogic.js')) as {
    percentFromResizeWidth: (inputWidth: number, baseWidth: number) => number | null;
    getViewportFillRatio: (availW: number, availH: number, imageW: number, imageH: number) => number;
    resolveZoomRatioAfterResize: (
        fillRatio: number,
        panelScalePercent: number | null,
        preferredRatio: number | null
    ) => number;
};

suite('Resize zoom after apply', () => {
    suite('getViewportFillRatio', () => {
        test('fits wide image by width', () => {
            const r = logic.getViewportFillRatio(1000, 800, 2000, 500);
            assert.strictEqual(r, 0.5);
        });

        test('fits tall image by height', () => {
            const r = logic.getViewportFillRatio(1000, 800, 500, 2000);
            assert.strictEqual(r, 0.4);
        });

        test('exceeds 1 when image is smaller than viewport', () => {
            const r = logic.getViewportFillRatio(800, 600, 128, 128);
            assert.ok(r > 1);
            assert.strictEqual(r, Math.min(800 / 128, 600 / 128));
        });

        test('guards zero dimensions', () => {
            const r = logic.getViewportFillRatio(0, 0, 0, 0);
            assert.strictEqual(r, 1);
        });
    });

    suite('resolveZoomRatioAfterResize', () => {
        test('panel 100% preserves preferred zoom when below capped fit', () => {
            assert.strictEqual(logic.resolveZoomRatioAfterResize(0.6, 100, 0.4), 0.4);
        });

        test('panel 100% caps preferred zoom to fit when above viewport', () => {
            assert.strictEqual(logic.resolveZoomRatioAfterResize(0.5, 100, 0.9), 0.5);
        });

        test('panel 100% with no preferred uses capped fit', () => {
            assert.strictEqual(logic.resolveZoomRatioAfterResize(0.55, 100, null), 0.55);
        });

        test('panel 100% treats null panel scale like 100%', () => {
            assert.strictEqual(logic.resolveZoomRatioAfterResize(0.5, null, 0.35), 0.35);
        });

        test('panel 100% treats 200% panel scale like at-100% branch', () => {
            assert.strictEqual(logic.resolveZoomRatioAfterResize(0.3, 200, 0.25), 0.25);
        });

        test('panel below 100% fills when prior zoom under 100%', () => {
            const fill = 0.42;
            assert.strictEqual(logic.resolveZoomRatioAfterResize(fill, 50, 0.35), fill);
            assert.strictEqual(logic.resolveZoomRatioAfterResize(fill, 80, 0.6), fill);
        });

        test('panel below 100% fills when fill ratio under 100% even if prior was 1', () => {
            const fill = 0.38;
            assert.strictEqual(logic.resolveZoomRatioAfterResize(fill, 25, 1), fill);
        });

        test('panel below 100% upscales small result to fill viewport', () => {
            const fill = 5.2;
            assert.strictEqual(logic.resolveZoomRatioAfterResize(fill, 10, 0.15), fill);
        });

        test('panel below 100% when fill and prior both >= 1 uses min', () => {
            assert.strictEqual(logic.resolveZoomRatioAfterResize(2.5, 50, 1.2), 1.2);
            assert.strictEqual(logic.resolveZoomRatioAfterResize(2.5, 50, 3), 2.5);
        });
    });

    suite('apply resize scenario (1024 → 128)', () => {
        const VIEWPORT_W = 900;
        const VIEWPORT_H = 700;
        const SRC_W = 1024;
        const SRC_H = 1024;
        const TARGET_W = 128;
        const TARGET_H = 128;

        test('panel scale from width drives fill-zoom branch', () => {
            const panelScale = logic.percentFromResizeWidth(TARGET_W, SRC_W);
            assert.strictEqual(panelScale, 13);

            const fill = logic.getViewportFillRatio(VIEWPORT_W, VIEWPORT_H, TARGET_W, TARGET_H);
            assert.ok(fill > 1);

            const zoom = logic.resolveZoomRatioAfterResize(fill, panelScale, 0.4);
            assert.strictEqual(zoom, fill);
        });

        test('same dimensions at panel 100% keeps pre-resize zoom', () => {
            const fill = logic.getViewportFillRatio(VIEWPORT_W, VIEWPORT_H, SRC_W, SRC_H);
            const zoom = logic.resolveZoomRatioAfterResize(fill, 100, 0.55);
            assert.strictEqual(zoom, 0.55);
        });

        test('large downscale in wide viewport uses fill not stale 40% zoom', () => {
            const fill = logic.getViewportFillRatio(1200, 900, TARGET_W, TARGET_H);
            const stalePrior = 0.4;
            const panelScale = logic.percentFromResizeWidth(TARGET_W, SRC_W);
            const zoom = logic.resolveZoomRatioAfterResize(fill, panelScale, stalePrior);
            assert.strictEqual(zoom, fill);
            assert.notStrictEqual(zoom, stalePrior);
        });
    });
});
