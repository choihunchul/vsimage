# Photoshop-Like Tool Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the editor chrome so the left rail owns the primary tools, zoom lives in the properties panel, and rotate/flip become left-rail actions while preserving current editing behavior.

**Architecture:** Keep the feature as a UI orchestration layer over the existing editor logic. `src/ImageCustomEditorProvider.ts` owns the webview structure and script loading, `media/editor.js` owns `activeTool` state and interaction routing, `media/editor.css` owns layout and icon styling, and `media/toolRailLogic.js` contains the pure tool-resolution rules so the webview and tests can share one source of truth.

**Tech Stack:** VS Code custom editor webview, TypeScript source generation, webview runtime JavaScript, plain CSS, Mocha unit tests.

---

### Task 1: Lock the tool-state rules in a shared helper

**Files:**
- Create: `media/toolRailLogic.js`
- Create: `src/test/suite/toolRailLogic.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import * as assert from 'assert';
const logic = require('../../../media/toolRailLogic');

suite('Tool rail logic', () => {
    test('defaults to cursor on image load', () => {
        assert.strictEqual(logic.DEFAULT_ACTIVE_TOOL, 'cursor');
    });

    test('returns to cursor after crop apply but keeps resize and mosaic active', () => {
        assert.strictEqual(logic.resolveToolAfterApply('crop', 'crop'), 'cursor');
        assert.strictEqual(logic.resolveToolAfterApply('resize', 'resize'), 'resize');
        assert.strictEqual(logic.resolveToolAfterApply('mosaic', 'mosaic'), 'mosaic');
    });

    test('maps shortcut actions onto the matching tools', () => {
        assert.strictEqual(logic.resolveToolForShortcutAction('crop', 'cursor'), 'crop');
        assert.strictEqual(logic.resolveToolForShortcutAction('marquee', 'crop'), 'cursor');
        assert.strictEqual(logic.resolveToolForShortcutAction('mosaic', 'cursor'), 'mosaic');
        assert.strictEqual(logic.resolveToolForShortcutAction('move', 'cursor'), 'move');
    });

    test('enables crop only while crop tool is active', () => {
        assert.strictEqual(logic.shouldEnableCropForTool('crop'), true);
        assert.strictEqual(logic.shouldEnableCropForTool('cursor'), false);
    });

    test('blocks marquee creation only while move tool is active', () => {
        assert.strictEqual(logic.shouldBlockMarqueeCreation('move'), true);
        assert.strictEqual(logic.shouldBlockMarqueeCreation('cursor'), false);
    });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm run compile-tests && npx mocha "out/src/test/suite/toolRailLogic.test.js" --ui tdd`

Expected: FAIL because the helper module is not wired yet.

- [ ] **Step 3: Implement the shared helper**

```js
'use strict';

const DEFAULT_ACTIVE_TOOL = 'cursor';

function normalizeTool(tool) {
    return tool || DEFAULT_ACTIVE_TOOL;
}

function resolveToolForShortcutAction(action, currentTool) {
    if (action === 'crop') return 'crop';
    if (action === 'marquee') return 'cursor';
    if (action === 'mosaic') return 'mosaic';
    if (action === 'move') return 'move';
    return normalizeTool(currentTool);
}

function resolveToolAfterApply(tool, applyKind) {
    if (applyKind === 'crop') return 'cursor';
    return normalizeTool(tool);
}

function shouldEnableCropForTool(tool) {
    return normalizeTool(tool) === 'crop';
}

function shouldBlockMarqueeCreation(tool) {
    return normalizeTool(tool) === 'move';
}

module.exports = {
    DEFAULT_ACTIVE_TOOL,
    resolveToolForShortcutAction,
    resolveToolAfterApply,
    shouldEnableCropForTool,
    shouldBlockMarqueeCreation
};
```

- [ ] **Step 4: Re-run the focused test and expect pass**

