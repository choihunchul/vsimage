import * as vscode from 'vscode';
import { ImageCustomEditorProvider } from './ImageCustomEditorProvider';

export function activate(context: vscode.ExtensionContext) {
    const provider = new ImageCustomEditorProvider(context);
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider('vsimage.editor', provider, {
            webviewOptions: { retainContextWhenHidden: true }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vsimage.newEditor', () => {
            provider.createUntitledEditor();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vsimage.openWithEditor', (uri?: vscode.Uri) => {
            void provider.openImageWithEditor(uri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vsimage.runShortcut', (payload?: { action?: string } | string) => {
            const action = typeof payload === 'string' ? payload : payload?.action;
            if (action) {
                void provider.runShortcut(action);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vsimage.debugState', async () => {
            const state = provider.getDebugState();
            const channel = vscode.window.createOutputChannel('vsimage');
            channel.appendLine(JSON.stringify(state, null, 2));
            channel.show(true);
            return state;
        })
    );
}

export function deactivate() {}
