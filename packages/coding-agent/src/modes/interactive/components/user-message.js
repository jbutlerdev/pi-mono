"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserMessageComponent = void 0;
const pi_tui_1 = require("@mariozechner/pi-tui");
const theme_js_1 = require("../theme/theme.js");
/**
 * Component that renders a user message
 */
class UserMessageComponent extends pi_tui_1.Container {
    constructor(text, markdownTheme = (0, theme_js_1.getMarkdownTheme)()) {
        super();
        this.addChild(new pi_tui_1.Spacer(1));
        this.addChild(new pi_tui_1.Markdown(text, 1, 1, markdownTheme, {
            bgColor: (text) => theme_js_1.theme.bg("userMessageBg", text),
            color: (text) => theme_js_1.theme.fg("userMessageText", text),
        }));
    }
}
exports.UserMessageComponent = UserMessageComponent;
