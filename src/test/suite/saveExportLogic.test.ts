import * as assert from 'assert';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logic = require(path.join(__dirname, '../../../../media/saveExportLogic.js')) as {
    resolveSaveStart: (
        type: string,
        isDocumentEditor: boolean
    ) => { immediateMessage: { command: string } | null; needsBlob: boolean };
    commandForBlobType: (type: string) => string;
    resolveMimeTypeForPath: (filePath: string, fallbackMimeType?: string) => string;
};

suite('Save and export logic', () => {
    test('saves an opened document through the VS Code document path', () => {
        assert.deepStrictEqual(logic.resolveSaveStart('save', true), {
            immediateMessage: { command: 'save-document' },
            needsBlob: false
        });
    });

    test('delegates untitled saves and exports back to the host first', () => {
        assert.deepStrictEqual(logic.resolveSaveStart('save', false), {
            immediateMessage: { command: 'save-image' },
            needsBlob: false
        });
        assert.deepStrictEqual(logic.resolveSaveStart('export', true), {
            immediateMessage: { command: 'export-image' },
            needsBlob: false
        });
    });

    test('maps blob requests to the stable host message commands', () => {
        assert.strictEqual(logic.commandForBlobType('save'), 'save-image');
        assert.strictEqual(logic.commandForBlobType('export'), 'export-image');
    });

    test('prefers the destination extension when resolving export mime types', () => {
        assert.strictEqual(logic.resolveMimeTypeForPath('/tmp/image.jpg', 'image/png'), 'image/jpeg');
        assert.strictEqual(logic.resolveMimeTypeForPath('/tmp/image.webp', 'image/png'), 'image/webp');
        assert.strictEqual(logic.resolveMimeTypeForPath('/tmp/image', 'image/png'), 'image/png');
        assert.strictEqual(logic.resolveMimeTypeForPath('/tmp/image.unknown', 'image/jpeg'), 'image/jpeg');
    });
});
