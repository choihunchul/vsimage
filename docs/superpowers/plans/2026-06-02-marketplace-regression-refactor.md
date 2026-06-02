# Marketplace Regression Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract marketplace-critical image-editor rules into focused modules and add regression tests so future refactors cannot silently break shipped behavior.

**Architecture:** Keep `media/editor.js` as the browser adapter. Move DOM-free decisions into CommonJS-compatible modules that also expose a `globalThis.Vsimage*Logic` API for the webview. Load every module before `editor.js`, test each module directly from Node, and verify stable adapter contracts with source-level tests plus the VS Code Extension Host suite.

**Tech Stack:** JavaScript webview modules, TypeScript Mocha tests, VS Code Extension Host tests, webpack, `vsce`

---

## Working Rules

- The worktree already contains unrelated and in-progress edits. Stage only files named by the current task.
- For each module: write the test, run it to observe the expected failure, add the module, wire `editor.js`, run the focused test, then run the full fast suite.
- After each feature group, run `npm test`.
- Preserve DOM mutation, Cropper.js calls, clipboard APIs, `FileReader`, and VS Code `postMessage` calls in `media/editor.js`.

## File Map

| File | Responsibility |
| --- | --- |
| `media/colorLogic.js` | RGB conversion and color-picker display strings |
| `media/magicWandLogic.js` | Flood-fill pixel selection |
| `media/clipboardLogic.js` | Clipboard format, quality, and selection-scope decisions |
| `media/saveExportLogic.js` | Save/export request command and payload decisions |
| `media/historyLogic.js` | Snapshot list trimming and restore transitions |
| `media/transformLogic.js` | Rotate and flip transitions |
| `media/loupeLogic.js` | Natural-coordinate loupe rectangles and client bounds |
| `src/test/suite/*Logic.test.ts` | Pure regression tests for each feature module |
| `src/test/suite/webviewContract.test.ts` | Webview script-load and adapter-wiring contracts |
| `src/ImageCustomEditorProvider.ts` | Load extracted modules before `editor.js` |
| `media/editor.js` | Call feature modules and apply browser side effects |
| `README.md` | Keep the fast test command current |

### Task 1: Color Picker Logic

**Files:**
- Create: `media/colorLogic.js`
- Create: `src/test/suite/colorLogic.test.ts`
- Modify: `media/editor.js`
- Modify: `src/ImageCustomEditorProvider.ts`

- [ ] **Step 1: Write the failing color-format test**

```ts
const logic = require(path.join(__dirname, '../../../../media/colorLogic.js'));

assert.deepStrictEqual(logic.rgbToHsl(255, 0, 0), { h: 0, s: 100, l: 50 });
assert.deepStrictEqual(logic.rgbToHsv(0, 255, 0), { h: 120, s: 100, v: 100 });
assert.deepStrictEqual(logic.rgbToCmyk(0, 0, 0), { c: 0, m: 0, y: 0, k: 100 });
assert.deepStrictEqual(logic.buildColorFormats(255, 0, 128, 128), [
  { label: 'HEX', value: '#FF008080' },
  { label: 'RGB', value: 'rgb(255, 0, 128)' },
  { label: 'RGBA', value: 'rgba(255, 0, 128, 0.50)' },
  { label: 'HSL', value: 'hsl(330, 100%, 50%)' },
  { label: 'HSV', value: 'hsv(330, 100%, 100%)' },
  { label: 'CMYK', value: 'cmyk(0%, 100%, 50%, 0%)' }
]);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run compile-tests && npx mocha out/src/test/suite/colorLogic.test.js --ui tdd`

Expected: FAIL because `media/colorLogic.js` does not exist.

- [ ] **Step 3: Extract the color API**

Create `media/colorLogic.js` with:

```js
const api = { toHexByte, rgbToHsl, rgbToHsv, rgbToCmyk, buildColorFormats };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof globalThis !== 'undefined') globalThis.VsimageColorLogic = api;
```

Move the existing conversion bodies from `media/editor.js` unchanged. Add
`colorLogicUri` before `scriptUri` in `src/ImageCustomEditorProvider.ts`. Replace
the local converter calls in `media/editor.js` with `colorLogic.buildColorFormats(...)`.

- [ ] **Step 4: Run focused and fast suites and verify GREEN**

Run: `npm run compile-tests && npx mocha out/src/test/suite/colorLogic.test.js --ui tdd`

Run: the README fast unit-test command plus `out/src/test/suite/colorLogic.test.js`.

Expected: PASS.

### Task 2: Magic Wand Logic

**Files:**
- Create: `media/magicWandLogic.js`
- Create: `src/test/suite/magicWandLogic.test.ts`
- Modify: `media/editor.js`
- Modify: `src/ImageCustomEditorProvider.ts`

