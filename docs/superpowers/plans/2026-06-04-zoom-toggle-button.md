# Zoom Toggle Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the bottom zoom controller toggle between `화면 맞춤` and `100%` based on the current zoom state, and ensure the initial load state is reflected immediately.

**Architecture:** Keep the zoom toggle behavior in the existing webview editor layer, using the shared zoom helper module for the actual fit-vs-100% decision. Add a small UI sync helper that updates the button label/title from the live zoom ratio, and call it after initial image load, after zoom changes, and after explicit reset clicks.

**Tech Stack:** TypeScript source generation in `src/ImageCustomEditorProvider.ts`, webview runtime JavaScript in `media/editor.js`, shared zoom helper in `media/zoomLogic.js`, contract tests in `src/test/suite/webviewContract.test.ts`.

---

### Task 1: Add contract coverage for the zoom toggle wiring

**Files:**
- Modify: `/Users/hunchulchoi/projects/workspace/myside/vs_extensions/vsimage/src/test/suite/webviewContract.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test('syncs the bottom zoom toggle label from the live zoom state', () => {
    assert.ok(editor.includes('updateZoomToggleButton()'));
    assert.ok(editor.includes('resolveToggleZoomTargetRatio(currentRatio, fitRatio)'));
    assert.ok(editor.includes("document.getElementById('btnReset').addEventListener('click'"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/test/suite/webviewContract.test.ts`
Expected: FAIL because `updateZoomToggleButton()` is not wired yet.

- [ ] **Step 3: Write minimal implementation**

No production code yet.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/test/suite/webviewContract.test.ts`
Expected: PASS after the editor wiring is added.

- [ ] **Step 5: Commit**

```bash
git add src/test/suite/webviewContract.test.ts
git commit -m "test: cover zoom toggle button wiring"
```

### Task 2: Implement the live zoom toggle sync

**Files:**
- Modify: `/Users/hunchulchoi/projects/workspace/myside/vs_extensions/vsimage/media/editor.js`

- [ ] **Step 1: Write the failing test**

Use the contract test from Task 1 to pin the expected editor wiring and initial-load synchronization.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runInBand src/test/suite/webviewContract.test.ts`
Expected: FAIL until the new helper and call sites are present.

- [ ] **Step 3: Write minimal implementation**

Add a helper in `media/editor.js` that:

```js
function updateZoomToggleButton() {
    if (!btnReset || !cropper) {
        return;
    }

    const currentRatio = zoomLogic.getImageZoomRatioFromData(cropper.getImageData());
    const fitRatio = getViewportFitRatio();
    const targetRatio = zoomLogic.resolveToggleZoomTargetRatio(currentRatio, fitRatio);
    const shouldShowActualPixels = Math.abs(targetRatio - 1) < zoomLogic.DEFAULT_ZOOM_EPSILON;
    btnReset.textContent = shouldShowActualPixels ? '100%' : t('shortcuts.zoomFit');
    btnReset.title = shouldShowActualPixels ? t('shortcuts.zoomActualPixels') : t('shortcuts.zoomFit');
}
```

Call it from `ready()`, `zoom()`, the resize/layout sync path, and the reset click handler after `applyZoomTo(...)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runInBand src/test/suite/webviewContract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add media/editor.js src/ImageCustomEditorProvider.ts
git commit -m "feat: sync zoom toggle label with current zoom"
```
