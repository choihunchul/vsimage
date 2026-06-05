'use strict';

const DEFAULT_ACTIVE_TOOL = 'select';

function normalizeTool(tool) {
    return tool || DEFAULT_ACTIVE_TOOL;
}

function resolveToolForShortcutAction(action, currentTool) {
    if (action === 'crop') {
        return 'crop';
    }
    if (action === 'marquee') {
        return 'select';
    }
    if (action === 'mosaic') {
        return 'mosaic';
    }
    if (action === 'move') {
        return 'move';
    }
    return normalizeTool(currentTool);
}

function resolveToolAfterApply(tool, applyKind) {
    if (applyKind === 'crop') {
        return 'select';
    }
    return normalizeTool(tool);
}

function shouldEnableCropForTool(tool) {
    return normalizeTool(tool) === 'crop';
}

function shouldBlockMarqueeCreation(tool) {
    return normalizeTool(tool) === 'move';
}

const api = {
    DEFAULT_ACTIVE_TOOL,
    resolveToolForShortcutAction,
    resolveToolAfterApply,
    shouldEnableCropForTool,
    shouldBlockMarqueeCreation
};

globalThis.VsimageToolRailLogic = api;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
}
