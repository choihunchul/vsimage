import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
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

    test('opens PNG with the vsimage custom editor', async () => {
        const fileUri = vscode.Uri.file(path.join(os.tmpdir(), `vsimage-openwith-${Date.now()}.png`));
        const png1x1 = Uint8Array.from(Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lw9L5wAAAABJRU5ErkJggg==',
            'base64'
        ));

        await vscode.workspace.fs.writeFile(fileUri, png1x1);
        await vscode.commands.executeCommand('vscode.openWith', fileUri, 'vsimage.editor');
        await new Promise(resolve => setTimeout(resolve, 500));

        const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
        assert.ok(activeTab?.input instanceof vscode.TabInputCustom);
        assert.strictEqual(activeTab.input.viewType, 'vsimage.editor');
    });
});
