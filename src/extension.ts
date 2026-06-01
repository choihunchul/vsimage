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
}

export function deactivate() {}
