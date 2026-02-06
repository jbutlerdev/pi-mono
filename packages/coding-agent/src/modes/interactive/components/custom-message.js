"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomMessageComponent = void 0;
const pi_tui_1 = require("@mariozechner/pi-tui");
const theme_js_1 = require("../theme/theme.js");
/**
 * Component that renders a custom message entry from extensions.
 * Uses distinct styling to differentiate from user messages.
 */
class CustomMessageComponent extends pi_tui_1.Container {
    message;
    customRenderer;
    box;
    customComponent;
    markdownTheme;
    _expanded = false;
    constructor(message, customRenderer, markdownTheme = (0, theme_js_1.getMarkdownTheme)()) {
        super();
        this.message = message;
        this.customRenderer = customRenderer;
        this.markdownTheme = markdownTheme;
        this.addChild(new pi_tui_1.Spacer(1));
        // Create box with purple background (used for default rendering)
        this.box = new pi_tui_1.Box(1, 1, (t) => theme_js_1.theme.bg("customMessageBg", t));
        this.rebuild();
    }
    setExpanded(expanded) {
        if (this._expanded !== expanded) {
            this._expanded = expanded;
            this.rebuild();
        }
    }
    invalidate() {
        super.invalidate();
        this.rebuild();
    }
    rebuild() {
        // Remove previous content component
        if (this.customComponent) {
            this.removeChild(this.customComponent);
            this.customComponent = undefined;
        }
        this.removeChild(this.box);
        // Try custom renderer first - it handles its own styling
        if (this.customRenderer) {
            try {
                const component = this.customRenderer(this.message, { expanded: this._expanded }, theme_js_1.theme);
                if (component) {
                    // Custom renderer provides its own styled component
                    this.customComponent = component;
                    this.addChild(component);
                    return;
                }
            }
            catch (_a) {
                // Fall through to default rendering
            }
        }
        // Default rendering uses our box
        this.addChild(this.box);
        this.box.clear();
        // Default rendering: label + content
        const label = theme_js_1.theme.fg("customMessageLabel", `\x1b[1m[${this.message.customType}]\x1b[22m`);
        this.box.addChild(new pi_tui_1.Text(label, 0, 0));
        this.box.addChild(new pi_tui_1.Spacer(1));
        // Extract text content
        let text;
        if (typeof this.message.content === "string") {
            text = this.message.content;
        }
        else {
            text = this.message.content
                .filter((c) => c.type === "text")
                .map((c) => c.text)
                .join("\n");
        }
        this.box.addChild(new pi_tui_1.Markdown(text, 0, 0, this.markdownTheme, {
            color: (text) => theme_js_1.theme.fg("customMessageText", text),
        }));
    }
}
exports.CustomMessageComponent = CustomMessageComponent;
