"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginDialogComponent = void 0;
const pi_ai_1 = require("@mariozechner/pi-ai");
const pi_tui_1 = require("@mariozechner/pi-tui");
const child_process_1 = require("child_process");
const theme_js_1 = require("../theme/theme.js");
const dynamic_border_js_1 = require("./dynamic-border.js");
const keybinding_hints_js_1 = require("./keybinding-hints.js");
/**
 * Login dialog component - replaces editor during OAuth login flow
 */
class LoginDialogComponent extends pi_tui_1.Container {
    onComplete;
    contentContainer;
    input;
    tui;
    abortController = new AbortController();
    inputResolver;
    inputRejecter;
    // Focusable implementation - propagate to input for IME cursor positioning
    _focused = false;
    get focused() {
        return this._focused;
    }
    set focused(value) {
        this._focused = value;
        this.input.focused = value;
    }
    constructor(tui, providerId, onComplete) {
        super();
        this.onComplete = onComplete;
        this.tui = tui;
        const providerInfo = (0, pi_ai_1.getOAuthProviders)().find((p) => p.id === providerId);
        const providerName = (providerInfo === null || providerInfo === void 0 ? void 0 : providerInfo.name) || providerId;
        // Top border
        this.addChild(new dynamic_border_js_1.DynamicBorder());
        // Title
        this.addChild(new pi_tui_1.Text(theme_js_1.theme.fg("warning", `Login to ${providerName}`), 1, 0));
        // Dynamic content area
        this.contentContainer = new pi_tui_1.Container();
        this.addChild(this.contentContainer);
        // Input (always present, used when needed)
        this.input = new pi_tui_1.Input();
        this.input.onSubmit = () => {
            if (this.inputResolver) {
                this.inputResolver(this.input.getValue());
                this.inputResolver = undefined;
                this.inputRejecter = undefined;
            }
        };
        this.input.onEscape = () => {
            this.cancel();
        };
        // Bottom border
        this.addChild(new dynamic_border_js_1.DynamicBorder());
    }
    get signal() {
        return this.abortController.signal;
    }
    cancel() {
        this.abortController.abort();
        if (this.inputRejecter) {
            this.inputRejecter(new Error("Login cancelled"));
            this.inputResolver = undefined;
            this.inputRejecter = undefined;
        }
        this.onComplete(false, "Login cancelled");
    }
    /**
     * Called by onAuth callback - show URL and optional instructions
     */
    showAuth(url, instructions) {
        this.contentContainer.clear();
        this.contentContainer.addChild(new pi_tui_1.Spacer(1));
        this.contentContainer.addChild(new pi_tui_1.Text(theme_js_1.theme.fg("accent", url), 1, 0));
        const clickHint = process.platform === "darwin" ? "Cmd+click to open" : "Ctrl+click to open";
        const hyperlink = `\x1b]8;;${url}\x07${clickHint}\x1b]8;;\x07`;
        this.contentContainer.addChild(new pi_tui_1.Text(theme_js_1.theme.fg("dim", hyperlink), 1, 0));
        if (instructions) {
            this.contentContainer.addChild(new pi_tui_1.Spacer(1));
            this.contentContainer.addChild(new pi_tui_1.Text(theme_js_1.theme.fg("warning", instructions), 1, 0));
        }
        // Try to open browser
        const openCmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
        (0, child_process_1.exec)(`${openCmd} "${url}"`);
        this.tui.requestRender();
    }
    /**
     * Show input for manual code/URL entry (for callback server providers)
     */
    showManualInput(prompt) {
        this.contentContainer.addChild(new pi_tui_1.Spacer(1));
        this.contentContainer.addChild(new pi_tui_1.Text(theme_js_1.theme.fg("dim", prompt), 1, 0));
        this.contentContainer.addChild(this.input);
        this.contentContainer.addChild(new pi_tui_1.Text(`(${(0, keybinding_hints_js_1.keyHint)("selectCancel", "to cancel")})`, 1, 0));
        this.tui.requestRender();
        return new Promise((resolve, reject) => {
            this.inputResolver = resolve;
            this.inputRejecter = reject;
        });
    }
    /**
     * Called by onPrompt callback - show prompt and wait for input
     * Note: Does NOT clear content, appends to existing (preserves URL from showAuth)
     */
    showPrompt(message, placeholder) {
        this.contentContainer.addChild(new pi_tui_1.Spacer(1));
        this.contentContainer.addChild(new pi_tui_1.Text(theme_js_1.theme.fg("text", message), 1, 0));
        if (placeholder) {
            this.contentContainer.addChild(new pi_tui_1.Text(theme_js_1.theme.fg("dim", `e.g., ${placeholder}`), 1, 0));
        }
        this.contentContainer.addChild(this.input);
        this.contentContainer.addChild(new pi_tui_1.Text(`(${(0, keybinding_hints_js_1.keyHint)("selectCancel", "to cancel,")} ${(0, keybinding_hints_js_1.keyHint)("selectConfirm", "to submit")})`, 1, 0));
        this.input.setValue("");
        this.tui.requestRender();
        return new Promise((resolve, reject) => {
            this.inputResolver = resolve;
            this.inputRejecter = reject;
        });
    }
    /**
     * Show waiting message (for polling flows like GitHub Copilot)
     */
    showWaiting(message) {
        this.contentContainer.addChild(new pi_tui_1.Spacer(1));
        this.contentContainer.addChild(new pi_tui_1.Text(theme_js_1.theme.fg("dim", message), 1, 0));
        this.contentContainer.addChild(new pi_tui_1.Text(`(${(0, keybinding_hints_js_1.keyHint)("selectCancel", "to cancel")})`, 1, 0));
        this.tui.requestRender();
    }
    /**
     * Called by onProgress callback
     */
    showProgress(message) {
        this.contentContainer.addChild(new pi_tui_1.Text(theme_js_1.theme.fg("dim", message), 1, 0));
        this.tui.requestRender();
    }
    handleInput(data) {
        const kb = (0, pi_tui_1.getEditorKeybindings)();
        if (kb.matches(data, "selectCancel")) {
            this.cancel();
            return;
        }
        // Pass to input
        this.input.handleInput(data);
    }
}
exports.LoginDialogComponent = LoginDialogComponent;
