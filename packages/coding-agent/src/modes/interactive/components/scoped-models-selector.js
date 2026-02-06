"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScopedModelsSelectorComponent = void 0;
const pi_tui_1 = require("@mariozechner/pi-tui");
const theme_js_1 = require("../theme/theme.js");
const dynamic_border_js_1 = require("./dynamic-border.js");
function isEnabled(enabledIds, id) {
    return enabledIds === null || enabledIds.includes(id);
}
function toggle(enabledIds, id) {
    if (enabledIds === null)
        return [id]; // First toggle: start with only this one
    const index = enabledIds.indexOf(id);
    if (index >= 0)
        return [...enabledIds.slice(0, index), ...enabledIds.slice(index + 1)];
    return [...enabledIds, id];
}
function enableAll(enabledIds, allIds, targetIds) {
    if (enabledIds === null)
        return null; // Already all enabled
    const targets = targetIds !== null && targetIds !== void 0 ? targetIds : allIds;
    const result = [...enabledIds];
    for (const id of targets) {
        if (!result.includes(id))
            result.push(id);
    }
    return result.length === allIds.length ? null : result;
}
function clearAll(enabledIds, allIds, targetIds) {
    if (enabledIds === null) {
        return targetIds ? allIds.filter((id) => !targetIds.includes(id)) : [];
    }
    const targets = new Set(targetIds !== null && targetIds !== void 0 ? targetIds : enabledIds);
    return enabledIds.filter((id) => !targets.has(id));
}
function move(enabledIds, allIds, id, delta) {
    const list = enabledIds !== null && enabledIds !== void 0 ? enabledIds : [...allIds];
    const index = list.indexOf(id);
    if (index < 0)
        return list;
    const newIndex = index + delta;
    if (newIndex < 0 || newIndex >= list.length)
        return list;
    const result = [...list];
    [result[index], result[newIndex]] = [result[newIndex], result[index]];
    return result;
}
function getSortedIds(enabledIds, allIds) {
    if (enabledIds === null)
        return allIds;
    const enabledSet = new Set(enabledIds);
    return [...enabledIds, ...allIds.filter((id) => !enabledSet.has(id))];
}
/**
 * Component for enabling/disabling models for Ctrl+P cycling.
 * Changes are session-only until explicitly persisted with Ctrl+S.
 */
