# Photoshop-Like Tool Rail Design

## Goal

Replace the always-visible `Resize` and `Crop Presets` sidebar panels with a Photoshop-like tool-driven layout.

The new interaction model should make the primary editing actions start from tool icons instead of large static cards, while preserving the current image editing behavior and keyboard shortcuts as much as possible.

## Confirmed Direction

We will use a `left tool rail + right context panel` layout.

- A fixed vertical tool rail appears on the left side of the canvas workspace.
- The rail contains five primary tools: `Select`, `Crop`, `Resize`, `Mosaic`, and `Move`.
- The right sidebar stays in place, but it is simplified.
- The existing dedicated `Resize` card and `Crop Presets` card are removed.
- Tool-specific controls are shown in one shared `Tool Options` area in the right sidebar, based on the active tool.

This keeps the interface closer to Photoshop while fitting the current extension architecture.

## Layout

### Left Tool Rail

The left edge of the canvas workspace gains a narrow vertical icon bar.

It contains:

1. `Select`
2. `Crop`
3. `Resize`
4. `Mosaic`
5. `Move`

Only one tool is active at a time. The active tool has a clear highlighted state.

The tool rail is part of the canvas workspace rather than the existing bottom floating toolbar. The bottom floating toolbar remains focused on viewport controls such as zoom, rotate, flip, and reset.

### Right Sidebar

The right sidebar remains the home for supporting information and secondary actions.

It keeps:

- Properties
- Selection information
- History
- Save / Export

It loses:

- The standalone `Resize` panel
- The standalone `Crop Presets` panel

It gains:

- A shared `Tool Options` section that changes based on the active tool

## Tool Behavior

### Select

`Select` is the default editing tool for marquee-based selection.

- It activates the existing selection behavior.
- It works with the current selection info card.
- It does not need a large option form.
- It may show a short hint in the `Tool Options` section, but no new mandatory controls are required.

### Crop

`Crop` activates the current crop system.

- Internally it continues to use the existing crop enable flow.
- The `Tool Options` section shows crop ratio presets and the crop apply action.
- The crop apply action remains the same behavior as the current `Apply Crop`.
- Existing crop shortcuts such as `C` and `Enter` continue to work.

### Resize

`Resize` activates destructive image resizing controls.

- The `Tool Options` section shows width, height, lock-ratio, scale, and apply controls.
- The current resize logic remains unchanged as much as possible.
- Existing percent labels and scale synchronization continue to work.
- The existing sharpen-after-resize option remains part of this tool context.

### Mosaic

`Mosaic` activates mosaic controls.

- The `Tool Options` section shows mosaic size and apply controls.
- The apply action keeps the current destructive mosaic behavior.
- Existing shortcut-driven mosaic behavior should remain intact.

### Move

`Move` acts like a hand tool for panning the canvas.

- Dragging pans the canvas without creating a new marquee selection.
- It reuses the current pan behavior that already exists for space-drag.
- It does not need a large options form.
- Space-drag remains available as a temporary pan shortcut even when another tool is active.

## State Model

Add a lightweight `activeTool` state in the webview UI layer.

Supported values:

- `select`
- `crop`
- `resize`
- `mosaic`
- `move`

Default behavior:

- When an image opens, the default active tool is `select`.
- After `Apply Crop`, the editor returns to `select` because crop mode is no longer active.
- After `Apply Resize` or mosaic apply, the current tool remains active so the user can repeat the action if needed.

The goal is orchestration, not feature reimplementation.

The new state layer should:

- drive which tool button is highlighted
- drive which `Tool Options` UI is visible
- map tool changes to existing feature toggles and handlers
- avoid rewriting stable editing logic that already works

Examples:

- Switching to `crop` enables the current crop mode and exposes crop controls.
- Switching away from `crop` disables crop-specific UI.
- Switching to `move` enables pointer behavior that pans instead of starting marquee creation.
- Switching to `resize` or `mosaic` only swaps the visible option controls and does not directly mutate the image until the user applies the action.

## Implementation Approach

This should be implemented as a UI restructuring on top of the existing logic.

### Reuse Strategy

Preserve the current IDs, handlers, and feature functions whenever possible.

- Keep existing resize form controls and wire them into the new `Tool Options` slot.
- Keep existing crop preset buttons and crop apply logic, but relocate their presentation.
- Keep existing mosaic logic and expose it from the new tool context.
- Reuse current pan logic for `move`.

This reduces regression risk and avoids a large rewrite.

### Structural Changes

Expected areas of change:

- `src/ImageCustomEditorProvider.ts`
  - add the tool rail markup
  - restructure the sidebar so it contains a shared `Tool Options` section
  - move existing crop/resize/mosaic controls into the new shared tool area
- `media/editor.css`
  - style the left tool rail
  - style active tool icons
  - style the shared tool options area
  - adjust workspace spacing so the new rail feels native
- `media/editor.js`
  - introduce `activeTool`
  - toggle tool state and tool-specific UI
  - connect `move` to existing pan behavior
  - preserve shortcuts and apply flows

## Interaction Rules

- One primary tool is active at a time.
- Tool activation is available by click and by existing keyboard shortcuts where already defined.
- A tool switch updates both canvas behavior and visible sidebar controls.
- Applying crop, resize, or mosaic still requires an explicit user action.
- `move` changes pointer interaction immediately and should visually communicate that selection creation is not active.
- Switching away from `crop` cancels crop-specific visual state unless the user explicitly applies the crop first.

## Error Handling And Edge Cases

- Switching tools must not silently apply pending edits.
- Switching away from `crop` must not leave crop UI partially active.
- `move` must not create accidental selections while dragging.
- `resize` and `mosaic` must preserve current disabled/enabled button behavior.
- If no image is loaded, the tool rail should remain hidden just like the current toolbar and sidebar behavior.

## Testing Focus

### Functional Checks

- Tool buttons change active state correctly.
- The correct `Tool Options` block appears for each tool.
- `crop`, `resize`, and `mosaic` still apply the same image mutations as before.
- `move` pans the canvas and blocks marquee creation while active.
- Existing selection workflows still work after switching back to `select`.

### Shortcut Checks

- `C` still toggles crop behavior correctly.
- `M` still returns to marquee/select behavior.
- `X` still applies mosaic to the current selection as expected.
- `Enter` still applies crop when crop is active.
- Space-drag still pans even when another tool is selected.

### Regression Checks

- Zoom/rotate/flip/reset toolbar remains functional.
- Selection info remains accurate.
- Save/export remains unaffected.
- History still records destructive actions correctly.

## Out Of Scope

- Full Photoshop-style submenu stacks or nested tool groups
- A complete redesign of zoom/rotate controls
- Replacing existing editing algorithms
- Reworking save/export or history architecture

## Recommendation

Implement this as an incremental UI migration rather than a rewrite.

The strongest version of the feature is:

- left-side tool rail for primary actions
- existing bottom floating toolbar retained for viewport actions
- right sidebar reduced to information, history, export, and context-sensitive tool options

This preserves the current system's strengths while making the editor feel much closer to a familiar image-editing tool layout.