- [ ] **Step 1: Write failing flood-fill tests**

```ts
const pixels = new Uint8ClampedArray([
  10, 10, 10, 255, 10, 10, 10, 255, 250, 250, 250, 255,
  10, 10, 10, 255, 12, 12, 12, 255, 250, 250, 250, 255
]);
const result = logic.floodFillPixels(pixels, 3, 2, 0, 0, 2);
assert.strictEqual(result.count, 4);
assert.deepStrictEqual(result.bounds, { x: 0, y: 0, width: 2, height: 2 });
assert.deepStrictEqual(Array.from(result.mask), [1, 1, 0, 1, 1, 0]);
assert.strictEqual(logic.floodFillPixels(pixels, 3, 2, -1, 0, 2), null);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run compile-tests && npx mocha out/src/test/suite/magicWandLogic.test.js --ui tdd`

Expected: FAIL because `media/magicWandLogic.js` does not exist.

- [ ] **Step 3: Extract flood fill**

Expose:

```js
function floodFillPixels(pixels, width, height, startX, startY, tolerance) {
    if (!pixels || width <= 0 || height <= 0 || startX < 0 || startX >= width || startY < 0 || startY >= height) {
        return null;
    }
    const seed = (startY * width + startX) * 4;
    const seedColor = [pixels[seed], pixels[seed + 1], pixels[seed + 2], pixels[seed + 3]];
    const mask = new Uint8Array(width * height);
    const visited = new Uint8Array(width * height);
    const stack = [startX, startY];
    let count = 0;
    let minX = width, minY = height, maxX = -1, maxY = -1;
    while (stack.length) {
        const y = stack.pop();
        const x = stack.pop();
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        const index = y * width + x;
        if (visited[index]) continue;
        visited[index] = 1;
        const pixel = index * 4;
        if (seedColor.some((value, channel) => Math.abs(pixels[pixel + channel] - value) > tolerance)) continue;
        mask[index] = 1;
        count++;
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
    }
    return count === 0 ? null : {
        mask, count,
        bounds: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
    };
}
```

Keep canvas creation and `getImageData()` in `media/editor.js`; pass pixel data
to `magicWandLogic.floodFillPixels(...)`. Load the module before `editor.js`.

- [ ] **Step 4: Run focused and fast suites and verify GREEN**

Run the focused test, then the expanded README fast unit-test command.

Expected: PASS.

- [ ] **Step 5: Verify feature group in Extension Host**

Run: `npm test`

Expected: PASS.

### Task 3: Clipboard Decisions

**Files:**
- Create: `media/clipboardLogic.js`
- Create: `src/test/suite/clipboardLogic.test.ts`
- Modify: `media/editor.js`
- Modify: `src/ImageCustomEditorProvider.ts`

- [ ] **Step 1: Write failing clipboard-decision tests**

```ts
assert.strictEqual(logic.shouldShowQuality('image/png'), false);
assert.strictEqual(logic.shouldShowQuality('image/jpeg'), true);
assert.strictEqual(logic.shouldShowQuality('image/webp'), true);
assert.strictEqual(logic.resolveCopyFormat('image/webp'), 'image/webp');
assert.strictEqual(logic.resolveCopyFormat('bad/type'), 'image/png');
assert.strictEqual(logic.resolveCopyQuality('85', 80), 85);
assert.strictEqual(logic.resolveCopyQuality('bad', 80), 80);
assert.strictEqual(logic.resolveSelectionOnly(true, 'full'), false);
assert.strictEqual(logic.resolveSelectionOnly(true, 'selection'), true);
assert.strictEqual(logic.resolveSelectionOnly(true, null), true);
assert.strictEqual(logic.resolveSelectionOnly(false, 'selection'), false);
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm run compile-tests && npx mocha out/src/test/suite/clipboardLogic.test.js --ui tdd`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Add clipboard decision module and adapter calls**

Expose `shouldShowQuality`, `resolveCopyFormat`, `resolveCopyQuality`, and
`resolveSelectionOnly`. Use them from `showCopyModal()`,
`syncCopyQualityVisibility()`, and `performCopyToClipboard()`. Leave
`navigator.clipboard.write()` in `media/editor.js`.

Use these exact rules:

```js
const COPY_FORMATS = new Set(['image/png', 'image/jpeg', 'image/webp']);
const shouldShowQuality = (format) => format === 'image/jpeg' || format === 'image/webp';
const resolveCopyFormat = (format) => COPY_FORMATS.has(format) ? format : 'image/png';
const resolveCopyQuality = (value, fallback) => Number.isFinite(parseInt(value, 10))
    ? parseInt(value, 10)
    : fallback;
const resolveSelectionOnly = (hasSelection, savedScope) => Boolean(hasSelection && savedScope !== 'full');
```

