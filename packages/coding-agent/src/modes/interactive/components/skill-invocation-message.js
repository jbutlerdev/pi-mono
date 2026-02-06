"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillInvocationMessageComponent = void 0;
const pi_tui_1 = require("@mariozechner/pi-tui");
const theme_js_1 = require("../theme/theme.js");
const keybinding_hints_js_1 = require("./keybinding-hints.js");
/**
 * Component that renders a skill invocation message with collapsed/expanded state.
 * Uses same background color as custom messages for visual consistency.
 * Only renders the skill block itself - user message is rendered separately.
 */
class SkillInvocationMessageComponent extends pi_tui_1.Box {
    expanded = false;
    skillBlock;
    markdownTheme;
    constructor(skillBlock, markdownTheme = (0, theme_js_1.getMarkdownTheme)()) {
        super(1, 1, (t) => theme_js_1.theme.bg("customMessageBg", t));
        this.skillBlock = skillBlock;
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
        if (this.expanded) {
            // Expanded: label + skill name header + full content
            const label = theme_js_1.theme.fg("customMessageLabel", `\x1b[1m[skill]\x1b[22m`);
            this.addChild(new pi_tui_1.Text(label, 0, 0));
            const header = `**${this.skillBlock.name}**\n\n`;
            this.addChild(new pi_tui_1.Markdown(header + this.skillBlock.content, 0, 0, this.markdownTheme, {
                color: (text) => theme_js_1.theme.fg("customMessageText", text),
            }));
        }
        else {
            // Collapsed: single line - [skill] name (hint to expand)
            const line = theme_js_1.theme.fg("customMessageLabel", `\x1b[1m[skill]\x1b[22m `) +
                theme_js_1.theme.fg("customMessageText", this.skillBlock.name) +
                theme_js_1.theme.fg("dim", ` (${(0, keybinding_hints_js_1.editorKey)("expandTools")} to expand)`);
            this.addChild(new pi_tui_1.Text(line, 0, 0));
        }
    }
}
exports.SkillInvocationMessageComponent = SkillInvocationMessageComponent;
