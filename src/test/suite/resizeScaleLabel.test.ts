import * as assert from 'assert';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logic = require(path.join(__dirname, '../../../../media/resizePanelLogic.js')) as {
    applyI18nPercentLabel: (labelHtml: string, translatedLabel: string) => string;
    readPercentFromLabelHtml: (labelHtml: string, valueId: string) => string | null;
    setPercentInLabelHtml: (labelHtml: string, valueId: string, value: number | string) => string;
    resolveI18nPercentLabel: (html: string) => { valueId: string; defaultValue: string };
};

const RESIZE_LABEL_INITIAL =
    'Scale (<span id="resizeScaleVal">100</span>%)';

suite('Resize scale label (i18n + slider sync)', () => {
    test('applyI18nPercentLabel keeps resize scale at 100 after Korean translation', () => {
        const rebuilt = logic.applyI18nPercentLabel(RESIZE_LABEL_INITIAL, '비율');
        assert.strictEqual(logic.readPercentFromLabelHtml(rebuilt, 'resizeScaleVal'), '100');
        assert.ok(rebuilt.includes('id="resizeScaleVal"'));
        assert.ok(rebuilt.startsWith('비율 ('));
    });

    test('applyI18nPercentLabel does not treat resize label as quality (80%)', () => {
        const rebuilt = logic.applyI18nPercentLabel(RESIZE_LABEL_INITIAL, 'Scale');
        const percent = logic.readPercentFromLabelHtml(rebuilt, 'resizeScaleVal');
        assert.strictEqual(percent, '100');
        assert.notStrictEqual(percent, '80');
    });

    test('cached span ref after i18n rebuild does not update visible label', () => {
        const detachedSpan = { textContent: '100' };
        let labelHtml = RESIZE_LABEL_INITIAL;

        labelHtml = logic.applyI18nPercentLabel(labelHtml, '비율');
        detachedSpan.textContent = '50';

        assert.strictEqual(logic.readPercentFromLabelHtml(labelHtml, 'resizeScaleVal'), '100');
        assert.strictEqual(detachedSpan.textContent, '50');
    });

    test('setPercentInLabelHtml updates visible percent after i18n rebuild', () => {
        let labelHtml = logic.applyI18nPercentLabel(RESIZE_LABEL_INITIAL, '비율');

        labelHtml = logic.setPercentInLabelHtml(labelHtml, 'resizeScaleVal', 80);
        assert.strictEqual(logic.readPercentFromLabelHtml(labelHtml, 'resizeScaleVal'), '80');

        labelHtml = logic.setPercentInLabelHtml(labelHtml, 'resizeScaleVal', 125);
        assert.strictEqual(logic.readPercentFromLabelHtml(labelHtml, 'resizeScaleVal'), '125');
    });

    test('slider flow: i18n then scale change reflects in label HTML', () => {
        let labelHtml = RESIZE_LABEL_INITIAL;
        const sliderValues = [80, 50, 200, 10];

        labelHtml = logic.applyI18nPercentLabel(labelHtml, 'Scale');
        for (const percent of sliderValues) {
            labelHtml = logic.setPercentInLabelHtml(labelHtml, 'resizeScaleVal', percent);
            assert.strictEqual(
                logic.readPercentFromLabelHtml(labelHtml, 'resizeScaleVal'),
                String(percent)
            );
        }
    });

    test('quality label i18n still defaults to 80', () => {
        const initial = 'Quality (<span id="qualityVal">80</span>%)';
        const rebuilt = logic.applyI18nPercentLabel(initial, '품질');
        assert.strictEqual(logic.readPercentFromLabelHtml(rebuilt, 'qualityVal'), '80');
        const meta = logic.resolveI18nPercentLabel(initial);
        assert.strictEqual(meta.valueId, 'qualityVal');
    });
});
