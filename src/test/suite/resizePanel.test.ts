import * as assert from 'assert';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logic = require(path.join(__dirname, '../../../../media/resizePanelLogic.js')) as {
    RESIZE_SCALE_DEFAULT: number;
    buildResizePanelFromImage: (w: number, h: number) => {
        baseWidth: number;
        baseHeight: number;
        width: number;
        height: number;
        scalePercent: number;
        widthPlaceholder: string;
    };
    buildResizePanelFromCrop: (crop: { width: number; height: number } | null) => {
        baseWidth: number;
        baseHeight: number;
        width: number;
        height: number;
        scalePercent: number;
    };
    shouldSyncResizePanelFromImage: (cropEnabled: boolean, cropped: boolean) => boolean;
    percentFromResizeWidth: (inputWidth: number, baseWidth: number) => number | null;
    dimensionsFromResizeScalePercent: (percent: number, baseW: number, baseH: number) => {
        width: number;
        height: number;
    };
    defaultPercentForLabelSpanId: (id: string) => string;
    resolveI18nPercentLabel: (html: string) => { valueId: string; defaultValue: string };
};

suite('Resize panel logic', () => {
    test('buildResizePanelFromImage fills resized dimensions at 100%', () => {
        const panel = logic.buildResizePanelFromImage(800, 600);
        assert.deepStrictEqual(panel, {
            baseWidth: 800,
            baseHeight: 600,
            width: 800,
            height: 600,
            scalePercent: 100,
            widthPlaceholder: '800'
        });
    });

    test('buildResizePanelFromImage does not clear fields to zero after edit', () => {
        const panel = logic.buildResizePanelFromImage(1920, 1080);
        assert.notStrictEqual(panel.width, 0);
        assert.notStrictEqual(panel.height, 0);
        assert.strictEqual(panel.scalePercent, 100);
    });

    test('buildResizePanelFromCrop uses rounded crop size at 100%', () => {
        const panel = logic.buildResizePanelFromCrop({ width: 401.6, height: 299.2 });
        assert.strictEqual(panel.width, 402);
        assert.strictEqual(panel.height, 299);
        assert.strictEqual(panel.baseWidth, 402);
        assert.strictEqual(panel.baseHeight, 299);
        assert.strictEqual(panel.scalePercent, 100);
    });

    test('shouldSyncResizePanelFromImage after resize/crop when crop mode is off', () => {
        assert.strictEqual(logic.shouldSyncResizePanelFromImage(false, false), true);
        assert.strictEqual(logic.shouldSyncResizePanelFromImage(false, true), true);
    });

    test('shouldSyncResizePanelFromImage uses crop dimensions while crop active', () => {
        assert.strictEqual(logic.shouldSyncResizePanelFromImage(true, true), false);
        assert.strictEqual(logic.shouldSyncResizePanelFromImage(true, false), true);
    });

    test('percentFromResizeWidth and dimensionsFromResizeScalePercent are inverse', () => {
        const baseW = 1000;
        const baseH = 500;
        const dims = logic.dimensionsFromResizeScalePercent(50, baseW, baseH);
        assert.strictEqual(dims.width, 500);
        assert.strictEqual(dims.height, 250);
        assert.strictEqual(logic.percentFromResizeWidth(500, baseW), 50);
    });

    test('defaultPercentForLabelSpanId keeps resize scale at 100 not 80', () => {
        assert.strictEqual(logic.defaultPercentForLabelSpanId('resizeScaleVal'), '100');
        assert.strictEqual(logic.defaultPercentForLabelSpanId('qualityVal'), '80');
    });

    test('resolveI18nPercentLabel detects resize vs quality labels', () => {
        const resize = logic.resolveI18nPercentLabel(
            'Scale (<span id="resizeScaleVal">100</span>%)'
        );
        assert.strictEqual(resize.valueId, 'resizeScaleVal');
        assert.strictEqual(resize.defaultValue, '100');

        const quality = logic.resolveI18nPercentLabel(
            'Quality (<span id="qualityVal">80</span>%)'
        );
        assert.strictEqual(quality.valueId, 'qualityVal');
        assert.strictEqual(quality.defaultValue, '80');
    });
});
