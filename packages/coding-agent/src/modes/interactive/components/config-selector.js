"use strict";
/**
 * TUI component for managing package resources (enable/disable)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigSelectorComponent = void 0;
const node_path_1 = require("node:path");
const pi_tui_1 = require("@mariozechner/pi-tui");
const config_js_1 = require("../../../config.js");
const theme_js_1 = require("../theme/theme.js");
const dynamic_border_js_1 = require("./dynamic-border.js");
const keybinding_hints_js_1 = require("./keybinding-hints.js");
const RESOURCE_TYPE_LABELS = {
    extensions: "Extensions",
    skills: "Skills",
    prompts: "Prompts",
    themes: "Themes",
};
function getGroupLabel(metadata) {
    if (metadata.origin === "package") {
        return `${metadata.source} (${metadata.scope})`;
    }
    // Top-level resources
    if (metadata.source === "auto") {
        return metadata.scope === "user" ? "User (~/.pi/agent/)" : "Project (.pi/)";
    }
    return metadata.scope === "user" ? "User settings" : "Project settings";
}
function buildGroups(resolved) {
    const groupMap = new Map();
    const addToGroup = (resources, resourceType) => {
        for (const res of resources) {
            const { path, enabled, metadata } = res;
            const groupKey = `${metadata.origin}:${metadata.scope}:${metadata.source}`;
            if (!groupMap.has(groupKey)) {
                groupMap.set(groupKey, {
                    key: groupKey,
                    label: getGroupLabel(metadata),
                    scope: metadata.scope,
                    origin: metadata.origin,
                    source: metadata.source,
                    subgroups: [],
                });
            }
            const group = groupMap.get(groupKey);
            const subgroupKey = `${groupKey}:${resourceType}`;
            let subgroup = group.subgroups.find((sg) => sg.type === resourceType);
            if (!subgroup) {
                subgroup = {
                    type: resourceType,
                    label: RESOURCE_TYPE_LABELS[resourceType],
                    items: [],
                };
                group.subgroups.push(subgroup);
            }
            const fileName = (0, node_path_1.basename)(path);
            const parentFolder = (0, node_path_1.basename)((0, node_path_1.dirname)(path));
            let displayName;
            if (resourceType === "extensions" && parentFolder !== "extensions") {
                displayName = `${parentFolder}/${fileName}`;
            }
            else if (resourceType === "skills" && fileName === "SKILL.md") {
                displayName = parentFolder;
            }
            else {
                displayName = fileName;
            }
            subgroup.items.push({
                path,
                enabled,
                metadata,
                resourceType,
                displayName,
                groupKey,
                subgroupKey,
            });
        }
    };
    addToGroup(resolved.extensions, "extensions");
    addToGroup(resolved.skills, "skills");
    addToGroup(resolved.prompts, "prompts");
    addToGroup(resolved.themes, "themes");
    // Sort groups: packages first, then top-level; user before project
    const groups = Array.from(groupMap.values());
    groups.sort((a, b) => {
        if (a.origin !== b.origin) {
            return a.origin === "package" ? -1 : 1;
        }
        if (a.scope !== b.scope) {
            return a.scope === "user" ? -1 : 1;
        }
        return a.source.localeCompare(b.source);
    });
    // Sort subgroups within each group by type order, and items by name
    const typeOrder = { extensions: 0, skills: 1, prompts: 2, themes: 3 };
    for (const group of groups) {
        group.subgroups.sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);
        for (const subgroup of group.subgroups) {
            subgroup.items.sort((a, b) => a.displayName.localeCompare(b.displayName));
        }
    }
    return groups;
}
class ConfigSelectorHeader {
    invalidate() { }
    render(width) {
        const title = theme_js_1.theme.bold("Resource Configuration");
        const sep = theme_js_1.theme.fg("muted", " · ");
        const hint = (0, keybinding_hints_js_1.rawKeyHint)("space", "toggle") + sep + (0, keybinding_hints_js_1.rawKeyHint)("esc", "close");
        const hintWidth = (0, pi_tui_1.visibleWidth)(hint);
        const titleWidth = (0, pi_tui_1.visibleWidth)(title);
        const spacing = Math.max(1, width - titleWidth - hintWidth);
        return [
            (0, pi_tui_1.truncateToWidth)(`${title}${" ".repeat(spacing)}${hint}`, width, ""),
            theme_js_1.theme.fg("muted", "Type to filter resources"),
        ];
    }
}
class ResourceList {
    groups;
    flatItems = [];
    filteredItems = [];
    selectedIndex = 0;
    searchInput;
    maxVisible = 15;
    settingsManager;
    cwd;
    agentDir;
    onCancel;
    onExit;
    onToggle;
    _focused = false;
    get focused() {
        return this._focused;
    }
    set focused(value) {
        this._focused = value;
        this.searchInput.focused = value;
    }
    constructor(groups, settingsManager, cwd, agentDir) {
        this.groups = groups;
        this.settingsManager = settingsManager;
        this.cwd = cwd;
        this.agentDir = agentDir;
        this.searchInput = new pi_tui_1.Input();
        this.buildFlatList();
        this.filteredItems = [...this.flatItems];
    }
    buildFlatList() {
        this.flatItems = [];
        for (const group of this.groups) {
            this.flatItems.push({ type: "group", group });
            for (const subgroup of group.subgroups) {
                this.flatItems.push({ type: "subgroup", subgroup, group });
                for (const item of subgroup.items) {
                    this.flatItems.push({ type: "item", item });
                }
            }
        }
        // Start selection on first item (not header)
        this.selectedIndex = this.flatItems.findIndex((e) => e.type === "item");
        if (this.selectedIndex < 0)
            this.selectedIndex = 0;
    }
    findNextItem(fromIndex, direction) {
        let idx = fromIndex + direction;
        while (idx >= 0 && idx < this.filteredItems.length) {
            if (this.filteredItems[idx].type === "item") {
                return idx;
            }
            idx += direction;
        }
        return fromIndex; // Stay at current if no item found
    }
    filterItems(query) {
        if (!query.trim()) {
            this.filteredItems = [...this.flatItems];
            this.selectFirstItem();
            return;
        }
        const lowerQuery = query.toLowerCase();
        const matchingItems = new Set();
        const matchingSubgroups = new Set();
        const matchingGroups = new Set();
        for (const entry of this.flatItems) {
            if (entry.type === "item") {
                const item = entry.item;
                if (item.displayName.toLowerCase().includes(lowerQuery) ||
                    item.resourceType.toLowerCase().includes(lowerQuery) ||
                    item.path.toLowerCase().includes(lowerQuery)) {
                    matchingItems.add(item);
                }
            }
        }
        // Find which subgroups and groups contain matching items
        for (const group of this.groups) {
            for (const subgroup of group.subgroups) {
                for (const item of subgroup.items) {
                    if (matchingItems.has(item)) {
                        matchingSubgroups.add(subgroup);
                        matchingGroups.add(group);
                    }
                }
            }
        }
        this.filteredItems = [];
        for (const entry of this.flatItems) {
            if (entry.type === "group" && matchingGroups.has(entry.group)) {
                this.filteredItems.push(entry);
            }
            else if (entry.type === "subgroup" && matchingSubgroups.has(entry.subgroup)) {
                this.filteredItems.push(entry);
            }
            else if (entry.type === "item" && matchingItems.has(entry.item)) {
                this.filteredItems.push(entry);
            }
        }
        this.selectFirstItem();
    }
    selectFirstItem() {
        const firstItemIndex = this.filteredItems.findIndex((e) => e.type === "item");
        this.selectedIndex = firstItemIndex >= 0 ? firstItemIndex : 0;
    }
    updateItem(item, enabled) {
        item.enabled = enabled;
        // Update in groups too
        for (const group of this.groups) {
            for (const subgroup of group.subgroups) {
                const found = subgroup.items.find((i) => i.path === item.path && i.resourceType === item.resourceType);
                if (found) {
                    found.enabled = enabled;
                    return;
                }
            }
        }
    }
    invalidate() { }
    render(width) {
        const lines = [];
        // Search input
        lines.push(...this.searchInput.render(width));
        lines.push("");
        if (this.filteredItems.length === 0) {
            lines.push(theme_js_1.theme.fg("muted", "  No resources found"));
            return lines;
        }
        // Calculate visible range
        const startIndex = Math.max(0, Math.min(this.selectedIndex - Math.floor(this.maxVisible / 2), this.filteredItems.length - this.maxVisible));
        const endIndex = Math.min(startIndex + this.maxVisible, this.filteredItems.length);
        for (let i = startIndex; i < endIndex; i++) {
            const entry = this.filteredItems[i];
            const isSelected = i === this.selectedIndex;
            if (entry.type === "group") {
                // Main group header (no cursor)
                const groupLine = theme_js_1.theme.fg("accent", theme_js_1.theme.bold(entry.group.label));
                lines.push((0, pi_tui_1.truncateToWidth)(`  ${groupLine}`, width, ""));
            }
            else if (entry.type === "subgroup") {
                // Subgroup header (indented, no cursor)
                const subgroupLine = theme_js_1.theme.fg("muted", entry.subgroup.label);
                lines.push((0, pi_tui_1.truncateToWidth)(`    ${subgroupLine}`, width, ""));
            }
            else {
                // Resource item (cursor only on items)
                const item = entry.item;
                const cursor = isSelected ? "> " : "  ";
                const checkbox = item.enabled ? theme_js_1.theme.fg("success", "[x]") : theme_js_1.theme.fg("dim", "[ ]");
                const name = isSelected ? theme_js_1.theme.bold(item.displayName) : item.displayName;
                lines.push((0, pi_tui_1.truncateToWidth)(`${cursor}    ${checkbox} ${name}`, width, "..."));
            }
        }
        // Scroll indicator
        if (startIndex > 0 || endIndex < this.filteredItems.length) {
            lines.push(theme_js_1.theme.fg("dim", `  (${this.selectedIndex + 1}/${this.filteredItems.length})`));
        }
        return lines;
    }
    handleInput(data) {
        var _a, _b, _c;
        const kb = (0, pi_tui_1.getEditorKeybindings)();
        if (kb.matches(data, "selectUp")) {
            this.selectedIndex = this.findNextItem(this.selectedIndex, -1);
            return;
        }
        if (kb.matches(data, "selectDown")) {
            this.selectedIndex = this.findNextItem(this.selectedIndex, 1);
            return;
        }
        if (kb.matches(data, "selectPageUp")) {
            // Jump up by maxVisible, then find nearest item
            let target = Math.max(0, this.selectedIndex - this.maxVisible);
            while (target < this.filteredItems.length && this.filteredItems[target].type !== "item") {
                target++;
            }
            if (target < this.filteredItems.length) {
                this.selectedIndex = target;
            }
            return;
        }
        if (kb.matches(data, "selectPageDown")) {
            // Jump down by maxVisible, then find nearest item
            let target = Math.min(this.filteredItems.length - 1, this.selectedIndex + this.maxVisible);
            while (target >= 0 && this.filteredItems[target].type !== "item") {
                target--;
            }
            if (target >= 0) {
                this.selectedIndex = target;
            }
            return;
        }
        if (kb.matches(data, "selectCancel")) {
            (_a = this.onCancel) === null || _a === void 0 ? void 0 : _a.call(this);
            return;
        }
        if ((0, pi_tui_1.matchesKey)(data, "ctrl+c")) {
            (_b = this.onExit) === null || _b === void 0 ? void 0 : _b.call(this);
            return;
        }
        if (data === " " || kb.matches(data, "selectConfirm")) {
            const entry = this.filteredItems[this.selectedIndex];
            if ((entry === null || entry === void 0 ? void 0 : entry.type) === "item") {
                const newEnabled = !entry.item.enabled;
                this.toggleResource(entry.item, newEnabled);
                this.updateItem(entry.item, newEnabled);
                (_c = this.onToggle) === null || _c === void 0 ? void 0 : _c.call(this, entry.item, newEnabled);
            }
            return;
        }
        // Pass to search input
        this.searchInput.handleInput(data);
        this.filterItems(this.searchInput.getValue());
    }
    toggleResource(item, enabled) {
        if (item.metadata.origin === "top-level") {
            this.toggleTopLevelResource(item, enabled);
        }
        else {
            this.togglePackageResource(item, enabled);
        }
    }
    toggleTopLevelResource(item, enabled) {
        var _a;
        const scope = item.metadata.scope;
        const settings = scope === "project" ? this.settingsManager.getProjectSettings() : this.settingsManager.getGlobalSettings();
        const arrayKey = item.resourceType;
        const current = ((_a = settings[arrayKey]) !== null && _a !== void 0 ? _a : []);
        // Generate pattern for this resource
        const pattern = this.getResourcePattern(item);
        const disablePattern = `-${pattern}`;
        const enablePattern = `+${pattern}`;
        // Filter out existing patterns for this resource
        const updated = current.filter((p) => {
            const stripped = p.startsWith("!") || p.startsWith("+") || p.startsWith("-") ? p.slice(1) : p;
            return stripped !== pattern;
        });
        if (enabled) {
            updated.push(enablePattern);
        }
        else {
            updated.push(disablePattern);
        }
        if (scope === "project") {
            if (arrayKey === "extensions") {
                this.settingsManager.setProjectExtensionPaths(updated);
            }
            else if (arrayKey === "skills") {
                this.settingsManager.setProjectSkillPaths(updated);
            }
            else if (arrayKey === "prompts") {
                this.settingsManager.setProjectPromptTemplatePaths(updated);
            }
            else if (arrayKey === "themes") {
                this.settingsManager.setProjectThemePaths(updated);
            }
        }
        else {
            if (arrayKey === "extensions") {
                this.settingsManager.setExtensionPaths(updated);
            }
            else if (arrayKey === "skills") {
                this.settingsManager.setSkillPaths(updated);
            }
            else if (arrayKey === "prompts") {
                this.settingsManager.setPromptTemplatePaths(updated);
            }
            else if (arrayKey === "themes") {
                this.settingsManager.setThemePaths(updated);
            }
        }
    }
    togglePackageResource(item, enabled) {
        var _a, _b;
        const scope = item.metadata.scope;
        const settings = scope === "project" ? this.settingsManager.getProjectSettings() : this.settingsManager.getGlobalSettings();
        const packages = [...((_a = settings.packages) !== null && _a !== void 0 ? _a : [])];
        const pkgIndex = packages.findIndex((pkg) => {
            const source = typeof pkg === "string" ? pkg : pkg.source;
            return source === item.metadata.source;
        });
        if (pkgIndex === -1)
            return;
        let pkg = packages[pkgIndex];
        // Convert string to object form if needed
        if (typeof pkg === "string") {
            pkg = { source: pkg };
            packages[pkgIndex] = pkg;
        }
        // Get the resource array for this type
        const arrayKey = item.resourceType;
        const current = ((_b = pkg[arrayKey]) !== null && _b !== void 0 ? _b : []);
        // Generate pattern relative to package root
        const pattern = this.getPackageResourcePattern(item);
        const disablePattern = `-${pattern}`;
        const enablePattern = `+${pattern}`;
        // Filter out existing patterns for this resource
        const updated = current.filter((p) => {
            const stripped = p.startsWith("!") || p.startsWith("+") || p.startsWith("-") ? p.slice(1) : p;
            return stripped !== pattern;
        });
        if (enabled) {
            updated.push(enablePattern);
        }
        else {
            updated.push(disablePattern);
        }
        pkg[arrayKey] = updated.length > 0 ? updated : undefined;
        // Clean up empty filter object
        const hasFilters = ["extensions", "skills", "prompts", "themes"].some((k) => pkg[k] !== undefined);
        if (!hasFilters) {
            packages[pkgIndex] = pkg.source;
        }
        if (scope === "project") {
            this.settingsManager.setProjectPackages(packages);
        }
        else {
            this.settingsManager.setPackages(packages);
        }
    }
    getTopLevelBaseDir(scope) {
        return scope === "project" ? (0, node_path_1.join)(this.cwd, config_js_1.CONFIG_DIR_NAME) : this.agentDir;
    }
    getResourcePattern(item) {
        const scope = item.metadata.scope;
        const baseDir = this.getTopLevelBaseDir(scope);
        return (0, node_path_1.relative)(baseDir, item.path);
    }
    getPackageResourcePattern(item) {
        var _a;
        const baseDir = (_a = item.metadata.baseDir) !== null && _a !== void 0 ? _a : (0, node_path_1.dirname)(item.path);
        return (0, node_path_1.relative)(baseDir, item.path);
    }
}
class ConfigSelectorComponent extends pi_tui_1.Container {
    resourceList;
    _focused = false;
    get focused() {
        return this._focused;
    }
    set focused(value) {
        this._focused = value;
        this.resourceList.focused = value;
    }
    constructor(resolvedPaths, settingsManager, cwd, agentDir, onClose, onExit, requestRender) {
        super();
        const groups = buildGroups(resolvedPaths);
        // Add header
        this.addChild(new pi_tui_1.Spacer(1));
        this.addChild(new dynamic_border_js_1.DynamicBorder());
        this.addChild(new pi_tui_1.Spacer(1));
        this.addChild(new ConfigSelectorHeader());
        this.addChild(new pi_tui_1.Spacer(1));
        // Resource list
        this.resourceList = new ResourceList(groups, settingsManager, cwd, agentDir);
        this.resourceList.onCancel = onClose;
        this.resourceList.onExit = onExit;
        this.resourceList.onToggle = () => requestRender();
        this.addChild(this.resourceList);
        // Bottom border
        this.addChild(new pi_tui_1.Spacer(1));
        this.addChild(new dynamic_border_js_1.DynamicBorder());
    }
    getResourceList() {
        return this.resourceList;
    }
}
exports.ConfigSelectorComponent = ConfigSelectorComponent;