class ScopedModelsSelectorComponent extends pi_tui_1.Container {
    modelsById = new Map();
    allIds = [];
    enabledIds = null;
    filteredItems = [];
    selectedIndex = 0;
    searchInput;
    // Focusable implementation - propagate to searchInput for IME cursor positioning
    _focused = false;
    get focused() {
        return this._focused;
    }
    set focused(value) {
        this._focused = value;
        this.searchInput.focused = value;
    }
    listContainer;
    footerText;
    callbacks;
    maxVisible = 15;
    isDirty = false;
    constructor(config, callbacks) {
        super();
        this.callbacks = callbacks;
        for (const model of config.allModels) {
            const fullId = `${model.provider}/${model.id}`;
            this.modelsById.set(fullId, model);
            this.allIds.push(fullId);
        }
        this.enabledIds = config.hasEnabledModelsFilter ? [...config.enabledModelIds] : null;
        this.filteredItems = this.buildItems();
        // Header
        this.addChild(new dynamic_border_js_1.DynamicBorder());
        this.addChild(new pi_tui_1.Spacer(1));
        this.addChild(new pi_tui_1.Text(theme_js_1.theme.fg("accent", theme_js_1.theme.bold("Model Configuration")), 0, 0));
        this.addChild(new pi_tui_1.Text(theme_js_1.theme.fg("muted", "Session-only. Ctrl+S to save to settings."), 0, 0));
        this.addChild(new pi_tui_1.Spacer(1));
        // Search input
        this.searchInput = new pi_tui_1.Input();
        this.addChild(this.searchInput);
        this.addChild(new pi_tui_1.Spacer(1));
        // List container
        this.listContainer = new pi_tui_1.Container();
        this.addChild(this.listContainer);
        // Footer hint
        this.addChild(new pi_tui_1.Spacer(1));
        this.footerText = new pi_tui_1.Text(this.getFooterText(), 0, 0);
        this.addChild(this.footerText);
        this.addChild(new dynamic_border_js_1.DynamicBorder());
        this.updateList();
    }
    buildItems() {
        // Filter out IDs that no longer have a corresponding model (e.g., after logout)
        return getSortedIds(this.enabledIds, this.allIds)
            .filter((id) => this.modelsById.has(id))
            .map((id) => ({
            fullId: id,
            model: this.modelsById.get(id),
            enabled: isEnabled(this.enabledIds, id),
        }));
    }
    getFooterText() {
        var _a;
        var _b;
        const enabledCount = (_b = (_a = this.enabledIds) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : this.allIds.length;
        const allEnabled = this.enabledIds === null;
        const countText = allEnabled ? "all enabled" : `${enabledCount}/${this.allIds.length} enabled`;
        const parts = ["Enter toggle", "^A all", "^X clear", "^P provider", "Alt+↑↓ reorder", "^S save", countText];
        return this.isDirty
            ? theme_js_1.theme.fg("dim", `  ${parts.join(" · ")} `) + theme_js_1.theme.fg("warning", "(unsaved)")
            : theme_js_1.theme.fg("dim", `  ${parts.join(" · ")}`);
    }
    refresh() {
        const query = this.searchInput.getValue();
        const items = this.buildItems();
        this.filteredItems = query ? (0, pi_tui_1.fuzzyFilter)(items, query, (i) => `${i.model.id} ${i.model.provider}`) : items;
        this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.filteredItems.length - 1));
        this.updateList();
        this.footerText.setText(this.getFooterText());
    }
    updateList() {
        this.listContainer.clear();
        if (this.filteredItems.length === 0) {
            this.listContainer.addChild(new pi_tui_1.Text(theme_js_1.theme.fg("muted", "  No matching models"), 0, 0));
            return;
        }
        const startIndex = Math.max(0, Math.min(this.selectedIndex - Math.floor(this.maxVisible / 2), this.filteredItems.length - this.maxVisible));
        const endIndex = Math.min(startIndex + this.maxVisible, this.filteredItems.length);
        const allEnabled = this.enabledIds === null;
        for (let i = startIndex; i < endIndex; i++) {
            const item = this.filteredItems[i];
            const isSelected = i === this.selectedIndex;
            const prefix = isSelected ? theme_js_1.theme.fg("accent", "→ ") : "  ";
            const modelText = isSelected ? theme_js_1.theme.fg("accent", item.model.id) : item.model.id;
            const providerBadge = theme_js_1.theme.fg("muted", ` [${item.model.provider}]`);
            const status = allEnabled ? "" : item.enabled ? theme_js_1.theme.fg("success", " ✓") : theme_js_1.theme.fg("dim", " ✗");
            this.listContainer.addChild(new pi_tui_1.Text(`${prefix}${modelText}${providerBadge}${status}`, 0, 0));
        }
        // Add scroll indicator if needed
        if (startIndex > 0 || endIndex < this.filteredItems.length) {
            this.listContainer.addChild(new pi_tui_1.Text(theme_js_1.theme.fg("muted", `  (${this.selectedIndex + 1}/${this.filteredItems.length})`), 0, 0));
        }
        if (this.filteredItems.length > 0) {
            const selected = this.filteredItems[this.selectedIndex];
            this.listContainer.addChild(new pi_tui_1.Spacer(1));
            this.listContainer.addChild(new pi_tui_1.Text(theme_js_1.theme.fg("muted", `  Model Name: ${selected.model.name}`), 0, 0));
        }
    }
    handleInput(data) {
        var _a, _b;
        const kb = (0, pi_tui_1.getEditorKeybindings)();
        // Navigation
        if (kb.matches(data, "selectUp")) {
            if (this.filteredItems.length === 0)
                return;
            this.selectedIndex = this.selectedIndex === 0 ? this.filteredItems.length - 1 : this.selectedIndex - 1;
            this.updateList();
            return;
        }
        if (kb.matches(data, "selectDown")) {
            if (this.filteredItems.length === 0)
                return;
            this.selectedIndex = this.selectedIndex === this.filteredItems.length - 1 ? 0 : this.selectedIndex + 1;
            this.updateList();
            return;
        }
        // Alt+Up/Down - Reorder enabled models
        if ((0, pi_tui_1.matchesKey)(data, pi_tui_1.Key.alt("up")) || (0, pi_tui_1.matchesKey)(data, pi_tui_1.Key.alt("down"))) {
            const item = this.filteredItems[this.selectedIndex];
            if (item && isEnabled(this.enabledIds, item.fullId)) {
                const delta = (0, pi_tui_1.matchesKey)(data, pi_tui_1.Key.alt("up")) ? -1 : 1;
                const enabledList = (_a = this.enabledIds) !== null && _a !== void 0 ? _a : this.allIds;
                const currentIndex = enabledList.indexOf(item.fullId);
                const newIndex = currentIndex + delta;
                // Only move if within bounds
                if (newIndex >= 0 && newIndex < enabledList.length) {
                    this.enabledIds = move(this.enabledIds, this.allIds, item.fullId, delta);
                    this.isDirty = true;
                    this.selectedIndex += delta;
                    this.refresh();
                }
            }
            return;
        }
        // Toggle on Enter
        if ((0, pi_tui_1.matchesKey)(data, pi_tui_1.Key.enter)) {
            const item = this.filteredItems[this.selectedIndex];
            if (item) {
                const wasAllEnabled = this.enabledIds === null;
                this.enabledIds = toggle(this.enabledIds, item.fullId);
                this.isDirty = true;
                if (wasAllEnabled)
                    this.callbacks.onClearAll();
                this.callbacks.onModelToggle(item.fullId, isEnabled(this.enabledIds, item.fullId));
                this.refresh();
            }
            return;
        }
        // Ctrl+A - Enable all (filtered if search active, otherwise all)
        if ((0, pi_tui_1.matchesKey)(data, pi_tui_1.Key.ctrl("a"))) {
            const targetIds = this.searchInput.getValue() ? this.filteredItems.map((i) => i.fullId) : undefined;
            this.enabledIds = enableAll(this.enabledIds, this.allIds, targetIds);
            this.isDirty = true;
            this.callbacks.onEnableAll(targetIds !== null && targetIds !== void 0 ? targetIds : this.allIds);
            this.refresh();
            return;
        }
        // Ctrl+X - Clear all (filtered if search active, otherwise all)
        if ((0, pi_tui_1.matchesKey)(data, pi_tui_1.Key.ctrl("x"))) {
            const targetIds = this.searchInput.getValue() ? this.filteredItems.map((i) => i.fullId) : undefined;
            this.enabledIds = clearAll(this.enabledIds, this.allIds, targetIds);
            this.isDirty = true;
            this.callbacks.onClearAll();
            this.refresh();
            return;
        }
        // Ctrl+P - Toggle provider of current item
        if ((0, pi_tui_1.matchesKey)(data, pi_tui_1.Key.ctrl("p"))) {
            const item = this.filteredItems[this.selectedIndex];
            if (item) {
                const provider = item.model.provider;
                const providerIds = this.allIds.filter((id) => this.modelsById.get(id).provider === provider);
                const allEnabled = providerIds.every((id) => isEnabled(this.enabledIds, id));
                this.enabledIds = allEnabled
                    ? clearAll(this.enabledIds, this.allIds, providerIds)
                    : enableAll(this.enabledIds, this.allIds, providerIds);
                this.isDirty = true;
                this.callbacks.onToggleProvider(provider, providerIds, !allEnabled);
                this.refresh();
            }
            return;
        }
        // Ctrl+S - Save/persist to settings
        if ((0, pi_tui_1.matchesKey)(data, pi_tui_1.Key.ctrl("s"))) {
            this.callbacks.onPersist((_b = this.enabledIds) !== null && _b !== void 0 ? _b : [...this.allIds]);
            this.isDirty = false;
            this.footerText.setText(this.getFooterText());
            return;
        }
        // Ctrl+C - clear search or cancel if empty
        if ((0, pi_tui_1.matchesKey)(data, pi_tui_1.Key.ctrl("c"))) {
            if (this.searchInput.getValue()) {
                this.searchInput.setValue("");
                this.refresh();
            }
            else {
                this.callbacks.onCancel();
            }
            return;
        }
        // Escape - cancel
        if ((0, pi_tui_1.matchesKey)(data, pi_tui_1.Key.escape)) {
            this.callbacks.onCancel();
            return;
        }
        // Pass everything else to search input
        this.searchInput.handleInput(data);
        this.refresh();
    }
    getSearchInput() {
        return this.searchInput;
    }
}
exports.ScopedModelsSelectorComponent = ScopedModelsSelectorComponent;
