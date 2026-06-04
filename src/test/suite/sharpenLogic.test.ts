import * as assert from 'assert';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sharpen = require(path.join(__dirname, '../../../../media/sharpenLogic.js')) as {
    SHARPEN_MAX_AMOUNT: number;
    amountFromSlider: (percent: number) => number;
    blurRadiusForSize: (w: number, h: number) => number;
};

suite('Sharpen logic', () => {
    test('amountFromSlider maps 0 and 100', () => {
        assert.strictEqual(sharpen.amountFromSlider(0), 0);
        assert.strictEqual(sharpen.amountFromSlider(100), sharpen.SHARPEN_MAX_AMOUNT);
        assert.strictEqual(sharpen.amountFromSlider(50), sharpen.SHARPEN_MAX_AMOUNT / 2);
    });

    test('blurRadiusForSize scales with image size', () => {
        assert.strictEqual(sharpen.blurRadiusForSize(128, 128), 1);
        assert.ok(sharpen.blurRadiusForSize(800, 600) >= 2);
    });
});
