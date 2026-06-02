import * as assert from 'assert';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logic = require(path.join(__dirname, '../../../../media/cropMarqueeLogic.js')) as {
    clampCropBox: (
        x: number, y: number, w: number, h: number, ow: number, oh: number
    ) => { x: number; y: number; width: number; height: number };
    fullImageCropBounds: (ow: number, oh: number) => { x: number; y: number; width: number; height: number };
    isMarqueeFullImageNatural: (
        crop: { x: number; y: number; width: number; height: number },
        ow: number,
        oh: number,
        tolerance?: number
    ) => boolean;
    isPointInCropSelection: (
        point: { x: number; y: number },
        crop: { x: number; y: number; width: number; height: number }
    ) => boolean;
    getMarqueeDblClickToggleAction: (
        crop: { x: number; y: number; width: number; height: number },
        ow: number,
        oh: number,
        tolerance?: number
    ) => 'trimToContent' | 'expandToFull' | null;
    canHandleMarqueeDblClick: (state: Record<string, boolean>) => boolean;
    shouldInvokeMarqueeDblClickToggle: (
        state: Record<string, boolean>,
        point: { x: number; y: number },
        crop: { x: number; y: number; width: number; height: number }
    ) => boolean;
    shouldInvokeImageZoomDblClick: (
        state: Record<string, boolean>,
        point: { x: number; y: number } | null,
        crop: { x: number; y: number; width: number; height: number } | null
    ) => boolean;
};

suite('Marquee double-click logic', () => {
    const OW = 1000;
    const OH = 800;
    const fullCrop = { x: 0, y: 0, width: OW, height: OH };
    const partialCrop = { x: 100, y: 50, width: 400, height: 300 };

    const baseState = {
        hasCropper: true,
        cropEnabled: true,
        cropped: true,
        eyedropperActive: false,
        magicWandMode: false,
        colorPickerMode: false,
        spacePressed: false,
        targetInCanvas: true,
        targetInToolbar: false,
        targetInModal: false
    };

    test('fullImageCropBounds selects entire natural image', () => {
        const bounds = logic.fullImageCropBounds(OW, OH);
        assert.deepStrictEqual(bounds, { x: 0, y: 0, width: OW, height: OH });
    });

    test('isMarqueeFullImageNatural detects full and partial selections', () => {
        assert.strictEqual(logic.isMarqueeFullImageNatural(fullCrop, OW, OH), true);
        assert.strictEqual(logic.isMarqueeFullImageNatural(partialCrop, OW, OH), false);
        assert.strictEqual(
            logic.isMarqueeFullImageNatural({ x: 1, y: 0, width: OW, height: OH }, OW, OH, 2),
            true
        );
    });

    test('isMarqueeFullImageNatural is false when crop does not cover full height at fit zoom', () => {
        const canvasMatchedButNotFull = { x: 0, y: 0, width: OW, height: Math.round(OH * 0.8) };
        assert.strictEqual(logic.isMarqueeFullImageNatural(canvasMatchedButNotFull, OW, OH), false);
    });

    test('getMarqueeDblClickToggleAction maps full → trim and partial → expand', () => {
        assert.strictEqual(logic.getMarqueeDblClickToggleAction(fullCrop, OW, OH), 'trimToContent');
        assert.strictEqual(logic.getMarqueeDblClickToggleAction(partialCrop, OW, OH), 'expandToFull');
    });

    test('isPointInCropSelection requires point inside crop rect', () => {
        assert.strictEqual(logic.isPointInCropSelection({ x: 150, y: 100 }, partialCrop), true);
        assert.strictEqual(logic.isPointInCropSelection({ x: 50, y: 100 }, partialCrop), false);
        assert.strictEqual(logic.isPointInCropSelection({ x: 500, y: 350 }, partialCrop), false);
    });

    test('canHandleMarqueeDblClick rejects inactive modes and outside canvas', () => {
        assert.strictEqual(logic.canHandleMarqueeDblClick(baseState), true);
        assert.strictEqual(logic.canHandleMarqueeDblClick({ ...baseState, cropEnabled: false }), false);
        assert.strictEqual(logic.canHandleMarqueeDblClick({ ...baseState, magicWandMode: true }), false);
        assert.strictEqual(logic.canHandleMarqueeDblClick({ ...baseState, zLoupeActive: true }), false);
        assert.strictEqual(logic.canHandleMarqueeDblClick({ ...baseState, targetInCanvas: false }), false);
        assert.strictEqual(logic.canHandleMarqueeDblClick({ ...baseState, targetInToolbar: true }), false);
    });

    test('shouldInvokeMarqueeDblClickToggle requires point inside marquee', () => {
        assert.strictEqual(
            logic.shouldInvokeMarqueeDblClickToggle(baseState, { x: 200, y: 120 }, partialCrop),
            true
        );
        assert.strictEqual(
            logic.shouldInvokeMarqueeDblClickToggle(baseState, { x: 10, y: 10 }, partialCrop),
            false
        );
        assert.strictEqual(
            logic.shouldInvokeMarqueeDblClickToggle({ ...baseState, spacePressed: true }, { x: 200, y: 120 }, partialCrop),
            false
        );
    });

    test('clampCropBox keeps selection within image bounds', () => {
        const clamped = logic.clampCropBox(-10, -5, 2000, 2000, OW, OH);
        assert.strictEqual(clamped.x, 0);
        assert.strictEqual(clamped.y, 0);
        assert.strictEqual(clamped.width, OW);
        assert.strictEqual(clamped.height, OH);
    });

    test('shouldInvokeImageZoomDblClick when no marquee or outside selection', () => {
        const canvasState = { ...baseState, cropEnabled: false, cropped: false };
        assert.strictEqual(
            logic.shouldInvokeImageZoomDblClick(canvasState, { x: 100, y: 100 }, null),
            true
        );
        assert.strictEqual(
            logic.shouldInvokeImageZoomDblClick(
                { ...baseState, cropEnabled: true, cropped: true },
                { x: 150, y: 100 },
                partialCrop
            ),
            false
        );
        assert.strictEqual(
            logic.shouldInvokeImageZoomDblClick(
                { ...baseState, cropEnabled: true, cropped: true },
                { x: 50, y: 50 },
                partialCrop
            ),
            true
        );
        assert.strictEqual(
            logic.shouldInvokeImageZoomDblClick(canvasState, null, null),
            false
        );
    });
});
