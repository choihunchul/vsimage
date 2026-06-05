'use strict';

const DEFAULT_ACTIVE_TOOL = 'cursor';

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

    return currentTool || DEFAULT_ACTIVE_TOOL;
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

    return tool || DEFAULT_ACTIVE_TOOL;
}

function shouldEnableCropForTool(tool) {
    return tool === 'crop';
}

function shouldBlockMarqueeCreation(tool) {
    return tool === 'move';
}

module.exports = {
    DEFAULT_ACTIVE_TOOL,
    resolveToolForShortcutAction,
    resolveToolAfterApply,
    shouldEnableCropForTool,
    shouldBlockMarqueeCreation
};
