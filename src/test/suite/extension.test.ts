import * as assert from 'assert';
import * as vscode from 'vscode';

suite('VS Code Image Editor Integration Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension is successfully registered', () => {
        const ext = vscode.extensions.getExtension('choihunchul.vsimage');
        assert.ok(ext);
    });

    test('vsimage.newEditor command is registered', async () => {
        const ext = vscode.extensions.getExtension('choihunchul.vsimage');
        assert.ok(ext);
        if (!ext.isActive) {
            await ext.activate();
        }
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('vsimage.newEditor'));
    });
});
