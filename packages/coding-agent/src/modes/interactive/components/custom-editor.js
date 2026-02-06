"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomEditor = void 0;
const pi_tui_1 = require("@mariozechner/pi-tui");
/**
 * Custom editor that handles app-level keybindings for coding-agent.
 */
class CustomEditor extends pi_tui_1.Editor {
    keybindings;
    actionHandlers = new Map();
    // Special handlers that can be dynamically replaced
    onEscape;
    onCtrlD;
    onPasteImage;
    /** Handler for extension-registered shortcuts. Returns true if handled. */
    onExtensionShortcut;
    constructor(tui, theme, keybindings, options) {
        super(tui, theme, options);
        this.keybindings = keybindings;
    }
    /**
     * Register a handler for an app action.
     */
    onAction(action, handler) {
        this.actionHandlers.set(action, handler);
    }
    handleInput(data) {
        var _a, _b;
        var _c, _d;
        // Check extension-registered shortcuts first
        if ((_a = this.onExtensionShortcut) === null || _a === void 0 ? void 0 : _a.call(this, data)) {
            return;
        }
        // Check for paste image keybinding
        if (this.keybindings.matches(data, "pasteImage")) {
            (_b = this.onPasteImage) === null || _b === void 0 ? void 0 : _b.call(this);
            return;
        }
        // Check app keybindings first
        // Escape/interrupt - only if autocomplete is NOT active
        if (this.keybindings.matches(data, "interrupt")) {
            if (!this.isShowingAutocomplete()) {
                // Use dynamic onEscape if set, otherwise registered handler
                const handler = (_c = this.onEscape) !== null && _c !== void 0 ? _c : this.actionHandlers.get("interrupt");
                if (handler) {
                    handler();
                    return;
                }
            }
            // Let parent handle escape for autocomplete cancellation
            super.handleInput(data);
            return;
        }
        // Exit (Ctrl+D) - only when editor is empty
        if (this.keybindings.matches(data, "exit")) {
            if (this.getText().length === 0) {
                const handler = (_d = this.onCtrlD) !== null && _d !== void 0 ? _d : this.actionHandlers.get("exit");
                if (handler)
                    handler();
                return;
            }
            // Fall through to editor handling for delete-char-forward when not empty
        }
        // Check all other app actions
        for (const [action, handler] of this.actionHandlers) {
            if (action !== "interrupt" && action !== "exit" && this.keybindings.matches(data, action)) {
                handler();
                return;
            }
        }
        // Pass to parent for editor handling
        super.handleInput(data);
    }
}
exports.CustomEditor = CustomEditor;
