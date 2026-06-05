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
        return 'marquee';
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
    const activeTool = normalizeTool(tool);
    return activeTool === 'crop' || activeTool === 'marquee';
}

function shouldBlockMarqueeCreation(tool) {
    const activeTool = normalizeTool(tool);
    return activeTool !== 'crop' && activeTool !== 'marquee';
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
