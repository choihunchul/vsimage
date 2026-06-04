import * as assert from 'assert';
import * as path from 'path';

type ShortcutEvent = {
  key?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
};

type ShortcutLogic = {
  getShortcutAction(event: ShortcutEvent): string | null;
};

type ZoomLogic = {
  ratioAfterZoomAction(currentRatio: number, action: string): number | null;
  getCanvasSizeForZoomRatio(
    naturalWidth: number,
    naturalHeight: number,
    ratio: number
  ): { width: number; height: number } | null;
};

const shortcutLogic = require(path.join(__dirname, '../../../../media/shortcutLogic.js')) as ShortcutLogic;
const zoomLogic = require(path.join(__dirname, '../../../../media/zoomLogic.js')) as ZoomLogic;

suite('Zoom actions', () => {
  test('toolbar zoom actions change ratio in both directions', () => {
    assert.strictEqual(zoomLogic.ratioAfterZoomAction(1, 'zoomIn'), 1.1);
    assert.ok(Math.abs((zoomLogic.ratioAfterZoomAction(1, 'zoomOut') ?? 0) - 1 / 1.1) < 1e-12);
  });

  test('plain plus and minus shortcuts use the same zoom actions', () => {
    const zoomInAction = shortcutLogic.getShortcutAction({ key: '+' });
    const zoomOutAction = shortcutLogic.getShortcutAction({ key: '-' });

    assert.strictEqual(zoomInAction, 'zoomIn');
    assert.strictEqual(zoomOutAction, 'zoomOut');
    assert.strictEqual(zoomLogic.ratioAfterZoomAction(1, zoomInAction), 1.1);
    assert.ok(Math.abs((zoomLogic.ratioAfterZoomAction(1, zoomOutAction) ?? 0) - 1 / 1.1) < 1e-12);
  });

  test('zoom out action reduces the cropper container target size', () => {
    const ratio = zoomLogic.ratioAfterZoomAction(1, 'zoomOut');
    assert.notStrictEqual(ratio, null);

    const target = zoomLogic.getCanvasSizeForZoomRatio(640, 480, ratio!);
    assert.ok(target);
    assert.ok(target!.width < 640);
    assert.ok(target!.height < 480);
  });

  test('VS Code command plus and minus shortcuts are ignored', () => {
    assert.strictEqual(shortcutLogic.getShortcutAction({ key: '+', metaKey: true }), null);
    assert.strictEqual(shortcutLogic.getShortcutAction({ key: '-', metaKey: true }), null);
    assert.strictEqual(shortcutLogic.getShortcutAction({ key: '+', ctrlKey: true }), null);
    assert.strictEqual(shortcutLogic.getShortcutAction({ key: '-', ctrlKey: true }), null);
  });
});