Run: `npm run compile-tests && npx mocha "out/src/test/suite/toolRailLogic.test.js" --ui tdd`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add media/toolRailLogic.js src/test/suite/toolRailLogic.test.ts
git commit -m "test: add tool rail state rules"
```

### Task 2: Rebuild the webview structure for the new chrome layout

**Files:**
- Modify: `src/ImageCustomEditorProvider.ts`
- Modify: `media/l10n/en.json`
- Modify: `media/l10n/ko.json`
- Modify: `src/test/suite/webviewContract.test.ts`

- [ ] **Step 1: Write the failing contract checks**

```ts
test('replaces static resize and crop cards with a tool rail and shared tool options', () => {
    assert.ok(provider.includes('id="toolRail"'));
    assert.ok(provider.includes('id="btnToolCursor"'));
    assert.ok(provider.includes('id="btnToolCrop"'));
    assert.ok(provider.includes('id="btnToolResize"'));
    assert.ok(provider.includes('id="btnToolMosaic"'));
    assert.ok(provider.includes('id="btnToolMove"'));
    assert.ok(provider.includes('id="toolOptionsSection"'));
    assert.ok(provider.includes('id="toolOptionsResize"'));
    assert.ok(provider.includes('id="toolOptionsCrop"'));
    assert.ok(provider.includes('id="toolOptionsMosaic"'));
    assert.ok(provider.includes('id="toolOptionsMove"'));
});
```

- [ ] **Step 2: Run the focused contract test and confirm it fails**

Run: `npm run compile-tests && npx mocha "out/src/test/suite/webviewContract.test.js" --ui tdd --grep "tool rail"`

Expected: FAIL until the webview markup is updated.

- [ ] **Step 3: Add the new chrome markup**

Use a left rail with `Cursor`, `Crop`, `Resize`, `Mosaic`, `Move`, plus secondary `Rotate` and `Flip` actions. Move the zoom readout and zoom buttons into the right sidebar properties area, and keep the shared `Tool Options` section in the sidebar for the active tool.

Representative markup:

```html
<div class="tool-rail" id="toolRail" style="display: none;">
    <button type="button" class="tool-rail-btn active" id="btnToolCursor" data-tool="cursor" aria-label="Cursor">
        <svg class="tool-rail-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 4l11 8-5.5 1.2L9 20.5 7.2 19l1.7-6.2L5 4z"></path>
        </svg>
    </button>
    <button type="button" class="tool-rail-btn" id="btnToolCrop" data-tool="crop" aria-label="Crop">
        <svg class="tool-rail-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 3v11H3v2h4v5h2v-5h10v-2H9V3H7zM17 9V4h-2v5h2z"></path>
        </svg>
    </button>
    <button type="button" class="tool-rail-btn" id="btnToolResize" data-tool="resize" aria-label="Resize">
        <svg class="tool-rail-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 4h7v2H6.4L10 9.6 8.6 11 5 7.4V11H3V4h1zM20 20h-7v-2h4.6L14 14.4 15.4 13 19 16.6V13h1v7z"></path>
        </svg>
    </button>
    <button type="button" class="tool-rail-btn" id="btnToolMosaic" data-tool="mosaic" aria-label="Mosaic">
        <svg class="tool-rail-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 5h4v4H5V5zm5 0h4v4h-4V5zm5 0h4v4h-4V5zM5 10h4v4H5v-4zm5 0h4v4h-4v-4zm5 0h4v4h-4v-4zM10 15h4v4h-4v-4z"></path>
        </svg>
    </button>
    <button type="button" class="tool-rail-btn" id="btnToolMove" data-tool="move" aria-label="Move">
        <svg class="tool-rail-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 2l3 4h-2v4h4V8l4 4-4 4v-2h-4v4h2l-3 4-3-4h2v-4H7v2l-4-4 4-4v2h4V6H9l3-4z"></path>
        </svg>
    </button>
    <button type="button" class="tool-rail-btn tool-rail-secondary" id="btnRotateLeft" aria-label="Rotate left">
        <svg class="tool-rail-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 7V3L2 8l5 5V9c3.3 0 6 2.7 6 6 0 2.1-1.1 4-2.8 5.1l1.2 1.6C14.7 19.2 16 16.8 16 15c0-4.4-3.6-8-8-8z"></path>
        </svg>
    </button>
    <button type="button" class="tool-rail-btn tool-rail-secondary" id="btnRotateRight" aria-label="Rotate right">
        <svg class="tool-rail-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M17 7V3l5 5-5 5V9c-3.3 0-6 2.7-6 6 0 2.1 1.1 4 2.8 5.1l-1.2 1.6C9.3 19.2 8 16.8 8 15c0-4.4 3.6-8 8-8z"></path>
        </svg>
    </button>
    <button type="button" class="tool-rail-btn tool-rail-secondary" id="btnFlipH" aria-label="Flip horizontal">
        <svg class="tool-rail-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M11 4H9v16h2V4zm4 0h-2v16h2V4zM6 6H4v12h2V6zm14 0h-2v12h2V6z"></path>
        </svg>
    </button>
    <button type="button" class="tool-rail-btn tool-rail-secondary" id="btnFlipV" aria-label="Flip vertical">
        <svg class="tool-rail-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 11v2h16v-2H4zm0-4v2h16V7H4zm0 8v2h16v-2H4z"></path>
        </svg>
    </button>
