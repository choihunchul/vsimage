import * as assert from 'assert';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logic = require(path.join(__dirname, '../../../../media/clipboardLogic.js')) as {
    shouldShowQuality: (format: string) => boolean;
    resolveCopyFormat: (format: string | null) => string;
    resolveCopyQuality: (value: string | null, fallback: number) => number;
    resolveSelectionOnly: (hasSelection: boolean, savedScope: string | null) => boolean;
};

suite('Clipboard logic', () => {
    test('shows quality only for lossy copy formats', () => {
        assert.strictEqual(logic.shouldShowQuality('image/png'), false);
        assert.strictEqual(logic.shouldShowQuality('image/jpeg'), true);
        assert.strictEqual(logic.shouldShowQuality('image/webp'), true);
    });

    test('falls back to PNG for an unsupported stored format', () => {
        assert.strictEqual(logic.resolveCopyFormat('image/webp'), 'image/webp');
        assert.strictEqual(logic.resolveCopyFormat('bad/type'), 'image/png');
        assert.strictEqual(logic.resolveCopyFormat(null), 'image/png');
    });

    test('uses stored quality when valid and current quality otherwise', () => {
        assert.strictEqual(logic.resolveCopyQuality('85', 80), 85);
        assert.strictEqual(logic.resolveCopyQuality('bad', 80), 80);
        assert.strictEqual(logic.resolveCopyQuality(null, 75), 75);
    });

    test('defaults to selection copy only when a crop selection exists', () => {
        assert.strictEqual(logic.resolveSelectionOnly(true, 'full'), true);
        assert.strictEqual(logic.resolveSelectionOnly(true, 'selection'), true);
        assert.strictEqual(logic.resolveSelectionOnly(true, null), true);
        assert.strictEqual(logic.resolveSelectionOnly(false, 'selection'), false);
        assert.strictEqual(logic.resolveSelectionOnly(false, 'full'), false);
    });
});
