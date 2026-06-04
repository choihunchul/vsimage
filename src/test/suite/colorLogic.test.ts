import * as assert from 'assert';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logic = require(path.join(__dirname, '../../../../media/colorLogic.js')) as {
    toHexByte: (value: number) => string;
    rgbToHsl: (r: number, g: number, b: number) => { h: number; s: number; l: number };
    rgbToHsv: (r: number, g: number, b: number) => { h: number; s: number; v: number };
    rgbToCmyk: (r: number, g: number, b: number) => { c: number; m: number; y: number; k: number };
    buildColorFormats: (r: number, g: number, b: number, a: number) => Array<{ label: string; value: string }>;
};

suite('Color picker logic', () => {
    test('formats bytes as uppercase two-digit hex', () => {
        assert.strictEqual(logic.toHexByte(0), '00');
        assert.strictEqual(logic.toHexByte(15), '0F');
        assert.strictEqual(logic.toHexByte(255), 'FF');
    });

    test('converts primary RGB values to HSL and HSV', () => {
        assert.deepStrictEqual(logic.rgbToHsl(255, 0, 0), { h: 0, s: 100, l: 50 });
        assert.deepStrictEqual(logic.rgbToHsv(0, 255, 0), { h: 120, s: 100, v: 100 });
    });

    test('converts black RGB to CMYK without dividing by zero', () => {
        assert.deepStrictEqual(logic.rgbToCmyk(0, 0, 0), { c: 0, m: 0, y: 0, k: 100 });
    });

    test('builds all picker copy formats including alpha hex', () => {
        assert.deepStrictEqual(logic.buildColorFormats(255, 0, 128, 128), [
            { label: 'HEX', value: '#FF008080' },
            { label: 'RGB', value: 'rgb(255, 0, 128)' },
            { label: 'RGBA', value: 'rgba(255, 0, 128, 0.50)' },
            { label: 'HSL', value: 'hsl(330, 100%, 50%)' },
            { label: 'HSV', value: 'hsv(330, 100%, 100%)' },
            { label: 'CMYK', value: 'cmyk(0%, 100%, 50%, 0%)' }
        ]);
    });
});
