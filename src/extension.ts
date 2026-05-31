import * as vscode from 'vscode';
import { ImageCustomEditorProvider } from './ImageCustomEditorProvider';

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(ImageCustomEditorProvider.register(context));

    context.subscriptions.push(
        vscode.commands.registerCommand('vsimage.newEditor', () => {
            vscode.window.showInformationMessage('Empty editor triggered');
        })
    );
}

export function deactivate() {}
