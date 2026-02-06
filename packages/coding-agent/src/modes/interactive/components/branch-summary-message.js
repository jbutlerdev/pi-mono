"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BranchSummaryMessageComponent = void 0;
const pi_tui_1 = require("@mariozechner/pi-tui");
const theme_js_1 = require("../theme/theme.js");
const keybinding_hints_js_1 = require("./keybinding-hints.js");
/**
 * Component that renders a branch summary message with collapsed/expanded state.
 * Uses same background color as custom messages for visual consistency.
 */
class BranchSummaryMessageComponent extends pi_tui_1.Box {
    expanded = false;
    message;
    markdownTheme;
    constructor(message, markdownTheme = (0, theme_js_1.getMarkdownTheme)()) {
        super(1, 1, (t) => theme_js_1.theme.bg("customMessageBg", t));
        this.message = message;
        this.markdownTheme = markdownTheme;
        this.updateDisplay();
    }
    setExpanded(expanded) {
        this.expanded = expanded;
        this.updateDisplay();
    }
    invalidate() {
        super.invalidate();
        this.updateDisplay();
    }
    updateDisplay() {
        this.clear();
        const label = theme_js_1.theme.fg("customMessageLabel", `\x1b[1m[branch]\x1b[22m`);
        this.addChild(new pi_tui_1.Text(label, 0, 0));
        this.addChild(new pi_tui_1.Spacer(1));
        if (this.expanded) {
            const header = "**Branch Summary**\n\n";
            this.addChild(new pi_tui_1.Markdown(header + this.message.summary, 0, 0, this.markdownTheme, {
                color: (text) => theme_js_1.theme.fg("customMessageText", text),
            }));
        }
        else {
            this.addChild(new pi_tui_1.Text(theme_js_1.theme.fg("customMessageText", "Branch summary (") +
                theme_js_1.theme.fg("dim", (0, keybinding_hints_js_1.editorKey)("expandTools")) +
                theme_js_1.theme.fg("customMessageText", " to expand)"), 0, 0));
        }
    }
}
exports.BranchSummaryMessageComponent = BranchSummaryMessageComponent;
