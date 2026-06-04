'use strict';

/**
 * Pure sidebar auto-collapse state transitions.
 * Loaded in the webview as globalThis.VsimageSidebarAutoCollapseLogic; required from Node tests.
 */

const SIDEBAR_AUTO_COLLAPSE_DELAY_MS = 240;

function createSidebarAutoCollapseState() {
    return {
        enabled: false,
        collapsed: false
    };
}

function getSidebarAutoCollapseDelayMs() {
    return SIDEBAR_AUTO_COLLAPSE_DELAY_MS;
}

function setSidebarAutoCollapseEnabled(state, enabled) {
    return {
        enabled: !!enabled,
        collapsed: false
    };
}

function handleSidebarAutoCollapseMouseEnter(state) {
    return state && state.enabled
        ? { enabled: true, collapsed: false }
        : state;
}

function handleSidebarAutoCollapseMouseLeave(state) {
    return state && state.enabled
        ? { enabled: true, collapsed: true }
        : state;
}

const api = {
    SIDEBAR_AUTO_COLLAPSE_DELAY_MS,
    getSidebarAutoCollapseDelayMs,
    createSidebarAutoCollapseState,
    setSidebarAutoCollapseEnabled,
    handleSidebarAutoCollapseMouseEnter,
    handleSidebarAutoCollapseMouseLeave
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}
if (typeof globalThis !== 'undefined') {
    globalThis.VsimageSidebarAutoCollapseLogic = api;
}
