"use strict";
/**
 * TUI config selector for `pi config` command
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectConfig = selectConfig;
const pi_tui_1 = require("@mariozechner/pi-tui");
const config_selector_js_1 = require("../modes/interactive/components/config-selector.js");
const theme_js_1 = require("../modes/interactive/theme/theme.js");
/** Show TUI config selector and return when closed */
async function selectConfig(options) {
    // Initialize theme before showing TUI
    (0, theme_js_1.initTheme)(options.settingsManager.getTheme(), true);
    return new Promise((resolve) => {
        const ui = new pi_tui_1.TUI(new pi_tui_1.ProcessTerminal());
        let resolved = false;
        const selector = new config_selector_js_1.ConfigSelectorComponent(options.resolvedPaths, options.settingsManager, options.cwd, options.agentDir, () => {
            if (!resolved) {
                resolved = true;
                ui.stop();
                (0, theme_js_1.stopThemeWatcher)();
                resolve();
            }
        }, () => {
            ui.stop();
            (0, theme_js_1.stopThemeWatcher)();
            process.exit(0);
        }, () => ui.requestRender());
        ui.addChild(selector);
        ui.setFocus(selector.getResourceList());
        ui.start();
    });
}
