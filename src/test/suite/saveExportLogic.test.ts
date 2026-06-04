import * as assert from 'assert';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logic = require(path.join(__dirname, '../../../../media/saveExportLogic.js')) as {
    resolveSaveStart: (
        type: string,
        isDocumentEditor: boolean
    ) => { immediateMessage: { command: string } | null; needsBlob: boolean };
    commandForBlobType: (type: string) => string;
};

suite('Save and export logic', () => {
    test('saves an opened document through the VS Code document path', () => {
        assert.deepStrictEqual(logic.resolveSaveStart('save', true), {
            immediateMessage: { command: 'save-document' },
            needsBlob: false
        });
    });

    test('requests a blob for untitled save and export', () => {
        assert.deepStrictEqual(logic.resolveSaveStart('save', false), {
            immediateMessage: null,
            needsBlob: true
        });
        assert.deepStrictEqual(logic.resolveSaveStart('export', true), {
            immediateMessage: null,
            needsBlob: true
        });
    });

    test('maps blob requests to the stable host message commands', () => {
        assert.strictEqual(logic.commandForBlobType('save'), 'save-image');
        assert.strictEqual(logic.commandForBlobType('export'), 'export-image');
    });
});
