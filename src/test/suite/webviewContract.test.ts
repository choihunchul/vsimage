import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '../../../../');
const provider = fs.readFileSync(path.join(root, 'src/ImageCustomEditorProvider.ts'), 'utf8');
const editor = fs.readFileSync(path.join(root, 'media/editor.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'media/editor.css'), 'utf8');
const extension = fs.readFileSync(path.join(root, 'src/extension.ts'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as {
    contributes?: {
        keybindings?: Array<{ command: string; key: string; mac?: string; when?: string; args?: unknown }>;
        customEditors?: Array<{ viewType: string; selector?: Array<{ filenamePattern?: string }> }>;
    };
};

suite('Webview contracts', () => {
    test('loads every feature module before the editor adapter', () => {
        const editorScriptIndex = provider.indexOf('<script src="${scriptUri}"></script>');
        assert.ok(editorScriptIndex >= 0);

        [
            'canvasLayoutLogicUri',
            'shortcutLogicUri',
            'zoomLogicUri',
            'cropMarqueeLogicUri',
            'resizePanelLogicUri',
            'sharpenLogicUri',
            'colorLogicUri',
            'magicWandLogicUri',
            'clipboardLogicUri',
            'saveExportLogicUri',
            'historyLogicUri',
            'transformLogicUri',
            'loupeLogicUri',
            'sidebarAutoCollapseLogicUri'
        ].forEach(uri => {
            const scriptIndex = provider.indexOf(`<script src="\${${uri}}"></script>`);
            assert.ok(scriptIndex >= 0, `${uri} script tag is missing`);
            assert.ok(scriptIndex < editorScriptIndex, `${uri} must load before editor.js`);
        });
    });

    test('routes toolbar and keyboard zoom through the shared action adapter', () => {
        assert.ok(editor.includes("applyZoomAction('zoomIn')"));
        assert.ok(editor.includes("applyZoomAction('zoomOut')"));
        assert.ok(editor.includes('applyZoomAction(shortcutAction)'));
    });

    test('routes rotate and flip entry points through shared adapters', () => {
        assert.ok(editor.includes("applyRotationAction('rotateLeft')"));
        assert.ok(editor.includes("applyRotationAction('rotateRight')"));
        assert.ok(editor.includes("applyFlipAction('flipH')"));
        assert.ok(editor.includes("applyFlipAction('flipV')"));
        assert.ok(editor.includes('applyRotationAction(shortcutAction)'));
    });

    test('keeps stable save and context-menu reset contracts', () => {
        assert.ok(editor.includes('saveExportLogic.commandForBlobType(type)'));
        assert.ok(editor.includes("document.getElementById('btnReset').click()"));
    });

    test('keeps core edit actions working if optional helper globals are missing', () => {
        assert.ok(editor.includes('const historyLogic = globalThis.VsimageHistoryLogic || {'));
        assert.ok(editor.includes('trimSnapshots: (entries, max) =>'));
        assert.ok(editor.includes('restoreSnapshot: (entries, index) =>'));
        assert.ok(editor.includes('const transformLogic = globalThis.VsimageTransformLogic || {'));
        assert.ok(editor.includes('const saveExportLogic = globalThis.VsimageSaveExportLogic || {'));
    });

    test('shows the extension version next to the properties title', () => {
        assert.ok(provider.includes('section-title-with-version'));
        assert.ok(provider.includes('section-title-version'));
        assert.ok(provider.includes("path.join(this.context.extensionPath, 'package.json')"));
    });

    test('keeps properties and save sticky while placing history near the top', () => {
        const propertiesIndex = provider.indexOf('section-card-properties');
        const resizeIndex = provider.indexOf('sidebar.resize');
        const historyIndex = provider.indexOf('section-card-history');
        const saveIndex = provider.indexOf('section-card-save');

        assert.ok(provider.includes('sidebar.fileSize'));
        assert.ok(provider.includes('chkAutoCollapse'));
        assert.ok(propertiesIndex >= 0);
        assert.ok(resizeIndex >= 0);
        assert.ok(historyIndex >= 0);
        assert.ok(saveIndex >= 0);
        assert.ok(propertiesIndex < resizeIndex);
        assert.ok(resizeIndex < historyIndex);
        assert.ok(historyIndex < saveIndex);
    });

    test('keeps the collapsed sidebar strip wired for hover reopen', () => {
        assert.ok(editor.includes('sidebar-controls-collapsed'));
        assert.ok(editor.includes('handleSidebarAutoCollapseMouseEnter'));
        assert.ok(editor.includes('handleSidebarAutoCollapseMouseLeave'));
        assert.ok(editor.includes('bindSidebarAutoCollapse'));
        assert.ok(provider.includes('sidebar.autoCollapse'));
    });

    test('lets the bottom zoom toolbar drag from its plus-arrow handle', () => {
        assert.ok(provider.includes('toolbarDragHandle'));
        assert.ok(provider.includes('toolbar-drag-mark'));
        assert.ok(editor.includes('startToolbarDrag'));
        assert.ok(editor.includes('moveToolbarDrag'));
        assert.ok(styles.includes('.canvas-toolbar-layer'));
        assert.ok(styles.includes('left: var(--ruler-size);'));
        assert.ok(styles.includes('left: 50%;'));
        assert.ok(styles.includes('.toolbar-drag-handle'));
        assert.ok(styles.includes('border: 1px solid rgba(77, 163, 224, 0.45);'));
        assert.ok(styles.includes('font-size: 0.92rem;'));
    });

    test('slows the sidebar collapse transition down a bit', () => {
        assert.ok(styles.includes('transition: width 480ms ease, min-width 480ms ease, flex-basis 480ms ease, padding 480ms ease;'));
        assert.ok(styles.includes('transition-duration: 240ms;'));
    });

    test('normalizes resize scale slider display to integer percentages', () => {
        assert.ok(editor.includes('resizePanelLogic.clampResizeScalePercent'));
        assert.ok(editor.includes("rngResizeScale.value = String(percent)"));
        assert.ok(editor.includes("setPercentSpan('resizeScaleVal', String(percent))"));
    });

    test('declares custom editor selectors per image extension', () => {
        const editorContribution = manifest.contributes?.customEditors?.find(item => item.viewType === 'vsimage.editor');
        const patterns = editorContribution?.selector?.map(item => item.filenamePattern) ?? [];

        for (const pattern of ['*.png', '*.jpg', '*.jpeg', '*.webp', '*.gif']) {
            assert.ok(patterns.includes(pattern), `${pattern} selector is missing`);
        }
    });

    test('bridges VS Code webview keybindings into editor shortcuts', () => {
        const keybindings = manifest.contributes?.keybindings ?? [];
        const bridgedActions = ['save', 'undo', 'copy', 'selectAll', 'crop', 'magicWand', 'rotateLeft', 'rotateRight', 'zoomIn', 'zoomOut', 'fitViewport', 'actualPixels'];

        for (const action of bridgedActions) {
            const binding = keybindings.find(item => item.command === 'vsimage.runShortcut' && (item.args as { action?: string } | undefined)?.action === action);
            assert.ok(binding, `${action} keybinding is missing`);
            assert.strictEqual(binding.when, "activeEditor == 'vsimage.editor' || activeCustomEditorId == 'vsimage.editor' || activeWebviewPanelId == 'vsimage.editor'");
        }

        assert.ok(extension.includes("provider.runShortcut(action)"));
        assert.ok(provider.includes("postMessage({ command: 'run-shortcut', action })"));
        assert.ok(editor.includes("case 'run-shortcut':"));
        assert.ok(editor.includes('runShortcutAction(message.action)'));
    });
});
