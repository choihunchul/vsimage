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
    test('defaults to select on image load', () => {
        assert.strictEqual(logic.DEFAULT_ACTIVE_TOOL, 'select');
    });

    test('returns to select after crop apply but keeps resize and mosaic active', () => {
        assert.strictEqual(logic.resolveToolAfterApply('crop', 'crop'), 'select');
        assert.strictEqual(logic.resolveToolAfterApply('resize', 'resize'), 'resize');
        assert.strictEqual(logic.resolveToolAfterApply('mosaic', 'mosaic'), 'mosaic');
    });

    test('maps existing shortcuts onto the matching tools', () => {
        assert.strictEqual(logic.resolveToolForShortcutAction('crop', 'select'), 'crop');
        assert.strictEqual(logic.resolveToolForShortcutAction('marquee', 'crop'), 'select');
        assert.strictEqual(logic.resolveToolForShortcutAction('mosaic', 'select'), 'mosaic');
        assert.strictEqual(logic.resolveToolForShortcutAction('move', 'select'), 'move');
    });

    test('enables crop only while crop tool is active', () => {
        assert.strictEqual(logic.shouldEnableCropForTool('crop'), true);
        assert.strictEqual(logic.shouldEnableCropForTool('resize'), false);
    });

    test('blocks marquee creation only while move tool is active', () => {
        assert.strictEqual(logic.shouldBlockMarqueeCreation('move'), true);
        assert.strictEqual(logic.shouldBlockMarqueeCreation('select'), false);
    });
});
