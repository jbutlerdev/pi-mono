"use strict";
/**
 * Generic selector component for extensions.
 * Displays a list of string options with keyboard navigation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtensionSelectorComponent = void 0;
const pi_tui_1 = require("@mariozechner/pi-tui");
const theme_js_1 = require("../theme/theme.js");
const countdown_timer_js_1 = require("./countdown-timer.js");
const dynamic_border_js_1 = require("./dynamic-border.js");
const keybinding_hints_js_1 = require("./keybinding-hints.js");
class ExtensionSelectorComponent extends pi_tui_1.Container {
    options;
    selectedIndex = 0;
    listContainer;
    onSelectCallback;
    onCancelCallback;
    titleText;
    baseTitle;
    countdown;
    constructor(title, options, onSelect, onCancel, opts) {
        super();
        this.options = options;
        this.onSelectCallback = onSelect;
        this.onCancelCallback = onCancel;
        this.baseTitle = title;
        this.addChild(new dynamic_border_js_1.DynamicBorder());
        this.addChild(new pi_tui_1.Spacer(1));
        this.titleText = new pi_tui_1.Text(theme_js_1.theme.fg("accent", title), 1, 0);
        this.addChild(this.titleText);
        this.addChild(new pi_tui_1.Spacer(1));
        if ((opts === null || opts === void 0 ? void 0 : opts.timeout) && opts.timeout > 0 && opts.tui) {
            this.countdown = new countdown_timer_js_1.CountdownTimer(opts.timeout, opts.tui, (s) => this.titleText.setText(theme_js_1.theme.fg("accent", `${this.baseTitle} (${s}s)`)), () => this.onCancelCallback());
        }
        this.listContainer = new pi_tui_1.Container();
        this.addChild(this.listContainer);
        this.addChild(new pi_tui_1.Spacer(1));
        this.addChild(new pi_tui_1.Text((0, keybinding_hints_js_1.rawKeyHint)("↑↓", "navigate") +
            "  " +
            (0, keybinding_hints_js_1.keyHint)("selectConfirm", "select") +
            "  " +
            (0, keybinding_hints_js_1.keyHint)("selectCancel", "cancel"), 1, 0));
        this.addChild(new pi_tui_1.Spacer(1));
        this.addChild(new dynamic_border_js_1.DynamicBorder());
        this.updateList();
    }
    updateList() {
        this.listContainer.clear();
        for (let i = 0; i < this.options.length; i++) {
            const isSelected = i === this.selectedIndex;
            const text = isSelected
                ? theme_js_1.theme.fg("accent", "→ ") + theme_js_1.theme.fg("accent", this.options[i])
                : `  ${theme_js_1.theme.fg("text", this.options[i])}`;
            this.listContainer.addChild(new pi_tui_1.Text(text, 1, 0));
        }
    }
    handleInput(keyData) {
        const kb = (0, pi_tui_1.getEditorKeybindings)();
        if (kb.matches(keyData, "selectUp") || keyData === "k") {
            this.selectedIndex = Math.max(0, this.selectedIndex - 1);
            this.updateList();
        }
        else if (kb.matches(keyData, "selectDown") || keyData === "j") {
            this.selectedIndex = Math.min(this.options.length - 1, this.selectedIndex + 1);
            this.updateList();
        }
        else if (kb.matches(keyData, "selectConfirm") || keyData === "\n") {
            const selected = this.options[this.selectedIndex];
            if (selected)
                this.onSelectCallback(selected);
        }
        else if (kb.matches(keyData, "selectCancel")) {
            this.onCancelCallback();
        }
    }
    dispose() {
        var _a;
        (_a = this.countdown) === null || _a === void 0 ? void 0 : _a.dispose();
    }
}
exports.ExtensionSelectorComponent = ExtensionSelectorComponent;
