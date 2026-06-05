'use strict';

const DEFAULT_ACTIVE_TOOL = 'cursor';

function normalizeTool(tool) {
    return tool || DEFAULT_ACTIVE_TOOL;
}

function resolveToolForShortcutAction(action, currentTool) {
    if (action === 'crop') {
        return 'crop';
    }

    if (action === 'marquee') {
        return 'cursor';
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
        return 'cursor';
    }

    if (applyKind === 'resize') {
        return 'resize';
    }

    if (applyKind === 'mosaic') {
        return 'mosaic';
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
