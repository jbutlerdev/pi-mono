"use strict";
/**
 * Extension system types.
 *
 * Extensions are TypeScript modules that can:
 * - Subscribe to agent lifecycle events
 * - Register LLM-callable tools
 * - Register commands, keyboard shortcuts, and CLI flags
 * - Interact with the user via UI primitives
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBashToolResult = isBashToolResult;
exports.isReadToolResult = isReadToolResult;
exports.isEditToolResult = isEditToolResult;
exports.isWriteToolResult = isWriteToolResult;
exports.isGrepToolResult = isGrepToolResult;
exports.isFindToolResult = isFindToolResult;
exports.isLsToolResult = isLsToolResult;
exports.isToolCallEventType = isToolCallEventType;
// Type guards for ToolResultEvent
function isBashToolResult(e) {
    return e.toolName === "bash";
}
function isReadToolResult(e) {
    return e.toolName === "read";
}
function isEditToolResult(e) {
    return e.toolName === "edit";
}
function isWriteToolResult(e) {
    return e.toolName === "write";
}
function isGrepToolResult(e) {
    return e.toolName === "grep";
}
function isFindToolResult(e) {
    return e.toolName === "find";
}
function isLsToolResult(e) {
    return e.toolName === "ls";
}
function isToolCallEventType(toolName, event) {
    return event.toolName === toolName;
}
