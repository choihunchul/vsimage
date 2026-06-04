import * as assert from 'assert';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logic = require(path.join(__dirname, '../../../../media/transformLogic.js')) as {
    rotationDelta: (action: string) => number | null;
    nextFlipState: (
        state: { scaleX: number; scaleY: number },
        action: string
    ) => { scaleX: number; scaleY: number };
};

suite('Transform logic', () => {
    test('maps rotation actions to quarter-turn deltas', () => {
        assert.strictEqual(logic.rotationDelta('rotateLeft'), -90);
        assert.strictEqual(logic.rotationDelta('rotateRight'), 90);
        assert.strictEqual(logic.rotationDelta('other'), null);
    });

    test('toggles horizontal and vertical scale independently', () => {
        assert.deepStrictEqual(logic.nextFlipState({ scaleX: 1, scaleY: 1 }, 'flipH'), {
            scaleX: -1,
            scaleY: 1
        });
        assert.deepStrictEqual(logic.nextFlipState({ scaleX: -1, scaleY: 1 }, 'flipV'), {
            scaleX: -1,
            scaleY: -1
        });
    });
});