- [ ] **Step 4: Run focused and fast suites and verify GREEN**

Run the focused test, then the expanded README fast unit-test command.

Expected: PASS.

### Task 4: Save and Export Decisions

**Files:**
- Create: `media/saveExportLogic.js`
- Create: `src/test/suite/saveExportLogic.test.ts`
- Modify: `media/editor.js`
- Modify: `src/ImageCustomEditorProvider.ts`

- [ ] **Step 1: Write failing save/export tests**

```ts
assert.deepStrictEqual(logic.resolveSaveStart('save', true), {
  immediateMessage: { command: 'save-document' },
  needsBlob: false
});
assert.deepStrictEqual(logic.resolveSaveStart('save', false), {
  immediateMessage: null,
  needsBlob: true
});
assert.strictEqual(logic.commandForBlobType('save'), 'save-image');
assert.strictEqual(logic.commandForBlobType('export'), 'export-image');
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm run compile-tests && npx mocha out/src/test/suite/saveExportLogic.test.js --ui tdd`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Extract request decisions**

Expose `resolveSaveStart(type, isDocumentEditor)` and
`commandForBlobType(type)`. Keep blob creation, `FileReader`, and
`vscode.postMessage()` in `media/editor.js`.

Use:

```js
function resolveSaveStart(type, isDocumentEditor) {
    if (type === 'save' && isDocumentEditor) {
        return { immediateMessage: { command: 'save-document' }, needsBlob: false };
    }
    return { immediateMessage: null, needsBlob: true };
}
function commandForBlobType(type) {
    return type === 'save' ? 'save-image' : 'export-image';
}
```

- [ ] **Step 4: Run focused, fast, and Extension Host suites**

Run the focused test, the expanded fast unit suite, then `npm test`.

Expected: PASS.

### Task 5: History and Transform Logic

**Files:**
- Create: `media/historyLogic.js`
- Create: `media/transformLogic.js`
- Create: `src/test/suite/historyLogic.test.ts`
- Create: `src/test/suite/transformLogic.test.ts`
- Modify: `media/editor.js`
- Modify: `src/ImageCustomEditorProvider.ts`

- [ ] **Step 1: Write failing history tests**

```ts
assert.deepStrictEqual(logic.trimSnapshots(['a', 'b', 'c'], 2), ['b', 'c']);
assert.deepStrictEqual(logic.restoreSnapshot(['a', 'b', 'c'], 1), {
  entry: 'b',
  remaining: ['a']
});
assert.strictEqual(logic.restoreSnapshot(['a'], -1), null);
```

- [ ] **Step 2: Write failing transform tests**

```ts
assert.strictEqual(logic.rotationDelta('rotateLeft'), -90);
assert.strictEqual(logic.rotationDelta('rotateRight'), 90);
assert.deepStrictEqual(logic.nextFlipState({ scaleX: 1, scaleY: 1 }, 'flipH'), {
  scaleX: -1, scaleY: 1
});
assert.deepStrictEqual(logic.nextFlipState({ scaleX: -1, scaleY: 1 }, 'flipV'), {
  scaleX: -1, scaleY: -1
});
```

- [ ] **Step 3: Run focused tests and verify RED**

Run: `npm run compile-tests && npx mocha out/src/test/suite/historyLogic.test.js out/src/test/suite/transformLogic.test.js --ui tdd`

Expected: FAIL because both modules are missing.

- [ ] **Step 4: Extract state transitions**

Expose `trimSnapshots`, `restoreSnapshot`, `rotationDelta`, and
`nextFlipState`. Use them from history restore, undo trimming, toolbar rotate,
context-menu flip, and shortcut rotate handlers. Keep snapshot canvas creation
and Cropper.js calls in `media/editor.js`.

Use:

```js
const trimSnapshots = (entries, max) => entries.length > max
    ? entries.slice(entries.length - max)
    : entries.slice();
function restoreSnapshot(entries, index) {
    if (index < 0 || index >= entries.length) return null;
    return { entry: entries[index], remaining: entries.slice(0, index) };
}
const rotationDelta = (action) => action === 'rotateLeft' ? -90 : action === 'rotateRight' ? 90 : null;
function nextFlipState(state, action) {
    return {
        scaleX: action === 'flipH' ? -state.scaleX : state.scaleX,
        scaleY: action === 'flipV' ? -state.scaleY : state.scaleY
    };
}
```

- [ ] **Step 5: Run focused, fast, and Extension Host suites**

Run focused tests, the expanded fast unit suite, then `npm test`.

Expected: PASS.

### Task 6: Loupe Coordinate Logic