</div>
```

Update the localization keys for the shared `Tool Options` title and the new tool labels in both `media/l10n/en.json` and `media/l10n/ko.json`.

- [ ] **Step 4: Re-run the contract test and expect pass**

Run: `npm run compile-tests && npx mocha "out/src/test/suite/webviewContract.test.js" --ui tdd --grep "tool rail"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ImageCustomEditorProvider.ts media/l10n/en.json media/l10n/ko.json src/test/suite/webviewContract.test.ts
git commit -m "feat: restructure the editor chrome for tool rail"
```

### Task 3: Orchestrate active tool state and interactions in the editor runtime

**Files:**
- Modify: `media/editor.js`
- Modify: `src/test/suite/webviewContract.test.ts`

- [ ] **Step 1: Write the failing runtime contract checks**

```ts
test('wires active tool state through the webview', () => {
    assert.ok(editor.includes('const toolRailLogic = globalThis.VsimageToolRailLogic'));
    assert.ok(editor.includes('let activeTool = toolRailLogic.DEFAULT_ACTIVE_TOOL || \'cursor\''));
    assert.ok(editor.includes('function setActiveTool(nextTool, options = {})'));
    assert.ok(editor.includes('toolRailLogic.shouldBlockMarqueeCreation(activeTool)'));
});
```

- [ ] **Step 2: Run the focused contract test and confirm it fails**

Run: `npm run compile-tests && npx mocha "out/src/test/suite/webviewContract.test.js" --ui tdd --grep "active tool state"`

Expected: FAIL until the runtime wiring exists.

- [ ] **Step 3: Implement the orchestration helpers**

Add `activeTool`, button syncing, and panel syncing:

```js
function syncToolOptionsVisibility() {
    Object.keys(toolOptionPanels).forEach((tool) => {
        const panel = toolOptionPanels[tool];
        if (panel) {
            panel.classList.toggle('active', tool === activeTool);
        }
    });
}

