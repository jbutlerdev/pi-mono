"use strict";
/**
 * Simple text input component for extensions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtensionInputComponent = void 0;
const pi_tui_1 = require("@mariozechner/pi-tui");
const theme_js_1 = require("../theme/theme.js");
const countdown_timer_js_1 = require("./countdown-timer.js");
const dynamic_border_js_1 = require("./dynamic-border.js");
const keybinding_hints_js_1 = require("./keybinding-hints.js");
class ExtensionInputComponent extends pi_tui_1.Container {
    input;
    onSubmitCallback;
    onCancelCallback;
    titleText;
    baseTitle;
    countdown;
    // Focusable implementation - propagate to input for IME cursor positioning
    _focused = false;
    get focused() {
        return this._focused;
    }
    set focused(value) {
        this._focused = value;
        this.input.focused = value;
    }
    constructor(title, _placeholder, onSubmit, onCancel, opts) {
        super();
        this.onSubmitCallback = onSubmit;
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
        this.input = new pi_tui_1.Input();
        this.addChild(this.input);
        this.addChild(new pi_tui_1.Spacer(1));
        this.addChild(new pi_tui_1.Text(`${(0, keybinding_hints_js_1.keyHint)("selectConfirm", "submit")}  ${(0, keybinding_hints_js_1.keyHint)("selectCancel", "cancel")}`, 1, 0));
        this.addChild(new pi_tui_1.Spacer(1));
        this.addChild(new dynamic_border_js_1.DynamicBorder());
    }
    handleInput(keyData) {
        const kb = (0, pi_tui_1.getEditorKeybindings)();
        if (kb.matches(keyData, "selectConfirm") || keyData === "\n") {
            this.onSubmitCallback(this.input.getValue());
        }
        else if (kb.matches(keyData, "selectCancel")) {
            this.onCancelCallback();
        }
        else {
            this.input.handleInput(keyData);
        }
    }
    dispose() {
        var _a;
        (_a = this.countdown) === null || _a === void 0 ? void 0 : _a.dispose();
    }
}
exports.ExtensionInputComponent = ExtensionInputComponent;