**Files:**
- Create: `media/loupeLogic.js`
- Create: `src/test/suite/loupeLogic.test.ts`
- Modify: `media/editor.js`
- Modify: `src/ImageCustomEditorProvider.ts`

- [ ] **Step 1: Write failing loupe tests**

```ts
assert.deepStrictEqual(logic.clampNaturalRect(95, 70, 20, 20, 100, 80), {
  x: 80, y: 60, width: 20, height: 20
});
assert.deepStrictEqual(logic.getNaturalRectFromPoints(
  { x: 10, y: 15 }, { x: 12, y: 17 }, 16, 100, 80
), { x: 10, y: 15, width: 16, height: 16 });
assert.deepStrictEqual(logic.naturalRectToClientBounds(
  { x: 10, y: 20, width: 30, height: 40 },
  { left: 5, top: 7, width: 200, height: 160, naturalWidth: 100, naturalHeight: 80 },
  { left: 100, top: 200 }
), { left: 125, top: 247, width: 60, height: 80 });
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `npm run compile-tests && npx mocha out/src/test/suite/loupeLogic.test.js --ui tdd`

Expected: FAIL because the module is missing.

- [ ] **Step 3: Extract coordinate functions**

Expose `clampNaturalRect`, `getNaturalRectFromPoints`, and
`naturalRectToClientBounds`. Pass original dimensions and Cropper-derived data
as explicit arguments. Keep loupe canvas drawing in `media/editor.js`.

Use:

```js
function clampNaturalRect(x, y, width, height, naturalWidth, naturalHeight) {
    const w = Math.max(1, Math.min(width, naturalWidth));
    const h = Math.max(1, Math.min(height, naturalHeight));
    return {
        x: Math.max(0, Math.min(naturalWidth - w, x)),
        y: Math.max(0, Math.min(naturalHeight - h, y)),
        width: w,
        height: h
    };
}
function getNaturalRectFromPoints(start, end, minDrag, naturalWidth, naturalHeight) {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    return clampNaturalRect(
        x, y,
        Math.max(minDrag, Math.abs(end.x - start.x) + 1),
        Math.max(minDrag, Math.abs(end.y - start.y) + 1),
        naturalWidth, naturalHeight
    );
}
function naturalRectToClientBounds(rect, imageData, containerRect) {
    const scaleX = imageData.width / imageData.naturalWidth;
    const scaleY = imageData.height / imageData.naturalHeight;
    return {
        left: containerRect.left + imageData.left + rect.x * scaleX,
        top: containerRect.top + imageData.top + rect.y * scaleY,
        width: rect.width * scaleX,
        height: rect.height * scaleY
    };
}
```

- [ ] **Step 4: Run focused, fast, and Extension Host suites**

Run focused tests, the expanded fast unit suite, then `npm test`.

Expected: PASS.

### Task 7: Webview Contracts and Fast-Test Script

**Files:**
- Create: `src/test/suite/webviewContract.test.ts`
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Write contract tests**

Read `src/ImageCustomEditorProvider.ts` and `media/editor.js` as source text.
Assert:

```ts
assert.ok(provider.indexOf('${colorLogicUri}') < provider.indexOf('${scriptUri}'));
assert.ok(provider.indexOf('${magicWandLogicUri}') < provider.indexOf('${scriptUri}'));
assert.ok(editor.includes("applyZoomAction('zoomIn')"));
assert.ok(editor.includes("applyZoomAction('zoomOut')"));
assert.ok(editor.includes("saveExportLogic.commandForBlobType(type)"));
assert.ok(editor.includes("document.getElementById('btnReset').click()"));
```

- [ ] **Step 2: Run contract test and verify GREEN**

Run: `npm run compile-tests && npx mocha out/src/test/suite/webviewContract.test.js --ui tdd`

Expected: PASS because all extraction tasks are already wired.

- [ ] **Step 3: Add one maintained fast-test command**

Add:

```json
"test:unit": "npm run compile-tests && mocha \"out/src/test/suite/*.test.js\" --ui tdd --ignore out/src/test/suite/extension.test.js"
```

Replace the long README command with `npm run test:unit`.

- [ ] **Step 4: Run complete verification**

Run:

```bash
npm run test:unit
npm test
npm run package
npm run vsix
git diff --check
```

Expected: all commands exit `0`; VSIX is written to `artifacts/vsimage.vsix`.

## Self-Review Checklist

- Every module in the design spec is either already tested or extracted by a task.
- Every new webview module is loaded before `editor.js`.
- Every production extraction starts with a focused failing test.
- Clipboard APIs, Cropper.js calls, DOM writes, and VS Code messages remain in
  `media/editor.js`.
- The final verification covers unit tests, Extension Host tests, production
  webpack output, VSIX packaging, and whitespace errors.
