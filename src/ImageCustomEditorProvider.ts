import * as vscode from 'vscode';
import * as path from 'path';
import { loadMessageBundle, loadPackageNls, resolveLanguageId, t as translate } from './l10n';

interface ImageDataResponse {
    buffer: Uint8Array;
    mimeType: string;
}

interface PendingImageRequest {
    resolve: (value: ImageDataResponse) => void;
    reject: (reason?: unknown) => void;
}

export class ImageCustomEditorProvider implements vscode.CustomEditorProvider {
    public static register(context: vscode.ExtensionContext): vscode.Disposable {
        const provider = new ImageCustomEditorProvider(context);
        return vscode.window.registerCustomEditorProvider(ImageCustomEditorProvider.viewType, provider, {
            webviewOptions: { retainContextWhenHidden: true }
        });
    }

    private static readonly viewType = 'vsimage.editor';

    private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentEditEvent<vscode.CustomDocument>>();
    readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

    private readonly webviews = new Map<string, vscode.WebviewPanel>();
    private readonly pendingImageRequests = new Map<number, PendingImageRequest>();
    private nextRequestId = 0;
    private untitledCounter = 0;

    constructor(private readonly context: vscode.ExtensionContext) {}

    private isUntitledDocument(document: vscode.CustomDocument): boolean {
        return document.uri.scheme === 'untitled';
    }

    private packageNls() {
        return loadPackageNls(this.context.extensionPath, vscode.env.language);
    }

    private webviewL10n() {
        return loadMessageBundle(this.context.extensionPath, vscode.env.language);
    }

    private getMimeTypeForUri(uri: vscode.Uri): string {
        switch (path.extname(uri.fsPath).toLowerCase()) {
            case '.png':
                return 'image/png';
            case '.jpg':
            case '.jpeg':
                return 'image/jpeg';
            case '.webp':
                return 'image/webp';
            case '.gif':
                return 'image/gif';
            default:
                return 'application/octet-stream';
        }
    }

    private async readImageAsDataUri(uri: vscode.Uri): Promise<string | undefined> {
        try {
            const bytes = await vscode.workspace.fs.readFile(uri);
            if (!bytes.byteLength) {
                return undefined;
            }
            const mime = this.getMimeTypeForUri(uri);
            return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
        } catch {
            return undefined;
        }
    }

    private getWebviewLocalResourceRoots(documentUri?: vscode.Uri): vscode.Uri[] {
        const roots: vscode.Uri[] = [
            vscode.Uri.file(path.join(this.context.extensionPath, 'media'))
        ];

        for (const folder of vscode.workspace.workspaceFolders ?? []) {
            roots.push(folder.uri);
        }

        if (documentUri?.scheme === 'file' && documentUri.fsPath) {
            roots.push(vscode.Uri.file(path.dirname(documentUri.fsPath)));
        }

        return roots;
    }

    async openCustomDocument(uri: vscode.Uri): Promise<vscode.CustomDocument> {
        return {
            uri,
            dispose: () => {}
        };
    }

    async resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        const documentKey = document.uri.toString();
        this.webviews.set(documentKey, webviewPanel);

        webviewPanel.onDidDispose(() => {
            this.webviews.delete(documentKey);
        });

        const isUntitled = this.isUntitledDocument(document);

        webviewPanel.webview.options = {
            enableScripts: true,
            localResourceRoots: this.getWebviewLocalResourceRoots(isUntitled ? undefined : document.uri)
        };

        if (isUntitled) {
            webviewPanel.title = translate(this.packageNls(), 'untitledPanel.title');
        }

        const initialImageSrc = isUntitled
            ? ''
            : (await this.readImageAsDataUri(document.uri) ?? '');

        if (!isUntitled && !initialImageSrc) {
            vscode.window.showErrorMessage(translate(this.packageNls(), 'toast.openImageFailed'));
        }

