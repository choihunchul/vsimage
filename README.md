# VS Code Image Editor (vsimage)

Edit PNG, JPEG, WebP, and GIF images directly inside VS Code — crop, resize, rotate, flip, export, and pick colors without leaving the editor.

![Version](https://img.shields.io/github/v/release/choihunchul/vsimage?label=version)
![License](https://img.shields.io/github/license/choihunchul/vsimage)

## Features

- **Custom image editor** for `png`, `jpg`, `jpeg`, `webp`, `gif`
- **Crop** with presets (auto, free, 1:1, 16:9, 4:3, circle) and marquee tools
- **Magic wand** — select similar-color regions (tolerance slider)
- **Resize** with aspect-ratio lock and scale slider (10–200%)
- **Transform** — rotate, flip, zoom, pan (Space + drag)
- **Edit history** — thumbnail snapshots with one-click restore
- **Save flow** — dirty-state tracking, save prompt on close, untitled document support
- **Export** as PNG, JPEG, or WebP with quality control
- **Clipboard** — paste images in, copy edited images out (format & selection options)
- **Color picker** — hold **Option/Alt** over the image, click to sample, copy as HEX / RGB / RGBA / HSL / HSV / CMYK
- **Pixel rulers** with zoom-aware ticks
- **Undo** for destructive edits (Cmd/Ctrl+Z)
- **i18n** — English and Korean UI (follows VS Code display language)

## Usage

1. Open an image file in the workspace — choose **VS Code Image Editor** from “Open With” if prompted.
2. Or run **Command Palette → `vsimage: Create Empty Image Editor`** to start from file import, drag-and-drop, or clipboard paste.
3. Use the sidebar for crop, resize, history, and save/export. Use the floating toolbar for zoom and rotation.
4. Hold **Cmd/Ctrl** to show the keyboard shortcut cheatsheet overlay.

### Crop marquee tips

- Press **C** to toggle crop mode on/off.
- Double-click inside the marquee to toggle **full image ↔ trim to content**.
- Use **\[ / \]** to shrink or expand the marquee by 1px per side.
- Use **arrow keys** to move the marquee (**Shift** = 10px steps).

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
| `C` | Toggle crop mode |
| `W + Click` | Magic wand select |
| `Option/Alt + Click` | Pick color |
| `[` / `]` | Shrink / expand marquee |
| `↑ ↓ ← →` | Move marquee |
| `Enter` | Apply crop |
| `Del / Backspace` | Erase / fill selection |
| `Esc` | Cancel / dismiss |

## Install

| Registry | Link |
|----------|------|
| VS Code Marketplace | [choihunchul.vsimage](https://marketplace.visualstudio.com/items?itemName=choihunchul.vsimage) |
| Open VSX (VSCodium, etc.) | [choihunchul/vsimage](https://open-vsx.org/extension/choihunchul/vsimage) |

Or search for **VS Code Image Editor** (publisher: `choihunchul`).

## Development

```bash
npm install
npm run compile
npm test
# Press F5 in VS Code to launch Extension Development Host
```

## Release & publish

Releases are automated via GitHub Actions:

- **CI** — runs on push/PR to `main` (build, test, VSIX packaging)
- **Publish** — runs on GitHub Release or `v*` tag push ([composite action](https://github.com/choihunchul/github--actions/tree/main/publish-vscode-extension))

Manual publish (local):

```bash
npm run package
npm run publish:vsce   # VS Code Marketplace
npm run publish:ovsx   # Open VSX
```

Requires repository secrets `VSCE_PAT` (Azure DevOps PAT with Marketplace **Manage**) and `OVSX_PAT` ([open-vsx.org](https://open-vsx.org/user-settings/tokens)).

## Links

- Repository: https://github.com/choihunchul/vsimage
- Issues: https://github.com/choihunchul/vsimage/issues
- Releases: https://github.com/choihunchul/vsimage/releases

## License

MIT © [choihunchul](https://github.com/choihunchul)
