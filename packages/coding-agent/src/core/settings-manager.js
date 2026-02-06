"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsManager = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const config_js_1 = require("../config.js");
/** Deep merge settings: project/overrides take precedence, nested objects merge recursively */
function deepMergeSettings(base, overrides) {
    const result = Object.assign({}, base);
    for (const key of Object.keys(overrides)) {
        const overrideValue = overrides[key];
        const baseValue = base[key];
        if (overrideValue === undefined) {
            continue;
        }
        // For nested objects, merge recursively
        if (typeof overrideValue === "object" &&
            overrideValue !== null &&
            !Array.isArray(overrideValue) &&
            typeof baseValue === "object" &&
            baseValue !== null &&
            !Array.isArray(baseValue)) {
            result[key] = Object.assign(Object.assign({}, baseValue), overrideValue);
        }
        else {
            // For primitives and arrays, override value wins
            result[key] = overrideValue;
        }
    }
    return result;
}
class SettingsManager {
    settingsPath;
    projectSettingsPath;
    globalSettings;
    inMemoryProjectSettings; // For in-memory mode
    settings;
    persist;
    modifiedFields = new Set(); // Track fields modified during session
    modifiedNestedFields = new Map(); // Track nested field modifications
    globalSettingsLoadError = null; // Track if settings file had parse errors
    constructor(settingsPath, projectSettingsPath, initialSettings, persist, loadError = null) {
        this.settingsPath = settingsPath;
        this.projectSettingsPath = projectSettingsPath;
        this.persist = persist;
        this.globalSettings = initialSettings;
        this.inMemoryProjectSettings = {};
        this.globalSettingsLoadError = loadError;
        const projectSettings = this.loadProjectSettings();
        this.settings = deepMergeSettings(this.globalSettings, projectSettings);
    }
    /** Create a SettingsManager that loads from files */
    static create(cwd = process.cwd(), agentDir = (0, config_js_1.getAgentDir)()) {
        const settingsPath = (0, path_1.join)(agentDir, "settings.json");
        const projectSettingsPath = (0, path_1.join)(cwd, config_js_1.CONFIG_DIR_NAME, "settings.json");
        let globalSettings = {};
        let loadError = null;
        try {
            globalSettings = SettingsManager.loadFromFile(settingsPath);
        }
        catch (error) {
            loadError = error;
            console.error(`Warning: Invalid JSON in ${settingsPath}: ${error}`);
            console.error(`Fix the syntax error to enable settings persistence.`);
        }
        return new SettingsManager(settingsPath, projectSettingsPath, globalSettings, true, loadError);
    }
    /** Create an in-memory SettingsManager (no file I/O) */
    static inMemory(settings = {}) {
        return new SettingsManager(null, null, settings, false);
    }
    static loadFromFile(path) {
        if (!(0, fs_1.existsSync)(path)) {
            return {};
        }
        const content = (0, fs_1.readFileSync)(path, "utf-8");
        const settings = JSON.parse(content);
        return SettingsManager.migrateSettings(settings);
    }
    /** Migrate old settings format to new format */
    static migrateSettings(settings) {
        // Migrate queueMode -> steeringMode
        if ("queueMode" in settings && !("steeringMode" in settings)) {
            settings.steeringMode = settings.queueMode;
            delete settings.queueMode;
        }
        // Migrate old skills object format to new array format
        if ("skills" in settings &&
            typeof settings.skills === "object" &&
            settings.skills !== null &&
            !Array.isArray(settings.skills)) {
            const skillsSettings = settings.skills;
            if (skillsSettings.enableSkillCommands !== undefined && settings.enableSkillCommands === undefined) {
                settings.enableSkillCommands = skillsSettings.enableSkillCommands;
            }
            if (Array.isArray(skillsSettings.customDirectories) && skillsSettings.customDirectories.length > 0) {
                settings.skills = skillsSettings.customDirectories;
            }
            else {
                delete settings.skills;
            }
        }
        return settings;
    }
    loadProjectSettings() {
        // In-memory mode: return stored in-memory project settings
        if (!this.persist) {
            return structuredClone(this.inMemoryProjectSettings);
        }
        if (!this.projectSettingsPath || !(0, fs_1.existsSync)(this.projectSettingsPath)) {
            return {};
        }
        try {
            const content = (0, fs_1.readFileSync)(this.projectSettingsPath, "utf-8");
            const settings = JSON.parse(content);
            return SettingsManager.migrateSettings(settings);
        }
        catch (error) {
            console.error(`Warning: Could not read project settings file: ${error}`);
            return {};
        }
    }
    getGlobalSettings() {
        return structuredClone(this.globalSettings);
    }
    getProjectSettings() {
        return this.loadProjectSettings();
    }
    reload() {
        let nextGlobalSettings = null;
        if (this.persist && this.settingsPath) {
            try {
                nextGlobalSettings = SettingsManager.loadFromFile(this.settingsPath);
                this.globalSettingsLoadError = null;
            }
            catch (error) {
                this.globalSettingsLoadError = error;
            }
        }
        if (nextGlobalSettings) {
            this.globalSettings = nextGlobalSettings;
        }
        this.modifiedFields.clear();
        this.modifiedNestedFields.clear();
        const projectSettings = this.loadProjectSettings();
        this.settings = deepMergeSettings(this.globalSettings, projectSettings);
    }
    /** Apply additional overrides on top of current settings */
    applyOverrides(overrides) {
        this.settings = deepMergeSettings(this.settings, overrides);
    }
    /** Mark a field as modified during this session */
    markModified(field, nestedKey) {
        this.modifiedFields.add(field);
        if (nestedKey) {
            if (!this.modifiedNestedFields.has(field)) {
                this.modifiedNestedFields.set(field, new Set());
            }
            this.modifiedNestedFields.get(field).add(nestedKey);
        }
    }
    save() {
        var _a;
        if (this.persist && this.settingsPath) {
            // Don't overwrite if the file had parse errors on initial load
            if (this.globalSettingsLoadError) {
                // Re-merge to update active settings even though we can't persist
                const projectSettings = this.loadProjectSettings();
                this.settings = deepMergeSettings(this.globalSettings, projectSettings);
                return;
            }
            try {
                const dir = (0, path_1.dirname)(this.settingsPath);
                if (!(0, fs_1.existsSync)(dir)) {
                    (0, fs_1.mkdirSync)(dir, { recursive: true });
                }
                // Re-read current file to get latest external changes
                const currentFileSettings = SettingsManager.loadFromFile(this.settingsPath);
                // Start with file settings as base - preserves external edits
                const mergedSettings = Object.assign({}, currentFileSettings);
                // Only override with in-memory values for fields that were explicitly modified during this session
                for (const field of this.modifiedFields) {
                    const value = this.globalSettings[field];
                    // Handle nested objects specially - merge at nested level to preserve unmodified nested keys
                    if (this.modifiedNestedFields.has(field) && typeof value === "object" && value !== null) {
                        const nestedModified = this.modifiedNestedFields.get(field);
                        const baseNested = (_a = currentFileSettings[field]) !== null && _a !== void 0 ? _a : {};
                        const inMemoryNested = value;
                        const mergedNested = Object.assign({}, baseNested);
                        for (const nestedKey of nestedModified) {
                            mergedNested[nestedKey] = inMemoryNested[nestedKey];
                        }
                        mergedSettings[field] = mergedNested;
                    }
                    else {
                        // For top-level primitives and arrays, use the modified value directly
                        mergedSettings[field] = value;
                    }
                }
                this.globalSettings = mergedSettings;
                (0, fs_1.writeFileSync)(this.settingsPath, JSON.stringify(this.globalSettings, null, 2), "utf-8");
            }
            catch (error) {
                // File may have been externally modified with invalid JSON - don't overwrite
                console.error(`Warning: Could not save settings file: ${error}`);
            }
        }
        // Always re-merge to update active settings (needed for both file and inMemory modes)
        const projectSettings = this.loadProjectSettings();
        this.settings = deepMergeSettings(this.globalSettings, projectSettings);
    }
    saveProjectSettings(settings) {
        // In-memory mode: store in memory
        if (!this.persist) {
            this.inMemoryProjectSettings = structuredClone(settings);
            return;
        }
        if (!this.projectSettingsPath) {
            return;
        }
        try {
            const dir = (0, path_1.dirname)(this.projectSettingsPath);
            if (!(0, fs_1.existsSync)(dir)) {
                (0, fs_1.mkdirSync)(dir, { recursive: true });
            }
            (0, fs_1.writeFileSync)(this.projectSettingsPath, JSON.stringify(settings, null, 2), "utf-8");
        }
        catch (error) {
            console.error(`Warning: Could not save project settings file: ${error}`);
        }
    }
    getLastChangelogVersion() {
        return this.settings.lastChangelogVersion;
    }
    setLastChangelogVersion(version) {
        this.globalSettings.lastChangelogVersion = version;
        this.markModified("lastChangelogVersion");
        this.save();
    }
    getDefaultProvider() {
        return this.settings.defaultProvider;
    }
    getDefaultModel() {
        return this.settings.defaultModel;
    }
    setDefaultProvider(provider) {
        this.globalSettings.defaultProvider = provider;
        this.markModified("defaultProvider");
        this.save();
    }
    setDefaultModel(modelId) {
        this.globalSettings.defaultModel = modelId;
        this.markModified("defaultModel");
        this.save();
    }
    setDefaultModelAndProvider(provider, modelId) {
        this.globalSettings.defaultProvider = provider;
        this.globalSettings.defaultModel = modelId;
        this.markModified("defaultProvider");
        this.markModified("defaultModel");
        this.save();
    }
    getSteeringMode() {
        return this.settings.steeringMode || "one-at-a-time";
    }
    setSteeringMode(mode) {
        this.globalSettings.steeringMode = mode;
        this.markModified("steeringMode");
        this.save();
    }
    getFollowUpMode() {
        return this.settings.followUpMode || "one-at-a-time";
    }
    setFollowUpMode(mode) {
        this.globalSettings.followUpMode = mode;
        this.markModified("followUpMode");
        this.save();
    }
    getTheme() {
        return this.settings.theme;
    }
    setTheme(theme) {
        this.globalSettings.theme = theme;
        this.markModified("theme");
        this.save();
    }
    getDefaultThinkingLevel() {
        return this.settings.defaultThinkingLevel;
    }
    setDefaultThinkingLevel(level) {
        this.globalSettings.defaultThinkingLevel = level;
        this.markModified("defaultThinkingLevel");
        this.save();
    }
    getCompactionEnabled() {
        var _a;
        var _b;
        return (_b = (_a = this.settings.compaction) === null || _a === void 0 ? void 0 : _a.enabled) !== null && _b !== void 0 ? _b : true;
    }
    setCompactionEnabled(enabled) {
        if (!this.globalSettings.compaction) {
            this.globalSettings.compaction = {};
        }
        this.globalSettings.compaction.enabled = enabled;
        this.markModified("compaction", "enabled");
        this.save();
    }
    getCompactionReserveTokens() {
        var _a;
        var _b;
        return (_b = (_a = this.settings.compaction) === null || _a === void 0 ? void 0 : _a.reserveTokens) !== null && _b !== void 0 ? _b : 16384;
    }
    getCompactionKeepRecentTokens() {
        var _a;
        var _b;
        return (_b = (_a = this.settings.compaction) === null || _a === void 0 ? void 0 : _a.keepRecentTokens) !== null && _b !== void 0 ? _b : 20000;
    }
    getCompactionSettings() {
        return {
            enabled: this.getCompactionEnabled(),
            reserveTokens: this.getCompactionReserveTokens(),
            keepRecentTokens: this.getCompactionKeepRecentTokens(),
        };
    }
    getBranchSummarySettings() {
        var _a;
        var _b;
        return {
            reserveTokens: (_b = (_a = this.settings.branchSummary) === null || _a === void 0 ? void 0 : _a.reserveTokens) !== null && _b !== void 0 ? _b : 16384,
        };
    }
    getRetryEnabled() {
        var _a;
        var _b;
        return (_b = (_a = this.settings.retry) === null || _a === void 0 ? void 0 : _a.enabled) !== null && _b !== void 0 ? _b : true;
    }
    setRetryEnabled(enabled) {
        if (!this.globalSettings.retry) {
            this.globalSettings.retry = {};
        }
        this.globalSettings.retry.enabled = enabled;
        this.markModified("retry", "enabled");
        this.save();
    }
    getRetrySettings() {
        var _a, _b, _c;
        var _d, _e, _f;
        return {
            enabled: this.getRetryEnabled(),
            maxRetries: (_d = (_a = this.settings.retry) === null || _a === void 0 ? void 0 : _a.maxRetries) !== null && _d !== void 0 ? _d : 3,
            baseDelayMs: (_e = (_b = this.settings.retry) === null || _b === void 0 ? void 0 : _b.baseDelayMs) !== null && _e !== void 0 ? _e : 2000,
            maxDelayMs: (_f = (_c = this.settings.retry) === null || _c === void 0 ? void 0 : _c.maxDelayMs) !== null && _f !== void 0 ? _f : 60000,
        };
    }
    getHideThinkingBlock() {
        var _a;
        return (_a = this.settings.hideThinkingBlock) !== null && _a !== void 0 ? _a : false;
    }
    setHideThinkingBlock(hide) {
        this.globalSettings.hideThinkingBlock = hide;
        this.markModified("hideThinkingBlock");
        this.save();
    }
    getShellPath() {
        return this.settings.shellPath;
    }
    setShellPath(path) {
        this.globalSettings.shellPath = path;
        this.markModified("shellPath");
        this.save();
    }
    getQuietStartup() {
        var _a;
        return (_a = this.settings.quietStartup) !== null && _a !== void 0 ? _a : false;
    }
    setQuietStartup(quiet) {
        this.globalSettings.quietStartup = quiet;
        this.markModified("quietStartup");
        this.save();
    }
    getShellCommandPrefix() {
        return this.settings.shellCommandPrefix;
    }
    setShellCommandPrefix(prefix) {
        this.globalSettings.shellCommandPrefix = prefix;
        this.markModified("shellCommandPrefix");
        this.save();
    }
    getCollapseChangelog() {
        var _a;
        return (_a = this.settings.collapseChangelog) !== null && _a !== void 0 ? _a : false;
    }
    setCollapseChangelog(collapse) {
        this.globalSettings.collapseChangelog = collapse;
        this.markModified("collapseChangelog");
        this.save();
    }
    getPackages() {
        var _a;
        return [...((_a = this.settings.packages) !== null && _a !== void 0 ? _a : [])];
    }
    setPackages(packages) {
        this.globalSettings.packages = packages;
        this.markModified("packages");
        this.save();
    }
    setProjectPackages(packages) {
        const projectSettings = this.loadProjectSettings();
        projectSettings.packages = packages;
        this.saveProjectSettings(projectSettings);
        this.settings = deepMergeSettings(this.globalSettings, projectSettings);
    }
    getExtensionPaths() {
        var _a;
        return [...((_a = this.settings.extensions) !== null && _a !== void 0 ? _a : [])];
    }
    setExtensionPaths(paths) {
        this.globalSettings.extensions = paths;
        this.markModified("extensions");
        this.save();
    }
    setProjectExtensionPaths(paths) {
        const projectSettings = this.loadProjectSettings();
        projectSettings.extensions = paths;
        this.saveProjectSettings(projectSettings);
        this.settings = deepMergeSettings(this.globalSettings, projectSettings);
    }
    getSkillPaths() {
        var _a;
        return [...((_a = this.settings.skills) !== null && _a !== void 0 ? _a : [])];
    }
    setSkillPaths(paths) {
        this.globalSettings.skills = paths;
        this.markModified("skills");
        this.save();
    }
    setProjectSkillPaths(paths) {
        const projectSettings = this.loadProjectSettings();
        projectSettings.skills = paths;
        this.saveProjectSettings(projectSettings);
        this.settings = deepMergeSettings(this.globalSettings, projectSettings);
    }
    getPromptTemplatePaths() {
        var _a;
        return [...((_a = this.settings.prompts) !== null && _a !== void 0 ? _a : [])];
    }
    setPromptTemplatePaths(paths) {
        this.globalSettings.prompts = paths;
        this.markModified("prompts");
        this.save();
    }
    setProjectPromptTemplatePaths(paths) {
        const projectSettings = this.loadProjectSettings();
        projectSettings.prompts = paths;
        this.saveProjectSettings(projectSettings);
        this.settings = deepMergeSettings(this.globalSettings, projectSettings);
    }
    getThemePaths() {
        var _a;
        return [...((_a = this.settings.themes) !== null && _a !== void 0 ? _a : [])];
    }
    setThemePaths(paths) {
        this.globalSettings.themes = paths;
        this.markModified("themes");
        this.save();
    }
    setProjectThemePaths(paths) {
        const projectSettings = this.loadProjectSettings();
        projectSettings.themes = paths;
        this.saveProjectSettings(projectSettings);
        this.settings = deepMergeSettings(this.globalSettings, projectSettings);
    }
    getEnableSkillCommands() {
        var _a;
        return (_a = this.settings.enableSkillCommands) !== null && _a !== void 0 ? _a : true;
    }
    setEnableSkillCommands(enabled) {
        this.globalSettings.enableSkillCommands = enabled;
        this.markModified("enableSkillCommands");
        this.save();
    }
    getThinkingBudgets() {
        return this.settings.thinkingBudgets;
    }
    getShowImages() {
        var _a;
        var _b;
        return (_b = (_a = this.settings.terminal) === null || _a === void 0 ? void 0 : _a.showImages) !== null && _b !== void 0 ? _b : true;
    }
    setShowImages(show) {
        if (!this.globalSettings.terminal) {
            this.globalSettings.terminal = {};
        }
        this.globalSettings.terminal.showImages = show;
        this.markModified("terminal", "showImages");
        this.save();
    }
    getClearOnShrink() {
        var _a;
        // Settings takes precedence, then env var, then default false
        if (((_a = this.settings.terminal) === null || _a === void 0 ? void 0 : _a.clearOnShrink) !== undefined) {
            return this.settings.terminal.clearOnShrink;
        }
        return process.env.PI_CLEAR_ON_SHRINK === "1";
    }
    setClearOnShrink(enabled) {
        if (!this.globalSettings.terminal) {
            this.globalSettings.terminal = {};
        }
        this.globalSettings.terminal.clearOnShrink = enabled;
        this.markModified("terminal", "clearOnShrink");
        this.save();
    }
    getImageAutoResize() {
        var _a;
        var _b;
        return (_b = (_a = this.settings.images) === null || _a === void 0 ? void 0 : _a.autoResize) !== null && _b !== void 0 ? _b : true;
    }
    setImageAutoResize(enabled) {
        if (!this.globalSettings.images) {
            this.globalSettings.images = {};
        }
        this.globalSettings.images.autoResize = enabled;
        this.markModified("images", "autoResize");
        this.save();
    }
    getBlockImages() {
        var _a;
        var _b;
        return (_b = (_a = this.settings.images) === null || _a === void 0 ? void 0 : _a.blockImages) !== null && _b !== void 0 ? _b : false;
    }
    setBlockImages(blocked) {
        if (!this.globalSettings.images) {
            this.globalSettings.images = {};
        }
        this.globalSettings.images.blockImages = blocked;
        this.markModified("images", "blockImages");
        this.save();
    }
    getEnabledModels() {
        return this.settings.enabledModels;
    }
    setEnabledModels(patterns) {
        this.globalSettings.enabledModels = patterns;
        this.markModified("enabledModels");
        this.save();
    }
    getDoubleEscapeAction() {
        var _a;
        return (_a = this.settings.doubleEscapeAction) !== null && _a !== void 0 ? _a : "tree";
    }
    setDoubleEscapeAction(action) {
        this.globalSettings.doubleEscapeAction = action;
        this.markModified("doubleEscapeAction");
        this.save();
    }
    getShowHardwareCursor() {
        var _a;
        return (_a = this.settings.showHardwareCursor) !== null && _a !== void 0 ? _a : process.env.PI_HARDWARE_CURSOR === "1";
    }
    setShowHardwareCursor(enabled) {
        this.globalSettings.showHardwareCursor = enabled;
        this.markModified("showHardwareCursor");
        this.save();
    }
    getEditorPaddingX() {
        var _a;
        return (_a = this.settings.editorPaddingX) !== null && _a !== void 0 ? _a : 0;
    }
    setEditorPaddingX(padding) {
        this.globalSettings.editorPaddingX = Math.max(0, Math.min(3, Math.floor(padding)));
        this.markModified("editorPaddingX");
        this.save();
    }
    getAutocompleteMaxVisible() {
        var _a;
        return (_a = this.settings.autocompleteMaxVisible) !== null && _a !== void 0 ? _a : 5;
    }
    setAutocompleteMaxVisible(maxVisible) {
        this.globalSettings.autocompleteMaxVisible = Math.max(3, Math.min(20, Math.floor(maxVisible)));
        this.markModified("autocompleteMaxVisible");
        this.save();
    }
    getCodeBlockIndent() {
        var _a;
        var _b;
        return (_b = (_a = this.settings.markdown) === null || _a === void 0 ? void 0 : _a.codeBlockIndent) !== null && _b !== void 0 ? _b : "  ";
    }
}
exports.SettingsManager = SettingsManager;
