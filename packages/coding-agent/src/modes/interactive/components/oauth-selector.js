"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuthSelectorComponent = void 0;
const pi_ai_1 = require("@mariozechner/pi-ai");
const pi_tui_1 = require("@mariozechner/pi-tui");
const theme_js_1 = require("../theme/theme.js");
const dynamic_border_js_1 = require("./dynamic-border.js");
/**
 * Component that renders an OAuth provider selector
 */
class OAuthSelectorComponent extends pi_tui_1.Container {
    listContainer;
    allProviders = [];
    selectedIndex = 0;
    mode;
    authStorage;
    onSelectCallback;
    onCancelCallback;
    constructor(mode, authStorage, onSelect, onCancel) {
        super();
        this.mode = mode;
        this.authStorage = authStorage;
        this.onSelectCallback = onSelect;
        this.onCancelCallback = onCancel;
        // Load all OAuth providers
        this.loadProviders();
        // Add top border
        this.addChild(new dynamic_border_js_1.DynamicBorder());
        this.addChild(new pi_tui_1.Spacer(1));
        // Add title
        const title = mode === "login" ? "Select provider to login:" : "Select provider to logout:";
        this.addChild(new pi_tui_1.TruncatedText(theme_js_1.theme.bold(title)));
        this.addChild(new pi_tui_1.Spacer(1));
        // Create list container
        this.listContainer = new pi_tui_1.Container();
        this.addChild(this.listContainer);
        this.addChild(new pi_tui_1.Spacer(1));
        // Add bottom border
        this.addChild(new dynamic_border_js_1.DynamicBorder());
        // Initial render
        this.updateList();
    }
    loadProviders() {
        this.allProviders = (0, pi_ai_1.getOAuthProviders)();
    }
    updateList() {
        this.listContainer.clear();
        for (let i = 0; i < this.allProviders.length; i++) {
            const provider = this.allProviders[i];
            if (!provider)
                continue;
            const isSelected = i === this.selectedIndex;
            // Check if user is logged in for this provider
            const credentials = this.authStorage.get(provider.id);
            const isLoggedIn = (credentials === null || credentials === void 0 ? void 0 : credentials.type) === "oauth";
            const statusIndicator = isLoggedIn ? theme_js_1.theme.fg("success", " ✓ logged in") : "";
            let line = "";
            if (isSelected) {
                const prefix = theme_js_1.theme.fg("accent", "→ ");
                const text = theme_js_1.theme.fg("accent", provider.name);
                line = prefix + text + statusIndicator;
            }
            else {
                const text = `  ${provider.name}`;
                line = text + statusIndicator;
            }
            this.listContainer.addChild(new pi_tui_1.TruncatedText(line, 0, 0));
        }
        // Show "no providers" if empty
        if (this.allProviders.length === 0) {
            const message = this.mode === "login" ? "No OAuth providers available" : "No OAuth providers logged in. Use /login first.";
            this.listContainer.addChild(new pi_tui_1.TruncatedText(theme_js_1.theme.fg("muted", `  ${message}`), 0, 0));
        }
    }
    handleInput(keyData) {
        const kb = (0, pi_tui_1.getEditorKeybindings)();
        // Up arrow
        if (kb.matches(keyData, "selectUp")) {
            this.selectedIndex = Math.max(0, this.selectedIndex - 1);
            this.updateList();
        }
        // Down arrow
        else if (kb.matches(keyData, "selectDown")) {
            this.selectedIndex = Math.min(this.allProviders.length - 1, this.selectedIndex + 1);
            this.updateList();
        }
        // Enter
        else if (kb.matches(keyData, "selectConfirm")) {
            const selectedProvider = this.allProviders[this.selectedIndex];
            if (selectedProvider) {
                this.onSelectCallback(selectedProvider.id);
            }
        }
        // Escape or Ctrl+C
        else if (kb.matches(keyData, "selectCancel")) {
            this.onCancelCallback();
        }
    }
}
exports.OAuthSelectorComponent = OAuthSelectorComponent;