        webviewPanel.webview.html = this.getHtmlForWebview(
            webviewPanel.webview,
            initialImageSrc,
            path.basename(document.uri.fsPath),
            true,
            isUntitled ? path.basename(document.uri.fsPath) : undefined
        );

        webviewPanel.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case 'save-image':
                case 'save-document':
                    await this.saveDocumentFromWebview(document, webviewPanel.webview);
                    return;
                case 'export-image':
                    await this.exportImage(message.arrayBuffer, message.mimeType);
                    return;
                case 'document-changed':
                    this.notifyDocumentChanged(document, message.label);
                    return;
                case 'image-data-response':
                    this.resolveImageDataRequest(message.requestId, message.arrayBuffer, message.mimeType);
                    return;
                case 'undo-request':
                    await vscode.commands.executeCommand('undo');
                    return;
                case 'show-toast':
                    vscode.window.showInformationMessage(message.text);
                    return;
            }
        });
    }

    async saveCustomDocument(document: vscode.CustomDocument, cancellation: vscode.CancellationToken): Promise<void> {
        const panel = this.webviews.get(document.uri.toString());
        if (!panel) {
            return;
        }

        if (this.isUntitledDocument(document)) {
            const destination = await this.promptImageSaveLocation();
            if (!destination) {
                throw new Error('Save cancelled');
            }
            await this.saveCustomDocumentAs(document, destination, cancellation);
            return;
        }

        const { buffer } = await this.requestImageData(panel.webview, cancellation);
        await vscode.workspace.fs.writeFile(document.uri, buffer);
        this.markDocumentSaved(document, panel);
    }

    async saveCustomDocumentAs(
        document: vscode.CustomDocument,
        destination: vscode.Uri,
        cancellation: vscode.CancellationToken
    ): Promise<void> {
        const panel = this.webviews.get(document.uri.toString());
        if (!panel) {
            const data = await vscode.workspace.fs.readFile(document.uri);
            await vscode.workspace.fs.writeFile(destination, data);
            return;
        }

        const { buffer } = await this.requestImageData(panel.webview, cancellation);
        await vscode.workspace.fs.writeFile(destination, buffer);
        this.markDocumentSaved(document, panel);
    }

    async revertCustomDocument(document: vscode.CustomDocument, _cancellation: vscode.CancellationToken): Promise<void> {
        const panel = this.webviews.get(document.uri.toString());
        if (!panel) {
            return;
        }

        this.markDocumentSaved(document, panel);

        if (this.isUntitledDocument(document)) {
            panel.webview.postMessage({ command: 'revert-untitled' });
            return;
        }

        const src = await this.readImageAsDataUri(document.uri);
        if (!src) {
            vscode.window.showErrorMessage(translate(this.packageNls(), 'toast.openImageFailed'));
            return;
        }

        panel.webview.postMessage({
            command: 'revert-document',
            src,
            filename: path.basename(document.uri.fsPath)
        });
    }

    async backupCustomDocument(
        document: vscode.CustomDocument,
        context: vscode.CustomDocumentBackupContext,
        cancellation: vscode.CancellationToken
    ): Promise<vscode.CustomDocumentBackup> {
        const panel = this.webviews.get(document.uri.toString());
        const backupUri = context.destination;

        if (panel) {
            try {
                const { buffer } = await this.requestImageData(panel.webview, cancellation);
                await vscode.workspace.fs.writeFile(backupUri, buffer);
            } catch {
                await vscode.workspace.fs.writeFile(backupUri, new Uint8Array());
            }
        } else if (!this.isUntitledDocument(document)) {
            const data = await vscode.workspace.fs.readFile(document.uri);
            await vscode.workspace.fs.writeFile(backupUri, data);
        } else {
            await vscode.workspace.fs.writeFile(backupUri, new Uint8Array());
        }

        return {
            id: backupUri.toString(),
            delete: async () => {
                try {
                    await vscode.workspace.fs.delete(backupUri);
                } catch {
                    // Backup may already have been cleaned up.
                }
            }
        };
    }

    private notifyDocumentChanged(document: vscode.CustomDocument, label = 'Edit'): void {
        this._onDidChangeCustomDocument.fire({
            document,
            label,
            undo: async () => {
                const panel = this.webviews.get(document.uri.toString());
                panel?.webview.postMessage({ command: 'perform-undo' });
            },
            redo: async () => {
                // Redo is not supported in the webview editor yet.
            }
        });
    }

    private markDocumentSaved(document: vscode.CustomDocument, panel?: vscode.WebviewPanel): void {
        const targetPanel = panel ?? this.webviews.get(document.uri.toString());
        targetPanel?.webview.postMessage({ command: 'document-saved' });
    }

    private async saveDocumentFromWebview(
        document: vscode.CustomDocument,
        webview: vscode.Webview
    ): Promise<void> {
        try {
            const saved = await vscode.workspace.save(document.uri);
            if (saved) {
                webview.postMessage({ command: 'document-saved' });
                vscode.window.showInformationMessage(translate(this.packageNls(), 'toast.saved'));
            }
        } catch {
            vscode.window.showErrorMessage(translate(this.packageNls(), 'toast.saveFailed'));
        }
    }

    private requestImageData(
        webview: vscode.Webview,
        cancellation: vscode.CancellationToken
    ): Promise<ImageDataResponse> {
        return new Promise((resolve, reject) => {
            const requestId = ++this.nextRequestId;

            const cancellationListener = cancellation.onCancellationRequested(() => {
                this.pendingImageRequests.delete(requestId);
                cancellationListener.dispose();
                reject(new Error('Save cancelled'));
            });

            this.pendingImageRequests.set(requestId, {
                resolve: (value) => {
                    cancellationListener.dispose();
                    resolve(value);
                },
                reject: (reason) => {
                    cancellationListener.dispose();
                    reject(reason);
                }
            });

            webview.postMessage({ command: 'request-image-data', requestId });
        });
    }

    private resolveImageDataRequest(
        requestId: number,
        arrayBuffer: ArrayBuffer | null | undefined,
        mimeType: string
    ): void {
        const pending = this.pendingImageRequests.get(requestId);
        if (!pending) {
            return;
        }

        this.pendingImageRequests.delete(requestId);

        if (!arrayBuffer) {
            pending.reject(new Error('No image data available'));
            return;
        }

        pending.resolve({
            buffer: new Uint8Array(arrayBuffer),
            mimeType: mimeType || 'image/png'
        });
    }

    private async promptImageSaveLocation(): Promise<vscode.Uri | undefined> {
        return vscode.window.showSaveDialog({
            filters: {
                Images: ['png', 'jpg', 'jpeg', 'webp', 'gif']
            },
            saveLabel: 'Save Image'
        });
    }

    private async exportImage(buffer: ArrayBuffer, mimeType: string) {
        const fileUri = await this.promptImageSaveLocation();
        if (fileUri) {
            await vscode.workspace.fs.writeFile(fileUri, new Uint8Array(buffer));
            vscode.window.showInformationMessage(
                translate(this.packageNls(), 'toast.exported', { filename: path.basename(fileUri.fsPath) })
            );
        }
    }

    public async createUntitledEditor(): Promise<void> {
        this.untitledCounter += 1;
        const uri = vscode.Uri.parse(`untitled:Untitled-${this.untitledCounter}.png`);
        await this.openImageWithEditor(uri);
    }

    public async openImageWithEditor(uri?: vscode.Uri): Promise<void> {
        const target = uri ?? vscode.window.activeTextEditor?.document.uri;
        if (!target) {
            const picked = await vscode.window.showOpenDialog({
                canSelectMany: false,
                openLabel: translate(this.packageNls(), 'command.openWithEditor.title'),
                filters: { Images: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }
            });
            if (!picked?.[0]) {
                return;
            }
            await vscode.commands.executeCommand('vscode.openWith', picked[0], ImageCustomEditorProvider.viewType);
            return;
        }

        await vscode.commands.executeCommand('vscode.openWith', target, ImageCustomEditorProvider.viewType);
    }

    private getHtmlForWebview(
        webview: vscode.Webview,
        initialImageSrc: string,
        displayFilename: string,
        isDocumentEditor = false,
        untitledFilename?: string
    ): string {
        const l10n = this.webviewL10n();
        const lang = resolveLanguageId(vscode.env.language);
        const l10nEnUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'l10n', 'en.json')));
        const l10nKoUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'l10n', 'ko.json')));
        const cropMarqueeLogicUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'cropMarqueeLogic.js')));
        const resizePanelLogicUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'resizePanelLogic.js')));
        const scriptUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'editor.js')));
        const styleUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'editor.css')));
        const cropperJsUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'cropper.min.js')));
        const cropperCssUri = webview.asWebviewUri(vscode.Uri.file(path.join(this.context.extensionPath, 'media', 'cropper.min.css')));
        const safeImageSrc = initialImageSrc.replace(/"/g, '&quot;');
        const filename = untitledFilename ?? displayFilename ?? translate(l10n, 'untitled');
        const untitledFilenameAttr = untitledFilename
            ? ` data-untitled-filename="${untitledFilename}"`
            : '';

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} blob: data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource}; connect-src ${webview.cspSource};">
                <link href="${cropperCssUri}" rel="stylesheet">
                <link href="${styleUri}" rel="stylesheet">
            </head>
            <body data-document-editor="${isDocumentEditor ? 'true' : 'false'}" data-lang="${lang}" data-l10n-en="${l10nEnUri}" data-l10n-ko="${l10nKoUri}"${untitledFilenameAttr}>
                <div class="editor-wrapper">
                    <!-- Landing Dashboard Empty State -->
                    <div class="dashboard-empty" id="dashboard" style="display: none;">
                        <div style="font-size: 3rem; margin-bottom: 12px;">🖼️</div>
                        <h2 style="margin: 0 0 10px 0;" data-i18n="dashboard.title"></h2>
                        <p style="color: #aaa; margin-bottom: 20px; max-width: 400px; font-size: 0.9rem;" data-i18n="dashboard.description"></p>
                        <div class="empty-card-container">
                            <div class="empty-card" id="cardImport">
                                <h3 style="margin: 0 0 6px 0; font-size: 1rem;" data-i18n="dashboard.importTitle"></h3>
                                <p style="font-size: 0.75rem; color: #858585;" data-i18n="dashboard.importDesc"></p>
                                <input type="file" id="filePicker" accept="image/*" style="display: none;">
                            </div>
                            <div class="empty-card" id="cardPaste">
                                <h3 style="margin: 0 0 6px 0; font-size: 1rem;" data-i18n="dashboard.pasteTitle"></h3>
                                <p style="font-size: 0.75rem; color: #858585;" data-i18n-html="dashboard.pasteDesc"></p>
                            </div>
                        </div>
                    </div>

                    <!-- Workspace Area (grid: ruler-corner | rulerH / rulerV | scrollable canvas) -->
                    <div class="canvas-workspace" id="workspace" tabindex="-1" style="display: none; outline: none;">
                        <div class="ruler-corner" id="rulerCorner"></div>
                        <canvas class="ruler ruler-h" id="rulerH"></canvas>
                        <canvas class="ruler ruler-v" id="rulerV"></canvas>
                        <!-- Scrollable canvas viewport -->
                        <div class="canvas-scroll-area" id="canvasScrollArea">
                            <div class="canvas-scroll-content" id="canvasScrollContent">
                                <div class="image-container" id="imageContainer">
                                    <img id="image" ${safeImageSrc ? `src="${safeImageSrc}"` : ''}>
                                </div>
                            </div>
                            <div id="zoomLoupePanel" class="zoom-loupe-panel" style="display: none;">
                                <span class="zoom-loupe-label" data-i18n="zoomLoupe.label"></span>
                                <canvas id="zoomLoupeCanvas" width="200" height="200"></canvas>
                            </div>
                        </div>
                        <div class="canvas-toolbar-layer">
                            <div class="floating-toolbar" id="toolbar" style="display: none;">
                                <button class="tb-btn" id="btnZoomOut" data-shortcut="-" data-i18n-title="toolbar.zoomOut">-<span class="ui-shortcut-badge"></span></button>
                                <span class="zoom-indicator" id="lblZoomPercent">--%</span>
                                <button class="tb-btn" id="btnZoomIn" data-shortcut="+" data-i18n-title="toolbar.zoomIn">+<span class="ui-shortcut-badge"></span></button>
                                <div class="tb-divider"></div>
                                <button class="tb-btn" id="btnRotateLeft" data-shortcut="mod+[" data-i18n-title="toolbar.rotateLeft">⟲<span class="ui-shortcut-badge"></span></button>
                                <button class="tb-btn" id="btnRotateRight" data-shortcut="mod+]" data-i18n-title="toolbar.rotateRight">⟳<span class="ui-shortcut-badge"></span></button>
                                <button class="tb-btn" id="btnFlipH" data-i18n-title="toolbar.flipH">↔</button>
                                <button class="tb-btn" id="btnFlipV" data-i18n-title="toolbar.flipV">↕</button>
                                <div class="tb-divider"></div>
                                <button class="tb-btn" id="btnReset" data-shortcut="mod+0" data-i18n-title="toolbar.reset"><span data-i18n="toolbar.reset"></span><span class="ui-shortcut-badge"></span></button>
                                <div class="tb-divider"></div>
                                <button class="tb-btn" id="btnMagicWand" data-shortcut="W" data-i18n-title="toolbar.magicWand">🪄<span class="ui-shortcut-badge"></span></button>
                            </div>
                        </div>
                    </div>

                    <!-- Control Panel -->
                    <div class="sidebar-controls" id="sidebar" style="display: none;">
                        <div class="sidebar-scroll">
                        <div class="section-card">
                            <div class="section-title" data-i18n="sidebar.properties"></div>
                            <div style="font-size: 0.8rem; line-height: 1.5; color: #aaa;">
                                <div><span data-i18n="sidebar.name"></span> <span id="lblFilename">${filename}</span></div>
                                <div><span data-i18n="sidebar.dimensions"></span> <span id="lblDimensions">0 x 0</span> px</div>
                            </div>
                        </div>

                        <div class="section-card">
                            <div class="section-title" style="display: flex; align-items: center; justify-content: space-between;">
                                <span data-i18n="sidebar.cropPresets"></span>
                                <div style="display: flex; align-items: center; gap: 4px; text-transform: none;">
                                    <input type="checkbox" id="chkEnableCrop" style="margin: 0; cursor: pointer;">
                                    <label for="chkEnableCrop" style="font-size: 0.75rem; user-select: none; cursor: pointer; color: #ccc;" data-i18n="sidebar.enableCrop" data-shortcut="C"></label>
                                </div>
                            </div>
                            <div class="btn-grid" id="cropPresets" style="margin-bottom: 8px;">
                                <button class="btn-secondary" data-auto="true" data-i18n="sidebar.cropAuto"></button>
                                <button class="btn-secondary" data-ratio="NaN" data-i18n="sidebar.cropFree"></button>
                                <button class="btn-secondary" data-ratio="1">1:1</button>
                                <button class="btn-secondary" data-ratio="1.77777777778">16:9</button>
                                <button class="btn-secondary" data-ratio="1.33333333333">4:3</button>
                                <button class="btn-secondary" data-circle="true" data-i18n="sidebar.cropCircle"></button>
                            </div>
                            <button class="btn-accent" id="btnApplyCrop" data-shortcut="Enter"><span data-i18n="sidebar.applyCrop"></span><span class="ui-shortcut-badge"></span></button>
                            <div class="control-group" style="margin-top: 12px; margin-bottom: 0;">
                                <label data-i18n="sidebar.magicWand"></label>
                                <div class="slider-row">
                                    <input type="range" id="rngMagicWandTolerance" min="0" max="128" value="32">
                                    <span id="magicWandToleranceVal" style="min-width: 28px; text-align: right; font-size: 0.8rem;">32</span>
                                </div>
                                <p class="tool-hint" data-i18n="sidebar.magicWandHint"></p>
                            </div>
                        </div>

                        <div class="section-card">
                            <div class="section-title" data-i18n="sidebar.resize"></div>
                            <div class="control-group">
                                <div class="input-row">
                                    <div>
                                        <label data-i18n="sidebar.width"></label>
                                        <input type="number" id="txtWidth" class="form-control" min="1" step="1">
                                    </div>
                                    <div>
                                        <label data-i18n="sidebar.height"></label>
                                        <input type="number" id="txtHeight" class="form-control" min="1" step="1">
                                    </div>
                                </div>
                            </div>
                            <div class="control-group">
                                <label data-i18n-label="sidebar.resizeScale">Scale (<span id="resizeScaleVal">100</span>%)</label>
                                <div class="slider-row">
                                    <input type="range" id="rngResizeScale" min="10" max="200" value="100">
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 10px;">
                                <input type="checkbox" id="chkLockRatio" checked>
                                <label for="chkLockRatio" style="font-size: 0.75rem; user-select: none;" data-i18n="sidebar.lockRatio"></label>
                            </div>
                            <button class="btn-accent" id="btnApplyResize" data-i18n="sidebar.applyResize"></button>
                        </div>
                        </div>

                        <div class="sidebar-bottom">
                        <div class="section-card section-card-history">
                            <div class="section-title" data-i18n="sidebar.history"></div>
                            <div id="historyList" class="history-list"></div>
                            <p class="tool-hint" data-i18n="sidebar.historyHint"></p>
                        </div>

                        <div class="section-card section-card-save">
                            <div class="section-title" data-i18n="sidebar.saveExport"></div>
                            <div class="control-group">
                                <label data-i18n="sidebar.exportFormat"></label>
                                <select id="selFormat" class="form-control">
                                    <option value="image/png">PNG</option>
                                    <option value="image/jpeg">JPEG</option>
                                    <option value="image/webp">WebP</option>
                                </select>
                            </div>
                            <div class="control-group" id="qualitySection" style="display: none;">
                                <label data-i18n-label="sidebar.quality">Quality (<span id="qualityVal">80</span>%)</label>
                                <div class="slider-row">
                                    <input type="range" id="rngQuality" min="1" max="100" value="80">
                                </div>
                            </div>
                            <button class="btn-accent" id="btnSave" style="background-color: #28a745; margin-bottom: 8px;" data-shortcut="mod+s"><span data-i18n="sidebar.save"></span><span class="ui-shortcut-badge"></span></button>
                            <button class="btn-accent" id="btnExport" style="background-color: #4e4e4e;" data-i18n="sidebar.exportAs"></button>
                        </div>
                        </div>
                    </div>
                </div>

                <!-- Custom Context Menu -->
                <div class="context-menu" id="contextMenu">
                    <div class="context-menu-item" id="ctxCopy" data-shortcut="mod+c">
                        <span data-i18n="context.copy"></span>
                        <span class="context-menu-shortcut"></span>
                    </div>
                    <div class="context-menu-item" id="ctxErase" data-shortcut="Del">
                        <span data-i18n="context.deleteSelection"></span>
                        <span class="context-menu-shortcut"></span>
                    </div>
                    <div class="context-menu-divider"></div>
                    <div class="context-menu-item" id="ctxFlipH">
                        <span data-i18n="context.flipH"></span>
                    </div>
                    <div class="context-menu-item" id="ctxFlipV">
                        <span data-i18n="context.flipV"></span>
                    </div>
                    <div class="context-menu-divider"></div>
                    <div class="context-menu-item" id="ctxSave" data-shortcut="mod+s">
                        <span data-i18n="context.save"></span>
                        <span class="context-menu-shortcut"></span>
                    </div>
                    <div class="context-menu-item" id="ctxUndo" data-shortcut="mod+z">
                        <span data-i18n="context.undo"></span>
                        <span class="context-menu-shortcut"></span>
                    </div>
                    <div class="context-menu-item" id="ctxReset" data-shortcut="mod+0">
                        <span data-i18n="context.reset"></span>
                        <span class="context-menu-shortcut"></span>
                    </div>
                </div>

                <div id="shortcutHintTooltip" class="shortcut-hint-tooltip" style="display: none;"></div>

                <!-- Floating Eyedropper Tooltip -->
                <div id="eyedropperTooltip" class="eyedropper-tooltip" style="display: none;" data-i18n="eyedropper.tooltip"></div>

                <!-- Color Picker Tooltip (Option key) -->
                <div id="colorPickerTooltip" class="color-picker-tooltip" style="display: none;">
                    <span class="color-picker-swatch" id="colorPickerSwatch"></span>
                    <span id="colorPickerPreview">#000000</span>
                </div>

                <!-- Z + drag: selection highlight on image -->
                <div id="zoomLoupeSelection" class="zoom-loupe-selection" style="display: none;"></div>

                <!-- Color Info Modal -->
                <div id="colorModal" class="color-modal" style="display: none;">
                    <div class="color-modal-backdrop" id="colorModalBackdrop"></div>
                    <div class="color-modal-panel">
                        <div class="color-modal-header">
                            <span class="color-modal-title" data-i18n="colorModal.title"></span>
                            <button type="button" class="color-modal-close" id="colorModalClose" data-i18n-title="colorModal.close">✕</button>
                        </div>
                        <div class="color-modal-preview">
                            <div class="color-modal-swatch" id="colorModalSwatch"></div>
                            <div class="color-modal-hint" data-i18n="colorModal.hint"></div>
                        </div>
                        <div class="color-format-list" id="colorFormatList"></div>
                    </div>
                </div>

                <!-- Copy Format Modal -->
                <div id="copyModal" class="color-modal copy-modal" style="display: none;">
                    <div class="color-modal-backdrop" id="copyModalBackdrop"></div>
                    <div class="color-modal-panel">
                        <div class="color-modal-header">
                            <span class="color-modal-title" data-i18n="copyModal.title"></span>
                            <button type="button" class="color-modal-close" id="copyModalClose" data-i18n-title="copyModal.close">✕</button>
                        </div>
                        <div class="color-modal-hint copy-modal-hint" data-i18n="copyModal.hint"></div>
                        <div class="copy-scope-section" id="copyScopeSection" style="display: none;">
                            <label class="copy-scope-label">
                                <input type="checkbox" id="chkCopySelectionOnly" checked>
                                <span data-i18n="copyModal.selectionOnly"></span>
                            </label>
                            <div class="copy-scope-info" id="copyScopeInfo"></div>
                        </div>
                        <div class="copy-format-options" id="copyFormatOptions">
                            <button type="button" class="copy-format-btn active" data-format="image/png">PNG</button>
                            <button type="button" class="copy-format-btn" data-format="image/jpeg">JPEG</button>
                            <button type="button" class="copy-format-btn" data-format="image/webp">WebP</button>
                        </div>
                        <div class="control-group copy-quality-section" id="copyQualitySection" style="display: none;">
                            <label data-i18n-label="copyModal.quality">Quality (<span id="copyQualityVal">80</span>%)</label>
                            <div class="slider-row">
                                <input type="range" id="rngCopyQuality" min="1" max="100" value="80">
                            </div>
                        </div>
                        <button type="button" class="btn-accent copy-modal-confirm" id="btnCopyConfirm" data-i18n="copyModal.confirm"></button>
                    </div>
                </div>

                <!-- Keyboard Shortcut Cheatsheet Overlay -->
                <div id="shortcutOverlay" class="shortcut-overlay" style="display: none;">
                    <div class="shortcut-overlay-title" data-i18n="shortcuts.title"></div>
                    <div class="shortcut-grid">
                        <div class="shortcut-row"><span class="shortcut-key">⌘/Ctrl + S</span><span class="shortcut-desc" data-i18n="shortcuts.save"></span></div>
                        <div class="shortcut-row"><span class="shortcut-key">⌘/Ctrl + Z</span><span class="shortcut-desc" data-i18n="shortcuts.undo"></span></div>
                        <div class="shortcut-row"><span class="shortcut-key">⌘/Ctrl + C</span><span class="shortcut-desc" data-i18n="shortcuts.copyImage"></span></div>
                        <div class="shortcut-row"><span class="shortcut-key">⌘/Ctrl + A</span><span class="shortcut-desc" data-i18n="shortcuts.selectAll"></span></div>
                        <div class="shortcut-row"><span class="shortcut-key">Space + Drag</span><span class="shortcut-desc" data-i18n="shortcuts.pan"></span></div>
                        <div class="shortcut-row"><span class="shortcut-key">Z + Drag</span><span class="shortcut-desc" data-i18n="shortcuts.zoomLoupe"></span></div>
                        <div class="shortcut-row"><span class="shortcut-key" data-i18n="shortcuts.dblClickImageKey"></span><span class="shortcut-desc" data-i18n="shortcuts.dblClickImage"></span></div>
                        <div class="shortcut-row"><span class="shortcut-key">⌘/Ctrl + 0</span><span class="shortcut-desc" data-i18n="shortcuts.zoomFit"></span></div>
                        <div class="shortcut-row"><span class="shortcut-key">⌘/Ctrl + +</span><span class="shortcut-desc" data-i18n="shortcuts.zoomIn"></span></div>
                        <div class="shortcut-row"><span class="shortcut-key">⌘/Ctrl + −</span><span class="shortcut-desc" data-i18n="shortcuts.zoomOut"></span></div>
                        <div class="shortcut-row"><span class="shortcut-key">[ / ]</span><span class="shortcut-desc" data-i18n="shortcuts.marqueeResize"></span></div>
                        <div class="shortcut-row"><span class="shortcut-key">⌘/Ctrl + [ / ]</span><span class="shortcut-desc" data-i18n="shortcuts.rotate"></span></div>
                        <div class="shortcut-row"><span class="shortcut-key">Enter</span><span class="shortcut-desc" data-i18n="shortcuts.applyCrop"></span></div>
                        <div class="shortcut-row"><span class="shortcut-key">Del / Bksp</span><span class="shortcut-desc" data-i18n="shortcuts.eraseSelection"></span></div>
                        <div class="shortcut-row"><span class="shortcut-key">Esc</span><span class="shortcut-desc" data-i18n="shortcuts.cancel"></span></div>
                        <div class="shortcut-row"><span class="shortcut-key">⌥/Alt + Click</span><span class="shortcut-desc" data-i18n="shortcuts.pickColor"></span></div>
                        <div class="shortcut-row"><span class="shortcut-key">↑ ↓ ← →</span><span class="shortcut-desc" data-i18n="shortcuts.moveMarquee"></span></div>
                        <div class="shortcut-row"><span class="shortcut-key">C</span><span class="shortcut-desc" data-i18n="shortcuts.toggleCrop"></span></div>
                        <div class="shortcut-row"><span class="shortcut-key">W + Click</span><span class="shortcut-desc" data-i18n="shortcuts.magicWand"></span></div>
                    </div>
                </div>

                <script src="${cropperJsUri}"></script>
                <script src="${cropMarqueeLogicUri}"></script>
                <script src="${resizePanelLogicUri}"></script>
                <script src="${scriptUri}"></script>
            </body>
            </html>
        `;
    }
}
