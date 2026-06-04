import * as assert from 'assert';
import * as path from 'path';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logic = require(path.join(__dirname, '../../../../media/sidebarAutoCollapseLogic.js')) as {
    getSidebarAutoCollapseDelayMs: () => number;
    createSidebarAutoCollapseState: () => { enabled: boolean; collapsed: boolean };
    setSidebarAutoCollapseEnabled: (state: { enabled: boolean; collapsed: boolean }, enabled: boolean) => { enabled: boolean; collapsed: boolean };
    handleSidebarAutoCollapseMouseEnter: (state: { enabled: boolean; collapsed: boolean }) => { enabled: boolean; collapsed: boolean };
    handleSidebarAutoCollapseMouseLeave: (state: { enabled: boolean; collapsed: boolean }) => { enabled: boolean; collapsed: boolean };
};

suite('Sidebar auto collapse logic', () => {
    test('uses a calmer auto-collapse delay', () => {
        assert.strictEqual(logic.getSidebarAutoCollapseDelayMs(), 240);
    });

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
