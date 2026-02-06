"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaultResourceLoader = void 0;
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const chalk_1 = __importDefault(require("chalk"));
const config_js_1 = require("../config.js");
const theme_js_1 = require("../modes/interactive/theme/theme.js");
const event_bus_js_1 = require("./event-bus.js");
const loader_js_1 = require("./extensions/loader.js");
const package_manager_js_1 = require("./package-manager.js");
const prompt_templates_js_1 = require("./prompt-templates.js");
const settings_manager_js_1 = require("./settings-manager.js");
const skills_js_1 = require("./skills.js");
function resolvePromptInput(input, description) {
    if (!input) {
        return undefined;
    }
    if ((0, node_fs_1.existsSync)(input)) {
        try {
            return (0, node_fs_1.readFileSync)(input, "utf-8");
        }
        catch (error) {
            console.error(chalk_1.default.yellow(`Warning: Could not read ${description} file ${input}: ${error}`));
            return input;
        }
    }
    return input;
}
function loadContextFileFromDir(dir) {
    const candidates = ["AGENTS.md", "CLAUDE.md"];
    for (const filename of candidates) {
        const filePath = (0, node_path_1.join)(dir, filename);
        if ((0, node_fs_1.existsSync)(filePath)) {
            try {
                return {
                    path: filePath,
                    content: (0, node_fs_1.readFileSync)(filePath, "utf-8"),
                };
            }
            catch (error) {
                console.error(chalk_1.default.yellow(`Warning: Could not read ${filePath}: ${error}`));
            }
        }
    }
    return null;
}
function loadProjectContextFiles(options = {}) {
    var _a, _b;
    const resolvedCwd = (_a = options.cwd) !== null && _a !== void 0 ? _a : process.cwd();
    const resolvedAgentDir = (_b = options.agentDir) !== null && _b !== void 0 ? _b : (0, config_js_1.getAgentDir)();
    const contextFiles = [];
    const seenPaths = new Set();
    const globalContext = loadContextFileFromDir(resolvedAgentDir);
    if (globalContext) {
        contextFiles.push(globalContext);
        seenPaths.add(globalContext.path);
    }
    const ancestorContextFiles = [];
    let currentDir = resolvedCwd;
    const root = (0, node_path_1.resolve)("/");
    while (true) {
        const contextFile = loadContextFileFromDir(currentDir);
        if (contextFile && !seenPaths.has(contextFile.path)) {
            ancestorContextFiles.unshift(contextFile);
            seenPaths.add(contextFile.path);
        }
        if (currentDir === root)
            break;
        const parentDir = (0, node_path_1.resolve)(currentDir, "..");
        if (parentDir === currentDir)
            break;
        currentDir = parentDir;
    }
    contextFiles.push(...ancestorContextFiles);
    return contextFiles;
}
class DefaultResourceLoader {
    cwd;
    agentDir;
    settingsManager;
    eventBus;
    packageManager;
    additionalExtensionPaths;
    additionalSkillPaths;
    additionalPromptTemplatePaths;
    additionalThemePaths;
    extensionFactories;
    noExtensions;
    noSkills;
    noPromptTemplates;
    noThemes;
    systemPromptSource;
    appendSystemPromptSource;
    extensionsOverride;
    skillsOverride;
    promptsOverride;
    themesOverride;
    agentsFilesOverride;
    systemPromptOverride;
    appendSystemPromptOverride;
    extensionsResult;
    skills;
    skillDiagnostics;
    prompts;
    promptDiagnostics;
    themes;
    themeDiagnostics;
    agentsFiles;
    systemPrompt;
    appendSystemPrompt;
    pathMetadata;
    lastSkillPaths;
    lastPromptPaths;
    lastThemePaths;
    constructor(options) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        this.cwd = (_a = options.cwd) !== null && _a !== void 0 ? _a : process.cwd();
        this.agentDir = (_b = options.agentDir) !== null && _b !== void 0 ? _b : (0, config_js_1.getAgentDir)();
        this.settingsManager = (_c = options.settingsManager) !== null && _c !== void 0 ? _c : settings_manager_js_1.SettingsManager.create(this.cwd, this.agentDir);
        this.eventBus = (_d = options.eventBus) !== null && _d !== void 0 ? _d : (0, event_bus_js_1.createEventBus)();
        this.packageManager = new package_manager_js_1.DefaultPackageManager({
            cwd: this.cwd,
            agentDir: this.agentDir,
            settingsManager: this.settingsManager,
        });
        this.additionalExtensionPaths = (_e = options.additionalExtensionPaths) !== null && _e !== void 0 ? _e : [];
        this.additionalSkillPaths = (_f = options.additionalSkillPaths) !== null && _f !== void 0 ? _f : [];
        this.additionalPromptTemplatePaths = (_g = options.additionalPromptTemplatePaths) !== null && _g !== void 0 ? _g : [];
        this.additionalThemePaths = (_h = options.additionalThemePaths) !== null && _h !== void 0 ? _h : [];
        this.extensionFactories = (_j = options.extensionFactories) !== null && _j !== void 0 ? _j : [];
        this.noExtensions = (_k = options.noExtensions) !== null && _k !== void 0 ? _k : false;
        this.noSkills = (_l = options.noSkills) !== null && _l !== void 0 ? _l : false;
        this.noPromptTemplates = (_m = options.noPromptTemplates) !== null && _m !== void 0 ? _m : false;
        this.noThemes = (_o = options.noThemes) !== null && _o !== void 0 ? _o : false;
        this.systemPromptSource = options.systemPrompt;
        this.appendSystemPromptSource = options.appendSystemPrompt;
        this.extensionsOverride = options.extensionsOverride;
        this.skillsOverride = options.skillsOverride;
        this.promptsOverride = options.promptsOverride;
        this.themesOverride = options.themesOverride;
        this.agentsFilesOverride = options.agentsFilesOverride;
        this.systemPromptOverride = options.systemPromptOverride;
        this.appendSystemPromptOverride = options.appendSystemPromptOverride;
        this.extensionsResult = { extensions: [], errors: [], runtime: (0, loader_js_1.createExtensionRuntime)() };
        this.skills = [];
        this.skillDiagnostics = [];
        this.prompts = [];
        this.promptDiagnostics = [];
        this.themes = [];
        this.themeDiagnostics = [];
        this.agentsFiles = [];
        this.appendSystemPrompt = [];
        this.pathMetadata = new Map();
        this.lastSkillPaths = [];
        this.lastPromptPaths = [];
        this.lastThemePaths = [];
    }
    getExtensions() {
        return this.extensionsResult;
    }
    getSkills() {
        return { skills: this.skills, diagnostics: this.skillDiagnostics };
    }
    getPrompts() {
        return { prompts: this.prompts, diagnostics: this.promptDiagnostics };
    }
    getThemes() {
        return { themes: this.themes, diagnostics: this.themeDiagnostics };
    }
    getAgentsFiles() {
        return { agentsFiles: this.agentsFiles };
    }
    getSystemPrompt() {
        return this.systemPrompt;
    }
    getAppendSystemPrompt() {
        return this.appendSystemPrompt;
    }
    getPathMetadata() {
        return this.pathMetadata;
    }
    extendResources(paths) {
        var _a, _b, _c;
        const skillPaths = this.normalizeExtensionPaths((_a = paths.skillPaths) !== null && _a !== void 0 ? _a : []);
        const promptPaths = this.normalizeExtensionPaths((_b = paths.promptPaths) !== null && _b !== void 0 ? _b : []);
        const themePaths = this.normalizeExtensionPaths((_c = paths.themePaths) !== null && _c !== void 0 ? _c : []);
        if (skillPaths.length > 0) {
            this.lastSkillPaths = this.mergePaths(this.lastSkillPaths, skillPaths.map((entry) => entry.path));
            this.updateSkillsFromPaths(this.lastSkillPaths, skillPaths);
        }
        if (promptPaths.length > 0) {
            this.lastPromptPaths = this.mergePaths(this.lastPromptPaths, promptPaths.map((entry) => entry.path));
            this.updatePromptsFromPaths(this.lastPromptPaths, promptPaths);
        }
        if (themePaths.length > 0) {
            this.lastThemePaths = this.mergePaths(this.lastThemePaths, themePaths.map((entry) => entry.path));
            this.updateThemesFromPaths(this.lastThemePaths, themePaths);
        }
    }
    async reload() {
        var _a, _b;
        const resolvedPaths = await this.packageManager.resolve();
        const cliExtensionPaths = await this.packageManager.resolveExtensionSources(this.additionalExtensionPaths, {
            temporary: true,
        });
        // Helper to extract enabled paths and store metadata
        const getEnabledResources = (resources) => {
            for (const r of resources) {
                if (!this.pathMetadata.has(r.path)) {
                    this.pathMetadata.set(r.path, r.metadata);
                }
            }
            return resources.filter((r) => r.enabled);
        };
        const getEnabledPaths = (resources) => getEnabledResources(resources).map((r) => r.path);
        // Store metadata and get enabled paths
        this.pathMetadata = new Map();
        const enabledExtensions = getEnabledPaths(resolvedPaths.extensions);
        const enabledSkillResources = getEnabledResources(resolvedPaths.skills);
        const enabledPrompts = getEnabledPaths(resolvedPaths.prompts);
        const enabledThemes = getEnabledPaths(resolvedPaths.themes);
        const mapSkillPath = (resource) => {
            if (resource.metadata.source !== "auto" && resource.metadata.origin !== "package") {
                return resource.path;
            }
            try {
                const stats = (0, node_fs_1.statSync)(resource.path);
                if (!stats.isDirectory()) {
                    return resource.path;
                }
            }
            catch (_a) {
                return resource.path;
            }
            const skillFile = (0, node_path_1.join)(resource.path, "SKILL.md");
            if ((0, node_fs_1.existsSync)(skillFile)) {
                if (!this.pathMetadata.has(skillFile)) {
                    this.pathMetadata.set(skillFile, resource.metadata);
                }
                return skillFile;
            }
            return resource.path;
        };
        const enabledSkills = enabledSkillResources.map(mapSkillPath);
        // Add CLI paths metadata
        for (const r of cliExtensionPaths.extensions) {
            if (!this.pathMetadata.has(r.path)) {
                this.pathMetadata.set(r.path, { source: "cli", scope: "temporary", origin: "top-level" });
            }
        }
        for (const r of cliExtensionPaths.skills) {
            if (!this.pathMetadata.has(r.path)) {
                this.pathMetadata.set(r.path, { source: "cli", scope: "temporary", origin: "top-level" });
            }
        }
        const cliEnabledExtensions = getEnabledPaths(cliExtensionPaths.extensions);
        const cliEnabledSkills = getEnabledPaths(cliExtensionPaths.skills);
        const cliEnabledPrompts = getEnabledPaths(cliExtensionPaths.prompts);
        const cliEnabledThemes = getEnabledPaths(cliExtensionPaths.themes);
        const extensionPaths = this.noExtensions
            ? cliEnabledExtensions
            : this.mergePaths(enabledExtensions, cliEnabledExtensions);
        const extensionsResult = await (0, loader_js_1.loadExtensions)(extensionPaths, this.cwd, this.eventBus);
        const inlineExtensions = await this.loadExtensionFactories(extensionsResult.runtime);
        extensionsResult.extensions.push(...inlineExtensions.extensions);
        extensionsResult.errors.push(...inlineExtensions.errors);
        // Detect extension conflicts (tools, commands, flags with same names from different extensions)
        const conflicts = this.detectExtensionConflicts(extensionsResult.extensions);
        if (conflicts.length > 0) {
            const conflictingPaths = new Set(conflicts.map((c) => c.path));
            extensionsResult.extensions = extensionsResult.extensions.filter((ext) => !conflictingPaths.has(ext.path));
            for (const conflict of conflicts) {
                extensionsResult.errors.push({ path: conflict.path, error: conflict.message });
            }
        }
        this.extensionsResult = this.extensionsOverride ? this.extensionsOverride(extensionsResult) : extensionsResult;
        const skillPaths = this.noSkills
            ? this.mergePaths(cliEnabledSkills, this.additionalSkillPaths)
            : this.mergePaths([...enabledSkills, ...cliEnabledSkills], this.additionalSkillPaths);
        this.lastSkillPaths = skillPaths;
        this.updateSkillsFromPaths(skillPaths);
        const promptPaths = this.noPromptTemplates
            ? this.mergePaths(cliEnabledPrompts, this.additionalPromptTemplatePaths)
            : this.mergePaths([...enabledPrompts, ...cliEnabledPrompts], this.additionalPromptTemplatePaths);
        this.lastPromptPaths = promptPaths;
        this.updatePromptsFromPaths(promptPaths);
        const themePaths = this.noThemes
            ? this.mergePaths(cliEnabledThemes, this.additionalThemePaths)
            : this.mergePaths([...enabledThemes, ...cliEnabledThemes], this.additionalThemePaths);
        this.lastThemePaths = themePaths;
        this.updateThemesFromPaths(themePaths);
        for (const extension of this.extensionsResult.extensions) {
            this.addDefaultMetadataForPath(extension.path);
        }
        const agentsFiles = { agentsFiles: loadProjectContextFiles({ cwd: this.cwd, agentDir: this.agentDir }) };
        const resolvedAgentsFiles = this.agentsFilesOverride ? this.agentsFilesOverride(agentsFiles) : agentsFiles;
        this.agentsFiles = resolvedAgentsFiles.agentsFiles;
        const baseSystemPrompt = resolvePromptInput((_a = this.systemPromptSource) !== null && _a !== void 0 ? _a : this.discoverSystemPromptFile(), "system prompt");
        this.systemPrompt = this.systemPromptOverride ? this.systemPromptOverride(baseSystemPrompt) : baseSystemPrompt;
        const appendSource = (_b = this.appendSystemPromptSource) !== null && _b !== void 0 ? _b : this.discoverAppendSystemPromptFile();
        const resolvedAppend = resolvePromptInput(appendSource, "append system prompt");
        const baseAppend = resolvedAppend ? [resolvedAppend] : [];
        this.appendSystemPrompt = this.appendSystemPromptOverride
            ? this.appendSystemPromptOverride(baseAppend)
            : baseAppend;
    }
    normalizeExtensionPaths(entries) {
        return entries.map((entry) => ({
            path: this.resolveResourcePath(entry.path),
            metadata: entry.metadata,
        }));
    }
    updateSkillsFromPaths(skillPaths, extensionPaths = []) {
        let skillsResult;
        if (this.noSkills && skillPaths.length === 0) {
            skillsResult = { skills: [], diagnostics: [] };
        }
        else {
            skillsResult = (0, skills_js_1.loadSkills)({
                cwd: this.cwd,
                agentDir: this.agentDir,
                skillPaths,
                includeDefaults: false,
            });
        }
        const resolvedSkills = this.skillsOverride ? this.skillsOverride(skillsResult) : skillsResult;
        this.skills = resolvedSkills.skills;
        this.skillDiagnostics = resolvedSkills.diagnostics;
        this.applyExtensionMetadata(extensionPaths, this.skills.map((skill) => skill.filePath));
        for (const skill of this.skills) {
            this.addDefaultMetadataForPath(skill.filePath);
        }
    }
    updatePromptsFromPaths(promptPaths, extensionPaths = []) {
        let promptsResult;
        if (this.noPromptTemplates && promptPaths.length === 0) {
            promptsResult = { prompts: [], diagnostics: [] };
        }
        else {
            const allPrompts = (0, prompt_templates_js_1.loadPromptTemplates)({
                cwd: this.cwd,
                agentDir: this.agentDir,
                promptPaths,
                includeDefaults: false,
            });
            promptsResult = this.dedupePrompts(allPrompts);
        }
        const resolvedPrompts = this.promptsOverride ? this.promptsOverride(promptsResult) : promptsResult;
        this.prompts = resolvedPrompts.prompts;
        this.promptDiagnostics = resolvedPrompts.diagnostics;
        this.applyExtensionMetadata(extensionPaths, this.prompts.map((prompt) => prompt.filePath));
        for (const prompt of this.prompts) {
            this.addDefaultMetadataForPath(prompt.filePath);
        }
    }
    updateThemesFromPaths(themePaths, extensionPaths = []) {
        let themesResult;
        if (this.noThemes && themePaths.length === 0) {
            themesResult = { themes: [], diagnostics: [] };
        }
        else {
            const loaded = this.loadThemes(themePaths, false);
            const deduped = this.dedupeThemes(loaded.themes);
            themesResult = { themes: deduped.themes, diagnostics: [...loaded.diagnostics, ...deduped.diagnostics] };
        }
        const resolvedThemes = this.themesOverride ? this.themesOverride(themesResult) : themesResult;
        this.themes = resolvedThemes.themes;
        this.themeDiagnostics = resolvedThemes.diagnostics;
        const themePathsWithSource = this.themes.flatMap((theme) => (theme.sourcePath ? [theme.sourcePath] : []));
        this.applyExtensionMetadata(extensionPaths, themePathsWithSource);
        for (const theme of this.themes) {
            if (theme.sourcePath) {
                this.addDefaultMetadataForPath(theme.sourcePath);
            }
        }
    }
    applyExtensionMetadata(extensionPaths, resourcePaths) {
        if (extensionPaths.length === 0) {
            return;
        }
        const normalized = extensionPaths.map((entry) => ({
            path: (0, node_path_1.resolve)(entry.path),
            metadata: entry.metadata,
        }));
        for (const entry of normalized) {
            if (!this.pathMetadata.has(entry.path)) {
                this.pathMetadata.set(entry.path, entry.metadata);
            }
        }
        for (const resourcePath of resourcePaths) {
            const normalizedResourcePath = (0, node_path_1.resolve)(resourcePath);
            if (this.pathMetadata.has(normalizedResourcePath) || this.pathMetadata.has(resourcePath)) {
                continue;
            }
            const match = normalized.find((entry) => normalizedResourcePath === entry.path || normalizedResourcePath.startsWith(`${entry.path}${node_path_1.sep}`));
            if (match) {
                this.pathMetadata.set(normalizedResourcePath, match.metadata);
            }
        }
    }
    mergePaths(primary, additional) {
        const merged = [];
        const seen = new Set();
        for (const p of [...primary, ...additional]) {
            const resolved = this.resolveResourcePath(p);
            if (seen.has(resolved))
                continue;
            seen.add(resolved);
            merged.push(resolved);
        }
        return merged;
    }
    resolveResourcePath(p) {
        const trimmed = p.trim();
        let expanded = trimmed;
        if (trimmed === "~") {
            expanded = (0, node_os_1.homedir)();
        }
        else if (trimmed.startsWith("~/")) {
            expanded = (0, node_path_1.join)((0, node_os_1.homedir)(), trimmed.slice(2));
        }
        else if (trimmed.startsWith("~")) {
            expanded = (0, node_path_1.join)((0, node_os_1.homedir)(), trimmed.slice(1));
        }
        return (0, node_path_1.resolve)(this.cwd, expanded);
    }
    loadThemes(paths, includeDefaults = true) {
        const themes = [];
        const diagnostics = [];
        if (includeDefaults) {
            const defaultDirs = [(0, node_path_1.join)(this.agentDir, "themes"), (0, node_path_1.join)(this.cwd, config_js_1.CONFIG_DIR_NAME, "themes")];
            for (const dir of defaultDirs) {
                this.loadThemesFromDir(dir, themes, diagnostics);
            }
        }
        for (const p of paths) {
            const resolved = (0, node_path_1.resolve)(this.cwd, p);
            if (!(0, node_fs_1.existsSync)(resolved)) {
                diagnostics.push({ type: "warning", message: "theme path does not exist", path: resolved });
                continue;
            }
            try {
                const stats = (0, node_fs_1.statSync)(resolved);
                if (stats.isDirectory()) {
                    this.loadThemesFromDir(resolved, themes, diagnostics);
                }
                else if (stats.isFile() && resolved.endsWith(".json")) {
                    this.loadThemeFromFile(resolved, themes, diagnostics);
                }
                else {
                    diagnostics.push({ type: "warning", message: "theme path is not a json file", path: resolved });
                }
            }
            catch (error) {
                const message = error instanceof Error ? error.message : "failed to read theme path";
                diagnostics.push({ type: "warning", message, path: resolved });
            }
        }
        return { themes, diagnostics };
    }
    loadThemesFromDir(dir, themes, diagnostics) {
        if (!(0, node_fs_1.existsSync)(dir)) {
            return;
        }
        try {
            const entries = (0, node_fs_1.readdirSync)(dir, { withFileTypes: true });
            for (const entry of entries) {
                let isFile = entry.isFile();
                if (entry.isSymbolicLink()) {
                    try {
                        isFile = (0, node_fs_1.statSync)((0, node_path_1.join)(dir, entry.name)).isFile();
                    }
                    catch (_a) {
                        continue;
                    }
                }
                if (!isFile) {
                    continue;
                }
                if (!entry.name.endsWith(".json")) {
                    continue;
                }
                this.loadThemeFromFile((0, node_path_1.join)(dir, entry.name), themes, diagnostics);
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "failed to read theme directory";
            diagnostics.push({ type: "warning", message, path: dir });
        }
    }
    loadThemeFromFile(filePath, themes, diagnostics) {
        try {
            themes.push((0, theme_js_1.loadThemeFromPath)(filePath));
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "failed to load theme";
            diagnostics.push({ type: "warning", message, path: filePath });
        }
    }
    async loadExtensionFactories(runtime) {
        const extensions = [];
        const errors = [];
        for (const [index, factory] of this.extensionFactories.entries()) {
            const extensionPath = `<inline:${index + 1}>`;
            try {
                const extension = await (0, loader_js_1.loadExtensionFromFactory)(factory, this.cwd, this.eventBus, runtime, extensionPath);
                extensions.push(extension);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : "failed to load extension";
                errors.push({ path: extensionPath, error: message });
            }
        }
        return { extensions, errors };
    }
    dedupePrompts(prompts) {
        const seen = new Map();
        const diagnostics = [];
        for (const prompt of prompts) {
            const existing = seen.get(prompt.name);
            if (existing) {
                diagnostics.push({
                    type: "collision",
                    message: `name "/${prompt.name}" collision`,
                    path: prompt.filePath,
                    collision: {
                        resourceType: "prompt",
                        name: prompt.name,
                        winnerPath: existing.filePath,
                        loserPath: prompt.filePath,
                    },
                });
            }
            else {
                seen.set(prompt.name, prompt);
            }
        }
        return { prompts: Array.from(seen.values()), diagnostics };
    }
    dedupeThemes(themes) {
        var _a, _b, _c;
        const seen = new Map();
        const diagnostics = [];
        for (const t of themes) {
            const name = (_a = t.name) !== null && _a !== void 0 ? _a : "unnamed";
            const existing = seen.get(name);
            if (existing) {
                diagnostics.push({
                    type: "collision",
                    message: `name "${name}" collision`,
                    path: t.sourcePath,
                    collision: {
                        resourceType: "theme",
                        name,
                        winnerPath: (_b = existing.sourcePath) !== null && _b !== void 0 ? _b : "<builtin>",
                        loserPath: (_c = t.sourcePath) !== null && _c !== void 0 ? _c : "<builtin>",
                    },
                });
            }
            else {
                seen.set(name, t);
            }
        }
        return { themes: Array.from(seen.values()), diagnostics };
    }
    discoverSystemPromptFile() {
        const projectPath = (0, node_path_1.join)(this.cwd, config_js_1.CONFIG_DIR_NAME, "SYSTEM.md");
        if ((0, node_fs_1.existsSync)(projectPath)) {
            return projectPath;
        }
        const globalPath = (0, node_path_1.join)(this.agentDir, "SYSTEM.md");
        if ((0, node_fs_1.existsSync)(globalPath)) {
            return globalPath;
        }
        return undefined;
    }
    discoverAppendSystemPromptFile() {
        const projectPath = (0, node_path_1.join)(this.cwd, config_js_1.CONFIG_DIR_NAME, "APPEND_SYSTEM.md");
        if ((0, node_fs_1.existsSync)(projectPath)) {
            return projectPath;
        }
        const globalPath = (0, node_path_1.join)(this.agentDir, "APPEND_SYSTEM.md");
        if ((0, node_fs_1.existsSync)(globalPath)) {
            return globalPath;
        }
        return undefined;
    }
    addDefaultMetadataForPath(filePath) {
        if (!filePath || filePath.startsWith("<")) {
            return;
        }
        const normalizedPath = (0, node_path_1.resolve)(filePath);
        if (this.pathMetadata.has(normalizedPath) || this.pathMetadata.has(filePath)) {
            return;
        }
        const agentRoots = [
            (0, node_path_1.join)(this.agentDir, "skills"),
            (0, node_path_1.join)(this.agentDir, "prompts"),
            (0, node_path_1.join)(this.agentDir, "themes"),
            (0, node_path_1.join)(this.agentDir, "extensions"),
        ];
        const projectRoots = [
            (0, node_path_1.join)(this.cwd, config_js_1.CONFIG_DIR_NAME, "skills"),
            (0, node_path_1.join)(this.cwd, config_js_1.CONFIG_DIR_NAME, "prompts"),
            (0, node_path_1.join)(this.cwd, config_js_1.CONFIG_DIR_NAME, "themes"),
            (0, node_path_1.join)(this.cwd, config_js_1.CONFIG_DIR_NAME, "extensions"),
        ];
        for (const root of agentRoots) {
            if (this.isUnderPath(normalizedPath, root)) {
                this.pathMetadata.set(normalizedPath, { source: "local", scope: "user", origin: "top-level" });
                return;
            }
        }
        for (const root of projectRoots) {
            if (this.isUnderPath(normalizedPath, root)) {
                this.pathMetadata.set(normalizedPath, { source: "local", scope: "project", origin: "top-level" });
                return;
            }
        }
    }
    isUnderPath(target, root) {
        const normalizedRoot = (0, node_path_1.resolve)(root);
        if (target === normalizedRoot) {
            return true;
        }
        const prefix = normalizedRoot.endsWith(node_path_1.sep) ? normalizedRoot : `${normalizedRoot}${node_path_1.sep}`;
        return target.startsWith(prefix);
    }
    detectExtensionConflicts(extensions) {
        const conflicts = [];
        // Track which extension registered each tool, command, and flag
        const toolOwners = new Map();
        const commandOwners = new Map();
        const flagOwners = new Map();
        for (const ext of extensions) {
            // Check tools
            for (const toolName of ext.tools.keys()) {
                const existingOwner = toolOwners.get(toolName);
                if (existingOwner && existingOwner !== ext.path) {
                    conflicts.push({
                        path: ext.path,
                        message: `Tool "${toolName}" conflicts with ${existingOwner}`,
                    });
                }
                else {
                    toolOwners.set(toolName, ext.path);
                }
            }
            // Check commands
            for (const commandName of ext.commands.keys()) {
                const existingOwner = commandOwners.get(commandName);
                if (existingOwner && existingOwner !== ext.path) {
                    conflicts.push({
                        path: ext.path,
                        message: `Command "/${commandName}" conflicts with ${existingOwner}`,
                    });
                }
                else {
                    commandOwners.set(commandName, ext.path);
                }
            }
            // Check flags
            for (const flagName of ext.flags.keys()) {
                const existingOwner = flagOwners.get(flagName);
                if (existingOwner && existingOwner !== ext.path) {
                    conflicts.push({
                        path: ext.path,
                        message: `Flag "--${flagName}" conflicts with ${existingOwner}`,
                    });
                }
                else {
                    flagOwners.set(flagName, ext.path);
                }
            }
        }
        return conflicts;
    }
}
exports.DefaultResourceLoader = DefaultResourceLoader;
