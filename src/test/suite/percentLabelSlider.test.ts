import * as assert from 'assert';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logic = require(path.join(__dirname, '../../../../media/resizePanelLogic.js')) as {
    PERCENT_LABEL_SYNC_PAIRS: Array<[string, string]>;
    rebuildPercentLabelHtml: (
        translated: string,
        el: {
            getAttribute: (name: string) => string | null;
            innerHTML: string;
            querySelector: (sel: string) => { textContent: string } | null;
        },
        doc: { getElementById: (id: string) => { value: string } | null }
    ) => { html: string; valueId: string; value: string };
    readPercentFromLabelHtml: (html: string, valueId: string) => string | null;
    resolveI18nPercentLabel: (html: string) => { valueId: string; defaultValue: string };
};

function mockLabel(attrs: Record<string, string>, innerHTML: string) {
    return {
        getAttribute: (name: string) => attrs[name] ?? null,
        innerHTML,
        querySelector: (sel: string) => {
            const id = sel.replace('#', '');
            const m = innerHTML.match(new RegExp(`id=["']${id}["'][^>]*>([^<]*)`, 'i'));
            return m ? { textContent: m[1] } : null;
        }
    };
}

function mockDoc(values: Record<string, string>) {
    return {
        getElementById: (id: string) => (values[id] != null ? { value: values[id] } : null)
    };
}

/** Sidebar markup mirrors ImageCustomEditorProvider data-percent-* attributes. */
const SIDEBAR_LABELS = {
    resize: {
        attrs: {
            'data-percent-id': 'resizeScaleVal',
            'data-percent-input': 'rngResizeScale',
            'data-percent-default': '100'
        },
        inner: 'Scale (<span id="resizeScaleVal">100</span>%)',
        input: 'rngResizeScale',
        defaultDisplay: '100'
    },
    sharpen: {
        attrs: {
            'data-percent-id': 'sharpenVal',
            'data-percent-input': 'rngSharpen',
            'data-percent-default': '0'
        },
        inner: 'Sharpen (<span id="sharpenVal">0</span>%)',
        input: 'rngSharpen',
        defaultDisplay: '0'
    },
    quality: {
        attrs: {
            'data-percent-id': 'qualityVal',
            'data-percent-input': 'rngQuality',
            'data-percent-default': '80'
        },
        inner: 'Quality (<span id="qualityVal">80</span>%)',
        input: 'rngQuality',
        defaultDisplay: '80'
    },
    copyQuality: {
        attrs: {
            'data-percent-id': 'copyQualityVal',
            'data-percent-input': 'rngCopyQuality',
            'data-percent-default': '80'
        },
        inner: 'Quality (<span id="copyQualityVal">80</span>%)',
        input: 'rngCopyQuality',
        defaultDisplay: '80'
    }
};

suite('Percent label slider (80% stuck regression)', () => {
    test('PERCENT_LABEL_SYNC_PAIRS covers all percent sliders', () => {
        assert.deepStrictEqual(logic.PERCENT_LABEL_SYNC_PAIRS, [
            ['resizeScaleVal', 'rngResizeScale'],
            ['sharpenVal', 'rngSharpen'],
            ['qualityVal', 'rngQuality'],
            ['copyQualityVal', 'rngCopyQuality']
        ]);
    });

    test('rebuildPercentLabelHtml uses range value when span still shows 80 (resize)', () => {
        const el = mockLabel(SIDEBAR_LABELS.resize.attrs, 'Scale (<span id="qualityVal">80</span>%)');
        const doc = mockDoc({ rngResizeScale: '100' });
        const out = logic.rebuildPercentLabelHtml('비율', el, doc);
        assert.strictEqual(out.valueId, 'resizeScaleVal');
        assert.strictEqual(out.value, '100');
        assert.strictEqual(logic.readPercentFromLabelHtml(out.html, 'resizeScaleVal'), '100');
        assert.ok(!out.html.includes('id="qualityVal"'));
    });

    test('rebuildPercentLabelHtml keeps sharpen at 0 not quality 80', () => {
        const el = mockLabel(SIDEBAR_LABELS.sharpen.attrs, SIDEBAR_LABELS.sharpen.inner);
        const doc = mockDoc({ rngSharpen: '0' });
        const out = logic.rebuildPercentLabelHtml('선명도', el, doc);
        assert.strictEqual(out.value, '0');
        assert.strictEqual(logic.readPercentFromLabelHtml(out.html, 'sharpenVal'), '0');
    });

    test('rebuildPercentLabelHtml follows slider when user moves resize scale to 45', () => {
        const el = mockLabel(SIDEBAR_LABELS.resize.attrs, SIDEBAR_LABELS.resize.inner);
        const doc = mockDoc({ rngResizeScale: '45' });
        const out = logic.rebuildPercentLabelHtml('Scale', el, doc);
        assert.strictEqual(out.value, '45');
    });

    test('each sidebar percent label keeps its own default via data-percent-default', () => {
        for (const key of Object.keys(SIDEBAR_LABELS) as Array<keyof typeof SIDEBAR_LABELS>) {
            const spec = SIDEBAR_LABELS[key];
            const el = mockLabel(spec.attrs, spec.inner);
            const doc = mockDoc({});
            const out = logic.rebuildPercentLabelHtml('Label', el, doc);
            assert.strictEqual(
                out.value,
                spec.defaultDisplay,
                `${key} should not fall back to quality 80`
            );
        }
    });

    test('legacy html-only mislabel would force quality 80 without data-percent-id', () => {
        const el = mockLabel({}, 'Scale (<span id="resizeScaleVal">100</span>%)');
        const meta = logic.resolveI18nPercentLabel(el.innerHTML);
        assert.strictEqual(meta.valueId, 'resizeScaleVal');
        assert.strictEqual(meta.defaultValue, '100');
        const broken = mockLabel({}, 'Scale (<span id="qualityVal">80</span>%)');
        const badMeta = logic.resolveI18nPercentLabel(broken.innerHTML);
        assert.strictEqual(badMeta.valueId, 'qualityVal');
        assert.strictEqual(badMeta.defaultValue, '80');
    });

    test('quality and copy quality labels stay at 80 when inputs are 80', () => {
        const q = mockLabel(SIDEBAR_LABELS.quality.attrs, SIDEBAR_LABELS.quality.inner);
        const outQ = logic.rebuildPercentLabelHtml('품질', q, mockDoc({ rngQuality: '80' }));
        assert.strictEqual(outQ.value, '80');

        const c = mockLabel(SIDEBAR_LABELS.copyQuality.attrs, SIDEBAR_LABELS.copyQuality.inner);
        const outC = logic.rebuildPercentLabelHtml('품질', c, mockDoc({ rngCopyQuality: '65' }));
        assert.strictEqual(outC.value, '65');
    });
});
