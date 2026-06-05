import * as assert from 'assert';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logic = require(path.join(__dirname, '../../../../media/toolRailLogic.js')) as {
    DEFAULT_ACTIVE_TOOL: string;
    resolveToolForShortcutAction: (action: string | null, currentTool: string) => string;
    resolveToolAfterApply: (tool: string, applyKind: 'crop' | 'resize' | 'mosaic') => string;
    shouldEnableCropForTool: (tool: string) => boolean;
    shouldBlockMarqueeCreation: (tool: string) => boolean;
};

suite('Tool rail logic', () => {
    test('defaults to cursor and resolves shortcut actions to the expected tools', () => {
        assert.strictEqual(logic.DEFAULT_ACTIVE_TOOL, 'cursor');
        assert.strictEqual(logic.resolveToolForShortcutAction('crop', 'cursor'), 'crop');
        assert.strictEqual(logic.resolveToolForShortcutAction('marquee', 'crop'), 'cursor');
        assert.strictEqual(logic.resolveToolForShortcutAction('mosaic', 'cursor'), 'mosaic');
        assert.strictEqual(logic.resolveToolForShortcutAction('move', 'cursor'), 'move');
    });

    test('resolves the active tool after apply based on the action kind', () => {
        assert.strictEqual(logic.resolveToolAfterApply('crop', 'crop'), 'cursor');
        assert.strictEqual(logic.resolveToolAfterApply('resize', 'resize'), 'resize');
        assert.strictEqual(logic.resolveToolAfterApply('mosaic', 'mosaic'), 'mosaic');
    });

    test('toggles crop and marquee gating from the active tool', () => {
        assert.strictEqual(logic.shouldEnableCropForTool('crop'), true);
        assert.strictEqual(logic.shouldEnableCropForTool('cursor'), false);
        assert.strictEqual(logic.shouldBlockMarqueeCreation('move'), true);
        assert.strictEqual(logic.shouldBlockMarqueeCreation('cursor'), false);
    });
});
