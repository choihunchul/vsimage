import * as vscode from 'vscode';
import * as path from 'path';

export class ImageCustomEditorProvider implements vscode.CustomEditorProvider {
    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new ImageCustomEditorProvider(context);
        return vscode.window.registerCustomEditorProvider(ImageCustomEditorProvider.viewType, provider);
    }

    private static readonly viewType = 'vsimage.editor';

    readonly onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<vscode.CustomDocument>>().event;

    constructor(private readonly context: vscode.ExtensionContext) {}

    async openCustomDocument(uri: vscode.Uri): Promise<vscode.CustomDocument> {
        return {
            uri,
            dispose: () => {}
        };
    }

    async resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        token: vscode.CancellationToken
    ): Promise<void> {
        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(this.context.extensionPath, 'media'))
            ]
        };

        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview, document.uri);

        webviewPanel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'save-image':
                    this.saveImage(document.uri, message.arrayBuffer);
                    return;
                case 'show-toast':
                    vscode.window.showInformationMessage(message.text);
                    return;
            }
        });
    }

    async saveCustomDocument(document: vscode.CustomDocument, cancellation: vscode.CancellationToken): Promise<void> {
        // Will implement in Task 7
    }

    async saveCustomDocumentAs(document: vscode.CustomDocument, destination: vscode.Uri, cancellation: vscode.CancellationToken): Promise<void> {
        // Will implement in Task 7
    }

    async revertCustomDocument(document: vscode.CustomDocument, cancellation: vscode.CancellationToken): Promise<void> {
        // Will implement in Task 7
    }

    async backupCustomDocument(document: vscode.CustomDocument, context: vscode.CustomDocumentBackupContext, cancellation: vscode.CancellationToken): Promise<vscode.CustomDocumentBackup> {
        return {
            id: '',
            delete: () => {}
        };
    }

    private saveImage(uri: vscode.Uri, buffer: ArrayBuffer) {
        vscode.workspace.fs.writeFile(uri, new Uint8Array(buffer));
        vscode.window.showInformationMessage('Image saved successfully.');
    }

    private getHtmlForWebview(webview: vscode.Webview, imageUri?: vscode.Uri): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'editor.js')));
        const styleUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'editor.css')));
        const cropperJsUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'cropper.min.js')));
        const cropperCssUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'cropper.min.css')));
        const imgWebviewUri = imageUri ? webview.asWebviewUri(imageUri) : '';

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} blob: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource};">
                <link href="${cropperCssUri}" rel="stylesheet">
                <link href="${styleUri}" rel="stylesheet">
            </head>
            <body>
                <div id="app" data-image="${imgWebviewUri}"></div>
                <script src="${cropperJsUri}"></script>
                <script src="${scriptUri}"></script>
            </body>
            </html>
        `;
    }
}
