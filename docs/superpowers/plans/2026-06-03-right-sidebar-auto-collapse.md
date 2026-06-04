# Right Sidebar Auto Collapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional auto-collapse mode to the right sidebar so the panel collapses when the pointer leaves and expands again when the pointer touches the sidebar edge.

**Architecture:** Keep the behavior local to the webview. Add one small pure logic module for sidebar collapse state transitions, wire it into `media/editor.js`, and expose a toggle in the sticky properties section. Use CSS to render a narrow hover target when the sidebar is collapsed so the panel can reopen without a separate button.

**Tech Stack:** TypeScript, vanilla webview JavaScript, CSS, Node-based unit tests.

---

### Task 1: Add a sidebar auto-collapse state helper

**Files:**
- Create: `media/sidebarAutoCollapseLogic.js`
- Test: `src/test/suite/sidebarAutoCollapseLogic.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import * as assert from 'assert';
import * as path from 'path';

const logic = require(path.join(__dirname, '../../../../media/sidebarAutoCollapseLogic.js')) as {
    createSidebarAutoCollapseState: () => { enabled: boolean; collapsed: boolean };
    setSidebarAutoCollapseEnabled: (state: { enabled: boolean; collapsed: boolean }, enabled: boolean) => { enabled: boolean; collapsed: boolean };
    handleSidebarAutoCollapseMouseEnter: (state: { enabled: boolean; collapsed: boolean }) => { enabled: boolean; collapsed: boolean };
    handleSidebarAutoCollapseMouseLeave: (state: { enabled: boolean; collapsed: boolean }) => { enabled: boolean; collapsed: boolean };
};

suite('Sidebar auto collapse logic', () => {
    test('expands on enter and collapses on leave when enabled', () => {
        const enabled = logic.setSidebarAutoCollapseEnabled(logic.createSidebarAutoCollapseState(), true);
        assert.deepStrictEqual(enabled, { enabled: true, collapsed: false });
        assert.deepStrictEqual(logic.handleSidebarAutoCollapseMouseLeave(enabled), { enabled: true, collapsed: true });
        assert.deepStrictEqual(logic.handleSidebarAutoCollapseMouseEnter({ enabled: true, collapsed: true }), { enabled: true, collapsed: false });
    });

    test('resets to expanded when disabled', () => {
        const disabled = logic.setSidebarAutoCollapseEnabled({ enabled: true, collapsed: true }, false);
        assert.deepStrictEqual(disabled, { enabled: false, collapsed: false });
        assert.deepStrictEqual(logic.handleSidebarAutoCollapseMouseLeave(disabled), { enabled: false, collapsed: false });
    });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test src/test/suite/sidebarAutoCollapseLogic.test.ts`
Expected: module-not-found or missing-export failure because the helper does not exist yet.

- [ ] **Step 3: Implement the minimal helper**

```js
'use strict';

function createSidebarAutoCollapseState() {
    return { enabled: false, collapsed: false };
}

function setSidebarAutoCollapseEnabled(state, enabled) {
    return {
        enabled: !!enabled,
        collapsed: false
    };
}

function handleSidebarAutoCollapseMouseEnter(state) {
    return state.enabled ? { enabled: true, collapsed: false } : state;
}

function handleSidebarAutoCollapseMouseLeave(state) {
    return state.enabled ? { enabled: true, collapsed: true } : state;
}

module.exports = {
    createSidebarAutoCollapseState,
    setSidebarAutoCollapseEnabled,
    handleSidebarAutoCollapseMouseEnter,
    handleSidebarAutoCollapseMouseLeave
};
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test src/test/suite/sidebarAutoCollapseLogic.test.ts`
Expected: PASS.

### Task 2: Wire the toggle into the webview and style the collapsed strip

**Files:**
- Modify: `src/ImageCustomEditorProvider.ts`
- Modify: `media/editor.js`
- Modify: `media/editor.css`
- Modify: `media/l10n/ko.json`
- Modify: `media/l10n/en.json`

- [ ] **Step 1: Add the control and UI state**

```ts
// Insert into the sticky properties card in the sidebar markup.
<div style="display: flex; align-items: center; gap: 6px; margin-top: 8px;">
    <input type="checkbox" id="chkAutoCollapse" checked>
    <label for="chkAutoCollapse" style="font-size: 0.75rem; user-select: none;" data-i18n="sidebar.autoCollapse"></label>
</div>
```

- [ ] **Step 2: Add the hover behavior and collapsed class handling**

```js
const sidebarAutoCollapseLogic = globalThis.VsimageSidebarAutoCollapseLogic || { ... };
let sidebarAutoCollapseState = sidebarAutoCollapseLogic.createSidebarAutoCollapseState();
let sidebarAutoCollapseTimer = null;

function renderSidebarAutoCollapseState() {
    if (!sidebar) return;
    sidebar.classList.toggle('sidebar-controls-collapsed', sidebarAutoCollapseState.enabled && sidebarAutoCollapseState.collapsed);
}
```

- [ ] **Step 3: Add the collapsed sidebar CSS**

```css
.sidebar-controls-collapsed {
    width: 16px;
    min-width: 16px;
    flex: 0 0 16px;
    padding: 0;
    cursor: e-resize;
}
```

- [ ] **Step 4: Add localization strings**

```json
{
  "sidebar.autoCollapse": "Auto collapse"
}
```

- [ ] **Step 5: Verify the webview still builds**

Run: `npm run test:unit`
Expected: all existing tests pass, and the new sidebar auto-collapse contract is covered.
```

