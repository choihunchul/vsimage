import * as assert from 'assert';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const en = require(path.join(__dirname, '../../../../media/l10n/en.json')) as Record<string, string>;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ko = require(path.join(__dirname, '../../../../media/l10n/ko.json')) as Record<string, string>;

suite('Webview localization bundles', () => {
    test('English and Korean bundles expose the same keys', () => {
        assert.deepStrictEqual(Object.keys(en).sort(), Object.keys(ko).sort());
    });
});
