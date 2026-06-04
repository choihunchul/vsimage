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
    shouldUpdateResizeInputsFromCrop: (cropEnabled: boolean, cropped: boolean) => boolean;
    percentFromResizeWidth: (inputWidth: number, baseWidth: number) => number | null;
    normalizeResizeDimensionValue: (value: string | number) => string;
    dimensionsFromResizeScalePercent: (percent: number, baseW: number, baseH: number) => {
        width: number;
        height: number;
    };
    shouldDisableResizeApplyButton: (scalePercent: number) => boolean;
    resolveResizePreviewZoomRatio: (scalePercent: number) => number;
    isImageSmallerThanViewport: (availW: number, availH: number, imageW: number, imageH: number) => boolean;
    defaultPercentForLabelSpanId: (id: string) => string;
    resolveI18nPercentLabel: (html: string) => { valueId: string; defaultValue: string };
    resolvePercentLabelMeta: (
        el: { getAttribute: (name: string) => string | null; innerHTML?: string },
        html: string
    ) => { valueId: string; inputId: string | null; defaultValue: string };
    getPercentLabelDisplayValue: (
        meta: { valueId: string; inputId: string | null; defaultValue: string },
        el: { querySelector: (sel: string) => { textContent: string } | null },
        doc: { getElementById: (id: string) => { value: string } | null }
    ) => string;
    RESIZE_DOWNSCALE_STEP_FACTOR: number;
    computeHalveDownscaleSteps: (
        srcW: number, srcH: number, targetW: number, targetH: number
    ) => Array<{ w: number; h: number }>;
    computeDownscaleSteps: (
        srcW: number, srcH: number, targetW: number, targetH: number, stepFactor?: number
    ) => Array<{ w: number; h: number }>;
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

    test('shouldUpdateResizeInputsFromCrop only updates when crop is active and cropped', () => {
        assert.strictEqual(logic.shouldUpdateResizeInputsFromCrop(false, false), false);
        assert.strictEqual(logic.shouldUpdateResizeInputsFromCrop(false, true), false);
        assert.strictEqual(logic.shouldUpdateResizeInputsFromCrop(true, false), false);
        assert.strictEqual(logic.shouldUpdateResizeInputsFromCrop(true, true), true);
    });

    test('percentFromResizeWidth and dimensionsFromResizeScalePercent are inverse', () => {
        const baseW = 1000;
        const baseH = 500;
        const dims = logic.dimensionsFromResizeScalePercent(50, baseW, baseH);
        assert.strictEqual(dims.width, 500);
        assert.strictEqual(dims.height, 250);
        assert.strictEqual(logic.percentFromResizeWidth(500, baseW), 50);
    });

    test('shouldDisableResizeApplyButton disables apply at 100% only', () => {
        assert.strictEqual(logic.shouldDisableResizeApplyButton(100), true);
        assert.strictEqual(logic.shouldDisableResizeApplyButton(99), false);
        assert.strictEqual(logic.shouldDisableResizeApplyButton(101), false);
    });

    test('resolveResizePreviewZoomRatio maps slider percent to canvas zoom ratio', () => {
        assert.strictEqual(logic.resolveResizePreviewZoomRatio(100), 1);
        assert.strictEqual(logic.resolveResizePreviewZoomRatio(50), 0.5);
        assert.strictEqual(logic.resolveResizePreviewZoomRatio(10), 0.1);
        assert.strictEqual(logic.resolveResizePreviewZoomRatio(220), 2);
    });

    test('isImageSmallerThanViewport detects when preview should scale the container', () => {
        assert.strictEqual(logic.isImageSmallerThanViewport(800, 600, 400, 300), true);
        assert.strictEqual(logic.isImageSmallerThanViewport(800, 600, 1600, 1200), false);
    });

    test('normalizeResizeDimensionValue strips decimal input down to an integer', () => {
        assert.strictEqual(logic.normalizeResizeDimensionValue('12.8'), '12');
        assert.strictEqual(logic.normalizeResizeDimensionValue(99.4), '99');
        assert.strictEqual(logic.normalizeResizeDimensionValue(''), '');
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

    test('computeHalveDownscaleSteps ends at target with fewer steps than 25%', () => {
        const halve = logic.computeHalveDownscaleSteps(1024, 1024, 128, 128);
        assert.ok(halve.length >= 3 && halve.length <= 5);
        const last = halve[halve.length - 1];
        assert.strictEqual(last.w, 128);
        assert.strictEqual(last.h, 128);
    });

    test('computeDownscaleSteps uses 25% factor when requested', () => {
        assert.strictEqual(logic.RESIZE_DOWNSCALE_STEP_FACTOR, 0.75);
        const steps = logic.computeDownscaleSteps(1024, 1024, 128, 128);
        assert.ok(steps.length >= 6 && steps.length <= 12);
    });

    test('resolveI18nPercentLabel detects sharpen label', () => {
        const meta = logic.resolveI18nPercentLabel('Sharpen (<span id="sharpenVal">0</span>%)');
        assert.strictEqual(meta.valueId, 'sharpenVal');
        assert.strictEqual(meta.defaultValue, '0');
    });

    test('resolvePercentLabelMeta uses data-percent-id not quality fallback', () => {
        const el = {
            getAttribute: (name: string) => {
                if (name === 'data-percent-id') {
                    return 'resizeScaleVal';
                }
                if (name === 'data-percent-input') {
                    return 'rngResizeScale';
                }
                if (name === 'data-percent-default') {
                    return '100';
                }
                return null;
            },
            innerHTML: 'ignored'
        };
        const meta = logic.resolvePercentLabelMeta(el, '');
        assert.strictEqual(meta.valueId, 'resizeScaleVal');
        assert.strictEqual(meta.defaultValue, '100');
    });

    test('getPercentLabelDisplayValue prefers range input over stale span', () => {
        const meta = {
            valueId: 'resizeScaleVal',
            inputId: 'rngResizeScale',
            defaultValue: '80'
        };
        const el = {
            querySelector: () => ({ textContent: '80' })
        };
        const doc = {
            getElementById: (id: string) => (id === 'rngResizeScale' ? { value: '100' } : null)
        };
        assert.strictEqual(logic.getPercentLabelDisplayValue(meta, el, doc), '100');
    });

    test('25% steps are fewer than 10% but more than 50% halve for 1024→128', () => {
        const quarter = logic.computeDownscaleSteps(1024, 1024, 128, 128, 0.75);
        const ten = logic.computeDownscaleSteps(1024, 1024, 128, 128, 0.9);
        const halve = logic.computeHalveDownscaleSteps(1024, 1024, 128, 128);
        assert.ok(quarter.length > halve.length);
        assert.ok(ten.length > quarter.length);
    });
});
