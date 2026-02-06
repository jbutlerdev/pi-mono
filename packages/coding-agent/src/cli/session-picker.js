"use strict";
/**
 * TUI session selector for --resume flag
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectSession = selectSession;
const pi_tui_1 = require("@mariozechner/pi-tui");
const keybindings_js_1 = require("../core/keybindings.js");
const session_selector_js_1 = require("../modes/interactive/components/session-selector.js");
/** Show TUI session selector and return selected session path or null if cancelled */
async function selectSession(currentSessionsLoader, allSessionsLoader) {
    return new Promise((resolve) => {
        const ui = new pi_tui_1.TUI(new pi_tui_1.ProcessTerminal());
        const keybindings = keybindings_js_1.KeybindingsManager.create();
        let resolved = false;
        const selector = new session_selector_js_1.SessionSelectorComponent(currentSessionsLoader, allSessionsLoader, (path) => {
            if (!resolved) {
                resolved = true;
                ui.stop();
                resolve(path);
            }
        }, () => {
            if (!resolved) {
                resolved = true;
                ui.stop();
                resolve(null);
            }
        }, () => {
            ui.stop();
            process.exit(0);
        }, () => ui.requestRender(), { showRenameHint: false, keybindings });
        ui.addChild(selector);
        ui.setFocus(selector.getSessionList());
        ui.start();
    });
}
