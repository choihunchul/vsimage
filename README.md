# VS Code Image Editor (vsimage)

Edit PNG, JPEG, WebP, and GIF images directly inside VS Code — crop, resize, rotate, flip, export, and pick colors without leaving the editor.

![Version](https://img.shields.io/github/v/release/choihunchul/vsimage?label=version)
![License](https://img.shields.io/github/license/choihunchul/vsimage)

## Features

- **Default image editor** for `png`, `jpg`, `jpeg`, `webp`, `gif` (opens in vsimage on double-click)
- **Explorer / tab context menu** — *Edit with VS Code Image Editor* (`vsimage: Open with Image Editor`)
- **Crop** — presets (auto, free, 1:1, 16:9, 4:3, circle), keyboard marquee tools
- **Magic wand** — select similar-color regions (tolerance slider, **W** + click)
- **Resize** — width/height, scale slider (10–200%), aspect-ratio lock; stepped downscale for sharper shrinks
- **Transform** — rotate, flip, toolbar zoom, pan (**Space** + drag)
- **Zoom loupe** — hold **Z** and drag on the image; magnified preview on the canvas + selection outline
- **Edit history** — thumbnail snapshots with one-click restore
- **Save flow** — dirty-state tracking, save prompt on close, untitled document support
- **Export** as PNG, JPEG, or WebP with quality control
- **Clipboard** — paste images in, copy edited images out (format & selection options)
- **Color picker** — hold **Option/Alt**, move over the image, click to sample; copy as HEX / RGB / RGBA / HSL / HSV / CMYK
- **Pixel rulers** with zoom-aware ticks
- **Right-click menu** on the canvas (copy, erase selection, flip, save, undo, reset zoom)
- **Undo** for destructive edits (**Cmd/Ctrl+Z**)
- **i18n** — English and Korean UI (follows VS Code display language)

## Usage

### Open an image

1. **Double-click** a supported image in the Explorer — opens in vsimage (default custom editor).
2. Or **right-click** the file → **Edit with VS Code Image Editor**.
3. Or **Command Palette** → `vsimage: Open with Image Editor` (current file).
4. Or **Command Palette** → `vsimage: Create Empty Image Editor` — import, drag-and-drop, or **Cmd/Ctrl+V** paste.

If an image already opened in another viewer, use **Reopen Editor With…** → **VS Code Image Editor**.

### Workspace layout

- **Canvas** — image, rulers, scroll/zoom; floating toolbar (zoom, rotate, flip, magic wand).
- **Sidebar** — properties, crop, resize, history, save/export.
- Hold **Cmd/Ctrl** on the canvas to show the keyboard shortcut overlay.

### Crop & marquee

| Action | Input |
|--------|--------|
| Toggle crop mode | **C** |
| Select all | **Cmd/Ctrl+A** |
| Shrink marquee (1px per side) | **`[`** |
| Expand marquee (1px per side) | **`]`** |
| Move marquee | **Arrow keys** (**Shift** = 10px) |
| Apply crop | **Enter** or sidebar button |
| Auto crop to content | Sidebar **Auto** preset |
| Full image ↔ trim to content | **Double-click inside** the marquee |
| Erase selection | **Delete** / **Backspace** (or eyedropper fill) |

### Zoom & navigation

| Action | Input |
|--------|--------|
| Zoom in / out | **+** / **-** or toolbar |
| Toggle **100% ↔ fit viewport** | **Cmd/Ctrl+0**, toolbar reset, or **double-click** on image when crop is off / outside the marquee |
| Pan | **Space** + drag |
| Magnify region on canvas | Hold **Z** + drag (preview panel bottom-right; **Esc** or release **Z** to exit) |

When crop mode is on, **double-click inside the marquee** still toggles full image ↔ trim to content. **Double-click outside** the marquee (or with crop off) toggles zoom fit ↔ 100%.

### Resize

1. Set target width/height or use the scale slider.
2. Click **Apply Resize** — image updates; sidebar shows the new pixel size at **100%** scale.
3. Large downscales use **stepped resizing** to reduce blur.

After **crop** or **resize**, the resize panel reflects the **current image dimensions** (not cleared to zero).

### Color & clipboard

- **Option/Alt** — live color preview; click to open format modal and copy.
- **Cmd/Ctrl+C** — copy image (optional format modal).
- **Cmd/Ctrl+S** — save.

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + S` | Save |
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + C` | Copy image to clipboard |
| `Cmd/Ctrl + A` | Select all (crop) |
| `Cmd/Ctrl + 0` | Toggle 100% ↔ fit to viewport |
| `Cmd/Ctrl + +` / `-` | Zoom in / out |
| `Cmd/Ctrl + [` / `]` | Rotate left / right |
| `Space + Drag` | Pan |
| `Z` (hold) + Drag | Magnify area on canvas |
| `Double-click` | 100% ↔ fit (no marquee / outside selection) |
| `Double-click` (in marquee) | Full image ↔ trim to content |
| `C` | Toggle crop mode |
| `W + Click` | Magic wand select |
| `Option/Alt + Click` | Pick color |
| `[` / `]` | Shrink / expand marquee (1px per side) |
| `↑ ↓ ← →` | Move marquee |
| `Enter` | Apply crop |
| `Del / Backspace` | Erase selection |
| `Esc` | Cancel loupe / modals / crop modes |

## Install

| Registry | Link |
|----------|------|
| VS Code Marketplace | [choihunchul.vsimage](https://marketplace.visualstudio.com/items?itemName=choihunchul.vsimage) |
| Open VSX (VSCodium, etc.) | [choihunchul/vsimage](https://open-vsx.org/extension/choihunchul/vsimage) |

Search for **VS Code Image Editor** (publisher: `choihunchul`).

## Development

```bash
npm install
npm run compile          # extension bundle
npm run compile-tests    # test TypeScript → out/
npm test                 # Extension Development Host integration tests (F5 environment)
```

Quick unit tests (marquee / resize panel logic, no VS Code runtime):

```bash
npm run compile-tests
npx mocha out/src/test/suite/marqueeDblclick.test.js out/src/test/suite/resizePanel.test.js --ui tdd
```

Press **F5** in VS Code to launch the **Extension Development Host**.

## Release & publish

Automated via GitHub Actions:

- **CI** — push/PR to `main` (build, test, VSIX)
- **Publish** — GitHub Release or `v*` tag ([publish action](https://github.com/choihunchul/github--actions/tree/main/publish-vscode-extension))

Manual publish:

```bash
npm run package
npm run publish:vsce   # VS Code Marketplace
npm run publish:ovsx   # Open VSX
```

Secrets: `VSCE_PAT` (Marketplace **Manage**), `OVSX_PAT` ([open-vsx.org](https://open-vsx.org/user-settings/tokens)).

## Links

- Repository: https://github.com/choihunchul/vsimage
- Issues: https://github.com/choihunchul/vsimage/issues
- Releases: https://github.com/choihunchul/vsimage/releases

## License

MIT © [choihunchul](https://github.com/choihunchul)
