"use strict";
/**
 * Utilities for formatting keybinding hints in the UI.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.editorKey = editorKey;
exports.appKey = appKey;
exports.keyHint = keyHint;
exports.appKeyHint = appKeyHint;
exports.rawKeyHint = rawKeyHint;
const pi_tui_1 = require("@mariozechner/pi-tui");
const theme_js_1 = require("../theme/theme.js");
/**
 * Format keys array as display string (e.g., ["ctrl+c", "escape"] -> "ctrl+c/escape").
 */
function formatKeys(keys) {
    if (keys.length === 0)
        return "";
    if (keys.length === 1)
        return keys[0];
    return keys.join("/");
}
/**
 * Get display string for an editor action.
 */
function editorKey(action) {
    return formatKeys((0, pi_tui_1.getEditorKeybindings)().getKeys(action));
}
/**
 * Get display string for an app action.
 */
function appKey(keybindings, action) {
    return formatKeys(keybindings.getKeys(action));
}
/**
 * Format a keybinding hint with consistent styling: dim key, muted description.
 * Looks up the key from editor keybindings automatically.
 *
 * @param action - Editor action name (e.g., "selectConfirm", "expandTools")
 * @param description - Description text (e.g., "to expand", "cancel")
 * @returns Formatted string with dim key and muted description
 */
function keyHint(action, description) {
    return theme_js_1.theme.fg("dim", editorKey(action)) + theme_js_1.theme.fg("muted", ` ${description}`);
}
/**
 * Format a keybinding hint for app-level actions.
 * Requires the KeybindingsManager instance.
 *
 * @param keybindings - KeybindingsManager instance
 * @param action - App action name (e.g., "interrupt", "externalEditor")
 * @param description - Description text
 * @returns Formatted string with dim key and muted description
 */
function appKeyHint(keybindings, action, description) {
    return theme_js_1.theme.fg("dim", appKey(keybindings, action)) + theme_js_1.theme.fg("muted", ` ${description}`);
}
/**
 * Format a raw key string with description (for non-configurable keys like ↑↓).
 *
 * @param key - Raw key string
 * @param description - Description text
 * @returns Formatted string with dim key and muted description
 */
function rawKeyHint(key, description) {
    return theme_js_1.theme.fg("dim", key) + theme_js_1.theme.fg("muted", ` ${description}`);
}
