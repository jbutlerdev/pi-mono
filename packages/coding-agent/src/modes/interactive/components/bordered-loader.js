"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BorderedLoader = void 0;
const pi_tui_1 = require("@mariozechner/pi-tui");
const dynamic_border_js_1 = require("./dynamic-border.js");
const keybinding_hints_js_1 = require("./keybinding-hints.js");
/** Loader wrapped with borders for extension UI */
class BorderedLoader extends pi_tui_1.Container {
    loader;
    cancellable;
    signalController;
    constructor(tui, theme, message, options) {
        var _a;
        super();
        this.cancellable = (_a = options === null || options === void 0 ? void 0 : options.cancellable) !== null && _a !== void 0 ? _a : true;
        const borderColor = (s) => theme.fg("border", s);
        this.addChild(new dynamic_border_js_1.DynamicBorder(borderColor));
        if (this.cancellable) {
            this.loader = new pi_tui_1.CancellableLoader(tui, (s) => theme.fg("accent", s), (s) => theme.fg("muted", s), message);
        }
        else {
            this.signalController = new AbortController();
            this.loader = new pi_tui_1.Loader(tui, (s) => theme.fg("accent", s), (s) => theme.fg("muted", s), message);
        }
        this.addChild(this.loader);
        if (this.cancellable) {
            this.addChild(new pi_tui_1.Spacer(1));
            this.addChild(new pi_tui_1.Text((0, keybinding_hints_js_1.keyHint)("selectCancel", "cancel"), 1, 0));
        }
        this.addChild(new pi_tui_1.Spacer(1));
        this.addChild(new dynamic_border_js_1.DynamicBorder(borderColor));
    }
    get signal() {
        var _a;
        var _b;
        if (this.cancellable) {
            return this.loader.signal;
        }
        return (_b = (_a = this.signalController) === null || _a === void 0 ? void 0 : _a.signal) !== null && _b !== void 0 ? _b : new AbortController().signal;
    }
    set onAbort(fn) {
        if (this.cancellable) {
            this.loader.onAbort = fn;
        }
    }
    handleInput(data) {
        if (this.cancellable) {
            this.loader.handleInput(data);
        }
    }
    dispose() {
        if ("dispose" in this.loader && typeof this.loader.dispose === "function") {
            this.loader.dispose();
        }
    }
}
exports.BorderedLoader = BorderedLoader;
