# Marketplace Regression Refactor Design

## Goal

Refactor the marketplace extension without breaking shipped behavior. Move reusable
business rules out of `media/editor.js` into focused, DOM-free modules and protect
each user-facing feature with regression tests.

## Constraints

- Keep the extension releasable after every feature-group extraction.
- Preserve existing UI, keyboard shortcuts, Cropper.js behavior, and VS Code
  message contracts.
- Do not rewrite `media/editor.js` wholesale.
- Prefer pure functions with explicit inputs and outputs.
- Keep DOM mutation, Cropper.js calls, clipboard access, and VS Code
  `postMessage` calls in `media/editor.js`.
- Run the full Extension Host suite after each completed feature group.
- Add browser-driven click and drag E2E coverage in a separate follow-up phase.

## Architecture

`media/editor.js` remains the webview adapter. It gathers browser state, calls a
feature module, then applies the returned result to the DOM, Cropper.js, or VS
Code bridge.

Each feature module has one responsibility:

| Module | Responsibility |
| --- | --- |
| `media/zoomLogic.js` | Zoom ratio calculations and zoom actions |
| `media/canvasLayoutLogic.js` | Canvas origin and scroll-content dimensions |
| `media/cropMarqueeLogic.js` | Crop bounds, marquee movement, and zoom-safe crop snapshots |
| `media/resizePanelLogic.js` | Resize dimensions, scale labels, stepped resize, and post-resize zoom |
| `media/shortcutLogic.js` | Keyboard event to editor action mapping |
| `media/sharpenLogic.js` | Sharpen slider mapping |
| `media/colorLogic.js` | RGB conversion and color-picker display formats |
| `media/magicWandLogic.js` | Pixel flood-fill selection and selected-region bounds |
| `media/clipboardLogic.js` | Clipboard format, quality, and selection-scope decisions |
| `media/historyLogic.js` | Snapshot trimming and restore-state decisions |
| `media/transformLogic.js` | Rotate and flip state transitions |
| `media/loupeLogic.js` | Natural-coordinate rectangle clamping and drag selection |
| `media/saveExportLogic.js` | Save/export request construction |

The first six modules already exist. The remaining modules are extracted
incrementally from `media/editor.js`.

## Test Layers

### Pure Logic Tests

Every extracted module receives a matching `src/test/suite/*.test.ts` file.
Tests cover normal behavior, boundary values, invalid inputs, and relevant
regressions. These tests run without VS Code or a browser and form the fast
refactoring loop.

### Webview Contract Tests

Add source-level contract tests for the adapter wiring that is difficult to
exercise without a browser:

- required logic scripts are loaded before `editor.js`
- toolbar and shortcut actions call the same feature path
- save/export requests preserve message command names
- context-menu actions retain their toolbar equivalents

These tests intentionally verify stable integration contracts, not formatting.

### Extension Host Tests

Keep the existing Extension Host suite and extend it around public extension
registration and webview resource loading. This verifies that the packaged
extension can load the extracted modules.

### Browser E2E Follow-Up

Browser-driven click, drag, clipboard, and Cropper.js interaction tests remain a
separate phase because they require a stable webview harness. The pure logic and
contract layers must be completed first.

## Feature-Group Order

1. Color picker and magic wand pixel logic
2. Clipboard and save/export decisions
3. Transform and history state
4. Loupe coordinate calculations
5. Webview resource and action-contract tests
6. Full Extension Host and package verification

This order extracts high-value DOM-independent logic first and leaves browser
interaction orchestration in place.

## SOLID Rules

- **Single responsibility:** each module owns one feature rule set.
- **Open/closed:** new output formats or shortcuts extend a focused module
  without editing unrelated feature code.
- **Liskov substitution:** `editor.js` fallback implementations follow the same
  API as loaded modules.
- **Interface segregation:** modules export only functions consumed by the
  adapter or tests.
- **Dependency inversion:** browser orchestration depends on feature-module
  contracts; pure modules do not depend on the DOM, VS Code, or Cropper.js.

## Completion Criteria

- Every module listed above has focused regression tests.
- Existing tests remain green during incremental extraction.
- `npm test`, `npm run package`, `npm run vsix`, and `git diff --check` succeed.
- README development instructions include the expanded fast unit-test command.
- No unrelated behavior or UI changes are introduced.
