import * as assert from 'assert';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const mosaic = require(path.join(__dirname, '../../../../media/mosaicLogic.js')) as {
    applyMosaicToImageData: (imageData: ImageData, rect: { x: number; y: number; width: number; height: number }, blockSize: number) => ImageData;
    scaleNaturalRectToImageData: (
        rect: { x: number; y: number; width: number; height: number },
        imageData: { width: number; height: number; naturalWidth: number; naturalHeight: number }
    ) => { x: number; y: number; width: number; height: number } | null;
};

function createImageData(width: number, height: number, values: number[]): ImageData {
    return {
        width,
        height,
        data: new Uint8ClampedArray(values)
    } as ImageData;
}

function pixel(data: Uint8ClampedArray, width: number, x: number, y: number): number[] {
    const offset = ((y * width) + x) * 4;
    return Array.from(data.slice(offset, offset + 4));
}

suite('Mosaic logic', () => {
    test('averages pixels inside the selected block and leaves outside pixels unchanged', () => {
        const imageData = createImageData(3, 2, [
            10, 0, 0, 255, 20, 0, 0, 255, 90, 0, 0, 255,
            30, 0, 0, 255, 40, 0, 0, 255, 100, 0, 0, 255
        ]);

        const result = mosaic.applyMosaicToImageData(imageData, { x: 0, y: 0, width: 2, height: 2 }, 2);

        assert.deepStrictEqual(pixel(result.data, 3, 0, 0), [25, 0, 0, 255]);
        assert.deepStrictEqual(pixel(result.data, 3, 1, 0), [25, 0, 0, 255]);
        assert.deepStrictEqual(pixel(result.data, 3, 0, 1), [25, 0, 0, 255]);
        assert.deepStrictEqual(pixel(result.data, 3, 1, 1), [25, 0, 0, 255]);
        assert.deepStrictEqual(pixel(result.data, 3, 2, 0), [90, 0, 0, 255]);
        assert.deepStrictEqual(pixel(result.data, 3, 2, 1), [100, 0, 0, 255]);
    });

    test('clamps selections that start outside the image bounds', () => {
        const imageData = createImageData(3, 1, [
            10, 0, 0, 255, 20, 0, 0, 255, 90, 0, 0, 255
        ]);

        const result = mosaic.applyMosaicToImageData(imageData, { x: -1, y: 0, width: 2, height: 1 }, 2);

        assert.deepStrictEqual(pixel(result.data, 3, 0, 0), [10, 0, 0, 255]);
        assert.deepStrictEqual(pixel(result.data, 3, 1, 0), [20, 0, 0, 255]);
        assert.deepStrictEqual(pixel(result.data, 3, 2, 0), [90, 0, 0, 255]);
    });

    test('scales natural crop bounds into rendered image bounds', () => {
        const scaled = mosaic.scaleNaturalRectToImageData(
            { x: 20, y: 10, width: 80, height: 40 },
            { width: 200, height: 100, naturalWidth: 400, naturalHeight: 200 }
        );

        assert.deepStrictEqual(scaled, { x: 10, y: 5, width: 40, height: 20 });
    });
});