function setActiveTool(nextTool, options = {}) {
    const resolvedTool = nextTool || toolRailLogic.DEFAULT_ACTIVE_TOOL || 'cursor';
    activeTool = resolvedTool;
    syncToolRailButtons();
    syncToolOptionsVisibility();
    if (toolRailLogic.shouldEnableCropForTool(activeTool) && !chkEnableCrop.checked) {
        ensureCropModeEnabled();
    }
    if (options.setMarqueeMode === true) {
        isMarqueeMode = true;
    } else if (options.setMarqueeMode === false) {
        isMarqueeMode = false;
    }
    setPanMode(activeTool === 'move' || isSpacePressed || isHandPressed);
    updateCropInteraction();
}
```

Wire tool clicks to `setActiveTool('cursor')`, `setActiveTool('crop')`, `setActiveTool('resize')`, `setActiveTool('mosaic')`, and `setActiveTool('move')`, route `move` through the existing pan behavior, return to `cursor` after crop apply, and block marquee creation in `onMarqueeDragStart` when the active tool is `move`.

- [ ] **Step 4: Re-run the focused contract test and expect pass**

Run: `npm run compile-tests && npx mocha "out/src/test/suite/webviewContract.test.js" --ui tdd --grep "active tool state"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add media/editor.js src/test/suite/webviewContract.test.ts
git commit -m "feat: wire tool rail interactions"
```

### Task 4: Polish styling and Photoshop-like iconography

**Files:**
- Modify: `media/editor.css`
- Modify: `src/ImageCustomEditorProvider.ts`

- [ ] **Step 1: Write the failing visual contract checks**

```ts
test('styles the tool rail, active state, and properties zoom controls', () => {
    assert.ok(styles.includes('.tool-rail'));
    assert.ok(styles.includes('.tool-rail-btn.active'));
    assert.ok(styles.includes('.tool-rail-secondary'));
    assert.ok(styles.includes('.tool-options-panel.active'));
    assert.ok(styles.includes('.properties-zoom-row'));
});
```

- [ ] **Step 2: Run the focused contract test and confirm it fails**

Run: `npm run compile-tests && npx mocha "out/src/test/suite/webviewContract.test.js" --ui tdd --grep "styles the tool rail"`

Expected: FAIL until the CSS selectors exist.

- [ ] **Step 3: Implement the style pass**

Use a narrow left rail, muted gray workspace background, clear active states, and SVG icons that read like Photoshop tools instead of emoji. Move the bottom zoom widgets into the properties card, keep the floating toolbar slimmer, and give `Rotate` / `Flip` a secondary-action look so they read as helpers rather than primary tools.

Representative CSS shape:

```css
.tool-rail {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 56px;
    padding: 8px;
}

.tool-rail-btn.active {
    background: rgba(77, 163, 224, 0.22);
    border-color: rgba(77, 163, 224, 0.75);
}

.tool-rail-secondary {
    opacity: 0.82;
    margin-top: 6px;
}
```

Replace the simple text/emoji buttons with inline SVGs for:

- `Cursor`
- `Crop`
- `Resize`
- `Mosaic`
- `Move`
- `Rotate Left`
- `Rotate Right`
- `Flip Horizontal`
- `Flip Vertical`

- [ ] **Step 4: Re-run the focused contract test and expect pass**

Run: `npm run compile-tests && npx mocha "out/src/test/suite/webviewContract.test.js" --ui tdd --grep "styles the tool rail"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add media/editor.css src/ImageCustomEditorProvider.ts
git commit -m "style: polish tool rail and iconography"
```

### Task 5: End-to-end verification and branch cleanup

**Files:**
- None

- [ ] **Step 1: Run the full unit suite**

Run: `npm run test:unit`

Expected: PASS with all existing editor and contract tests still green.

- [ ] **Step 2: Sanity-check the worktree**

Run: `git status --short`

Expected: clean worktree after commits, with no untracked or modified files left behind.

- [ ] **Step 3: Document the verification result**

Record the final passing test count and the last commit hash in the handoff message so the next worker can pick up with confidence.

## Coverage Check

- Tool rail and shared tool options: Task 2
- Zoom moved into the properties panel: Task 2 and Task 4
- Rotate/flip moved into the left rail: Task 2 and Task 4
- Cursor added as the default non-editing state: Task 1 and Task 3
- Move tool blocking accidental marquee creation: Task 1 and Task 3
- Photoshop-like icon styling: Task 4
- Full regression verification: Task 5
