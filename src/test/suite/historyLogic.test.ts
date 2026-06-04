import * as assert from 'assert';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logic = require(path.join(__dirname, '../../../../media/historyLogic.js')) as {
    trimSnapshots: <T>(entries: T[], max: number) => T[];
    restoreSnapshot: <T>(entries: T[], index: number) => { entry: T; remaining: T[] } | null;
};

suite('History logic', () => {
    test('keeps the most recent snapshots within the limit', () => {
        assert.deepStrictEqual(logic.trimSnapshots(['a', 'b', 'c'], 2), ['b', 'c']);
        assert.deepStrictEqual(logic.trimSnapshots(['a'], 2), ['a']);
    });

    test('restores a snapshot and removes it and newer snapshots', () => {
        assert.deepStrictEqual(logic.restoreSnapshot(['a', 'b', 'c'], 1), {
            entry: 'b',
            remaining: ['a']
        });
    });

    test('rejects an invalid restore index', () => {
        assert.strictEqual(logic.restoreSnapshot(['a'], -1), null);
        assert.strictEqual(logic.restoreSnapshot(['a'], 1), null);
    });
});
