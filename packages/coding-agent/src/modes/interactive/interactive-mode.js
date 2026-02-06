"use strict";
/**
 * Interactive mode for the coding agent.
 * Handles TUI rendering and user interaction, delegating business logic to AgentSession.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.InteractiveMode = void 0;
const crypto = __importStar(require("node:crypto"));
const fs = __importStar(require("node:fs"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const pi_ai_1 = require("@mariozechner/pi-ai");
const pi_tui_1 = require("@mariozechner/pi-tui");
const child_process_1 = require("child_process");
const config_js_1 = require("../../config.js");
const agent_session_js_1 = require("../../core/agent-session.js");
const footer_data_provider_js_1 = require("../../core/footer-data-provider.js");
const keybindings_js_1 = require("../../core/keybindings.js");
const messages_js_1 = require("../../core/messages.js");
const model_resolver_js_1 = require("../../core/model-resolver.js");
const session_manager_js_1 = require("../../core/session-manager.js");
const slash_commands_js_1 = require("../../core/slash-commands.js");
const changelog_js_1 = require("../../utils/changelog.js");
const clipboard_js_1 = require("../../utils/clipboard.js");
const clipboard_image_js_1 = require("../../utils/clipboard-image.js");
const tools_manager_js_1 = require("../../utils/tools-manager.js");
const armin_js_1 = require("./components/armin.js");
const assistant_message_js_1 = require("./components/assistant-message.js");
const bash_execution_js_1 = require("./components/bash-execution.js");
const bordered_loader_js_1 = require("./components/bordered-loader.js");
const branch_summary_message_js_1 = require("./components/branch-summary-message.js");
const compaction_summary_message_js_1 = require("./components/compaction-summary-message.js");
const custom_editor_js_1 = require("./components/custom-editor.js");
const custom_message_js_1 = require("./components/custom-message.js");
const daxnuts_js_1 = require("./components/daxnuts.js");
const dynamic_border_js_1 = require("./components/dynamic-border.js");
const extension_editor_js_1 = require("./components/extension-editor.js");
const extension_input_js_1 = require("./components/extension-input.js");
const extension_selector_js_1 = require("./components/extension-selector.js");
const footer_js_1 = require("./components/footer.js");
const keybinding_hints_js_1 = require("./components/keybinding-hints.js");
const login_dialog_js_1 = require("./components/login-dialog.js");
const model_selector_js_1 = require("./components/model-selector.js");
const oauth_selector_js_1 = require("./components/oauth-selector.js");
const scoped_models_selector_js_1 = require("./components/scoped-models-selector.js");
const session_selector_js_1 = require("./components/session-selector.js");
const settings_selector_js_1 = require("./components/settings-selector.js");
const skill_invocation_message_js_1 = require("./components/skill-invocation-message.js");
const tool_execution_js_1 = require("./components/tool-execution.js");
const tree_selector_js_1 = require("./components/tree-selector.js");
const user_message_js_1 = require("./components/user-message.js");
const user_message_selector_js_1 = require("./components/user-message-selector.js");
const theme_js_1 = require("./theme/theme.js");
function isExpandable(obj) {
    return typeof obj === "object" && obj !== null && "setExpanded" in obj && typeof obj.setExpanded === "function";
}
class InteractiveMode {
    options;
    session;
    ui;
    chatContainer;
    pendingMessagesContainer;
    statusContainer;
    defaultEditor;
    editor;
    autocompleteProvider;
    fdPath;
    editorContainer;
    footer;
    footerDataProvider;
    keybindings;
    version;
    isInitialized = false;
    onInputCallback;
    loadingAnimation = undefined;
    pendingWorkingMessage = undefined;
    defaultWorkingMessage = "Working...";
    lastSigintTime = 0;
    lastEscapeTime = 0;
    changelogMarkdown = undefined;
    // Status line tracking (for mutating immediately-sequential status updates)
    lastStatusSpacer = undefined;
    lastStatusText = undefined;
    // Streaming message tracking
    streamingComponent = undefined;
    streamingMessage = undefined;
    // Tool execution tracking: toolCallId -> component
    pendingTools = new Map();
    // Tool output expansion state
    toolOutputExpanded = false;
    // Thinking block visibility state
    hideThinkingBlock = false;
    // Skill commands: command name -> skill file path
    skillCommands = new Map();
    // Agent subscription unsubscribe function
    unsubscribe;
    // Track if editor is in bash mode (text starts with !)
    isBashMode = false;
    // Track current bash execution component
    bashComponent = undefined;
    // Track pending bash components (shown in pending area, moved to chat on submit)
    pendingBashComponents = [];
    // Auto-compaction state
    autoCompactionLoader = undefined;
    autoCompactionEscapeHandler;
    // Auto-retry state
    retryLoader = undefined;
    retryEscapeHandler;
    // Messages queued while compaction is running
    compactionQueuedMessages = [];
    // Shutdown state
    shutdownRequested = false;
    // Extension UI state
    extensionSelector = undefined;
    extensionInput = undefined;
    extensionEditor = undefined;
    // Extension widgets (components rendered above/below the editor)
    extensionWidgetsAbove = new Map();
    extensionWidgetsBelow = new Map();
    widgetContainerAbove;
    widgetContainerBelow;
    // Custom footer from extension (undefined = use built-in footer)
    customFooter = undefined;
    // Header container that holds the built-in or custom header
    headerContainer;
    // Built-in header (logo + keybinding hints + changelog)
    builtInHeader = undefined;
    // Custom header from extension (undefined = use built-in header)
    customHeader = undefined;
    // Convenience accessors
    get agent() {
        return this.session.agent;
    }
    get sessionManager() {
        return this.session.sessionManager;
    }
    get settingsManager() {
        return this.session.settingsManager;
    }
    constructor(session, options = {}) {
        this.options = options;
        this.session = session;
        this.version = config_js_1.VERSION;
        this.ui = new pi_tui_1.TUI(new pi_tui_1.ProcessTerminal(), this.settingsManager.getShowHardwareCursor());
        this.ui.setClearOnShrink(this.settingsManager.getClearOnShrink());
        this.headerContainer = new pi_tui_1.Container();
        this.chatContainer = new pi_tui_1.Container();
        this.pendingMessagesContainer = new pi_tui_1.Container();
        this.statusContainer = new pi_tui_1.Container();
        this.widgetContainerAbove = new pi_tui_1.Container();
        this.widgetContainerBelow = new pi_tui_1.Container();
        this.keybindings = keybindings_js_1.KeybindingsManager.create();
        const editorPaddingX = this.settingsManager.getEditorPaddingX();
        const autocompleteMaxVisible = this.settingsManager.getAutocompleteMaxVisible();
        this.defaultEditor = new custom_editor_js_1.CustomEditor(this.ui, (0, theme_js_1.getEditorTheme)(), this.keybindings, {
            paddingX: editorPaddingX,
            autocompleteMaxVisible,
        });
        this.editor = this.defaultEditor;
        this.editorContainer = new pi_tui_1.Container();
        this.editorContainer.addChild(this.editor);
        this.footerDataProvider = new footer_data_provider_js_1.FooterDataProvider();
        this.footer = new footer_js_1.FooterComponent(session, this.footerDataProvider);
        this.footer.setAutoCompactEnabled(session.autoCompactionEnabled);
        // Load hide thinking block setting
        this.hideThinkingBlock = this.settingsManager.getHideThinkingBlock();
        // Register themes from resource loader and initialize
        (0, theme_js_1.setRegisteredThemes)(this.session.resourceLoader.getThemes().themes);
        (0, theme_js_1.initTheme)(this.settingsManager.getTheme(), true);
    }
    setupAutocomplete(fdPath) {
        var _a;
        var _b;
        // Define commands for autocomplete
        const slashCommands = slash_commands_js_1.BUILTIN_SLASH_COMMANDS.map((command) => ({
            name: command.name,
            description: command.description,
        }));
        const modelCommand = slashCommands.find((command) => command.name === "model");
        if (modelCommand) {
            modelCommand.getArgumentCompletions = (prefix) => {
                // Get available models (scoped or from registry)
                const models = this.session.scopedModels.length > 0
                    ? this.session.scopedModels.map((s) => s.model)
                    : this.session.modelRegistry.getAvailable();
                if (models.length === 0)
                    return null;
                // Create items with provider/id format
                const items = models.map((m) => ({
                    id: m.id,
                    provider: m.provider,
                    label: `${m.provider}/${m.id}`,
                }));
                // Fuzzy filter by model ID + provider (allows "opus anthropic" to match)
                const filtered = (0, pi_tui_1.fuzzyFilter)(items, prefix, (item) => `${item.id} ${item.provider}`);
                if (filtered.length === 0)
                    return null;
                return filtered.map((item) => ({
                    value: item.label,
                    label: item.id,
                    description: item.provider,
                }));
            };
        }
        // Convert prompt templates to SlashCommand format for autocomplete
        const templateCommands = this.session.promptTemplates.map((cmd) => ({
            name: cmd.name,
            description: cmd.description,
        }));
        // Convert extension commands to SlashCommand format
        const builtinCommandNames = new Set(slashCommands.map((c) => c.name));
        const extensionCommands = ((_b = (_a = this.session.extensionRunner) === null || _a === void 0 ? void 0 : _a.getRegisteredCommands(builtinCommandNames)) !== null && _b !== void 0 ? _b : []).map((cmd) => {
            var _a;
            return ({
                name: cmd.name,
                description: (_a = cmd.description) !== null && _a !== void 0 ? _a : "(extension command)",
                getArgumentCompletions: cmd.getArgumentCompletions,
            });
        });
        // Build skill commands from session.skills (if enabled)
        this.skillCommands.clear();
        const skillCommandList = [];
        if (this.settingsManager.getEnableSkillCommands()) {
            for (const skill of this.session.resourceLoader.getSkills().skills) {
                const commandName = `skill:${skill.name}`;
                this.skillCommands.set(commandName, skill.filePath);
                skillCommandList.push({ name: commandName, description: skill.description });
            }
        }
        // Setup autocomplete
        this.autocompleteProvider = new pi_tui_1.CombinedAutocompleteProvider([...slashCommands, ...templateCommands, ...extensionCommands, ...skillCommandList], process.cwd(), fdPath);
        this.defaultEditor.setAutocompleteProvider(this.autocompleteProvider);
    }
    async init() {
        if (this.isInitialized)
            return;
        // Load changelog (only show new entries, skip for resumed sessions)
        this.changelogMarkdown = this.getChangelogForDisplay();
        // Setup autocomplete with fd tool for file path completion
        this.fdPath = await (0, tools_manager_js_1.ensureTool)("fd");
        // Add header container as first child
        this.ui.addChild(this.headerContainer);
        // Add header with keybindings from config (unless silenced)
        if (this.options.verbose || !this.settingsManager.getQuietStartup()) {
            const logo = theme_js_1.theme.bold(theme_js_1.theme.fg("accent", config_js_1.APP_NAME)) + theme_js_1.theme.fg("dim", ` v${this.version}`);
            // Build startup instructions using keybinding hint helpers
            const kb = this.keybindings;
            const hint = (action, desc) => (0, keybinding_hints_js_1.appKeyHint)(kb, action, desc);
            const instructions = [
                hint("interrupt", "to interrupt"),
                hint("clear", "to clear"),
                (0, keybinding_hints_js_1.rawKeyHint)(`${(0, keybinding_hints_js_1.appKey)(kb, "clear")} twice`, "to exit"),
                hint("exit", "to exit (empty)"),
                hint("suspend", "to suspend"),
                (0, keybinding_hints_js_1.keyHint)("deleteToLineEnd", "to delete to end"),
                hint("cycleThinkingLevel", "to cycle thinking level"),
                (0, keybinding_hints_js_1.rawKeyHint)(`${(0, keybinding_hints_js_1.appKey)(kb, "cycleModelForward")}/${(0, keybinding_hints_js_1.appKey)(kb, "cycleModelBackward")}`, "to cycle models"),
                hint("selectModel", "to select model"),
                hint("expandTools", "to expand tools"),
                hint("toggleThinking", "to expand thinking"),
                hint("externalEditor", "for external editor"),
                (0, keybinding_hints_js_1.rawKeyHint)("/", "for commands"),
                (0, keybinding_hints_js_1.rawKeyHint)("!", "to run bash"),
                (0, keybinding_hints_js_1.rawKeyHint)("!!", "to run bash (no context)"),
                hint("followUp", "to queue follow-up"),
                hint("dequeue", "to edit all queued messages"),
                hint("pasteImage", "to paste image"),
                (0, keybinding_hints_js_1.rawKeyHint)("drop files", "to attach"),
            ].join("\n");
            this.builtInHeader = new pi_tui_1.Text(`${logo}\n${instructions}`, 1, 0);
            // Setup UI layout
            this.headerContainer.addChild(new pi_tui_1.Spacer(1));
            this.headerContainer.addChild(this.builtInHeader);
            this.headerContainer.addChild(new pi_tui_1.Spacer(1));
            // Add changelog if provided
            if (this.changelogMarkdown) {
                this.headerContainer.addChild(new dynamic_border_js_1.DynamicBorder());
                if (this.settingsManager.getCollapseChangelog()) {
                    const versionMatch = this.changelogMarkdown.match(/##\s+\[?(\d+\.\d+\.\d+)\]?/);
                    const latestVersion = versionMatch ? versionMatch[1] : this.version;
                    const condensedText = `Updated to v${latestVersion}. Use ${theme_js_1.theme.bold("/changelog")} to view full changelog.`;
                    this.headerContainer.addChild(new pi_tui_1.Text(condensedText, 1, 0));
                }
                else {
                    this.headerContainer.addChild(new pi_tui_1.Text(theme_js_1.theme.bold(theme_js_1.theme.fg("accent", "What's New")), 1, 0));
                    this.headerContainer.addChild(new pi_tui_1.Spacer(1));
                    this.headerContainer.addChild(new pi_tui_1.Markdown(this.changelogMarkdown.trim(), 1, 0, this.getMarkdownThemeWithSettings()));
                    this.headerContainer.addChild(new pi_tui_1.Spacer(1));
                }
                this.headerContainer.addChild(new dynamic_border_js_1.DynamicBorder());
            }
        }
        else {
            // Minimal header when silenced
            this.builtInHeader = new pi_tui_1.Text("", 0, 0);
            this.headerContainer.addChild(this.builtInHeader);
            if (this.changelogMarkdown) {
                // Still show changelog notification even in silent mode
                this.headerContainer.addChild(new pi_tui_1.Spacer(1));
                const versionMatch = this.changelogMarkdown.match(/##\s+\[?(\d+\.\d+\.\d+)\]?/);
                const latestVersion = versionMatch ? versionMatch[1] : this.version;
                const condensedText = `Updated to v${latestVersion}. Use ${theme_js_1.theme.bold("/changelog")} to view full changelog.`;
                this.headerContainer.addChild(new pi_tui_1.Text(condensedText, 1, 0));
            }
        }
        this.ui.addChild(this.chatContainer);
        this.ui.addChild(this.pendingMessagesContainer);
        this.ui.addChild(this.statusContainer);
        this.renderWidgets(); // Initialize with default spacer
        this.ui.addChild(this.widgetContainerAbove);
        this.ui.addChild(this.editorContainer);
        this.ui.addChild(this.widgetContainerBelow);
        this.ui.addChild(this.footer);
        this.ui.setFocus(this.editor);
        this.setupKeyHandlers();
        this.setupEditorSubmitHandler();
        // Initialize extensions first so resources are shown before messages
        await this.initExtensions();
        // Render initial messages AFTER showing loaded resources
        this.renderInitialMessages();
        // Start the UI
        this.ui.start();
        this.isInitialized = true;
        // Set terminal title
        this.updateTerminalTitle();
        // Subscribe to agent events
        this.subscribeToAgent();
        // Set up theme file watcher
        (0, theme_js_1.onThemeChange)(() => {
            this.ui.invalidate();
            this.updateEditorBorderColor();
            this.ui.requestRender();
        });
        // Set up git branch watcher (uses provider instead of footer)
        this.footerDataProvider.onBranchChange(() => {
            this.ui.requestRender();
        });
        // Initialize available provider count for footer display
        await this.updateAvailableProviderCount();
    }
    /**
     * Update terminal title with session name and cwd.
     */
    updateTerminalTitle() {
        const cwdBasename = path.basename(process.cwd());
        const sessionName = this.sessionManager.getSessionName();
        if (sessionName) {
            this.ui.terminal.setTitle(`π - ${sessionName} - ${cwdBasename}`);
        }
        else {
            this.ui.terminal.setTitle(`π - ${cwdBasename}`);
        }
    }
    /**
     * Run the interactive mode. This is the main entry point.
     * Initializes the UI, shows warnings, processes initial messages, and starts the interactive loop.
     */
    async run() {
        await this.init();
        // Start version check asynchronously
        this.checkForNewVersion().then((newVersion) => {
            if (newVersion) {
                this.showNewVersionNotification(newVersion);
            }
        });
        // Show startup warnings
        const { migratedProviders, modelFallbackMessage, initialMessage, initialImages, initialMessages } = this.options;
        if (migratedProviders && migratedProviders.length > 0) {
            this.showWarning(`Migrated credentials to auth.json: ${migratedProviders.join(", ")}`);
        }
        const modelsJsonError = this.session.modelRegistry.getError();
        if (modelsJsonError) {
            this.showError(`models.json error: ${modelsJsonError}`);
        }
        if (modelFallbackMessage) {
            this.showWarning(modelFallbackMessage);
        }
        // Process initial messages
        if (initialMessage) {
            try {
                await this.session.prompt(initialMessage, { images: initialImages });
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
                this.showError(errorMessage);
            }
        }
        if (initialMessages) {
            for (const message of initialMessages) {
                try {
                    await this.session.prompt(message);
                }
                catch (error) {
                    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
                    this.showError(errorMessage);
                }
            }
        }
        // Main interactive loop
        while (true) {
            const userInput = await this.getUserInput();
            try {
                await this.session.prompt(userInput);
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
                this.showError(errorMessage);
            }
        }
    }
    /**
     * Check npm registry for a newer version.
     */
    async checkForNewVersion() {
        if (process.env.PI_SKIP_VERSION_CHECK)
            return undefined;
        try {
            const response = await fetch("https://registry.npmjs.org/@mariozechner/pi-coding-agent/latest");
            if (!response.ok)
                return undefined;
            const data = (await response.json());
            const latestVersion = data.version;
            if (latestVersion && latestVersion !== this.version) {
                return latestVersion;
            }
            return undefined;
        }
        catch (_a) {
            return undefined;
        }
    }
    /**
     * Get changelog entries to display on startup.
     * Only shows new entries since last seen version, skips for resumed sessions.
     */
    getChangelogForDisplay() {
        // Skip changelog for resumed/continued sessions (already have messages)
        if (this.session.state.messages.length > 0) {
            return undefined;
        }
        const lastVersion = this.settingsManager.getLastChangelogVersion();
        const changelogPath = (0, changelog_js_1.getChangelogPath)();
        const entries = (0, changelog_js_1.parseChangelog)(changelogPath);
        if (!lastVersion) {
            // Fresh install - just record the version, don't show changelog
            this.settingsManager.setLastChangelogVersion(config_js_1.VERSION);
            return undefined;
        }
        else {
            const newEntries = (0, changelog_js_1.getNewEntries)(entries, lastVersion);
            if (newEntries.length > 0) {
                this.settingsManager.setLastChangelogVersion(config_js_1.VERSION);
                return newEntries.map((e) => e.content).join("\n\n");
            }
        }
        return undefined;
    }
    getMarkdownThemeWithSettings() {
        return Object.assign(Object.assign({}, (0, theme_js_1.getMarkdownTheme)()), { codeBlockIndent: this.settingsManager.getCodeBlockIndent() });
    }
    // =========================================================================
    // Extension System
    // =========================================================================
    formatDisplayPath(p) {
        const home = os.homedir();
        let result = p;
        // Replace home directory with ~
        if (result.startsWith(home)) {
            result = `~${result.slice(home.length)}`;
        }
        return result;
    }
    /**
     * Get a short path relative to the package root for display.
     */
    getShortPath(fullPath, source) {
        // For npm packages, show path relative to node_modules/pkg/
        const npmMatch = fullPath.match(/node_modules\/(@?[^/]+(?:\/[^/]+)?)\/(.*)/);
        if (npmMatch && source.startsWith("npm:")) {
            return npmMatch[2];
        }
        // For git packages, show path relative to repo root
        const gitMatch = fullPath.match(/git\/[^/]+\/[^/]+\/(.*)/);
        if (gitMatch && source.startsWith("git:")) {
            return gitMatch[1];
        }
        // For local/auto, just use formatDisplayPath
        return this.formatDisplayPath(fullPath);
    }
    getDisplaySourceInfo(source, scope) {
        if (source === "local") {
            if (scope === "user") {
                return { label: "user", color: "muted" };
            }
            if (scope === "project") {
                return { label: "project", color: "muted" };
            }
            if (scope === "temporary") {
                return { label: "path", scopeLabel: "temp", color: "muted" };
            }
            return { label: "path", color: "muted" };
        }
        if (source === "cli") {
            return { label: "path", scopeLabel: scope === "temporary" ? "temp" : undefined, color: "muted" };
        }
        const scopeLabel = scope === "user" ? "user" : scope === "project" ? "project" : scope === "temporary" ? "temp" : undefined;
        return { label: source, scopeLabel, color: "accent" };
    }
    getScopeGroup(source, scope) {
        if (source === "cli" || scope === "temporary")
            return "path";
        if (scope === "user")
            return "user";
        if (scope === "project")
            return "project";
        return "path";
    }
    isPackageSource(source) {
        return source.startsWith("npm:") || source.startsWith("git:");
    }
    buildScopeGroups(paths, metadata) {
        var _a, _b, _c;
        const groups = {
            user: { scope: "user", paths: [], packages: new Map() },
            project: { scope: "project", paths: [], packages: new Map() },
            path: { scope: "path", paths: [], packages: new Map() },
        };
        for (const p of paths) {
            const meta = this.findMetadata(p, metadata);
            const source = (_a = meta === null || meta === void 0 ? void 0 : meta.source) !== null && _a !== void 0 ? _a : "local";
            const scope = (_b = meta === null || meta === void 0 ? void 0 : meta.scope) !== null && _b !== void 0 ? _b : "project";
            const groupKey = this.getScopeGroup(source, scope);
            const group = groups[groupKey];
            if (this.isPackageSource(source)) {
                const list = (_c = group.packages.get(source)) !== null && _c !== void 0 ? _c : [];
                list.push(p);
                group.packages.set(source, list);
            }
            else {
                group.paths.push(p);
            }
        }
        return [groups.user, groups.project, groups.path].filter((group) => group.paths.length > 0 || group.packages.size > 0);
    }
    formatScopeGroups(groups, options) {
        const lines = [];
        for (const group of groups) {
            lines.push(`  ${theme_js_1.theme.fg("accent", group.scope)}`);
            const sortedPaths = [...group.paths].sort((a, b) => a.localeCompare(b));
            for (const p of sortedPaths) {
                lines.push(theme_js_1.theme.fg("dim", `    ${options.formatPath(p)}`));
            }
            const sortedPackages = Array.from(group.packages.entries()).sort(([a], [b]) => a.localeCompare(b));
            for (const [source, paths] of sortedPackages) {
                lines.push(`    ${theme_js_1.theme.fg("mdLink", source)}`);
                const sortedPackagePaths = [...paths].sort((a, b) => a.localeCompare(b));
                for (const p of sortedPackagePaths) {
                    lines.push(theme_js_1.theme.fg("dim", `      ${options.formatPackagePath(p, source)}`));
                }
            }
        }
        return lines.join("\n");
    }
    /**
     * Find metadata for a path, checking parent directories if exact match fails.
     * Package manager stores metadata for directories, but we display file paths.
     */
    findMetadata(p, metadata) {
        // Try exact match first
        const exact = metadata.get(p);
        if (exact)
            return exact;
        // Try parent directories (package manager stores directory paths)
        let current = p;
        while (current.includes("/")) {
            current = current.substring(0, current.lastIndexOf("/"));
            const parent = metadata.get(current);
            if (parent)
                return parent;
        }
        return undefined;
    }
    /**
     * Format a path with its source/scope info from metadata.
     */
    formatPathWithSource(p, metadata) {
        const meta = this.findMetadata(p, metadata);
        if (meta) {
            const shortPath = this.getShortPath(p, meta.source);
            const { label, scopeLabel } = this.getDisplaySourceInfo(meta.source, meta.scope);
            const labelText = scopeLabel ? `${label} (${scopeLabel})` : label;
            return `${labelText} ${shortPath}`;
        }
        return this.formatDisplayPath(p);
    }
    /**
     * Format resource diagnostics with nice collision display using metadata.
     */
    formatDiagnostics(diagnostics, metadata) {
        var _a;
        var _b;
        const lines = [];
        // Group collision diagnostics by name
        const collisions = new Map();
        const otherDiagnostics = [];
        for (const d of diagnostics) {
            if (d.type === "collision" && d.collision) {
                const list = (_b = collisions.get(d.collision.name)) !== null && _b !== void 0 ? _b : [];
                list.push(d);
                collisions.set(d.collision.name, list);
            }
            else {
                otherDiagnostics.push(d);
            }
        }
        // Format collision diagnostics grouped by name
        for (const [name, collisionList] of collisions) {
            const first = (_a = collisionList[0]) === null || _a === void 0 ? void 0 : _a.collision;
            if (!first)
                continue;
            lines.push(theme_js_1.theme.fg("warning", `  "${name}" collision:`));
            // Show winner
            lines.push(theme_js_1.theme.fg("dim", `    ${theme_js_1.theme.fg("success", "✓")} ${this.formatPathWithSource(first.winnerPath, metadata)}`));
            // Show all losers
            for (const d of collisionList) {
                if (d.collision) {
                    lines.push(theme_js_1.theme.fg("dim", `    ${theme_js_1.theme.fg("warning", "✗")} ${this.formatPathWithSource(d.collision.loserPath, metadata)} (skipped)`));
                }
            }
        }
        // Format other diagnostics (skill name collisions, parse errors, etc.)
        for (const d of otherDiagnostics) {
            if (d.path) {
                // Use metadata-aware formatting for paths
                const sourceInfo = this.formatPathWithSource(d.path, metadata);
                lines.push(theme_js_1.theme.fg(d.type === "error" ? "error" : "warning", `  ${sourceInfo}`));
                lines.push(theme_js_1.theme.fg(d.type === "error" ? "error" : "warning", `    ${d.message}`));
            }
            else {
                lines.push(theme_js_1.theme.fg(d.type === "error" ? "error" : "warning", `  ${d.message}`));
            }
        }
        return lines.join("\n");
    }
    showLoadedResources(options) {
        var _a, _b;
        var _c, _d, _e;
        const shouldShow = (options === null || options === void 0 ? void 0 : options.force) || this.options.verbose || !this.settingsManager.getQuietStartup();
        if (!shouldShow) {
            return;
        }
        const metadata = this.session.resourceLoader.getPathMetadata();
        const sectionHeader = (name, color = "mdHeading") => theme_js_1.theme.fg(color, `[${name}]`);
        const contextFiles = this.session.resourceLoader.getAgentsFiles().agentsFiles;
        if (contextFiles.length > 0) {
            this.chatContainer.addChild(new pi_tui_1.Spacer(1));
            const contextList = contextFiles.map((f) => theme_js_1.theme.fg("dim", `  ${this.formatDisplayPath(f.path)}`)).join("\n");
            this.chatContainer.addChild(new pi_tui_1.Text(`${sectionHeader("Context")}\n${contextList}`, 0, 0));
            this.chatContainer.addChild(new pi_tui_1.Spacer(1));
        }
        const skills = this.session.resourceLoader.getSkills().skills;
        if (skills.length > 0) {
            const skillPaths = skills.map((s) => s.filePath);
            const groups = this.buildScopeGroups(skillPaths, metadata);
            const skillList = this.formatScopeGroups(groups, {
                formatPath: (p) => this.formatDisplayPath(p),
                formatPackagePath: (p, source) => this.getShortPath(p, source),
            });
            this.chatContainer.addChild(new pi_tui_1.Text(`${sectionHeader("Skills")}\n${skillList}`, 0, 0));
            this.chatContainer.addChild(new pi_tui_1.Spacer(1));
        }
        const skillDiagnostics = this.session.resourceLoader.getSkills().diagnostics;
        if (skillDiagnostics.length > 0) {
            const warningLines = this.formatDiagnostics(skillDiagnostics, metadata);
            this.chatContainer.addChild(new pi_tui_1.Text(`${theme_js_1.theme.fg("warning", "[Skill conflicts]")}\n${warningLines}`, 0, 0));
            this.chatContainer.addChild(new pi_tui_1.Spacer(1));
        }
        const templates = this.session.promptTemplates;
        if (templates.length > 0) {
            const templatePaths = templates.map((t) => t.filePath);
            const groups = this.buildScopeGroups(templatePaths, metadata);
            const templateByPath = new Map(templates.map((t) => [t.filePath, t]));
            const templateList = this.formatScopeGroups(groups, {
                formatPath: (p) => {
                    const template = templateByPath.get(p);
                    return template ? `/${template.name}` : this.formatDisplayPath(p);
                },
                formatPackagePath: (p) => {
                    const template = templateByPath.get(p);
                    return template ? `/${template.name}` : this.formatDisplayPath(p);
                },
            });
            this.chatContainer.addChild(new pi_tui_1.Text(`${sectionHeader("Prompts")}\n${templateList}`, 0, 0));
            this.chatContainer.addChild(new pi_tui_1.Spacer(1));
        }
        const promptDiagnostics = this.session.resourceLoader.getPrompts().diagnostics;
        if (promptDiagnostics.length > 0) {
            const warningLines = this.formatDiagnostics(promptDiagnostics, metadata);
            this.chatContainer.addChild(new pi_tui_1.Text(`${theme_js_1.theme.fg("warning", "[Prompt conflicts]")}\n${warningLines}`, 0, 0));
            this.chatContainer.addChild(new pi_tui_1.Spacer(1));
        }
        const extensionPaths = (_c = options === null || options === void 0 ? void 0 : options.extensionPaths) !== null && _c !== void 0 ? _c : [];
        if (extensionPaths.length > 0) {
            const groups = this.buildScopeGroups(extensionPaths, metadata);
            const extList = this.formatScopeGroups(groups, {
                formatPath: (p) => this.formatDisplayPath(p),
                formatPackagePath: (p, source) => this.getShortPath(p, source),
            });
            this.chatContainer.addChild(new pi_tui_1.Text(`${sectionHeader("Extensions", "mdHeading")}\n${extList}`, 0, 0));
            this.chatContainer.addChild(new pi_tui_1.Spacer(1));
        }
        const extensionDiagnostics = [];
        const extensionErrors = this.session.resourceLoader.getExtensions().errors;
        if (extensionErrors.length > 0) {
            for (const error of extensionErrors) {
                extensionDiagnostics.push({ type: "error", message: error.error, path: error.path });
            }
        }
        const commandDiagnostics = (_d = (_a = this.session.extensionRunner) === null || _a === void 0 ? void 0 : _a.getCommandDiagnostics()) !== null && _d !== void 0 ? _d : [];
        extensionDiagnostics.push(...commandDiagnostics);
        const shortcutDiagnostics = (_e = (_b = this.session.extensionRunner) === null || _b === void 0 ? void 0 : _b.getShortcutDiagnostics()) !== null && _e !== void 0 ? _e : [];
        extensionDiagnostics.push(...shortcutDiagnostics);
        if (extensionDiagnostics.length > 0) {
            const warningLines = this.formatDiagnostics(extensionDiagnostics, metadata);
            this.chatContainer.addChild(new pi_tui_1.Text(`${theme_js_1.theme.fg("warning", "[Extension issues]")}\n${warningLines}`, 0, 0));
            this.chatContainer.addChild(new pi_tui_1.Spacer(1));
        }
        // Show loaded themes (excluding built-in)
        const loadedThemes = this.session.resourceLoader.getThemes().themes;
        const customThemes = loadedThemes.filter((t) => t.sourcePath);
        if (customThemes.length > 0) {
            const themePaths = customThemes.map((t) => t.sourcePath);
            const groups = this.buildScopeGroups(themePaths, metadata);
            const themeList = this.formatScopeGroups(groups, {
                formatPath: (p) => this.formatDisplayPath(p),
                formatPackagePath: (p, source) => this.getShortPath(p, source),
            });
            this.chatContainer.addChild(new pi_tui_1.Text(`${sectionHeader("Themes")}\n${themeList}`, 0, 0));
            this.chatContainer.addChild(new pi_tui_1.Spacer(1));
        }
        const themeDiagnostics = this.session.resourceLoader.getThemes().diagnostics;
        if (themeDiagnostics.length > 0) {
            const warningLines = this.formatDiagnostics(themeDiagnostics, metadata);
            this.chatContainer.addChild(new pi_tui_1.Text(`${theme_js_1.theme.fg("warning", "[Theme conflicts]")}\n${warningLines}`, 0, 0));
            this.chatContainer.addChild(new pi_tui_1.Spacer(1));
        }
    }
    /**
     * Initialize the extension system with TUI-based UI context.
     */
    async initExtensions() {
        const uiContext = this.createExtensionUIContext();
        await this.session.bindExtensions({
            uiContext,
            commandContextActions: {
                waitForIdle: () => this.session.agent.waitForIdle(),
                newSession: async (options) => {
                    if (this.loadingAnimation) {
                        this.loadingAnimation.stop();
                        this.loadingAnimation = undefined;
                    }
                    this.statusContainer.clear();
                    // Delegate to AgentSession (handles setup + agent state sync)
                    const success = await this.session.newSession(options);
                    if (!success) {
                        return { cancelled: true };
                    }
                    // Clear UI state
                    this.chatContainer.clear();
                    this.pendingMessagesContainer.clear();
                    this.compactionQueuedMessages = [];
                    this.streamingComponent = undefined;
                    this.streamingMessage = undefined;
                    this.pendingTools.clear();
                    // Render any messages added via setup, or show empty session
                    this.renderInitialMessages();
                    this.ui.requestRender();
                    return { cancelled: false };
                },
                fork: async (entryId) => {
                    const result = await this.session.fork(entryId);
                    if (result.cancelled) {
                        return { cancelled: true };
                    }
                    this.chatContainer.clear();
                    this.renderInitialMessages();
                    this.editor.setText(result.selectedText);
                    this.showStatus("Forked to new session");
                    return { cancelled: false };
                },
                navigateTree: async (targetId, options) => {
                    const result = await this.session.navigateTree(targetId, {
                        summarize: options === null || options === void 0 ? void 0 : options.summarize,
                        customInstructions: options === null || options === void 0 ? void 0 : options.customInstructions,
                        replaceInstructions: options === null || options === void 0 ? void 0 : options.replaceInstructions,
                        label: options === null || options === void 0 ? void 0 : options.label,
                    });
                    if (result.cancelled) {
                        return { cancelled: true };
                    }
                    this.chatContainer.clear();
                    this.renderInitialMessages();
                    if (result.editorText && !this.editor.getText().trim()) {
                        this.editor.setText(result.editorText);
                    }
                    this.showStatus("Navigated to selected point");
                    return { cancelled: false };
                },
                switchSession: async (sessionPath) => {
                    await this.handleResumeSession(sessionPath);
                    return { cancelled: false };
                },
            },
            shutdownHandler: () => {
                this.shutdownRequested = true;
            },
            onError: (error) => {
                this.showExtensionError(error.extensionPath, error.error, error.stack);
            },
        });
        (0, theme_js_1.setRegisteredThemes)(this.session.resourceLoader.getThemes().themes);
        this.setupAutocomplete(this.fdPath);
        const extensionRunner = this.session.extensionRunner;
        if (!extensionRunner) {
            this.showLoadedResources({ extensionPaths: [], force: false });
            return;
        }
        this.setupExtensionShortcuts(extensionRunner);
        this.showLoadedResources({ extensionPaths: extensionRunner.getExtensionPaths(), force: false });
    }
    /**
     * Get a registered tool definition by name (for custom rendering).
     */
    getRegisteredToolDefinition(toolName) {
        var _a;
        var _b;
        const tools = (_b = (_a = this.session.extensionRunner) === null || _a === void 0 ? void 0 : _a.getAllRegisteredTools()) !== null && _b !== void 0 ? _b : [];
        const registeredTool = tools.find((t) => t.definition.name === toolName);
        return registeredTool === null || registeredTool === void 0 ? void 0 : registeredTool.definition;
    }
    /**
     * Set up keyboard shortcuts registered by extensions.
     */
    setupExtensionShortcuts(extensionRunner) {
        const shortcuts = extensionRunner.getShortcuts(this.keybindings.getEffectiveConfig());
        if (shortcuts.size === 0)
            return;
        // Create a context for shortcut handlers
        const createContext = () => ({
            ui: this.createExtensionUIContext(),
            hasUI: true,
            cwd: process.cwd(),
            sessionManager: this.sessionManager,
            modelRegistry: this.session.modelRegistry,
            model: this.session.model,
            isIdle: () => !this.session.isStreaming,
            abort: () => this.session.abort(),
            hasPendingMessages: () => this.session.pendingMessageCount > 0,
            shutdown: () => {
                this.shutdownRequested = true;
            },
            getContextUsage: () => this.session.getContextUsage(),
            compact: (options) => {
                void (async () => {
                    var _a, _b;
                    try {
                        const result = await this.executeCompaction(options === null || options === void 0 ? void 0 : options.customInstructions, false);
                        if (result) {
                            (_a = options === null || options === void 0 ? void 0 : options.onComplete) === null || _a === void 0 ? void 0 : _a.call(options, result);
                        }
                    }
                    catch (error) {
                        const err = error instanceof Error ? error : new Error(String(error));
                        (_b = options === null || options === void 0 ? void 0 : options.onError) === null || _b === void 0 ? void 0 : _b.call(options, err);
                    }
                })();
            },
            getSystemPrompt: () => this.session.systemPrompt,
        });
        // Set up the extension shortcut handler on the default editor
        this.defaultEditor.onExtensionShortcut = (data) => {
            for (const [shortcutStr, shortcut] of shortcuts) {
                // Cast to KeyId - extension shortcuts use the same format
                if ((0, pi_tui_1.matchesKey)(data, shortcutStr)) {
                    // Run handler async, don't block input
                    Promise.resolve(shortcut.handler(createContext())).catch((err) => {
                        this.showError(`Shortcut handler error: ${err instanceof Error ? err.message : String(err)}`);
                    });
                    return true;
                }
            }
            return false;
        };
    }
    /**
     * Set extension status text in the footer.
     */
    setExtensionStatus(key, text) {
        this.footerDataProvider.setExtensionStatus(key, text);
        this.ui.requestRender();
    }
    /**
     * Set an extension widget (string array or custom component).
     */
    setExtensionWidget(key, content, options) {
        var _a;
        const placement = (_a = options === null || options === void 0 ? void 0 : options.placement) !== null && _a !== void 0 ? _a : "aboveEditor";
        const removeExisting = (map) => {
            const existing = map.get(key);
            if (existing === null || existing === void 0 ? void 0 : existing.dispose)
                existing.dispose();
            map.delete(key);
        };
        removeExisting(this.extensionWidgetsAbove);
        removeExisting(this.extensionWidgetsBelow);
        if (content === undefined) {
            this.renderWidgets();
            return;
        }
        let component;
        if (Array.isArray(content)) {
            // Wrap string array in a Container with Text components
            const container = new pi_tui_1.Container();
            for (const line of content.slice(0, InteractiveMode.MAX_WIDGET_LINES)) {
                container.addChild(new pi_tui_1.Text(line, 1, 0));
            }
            if (content.length > InteractiveMode.MAX_WIDGET_LINES) {
                container.addChild(new pi_tui_1.Text(theme_js_1.theme.fg("muted", "... (widget truncated)"), 1, 0));
            }
            component = container;
        }
        else {
            // Factory function - create component
            component = content(this.ui, theme_js_1.theme);
        }
        const targetMap = placement === "belowEditor" ? this.extensionWidgetsBelow : this.extensionWidgetsAbove;
        targetMap.set(key, component);
        this.renderWidgets();
    }
    clearExtensionWidgets() {
        var _a, _b;
        for (const widget of this.extensionWidgetsAbove.values()) {
            (_a = widget.dispose) === null || _a === void 0 ? void 0 : _a.call(widget);
        }
        for (const widget of this.extensionWidgetsBelow.values()) {
            (_b = widget.dispose) === null || _b === void 0 ? void 0 : _b.call(widget);
        }
        this.extensionWidgetsAbove.clear();
        this.extensionWidgetsBelow.clear();
        this.renderWidgets();
    }
    resetExtensionUI() {
        if (this.extensionSelector) {
            this.hideExtensionSelector();
        }
        if (this.extensionInput) {
            this.hideExtensionInput();
        }
        if (this.extensionEditor) {
            this.hideExtensionEditor();
        }
        this.ui.hideOverlay();
        this.setExtensionFooter(undefined);
        this.setExtensionHeader(undefined);
        this.clearExtensionWidgets();
        this.footerDataProvider.clearExtensionStatuses();
        this.footer.invalidate();
        this.setCustomEditorComponent(undefined);
        this.defaultEditor.onExtensionShortcut = undefined;
        this.updateTerminalTitle();
        if (this.loadingAnimation) {
            this.loadingAnimation.setMessage(`${this.defaultWorkingMessage} (${(0, keybinding_hints_js_1.appKey)(this.keybindings, "interrupt")} to interrupt)`);
        }
    }
    // Maximum total widget lines to prevent viewport overflow
    static MAX_WIDGET_LINES = 10;
    /**
     * Render all extension widgets to the widget container.
     */
    renderWidgets() {
        if (!this.widgetContainerAbove || !this.widgetContainerBelow)
            return;
        this.renderWidgetContainer(this.widgetContainerAbove, this.extensionWidgetsAbove, true, true);
        this.renderWidgetContainer(this.widgetContainerBelow, this.extensionWidgetsBelow, false, false);
        this.ui.requestRender();
    }
    renderWidgetContainer(container, widgets, spacerWhenEmpty, leadingSpacer) {
        container.clear();
        if (widgets.size === 0) {
            if (spacerWhenEmpty) {
                container.addChild(new pi_tui_1.Spacer(1));
            }
            return;
        }
        if (leadingSpacer) {
            container.addChild(new pi_tui_1.Spacer(1));
        }
        for (const component of widgets.values()) {
            container.addChild(component);
        }
    }
    /**
     * Set a custom footer component, or restore the built-in footer.
     */
    setExtensionFooter(factory) {
        var _a;
        // Dispose existing custom footer
        if ((_a = this.customFooter) === null || _a === void 0 ? void 0 : _a.dispose) {
            this.customFooter.dispose();
        }
        // Remove current footer from UI
        if (this.customFooter) {
            this.ui.removeChild(this.customFooter);
        }
        else {
            this.ui.removeChild(this.footer);
        }
        if (factory) {
            // Create and add custom footer, passing the data provider
            this.customFooter = factory(this.ui, theme_js_1.theme, this.footerDataProvider);
            this.ui.addChild(this.customFooter);
        }
        else {
            // Restore built-in footer
            this.customFooter = undefined;
            this.ui.addChild(this.footer);
        }
        this.ui.requestRender();
    }
    /**
     * Set a custom header component, or restore the built-in header.
     */
    setExtensionHeader(factory) {
        var _a;
        // Header may not be initialized yet if called during early initialization
        if (!this.builtInHeader) {
            return;
        }
        // Dispose existing custom header
        if ((_a = this.customHeader) === null || _a === void 0 ? void 0 : _a.dispose) {
            this.customHeader.dispose();
        }
        // Find the index of the current header in the header container
        const currentHeader = this.customHeader || this.builtInHeader;
        const index = this.headerContainer.children.indexOf(currentHeader);
        if (factory) {
            // Create and add custom header
            this.customHeader = factory(this.ui, theme_js_1.theme);
            if (index !== -1) {
                this.headerContainer.children[index] = this.customHeader;
            }
            else {
                // If not found (e.g. builtInHeader was never added), add at the top
                this.headerContainer.children.unshift(this.customHeader);
            }
        }
        else {
            // Restore built-in header
            this.customHeader = undefined;
            if (index !== -1) {
                this.headerContainer.children[index] = this.builtInHeader;
            }
        }
        this.ui.requestRender();
    }
    /**
     * Create the ExtensionUIContext for extensions.
     */
    createExtensionUIContext() {
        return {
            select: (title, options, opts) => this.showExtensionSelector(title, options, opts),
            confirm: (title, message, opts) => this.showExtensionConfirm(title, message, opts),
            input: (title, placeholder, opts) => this.showExtensionInput(title, placeholder, opts),
            notify: (message, type) => this.showExtensionNotify(message, type),
            setStatus: (key, text) => this.setExtensionStatus(key, text),
            setWorkingMessage: (message) => {
                if (this.loadingAnimation) {
                    if (message) {
                        this.loadingAnimation.setMessage(message);
                    }
                    else {
                        this.loadingAnimation.setMessage(`${this.defaultWorkingMessage} (${(0, keybinding_hints_js_1.appKey)(this.keybindings, "interrupt")} to interrupt)`);
                    }
                }
                else {
                    // Queue message for when loadingAnimation is created (handles agent_start race)
                    this.pendingWorkingMessage = message;
                }
            },
            setWidget: (key, content, options) => this.setExtensionWidget(key, content, options),
            setFooter: (factory) => this.setExtensionFooter(factory),
            setHeader: (factory) => this.setExtensionHeader(factory),
            setTitle: (title) => this.ui.terminal.setTitle(title),
            custom: (factory, options) => this.showExtensionCustom(factory, options),
            setEditorText: (text) => this.editor.setText(text),
            getEditorText: () => this.editor.getText(),
            editor: (title, prefill) => this.showExtensionEditor(title, prefill),
            setEditorComponent: (factory) => this.setCustomEditorComponent(factory),
            get theme() {
                return theme_js_1.theme;
            },
            getAllThemes: () => (0, theme_js_1.getAvailableThemesWithPaths)(),
            getTheme: (name) => (0, theme_js_1.getThemeByName)(name),
            setTheme: (themeOrName) => {
                if (themeOrName instanceof theme_js_1.Theme) {
                    (0, theme_js_1.setThemeInstance)(themeOrName);
                    this.ui.requestRender();
                    return { success: true };
                }
                const result = (0, theme_js_1.setTheme)(themeOrName, true);
                if (result.success) {
                    this.ui.requestRender();
                }
                return result;
            },
            getToolsExpanded: () => this.toolOutputExpanded,
            setToolsExpanded: (expanded) => this.setToolsExpanded(expanded),
        };
    }
    /**
     * Show a selector for extensions.
     */
    showExtensionSelector(title, options, opts) {
        return new Promise((resolve) => {
            var _a, _b;
            if ((_a = opts === null || opts === void 0 ? void 0 : opts.signal) === null || _a === void 0 ? void 0 : _a.aborted) {
                resolve(undefined);
                return;
            }
            const onAbort = () => {
                this.hideExtensionSelector();
                resolve(undefined);
            };
            (_b = opts === null || opts === void 0 ? void 0 : opts.signal) === null || _b === void 0 ? void 0 : _b.addEventListener("abort", onAbort, { once: true });
            this.extensionSelector = new extension_selector_js_1.ExtensionSelectorComponent(title, options, (option) => {
                var _a;
                (_a = opts === null || opts === void 0 ? void 0 : opts.signal) === null || _a === void 0 ? void 0 : _a.removeEventListener("abort", onAbort);
                this.hideExtensionSelector();
                resolve(option);
            }, () => {
                var _a;
                (_a = opts === null || opts === void 0 ? void 0 : opts.signal) === null || _a === void 0 ? void 0 : _a.removeEventListener("abort", onAbort);
                this.hideExtensionSelector();
                resolve(undefined);
            }, { tui: this.ui, timeout: opts === null || opts === void 0 ? void 0 : opts.timeout });
            this.editorContainer.clear();
            this.editorContainer.addChild(this.extensionSelector);
            this.ui.setFocus(this.extensionSelector);
            this.ui.requestRender();
        });
    }
    /**
     * Hide the extension selector.
     */
    hideExtensionSelector() {
        var _a;
        (_a = this.extensionSelector) === null || _a === void 0 ? void 0 : _a.dispose();
        this.editorContainer.clear();
        this.editorContainer.addChild(this.editor);
        this.extensionSelector = undefined;
        this.ui.setFocus(this.editor);
        this.ui.requestRender();
    }
    /**
     * Show a confirmation dialog for extensions.
     */
    async showExtensionConfirm(title, message, opts) {
        const result = await this.showExtensionSelector(`${title}\n${message}`, ["Yes", "No"], opts);
        return result === "Yes";
    }
    /**
     * Show a text input for extensions.
     */
    showExtensionInput(title, placeholder, opts) {
        return new Promise((resolve) => {
            var _a, _b;
            if ((_a = opts === null || opts === void 0 ? void 0 : opts.signal) === null || _a === void 0 ? void 0 : _a.aborted) {
                resolve(undefined);
                return;
            }
            const onAbort = () => {
                this.hideExtensionInput();
                resolve(undefined);
            };
            (_b = opts === null || opts === void 0 ? void 0 : opts.signal) === null || _b === void 0 ? void 0 : _b.addEventListener("abort", onAbort, { once: true });
            this.extensionInput = new extension_input_js_1.ExtensionInputComponent(title, placeholder, (value) => {
                var _a;
                (_a = opts === null || opts === void 0 ? void 0 : opts.signal) === null || _a === void 0 ? void 0 : _a.removeEventListener("abort", onAbort);
                this.hideExtensionInput();
                resolve(value);
            }, () => {
                var _a;
                (_a = opts === null || opts === void 0 ? void 0 : opts.signal) === null || _a === void 0 ? void 0 : _a.removeEventListener("abort", onAbort);
                this.hideExtensionInput();
                resolve(undefined);
            }, { tui: this.ui, timeout: opts === null || opts === void 0 ? void 0 : opts.timeout });
            this.editorContainer.clear();
            this.editorContainer.addChild(this.extensionInput);
            this.ui.setFocus(this.extensionInput);
            this.ui.requestRender();
        });
    }
    /**
     * Hide the extension input.
     */
    hideExtensionInput() {
        var _a;
        (_a = this.extensionInput) === null || _a === void 0 ? void 0 : _a.dispose();
        this.editorContainer.clear();
        this.editorContainer.addChild(this.editor);
        this.extensionInput = undefined;
        this.ui.setFocus(this.editor);
        this.ui.requestRender();
    }
    /**
     * Show a multi-line editor for extensions (with Ctrl+G support).
     */
    showExtensionEditor(title, prefill) {
        return new Promise((resolve) => {
            this.extensionEditor = new extension_editor_js_1.ExtensionEditorComponent(this.ui, this.keybindings, title, prefill, (value) => {
                this.hideExtensionEditor();
                resolve(value);
            }, () => {
                this.hideExtensionEditor();
                resolve(undefined);
            });
            this.editorContainer.clear();
            this.editorContainer.addChild(this.extensionEditor);
            this.ui.setFocus(this.extensionEditor);
            this.ui.requestRender();
        });
    }
    /**
     * Hide the extension editor.
     */
    hideExtensionEditor() {
        this.editorContainer.clear();
        this.editorContainer.addChild(this.editor);
        this.extensionEditor = undefined;
        this.ui.setFocus(this.editor);
        this.ui.requestRender();
    }
    /**
     * Set a custom editor component from an extension.
     * Pass undefined to restore the default editor.
     */
    setCustomEditorComponent(factory) {
        // Save text from current editor before switching
        const currentText = this.editor.getText();
        this.editorContainer.clear();
        if (factory) {
            // Create the custom editor with tui, theme, and keybindings
            const newEditor = factory(this.ui, (0, theme_js_1.getEditorTheme)(), this.keybindings);
            // Wire up callbacks from the default editor
            newEditor.onSubmit = this.defaultEditor.onSubmit;
            newEditor.onChange = this.defaultEditor.onChange;
            // Copy text from previous editor
            newEditor.setText(currentText);
            // Copy appearance settings if supported
            if (newEditor.borderColor !== undefined) {
                newEditor.borderColor = this.defaultEditor.borderColor;
            }
            if (newEditor.setPaddingX !== undefined) {
                newEditor.setPaddingX(this.defaultEditor.getPaddingX());
            }
            // Set autocomplete if supported
            if (newEditor.setAutocompleteProvider && this.autocompleteProvider) {
                newEditor.setAutocompleteProvider(this.autocompleteProvider);
            }
            // If extending CustomEditor, copy app-level handlers
            // Use duck typing since instanceof fails across jiti module boundaries
            const customEditor = newEditor;
            if ("actionHandlers" in customEditor && customEditor.actionHandlers instanceof Map) {
                customEditor.onEscape = this.defaultEditor.onEscape;
                customEditor.onCtrlD = this.defaultEditor.onCtrlD;
                customEditor.onPasteImage = this.defaultEditor.onPasteImage;
                customEditor.onExtensionShortcut = (data) => {
                    var _a, _b;
                    return (_b = (_a = this.defaultEditor).onExtensionShortcut) === null || _b === void 0 ? void 0 : _b.call(_a, data);
                };
                // Copy action handlers (clear, suspend, model switching, etc.)
                for (const [action, handler] of this.defaultEditor.actionHandlers) {
                    customEditor.actionHandlers.set(action, handler);
                }
            }
            this.editor = newEditor;
        }
        else {
            // Restore default editor with text from custom editor
            this.defaultEditor.setText(currentText);
            this.editor = this.defaultEditor;
        }
        this.editorContainer.addChild(this.editor);
        this.ui.setFocus(this.editor);
        this.ui.requestRender();
    }
    /**
     * Show a notification for extensions.
     */
    showExtensionNotify(message, type) {
        if (type === "error") {
            this.showError(message);
        }
        else if (type === "warning") {
            this.showWarning(message);
        }
        else {
            this.showStatus(message);
        }
    }
    /** Show a custom component with keyboard focus. Overlay mode renders on top of existing content. */
    async showExtensionCustom(factory, options) {
        var _a;
        const savedText = this.editor.getText();
        const isOverlay = (_a = options === null || options === void 0 ? void 0 : options.overlay) !== null && _a !== void 0 ? _a : false;
        const restoreEditor = () => {
            this.editorContainer.clear();
            this.editorContainer.addChild(this.editor);
            this.editor.setText(savedText);
            this.ui.setFocus(this.editor);
            this.ui.requestRender();
        };
        return new Promise((resolve, reject) => {
            let component;
            let closed = false;
            const close = (result) => {
                var _a;
                if (closed)
                    return;
                closed = true;
                if (isOverlay)
                    this.ui.hideOverlay();
                else
                    restoreEditor();
                // Note: both branches above already call requestRender
                resolve(result);
                try {
                    (_a = component === null || component === void 0 ? void 0 : component.dispose) === null || _a === void 0 ? void 0 : _a.call(component);
                }
                catch (_b) {
                    /* ignore dispose errors */
                }
            };
            Promise.resolve(factory(this.ui, theme_js_1.theme, this.keybindings, close))
                .then((c) => {
                var _a;
                if (closed)
                    return;
                component = c;
                if (isOverlay) {
                    // Resolve overlay options - can be static or dynamic function
                    const resolveOptions = () => {
                        if (options === null || options === void 0 ? void 0 : options.overlayOptions) {
                            const opts = typeof options.overlayOptions === "function"
                                ? options.overlayOptions()
                                : options.overlayOptions;
                            return opts;
                        }
                        // Fallback: use component's width property if available
                        const w = component.width;
                        return w ? { width: w } : undefined;
                    };
                    const handle = this.ui.showOverlay(component, resolveOptions());
                    // Expose handle to caller for visibility control
                    (_a = options === null || options === void 0 ? void 0 : options.onHandle) === null || _a === void 0 ? void 0 : _a.call(options, handle);
                }
                else {
                    this.editorContainer.clear();
                    this.editorContainer.addChild(component);
                    this.ui.setFocus(component);
                    this.ui.requestRender();
                }
            })
                .catch((err) => {
                if (closed)
                    return;
                if (!isOverlay)
                    restoreEditor();
                reject(err);
            });
        });
    }
    /**
     * Show an extension error in the UI.
     */
    showExtensionError(extensionPath, error, stack) {
        const errorMsg = `Extension "${extensionPath}" error: ${error}`;
        const errorText = new pi_tui_1.Text(theme_js_1.theme.fg("error", errorMsg), 1, 0);
        this.chatContainer.addChild(errorText);
        if (stack) {
            // Show stack trace in dim color, indented
            const stackLines = stack
                .split("\n")
                .slice(1) // Skip first line (duplicates error message)
                .map((line) => theme_js_1.theme.fg("dim", `  ${line.trim()}`))
                .join("\n");
            if (stackLines) {
                this.chatContainer.addChild(new pi_tui_1.Text(stackLines, 1, 0));
            }
        }
        this.ui.requestRender();
    }
    // =========================================================================
    // Key Handlers
    // =========================================================================
    setupKeyHandlers() {
        // Set up handlers on defaultEditor - they use this.editor for text access
        // so they work correctly regardless of which editor is active
        this.defaultEditor.onEscape = () => {
            if (this.loadingAnimation) {
                this.restoreQueuedMessagesToEditor({ abort: true });
            }
            else if (this.session.isBashRunning) {
                this.session.abortBash();
            }
            else if (this.isBashMode) {
                this.editor.setText("");
                this.isBashMode = false;
                this.updateEditorBorderColor();
            }
            else if (!this.editor.getText().trim()) {
                // Double-escape with empty editor triggers /tree, /fork, or nothing based on setting
                const action = this.settingsManager.getDoubleEscapeAction();
                if (action !== "none") {
                    const now = Date.now();
                    if (now - this.lastEscapeTime < 500) {
                        if (action === "tree") {
                            this.showTreeSelector();
                        }
                        else {
                            this.showUserMessageSelector();
                        }
                        this.lastEscapeTime = 0;
                    }
                    else {
                        this.lastEscapeTime = now;
                    }
                }
            }
        };
        // Register app action handlers
        this.defaultEditor.onAction("clear", () => this.handleCtrlC());
        this.defaultEditor.onCtrlD = () => this.handleCtrlD();
        this.defaultEditor.onAction("suspend", () => this.handleCtrlZ());
        this.defaultEditor.onAction("cycleThinkingLevel", () => this.cycleThinkingLevel());
        this.defaultEditor.onAction("cycleModelForward", () => this.cycleModel("forward"));
        this.defaultEditor.onAction("cycleModelBackward", () => this.cycleModel("backward"));
        // Global debug handler on TUI (works regardless of focus)
        this.ui.onDebug = () => this.handleDebugCommand();
        this.defaultEditor.onAction("selectModel", () => this.showModelSelector());
        this.defaultEditor.onAction("expandTools", () => this.toggleToolOutputExpansion());
        this.defaultEditor.onAction("toggleThinking", () => this.toggleThinkingBlockVisibility());
        this.defaultEditor.onAction("externalEditor", () => this.openExternalEditor());
        this.defaultEditor.onAction("followUp", () => this.handleFollowUp());
        this.defaultEditor.onAction("dequeue", () => this.handleDequeue());
        this.defaultEditor.onAction("newSession", () => this.handleClearCommand());
        this.defaultEditor.onAction("tree", () => this.showTreeSelector());
        this.defaultEditor.onAction("fork", () => this.showUserMessageSelector());
        this.defaultEditor.onAction("resume", () => this.showSessionSelector());
        this.defaultEditor.onChange = (text) => {
            const wasBashMode = this.isBashMode;
            this.isBashMode = text.trimStart().startsWith("!");
            if (wasBashMode !== this.isBashMode) {
                this.updateEditorBorderColor();
            }
        };
        // Handle clipboard image paste (triggered on Ctrl+V)
        this.defaultEditor.onPasteImage = () => {
            this.handleClipboardImagePaste();
        };
    }
    async handleClipboardImagePaste() {
        var _a, _b;
        var _c;
        try {
            const image = await (0, clipboard_image_js_1.readClipboardImage)();
            if (!image) {
                return;
            }
            // Write to temp file
            const tmpDir = os.tmpdir();
            const ext = (_c = (0, clipboard_image_js_1.extensionForImageMimeType)(image.mimeType)) !== null && _c !== void 0 ? _c : "png";
            const fileName = `pi-clipboard-${crypto.randomUUID()}.${ext}`;
            const filePath = path.join(tmpDir, fileName);
            fs.writeFileSync(filePath, Buffer.from(image.bytes));
            // Insert file path directly
            (_b = (_a = this.editor).insertTextAtCursor) === null || _b === void 0 ? void 0 : _b.call(_a, filePath);
            this.ui.requestRender();
        }
        catch (_d) {
            // Silently ignore clipboard errors (may not have permission, etc.)
        }
    }
    setupEditorSubmitHandler() {
        this.defaultEditor.onSubmit = async (text) => {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            text = text.trim();
            if (!text)
                return;
            // Handle commands
            if (text === "/settings") {
                this.showSettingsSelector();
                this.editor.setText("");
                return;
            }
            if (text === "/scoped-models") {
                this.editor.setText("");
                await this.showModelsSelector();
                return;
            }
            if (text === "/model" || text.startsWith("/model ")) {
                const searchTerm = text.startsWith("/model ") ? text.slice(7).trim() : undefined;
                this.editor.setText("");
                await this.handleModelCommand(searchTerm);
                return;
            }
            if (text.startsWith("/export")) {
                await this.handleExportCommand(text);
                this.editor.setText("");
                return;
            }
            if (text === "/share") {
                await this.handleShareCommand();
                this.editor.setText("");
                return;
            }
            if (text === "/copy") {
                this.handleCopyCommand();
                this.editor.setText("");
                return;
            }
            if (text === "/name" || text.startsWith("/name ")) {
                this.handleNameCommand(text);
                this.editor.setText("");
                return;
            }
            if (text === "/session") {
                this.handleSessionCommand();
                this.editor.setText("");
                return;
            }
            if (text === "/changelog") {
                this.handleChangelogCommand();
                this.editor.setText("");
                return;
            }
            if (text === "/hotkeys") {
                this.handleHotkeysCommand();
                this.editor.setText("");
                return;
            }
            if (text === "/fork") {
                this.showUserMessageSelector();
                this.editor.setText("");
                return;
            }
            if (text === "/tree") {
                this.showTreeSelector();
                this.editor.setText("");
                return;
            }
            if (text === "/login") {
                this.showOAuthSelector("login");
                this.editor.setText("");
                return;
            }
            if (text === "/logout") {
                this.showOAuthSelector("logout");
                this.editor.setText("");
                return;
            }
            if (text === "/new") {
                this.editor.setText("");
                await this.handleClearCommand();
                return;
            }
            if (text === "/compact" || text.startsWith("/compact ")) {
                const customInstructions = text.startsWith("/compact ") ? text.slice(9).trim() : undefined;
                this.editor.setText("");
                await this.handleCompactCommand(customInstructions);
                return;
            }
            if (text === "/reload") {
                this.editor.setText("");
                await this.handleReloadCommand();
                return;
            }
            if (text === "/debug") {
                this.handleDebugCommand();
                this.editor.setText("");
                return;
            }
            if (text === "/arminsayshi") {
                this.handleArminSaysHi();
                this.editor.setText("");
                return;
            }
            if (text === "/resume") {
                this.showSessionSelector();
                this.editor.setText("");
                return;
            }
            if (text === "/quit") {
                this.editor.setText("");
                await this.shutdown();
                return;
            }
            // Handle bash command (! for normal, !! for excluded from context)
            if (text.startsWith("!")) {
                const isExcluded = text.startsWith("!!");
                const command = isExcluded ? text.slice(2).trim() : text.slice(1).trim();
                if (command) {
                    if (this.session.isBashRunning) {
                        this.showWarning("A bash command is already running. Press Esc to cancel it first.");
                        this.editor.setText(text);
                        return;
                    }
                    (_b = (_a = this.editor).addToHistory) === null || _b === void 0 ? void 0 : _b.call(_a, text);
                    await this.handleBashCommand(command, isExcluded);
                    this.isBashMode = false;
                    this.updateEditorBorderColor();
                    return;
                }
            }
            // Queue input during compaction (extension commands execute immediately)
            if (this.session.isCompacting) {
                if (this.isExtensionCommand(text)) {
                    (_d = (_c = this.editor).addToHistory) === null || _d === void 0 ? void 0 : _d.call(_c, text);
                    this.editor.setText("");
                    await this.session.prompt(text);
                }
                else {
                    this.queueCompactionMessage(text, "steer");
                }
                return;
            }
            // If streaming, use prompt() with steer behavior
            // This handles extension commands (execute immediately), prompt template expansion, and queueing
            if (this.session.isStreaming) {
                (_f = (_e = this.editor).addToHistory) === null || _f === void 0 ? void 0 : _f.call(_e, text);
                this.editor.setText("");
                await this.session.prompt(text, { streamingBehavior: "steer" });
                this.updatePendingMessagesDisplay();
                this.ui.requestRender();
                return;
            }
            // Normal message submission
            // First, move any pending bash components to chat
            this.flushPendingBashComponents();
            if (this.onInputCallback) {
                this.onInputCallback(text);
            }
            (_h = (_g = this.editor).addToHistory) === null || _h === void 0 ? void 0 : _h.call(_g, text);
        };
    }
    subscribeToAgent() {
        this.unsubscribe = this.session.subscribe(async (event) => {
            await this.handleEvent(event);
        });
    }
    async handleEvent(event) {
        if (!this.isInitialized) {
            await this.init();
        }
        this.footer.invalidate();
        switch (event.type) {
            case "agent_start":
                // Restore main escape handler if retry handler is still active
                // (retry success event fires later, but we need main handler now)
                if (this.retryEscapeHandler) {
                    this.defaultEditor.onEscape = this.retryEscapeHandler;
                    this.retryEscapeHandler = undefined;
                }
                if (this.retryLoader) {
                    this.retryLoader.stop();
                    this.retryLoader = undefined;
                }
                if (this.loadingAnimation) {
                    this.loadingAnimation.stop();
                }
                this.statusContainer.clear();
                this.loadingAnimation = new pi_tui_1.Loader(this.ui, (spinner) => theme_js_1.theme.fg("accent", spinner), (text) => theme_js_1.theme.fg("muted", text), this.defaultWorkingMessage);
                this.statusContainer.addChild(this.loadingAnimation);
                // Apply any pending working message queued before loader existed
                if (this.pendingWorkingMessage !== undefined) {
                    if (this.pendingWorkingMessage) {
                        this.loadingAnimation.setMessage(this.pendingWorkingMessage);
                    }
                    this.pendingWorkingMessage = undefined;
                }
                this.ui.requestRender();
                break;
            case "message_start":
                if (event.message.role === "custom") {
                    this.addMessageToChat(event.message);
                    this.ui.requestRender();
                }
                else if (event.message.role === "user") {
                    this.addMessageToChat(event.message);
                    this.updatePendingMessagesDisplay();
                    this.ui.requestRender();
                }
                else if (event.message.role === "assistant") {
                    this.streamingComponent = new assistant_message_js_1.AssistantMessageComponent(undefined, this.hideThinkingBlock, this.getMarkdownThemeWithSettings());
                    this.streamingMessage = event.message;
                    this.chatContainer.addChild(this.streamingComponent);
                    this.streamingComponent.updateContent(this.streamingMessage);
                    this.ui.requestRender();
                }
                break;
            case "message_update":
                if (this.streamingComponent && event.message.role === "assistant") {
                    this.streamingMessage = event.message;
                    this.streamingComponent.updateContent(this.streamingMessage);
                    for (const content of this.streamingMessage.content) {
                        if (content.type === "toolCall") {
                            if (!this.pendingTools.has(content.id)) {
                                this.chatContainer.addChild(new pi_tui_1.Text("", 0, 0));
                                const component = new tool_execution_js_1.ToolExecutionComponent(content.name, content.arguments, {
                                    showImages: this.settingsManager.getShowImages(),
                                }, this.getRegisteredToolDefinition(content.name), this.ui);
                                component.setExpanded(this.toolOutputExpanded);
                                this.chatContainer.addChild(component);
                                this.pendingTools.set(content.id, component);
                            }
                            else {
                                const component = this.pendingTools.get(content.id);
                                if (component) {
                                    component.updateArgs(content.arguments);
                                }
                            }
                        }
                    }
                    this.ui.requestRender();
                }
                break;
            case "message_end":
                if (event.message.role === "user")
                    break;
                if (this.streamingComponent && event.message.role === "assistant") {
                    this.streamingMessage = event.message;
                    let errorMessage;
                    if (this.streamingMessage.stopReason === "aborted") {
                        const retryAttempt = this.session.retryAttempt;
                        errorMessage =
                            retryAttempt > 0
                                ? `Aborted after ${retryAttempt} retry attempt${retryAttempt > 1 ? "s" : ""}`
                                : "Operation aborted";
                        this.streamingMessage.errorMessage = errorMessage;
                    }
                    this.streamingComponent.updateContent(this.streamingMessage);
                    if (this.streamingMessage.stopReason === "aborted" || this.streamingMessage.stopReason === "error") {
                        if (!errorMessage) {
                            errorMessage = this.streamingMessage.errorMessage || "Error";
                        }
                        for (const [, component] of this.pendingTools.entries()) {
                            component.updateResult({
                                content: [{ type: "text", text: errorMessage }],
                                isError: true,
                            });
                        }
                        this.pendingTools.clear();
                    }
                    else {
                        // Args are now complete - trigger diff computation for edit tools
                        for (const [, component] of this.pendingTools.entries()) {
                            component.setArgsComplete();
                        }
                    }
                    this.streamingComponent = undefined;
                    this.streamingMessage = undefined;
                    this.footer.invalidate();
                }
                this.ui.requestRender();
                break;
            case "tool_execution_start": {
                if (!this.pendingTools.has(event.toolCallId)) {
                    const component = new tool_execution_js_1.ToolExecutionComponent(event.toolName, event.args, {
                        showImages: this.settingsManager.getShowImages(),
                    }, this.getRegisteredToolDefinition(event.toolName), this.ui);
                    component.setExpanded(this.toolOutputExpanded);
                    this.chatContainer.addChild(component);
                    this.pendingTools.set(event.toolCallId, component);
                    this.ui.requestRender();
                }
                break;
            }
            case "tool_execution_update": {
                const component = this.pendingTools.get(event.toolCallId);
                if (component) {
                    component.updateResult(Object.assign(Object.assign({}, event.partialResult), { isError: false }), true);
                    this.ui.requestRender();
                }
                break;
            }
            case "tool_execution_end": {
                const component = this.pendingTools.get(event.toolCallId);
                if (component) {
                    component.updateResult(Object.assign(Object.assign({}, event.result), { isError: event.isError }));
                    this.pendingTools.delete(event.toolCallId);
                    this.ui.requestRender();
                }
                break;
            }
            case "agent_end":
                if (this.loadingAnimation) {
                    this.loadingAnimation.stop();
                    this.loadingAnimation = undefined;
                    this.statusContainer.clear();
                }
                if (this.streamingComponent) {
                    this.chatContainer.removeChild(this.streamingComponent);
                    this.streamingComponent = undefined;
                    this.streamingMessage = undefined;
                }
                this.pendingTools.clear();
                await this.checkShutdownRequested();
                this.ui.requestRender();
                break;
            case "auto_compaction_start": {
                // Keep editor active; submissions are queued during compaction.
                // Set up escape to abort auto-compaction
                this.autoCompactionEscapeHandler = this.defaultEditor.onEscape;
                this.defaultEditor.onEscape = () => {
                    this.session.abortCompaction();
                };
                // Show compacting indicator with reason
                this.statusContainer.clear();
                const reasonText = event.reason === "overflow" ? "Context overflow detected, " : "";
                this.autoCompactionLoader = new pi_tui_1.Loader(this.ui, (spinner) => theme_js_1.theme.fg("accent", spinner), (text) => theme_js_1.theme.fg("muted", text), `${reasonText}Auto-compacting... (${(0, keybinding_hints_js_1.appKey)(this.keybindings, "interrupt")} to cancel)`);
                this.statusContainer.addChild(this.autoCompactionLoader);
                this.ui.requestRender();
                break;
            }
            case "auto_compaction_end": {
                // Restore escape handler
                if (this.autoCompactionEscapeHandler) {
                    this.defaultEditor.onEscape = this.autoCompactionEscapeHandler;
                    this.autoCompactionEscapeHandler = undefined;
                }
                // Stop loader
                if (this.autoCompactionLoader) {
                    this.autoCompactionLoader.stop();
                    this.autoCompactionLoader = undefined;
                    this.statusContainer.clear();
                }
                // Handle result
                if (event.aborted) {
                    this.showStatus("Auto-compaction cancelled");
                }
                else if (event.result) {
                    // Rebuild chat to show compacted state
                    this.chatContainer.clear();
                    this.rebuildChatFromMessages();
                    // Add compaction component at bottom so user sees it without scrolling
                    this.addMessageToChat({
                        role: "compactionSummary",
                        tokensBefore: event.result.tokensBefore,
                        summary: event.result.summary,
                        timestamp: Date.now(),
                    });
                    this.footer.invalidate();
                }
                else if (event.errorMessage) {
                    // Compaction failed (e.g., quota exceeded, API error)
                    this.chatContainer.addChild(new pi_tui_1.Spacer(1));
                    this.chatContainer.addChild(new pi_tui_1.Text(theme_js_1.theme.fg("error", event.errorMessage), 1, 0));
                }
                void this.flushCompactionQueue({ willRetry: event.willRetry });
                this.ui.requestRender();
                break;
            }
            case "auto_retry_start": {
                // Set up escape to abort retry
                this.retryEscapeHandler = this.defaultEditor.onEscape;
                this.defaultEditor.onEscape = () => {
                    this.session.abortRetry();
                };
                // Show retry indicator
                this.statusContainer.clear();
                const delaySeconds = Math.round(event.delayMs / 1000);
                this.retryLoader = new pi_tui_1.Loader(this.ui, (spinner) => theme_js_1.theme.fg("warning", spinner), (text) => theme_js_1.theme.fg("muted", text), `Retrying (${event.attempt}/${event.maxAttempts}) in ${delaySeconds}s... (${(0, keybinding_hints_js_1.appKey)(this.keybindings, "interrupt")} to cancel)`);
                this.statusContainer.addChild(this.retryLoader);
                this.ui.requestRender();
                break;
            }
            case "auto_retry_end": {
                // Restore escape handler
                if (this.retryEscapeHandler) {
                    this.defaultEditor.onEscape = this.retryEscapeHandler;
                    this.retryEscapeHandler = undefined;
                }
                // Stop loader
                if (this.retryLoader) {
                    this.retryLoader.stop();
                    this.retryLoader = undefined;
                    this.statusContainer.clear();
                }
                // Show error only on final failure (success shows normal response)
                if (!event.success) {
                    this.showError(`Retry failed after ${event.attempt} attempts: ${event.finalError || "Unknown error"}`);
                }
                this.ui.requestRender();
                break;
            }
        }
    }
    /** Extract text content from a user message */
    getUserMessageText(message) {
        if (message.role !== "user")
            return "";
        const textBlocks = typeof message.content === "string"
            ? [{ type: "text", text: message.content }]
            : message.content.filter((c) => c.type === "text");
        return textBlocks.map((c) => c.text).join("");
    }
    /**
     * Show a status message in the chat.
     *
     * If multiple status messages are emitted back-to-back (without anything else being added to the chat),
     * we update the previous status line instead of appending new ones to avoid log spam.
     */
    showStatus(message) {
        const children = this.chatContainer.children;
        const last = children.length > 0 ? children[children.length - 1] : undefined;
        const secondLast = children.length > 1 ? children[children.length - 2] : undefined;
        if (last && secondLast && last === this.lastStatusText && secondLast === this.lastStatusSpacer) {
            this.lastStatusText.setText(theme_js_1.theme.fg("dim", message));
            this.ui.requestRender();
            return;
        }
        const spacer = new pi_tui_1.Spacer(1);
        const text = new pi_tui_1.Text(theme_js_1.theme.fg("dim", message), 1, 0);
        this.chatContainer.addChild(spacer);
        this.chatContainer.addChild(text);
        this.lastStatusSpacer = spacer;
        this.lastStatusText = text;
        this.ui.requestRender();
    }
    addMessageToChat(message, options) {
        var _a, _b, _c;
        switch (message.role) {
            case "bashExecution": {
                const component = new bash_execution_js_1.BashExecutionComponent(message.command, this.ui, message.excludeFromContext);
                if (message.output) {
                    component.appendOutput(message.output);
                }
                component.setComplete(message.exitCode, message.cancelled, message.truncated ? { truncated: true } : undefined, message.fullOutputPath);
                this.chatContainer.addChild(component);
                break;
            }
            case "custom": {
                if (message.display) {
                    const renderer = (_a = this.session.extensionRunner) === null || _a === void 0 ? void 0 : _a.getMessageRenderer(message.customType);
                    const component = new custom_message_js_1.CustomMessageComponent(message, renderer, this.getMarkdownThemeWithSettings());
                    component.setExpanded(this.toolOutputExpanded);
                    this.chatContainer.addChild(component);
                }
                break;
            }
            case "compactionSummary": {
                this.chatContainer.addChild(new pi_tui_1.Spacer(1));
                const component = new compaction_summary_message_js_1.CompactionSummaryMessageComponent(message, this.getMarkdownThemeWithSettings());
                component.setExpanded(this.toolOutputExpanded);
                this.chatContainer.addChild(component);
                break;
            }
            case "branchSummary": {
                this.chatContainer.addChild(new pi_tui_1.Spacer(1));
                const component = new branch_summary_message_js_1.BranchSummaryMessageComponent(message, this.getMarkdownThemeWithSettings());
                component.setExpanded(this.toolOutputExpanded);
                this.chatContainer.addChild(component);
                break;
            }
            case "user": {
                const textContent = this.getUserMessageText(message);
                if (textContent) {
                    const skillBlock = (0, agent_session_js_1.parseSkillBlock)(textContent);
                    if (skillBlock) {
                        // Render skill block (collapsible)
                        this.chatContainer.addChild(new pi_tui_1.Spacer(1));
                        const component = new skill_invocation_message_js_1.SkillInvocationMessageComponent(skillBlock, this.getMarkdownThemeWithSettings());
                        component.setExpanded(this.toolOutputExpanded);
                        this.chatContainer.addChild(component);
                        // Render user message separately if present
                        if (skillBlock.userMessage) {
                            const userComponent = new user_message_js_1.UserMessageComponent(skillBlock.userMessage, this.getMarkdownThemeWithSettings());
                            this.chatContainer.addChild(userComponent);
                        }
                    }
                    else {
                        const userComponent = new user_message_js_1.UserMessageComponent(textContent, this.getMarkdownThemeWithSettings());
                        this.chatContainer.addChild(userComponent);
                    }
                    if (options === null || options === void 0 ? void 0 : options.populateHistory) {
                        (_c = (_b = this.editor).addToHistory) === null || _c === void 0 ? void 0 : _c.call(_b, textContent);
                    }
                }
                break;
            }
            case "assistant": {
                const assistantComponent = new assistant_message_js_1.AssistantMessageComponent(message, this.hideThinkingBlock, this.getMarkdownThemeWithSettings());
                this.chatContainer.addChild(assistantComponent);
                break;
            }
            case "toolResult": {
                // Tool results are rendered inline with tool calls, handled separately
                break;
            }
            default: {
                const _exhaustive = message;
            }
        }
    }
    /**
     * Render session context to chat. Used for initial load and rebuild after compaction.
     * @param sessionContext Session context to render
     * @param options.updateFooter Update footer state
     * @param options.populateHistory Add user messages to editor history
     */
    renderSessionContext(sessionContext, options = {}) {
        this.pendingTools.clear();
        if (options.updateFooter) {
            this.footer.invalidate();
            this.updateEditorBorderColor();
        }
        for (const message of sessionContext.messages) {
            // Assistant messages need special handling for tool calls
            if (message.role === "assistant") {
                this.addMessageToChat(message);
                // Render tool call components
                for (const content of message.content) {
                    if (content.type === "toolCall") {
                        const component = new tool_execution_js_1.ToolExecutionComponent(content.name, content.arguments, { showImages: this.settingsManager.getShowImages() }, this.getRegisteredToolDefinition(content.name), this.ui);
                        component.setExpanded(this.toolOutputExpanded);
                        this.chatContainer.addChild(component);
                        if (message.stopReason === "aborted" || message.stopReason === "error") {
                            let errorMessage;
                            if (message.stopReason === "aborted") {
                                const retryAttempt = this.session.retryAttempt;
                                errorMessage =
                                    retryAttempt > 0
                                        ? `Aborted after ${retryAttempt} retry attempt${retryAttempt > 1 ? "s" : ""}`
                                        : "Operation aborted";
                            }
                            else {
                                errorMessage = message.errorMessage || "Error";
                            }
                            component.updateResult({ content: [{ type: "text", text: errorMessage }], isError: true });
                        }
                        else {
                            this.pendingTools.set(content.id, component);
                        }
                    }
                }
            }
            else if (message.role === "toolResult") {
                // Match tool results to pending tool components
                const component = this.pendingTools.get(message.toolCallId);
                if (component) {
                    component.updateResult(message);
                    this.pendingTools.delete(message.toolCallId);
                }
            }
            else {
                // All other messages use standard rendering
                this.addMessageToChat(message, options);
            }
        }
        this.pendingTools.clear();
        this.ui.requestRender();
    }
    renderInitialMessages() {
        // Get aligned messages and entries from session context
        const context = this.sessionManager.buildSessionContext();
        this.renderSessionContext(context, {
            updateFooter: true,
            populateHistory: true,
        });
        // Show compaction info if session was compacted
        const allEntries = this.sessionManager.getEntries();
        const compactionCount = allEntries.filter((e) => e.type === "compaction").length;
        if (compactionCount > 0) {
            const times = compactionCount === 1 ? "1 time" : `${compactionCount} times`;
            this.showStatus(`Session compacted ${times}`);
        }
    }
    async getUserInput() {
        return new Promise((resolve) => {
            this.onInputCallback = (text) => {
                this.onInputCallback = undefined;
                resolve(text);
            };
        });
    }
    rebuildChatFromMessages() {
        this.chatContainer.clear();
        const context = this.sessionManager.buildSessionContext();
        this.renderSessionContext(context);
    }
    // =========================================================================
    // Key handlers
    // =========================================================================
    handleCtrlC() {
        const now = Date.now();
        if (now - this.lastSigintTime < 500) {
            void this.shutdown();
        }
        else {
            this.clearEditor();
            this.lastSigintTime = now;
        }
    }
    handleCtrlD() {
        // Only called when editor is empty (enforced by CustomEditor)
        void this.shutdown();
    }
    /**
     * Gracefully shutdown the agent.
     * Emits shutdown event to extensions, then exits.
     */
    isShuttingDown = false;
    async shutdown() {
        if (this.isShuttingDown)
            return;
        this.isShuttingDown = true;
        // Emit shutdown event to extensions
        const extensionRunner = this.session.extensionRunner;
        if (extensionRunner === null || extensionRunner === void 0 ? void 0 : extensionRunner.hasHandlers("session_shutdown")) {
            await extensionRunner.emit({
                type: "session_shutdown",
            });
        }
        // Wait for any pending renders to complete
        // requestRender() uses process.nextTick(), so we wait one tick
        await new Promise((resolve) => process.nextTick(resolve));
        // Drain any in-flight Kitty key release events before stopping.
        // This prevents escape sequences from leaking to the parent shell over slow SSH.
        await this.ui.terminal.drainInput(1000);
        this.stop();
        process.exit(0);
    }
    /**
     * Check if shutdown was requested and perform shutdown if so.
     */
    async checkShutdownRequested() {
        if (!this.shutdownRequested)
            return;
        await this.shutdown();
    }
    handleCtrlZ() {
        // Set up handler to restore TUI when resumed
        process.once("SIGCONT", () => {
            this.ui.start();
            this.ui.requestRender(true);
        });
        // Stop the TUI (restore terminal to normal mode)
        this.ui.stop();
        // Send SIGTSTP to process group (pid=0 means all processes in group)
        process.kill(0, "SIGTSTP");
    }
    async handleFollowUp() {
        var _a, _b, _c, _d, _e, _f;
        var _g;
        const text = ((_g = (_b = (_a = this.editor).getExpandedText) === null || _b === void 0 ? void 0 : _b.call(_a)) !== null && _g !== void 0 ? _g : this.editor.getText()).trim();
        if (!text)
            return;
        // Queue input during compaction (extension commands execute immediately)
        if (this.session.isCompacting) {
            if (this.isExtensionCommand(text)) {
                (_d = (_c = this.editor).addToHistory) === null || _d === void 0 ? void 0 : _d.call(_c, text);
                this.editor.setText("");
                await this.session.prompt(text);
            }
            else {
                this.queueCompactionMessage(text, "followUp");
            }
            return;
        }
        // Alt+Enter queues a follow-up message (waits until agent finishes)
        // This handles extension commands (execute immediately), prompt template expansion, and queueing
        if (this.session.isStreaming) {
            (_f = (_e = this.editor).addToHistory) === null || _f === void 0 ? void 0 : _f.call(_e, text);
            this.editor.setText("");
            await this.session.prompt(text, { streamingBehavior: "followUp" });
            this.updatePendingMessagesDisplay();
            this.ui.requestRender();
        }
        // If not streaming, Alt+Enter acts like regular Enter (trigger onSubmit)
        else if (this.editor.onSubmit) {
            this.editor.onSubmit(text);
        }
    }
    handleDequeue() {
        const restored = this.restoreQueuedMessagesToEditor();
        if (restored === 0) {
            this.showStatus("No queued messages to restore");
        }
        else {
            this.showStatus(`Restored ${restored} queued message${restored > 1 ? "s" : ""} to editor`);
        }
    }
    updateEditorBorderColor() {
        if (this.isBashMode) {
            this.editor.borderColor = theme_js_1.theme.getBashModeBorderColor();
        }
        else {
            const level = this.session.thinkingLevel || "off";
            this.editor.borderColor = theme_js_1.theme.getThinkingBorderColor(level);
        }
        this.ui.requestRender();
    }
    cycleThinkingLevel() {
        const newLevel = this.session.cycleThinkingLevel();
        if (newLevel === undefined) {
            this.showStatus("Current model does not support thinking");
        }
        else {
            this.footer.invalidate();
            this.updateEditorBorderColor();
            this.showStatus(`Thinking level: ${newLevel}`);
        }
    }
    async cycleModel(direction) {
        try {
            const result = await this.session.cycleModel(direction);
            if (result === undefined) {
                const msg = this.session.scopedModels.length > 0 ? "Only one model in scope" : "Only one model available";
                this.showStatus(msg);
            }
            else {
                this.footer.invalidate();
                this.updateEditorBorderColor();
                const thinkingStr = result.model.reasoning && result.thinkingLevel !== "off" ? ` (thinking: ${result.thinkingLevel})` : "";
                this.showStatus(`Switched to ${result.model.name || result.model.id}${thinkingStr}`);
            }
        }
        catch (error) {
            this.showError(error instanceof Error ? error.message : String(error));
        }
    }
    toggleToolOutputExpansion() {
        this.setToolsExpanded(!this.toolOutputExpanded);
    }
    setToolsExpanded(expanded) {
        this.toolOutputExpanded = expanded;
        for (const child of this.chatContainer.children) {
            if (isExpandable(child)) {
                child.setExpanded(expanded);
            }
        }
        this.ui.requestRender();
    }
    toggleThinkingBlockVisibility() {
        this.hideThinkingBlock = !this.hideThinkingBlock;
        this.settingsManager.setHideThinkingBlock(this.hideThinkingBlock);
        // Rebuild chat from session messages
        this.chatContainer.clear();
        this.rebuildChatFromMessages();
        // If streaming, re-add the streaming component with updated visibility and re-render
        if (this.streamingComponent && this.streamingMessage) {
            this.streamingComponent.setHideThinkingBlock(this.hideThinkingBlock);
            this.streamingComponent.updateContent(this.streamingMessage);
            this.chatContainer.addChild(this.streamingComponent);
        }
        this.showStatus(`Thinking blocks: ${this.hideThinkingBlock ? "hidden" : "visible"}`);
    }
    openExternalEditor() {
        var _a, _b;
        var _c;
        // Determine editor (respect $VISUAL, then $EDITOR)
        const editorCmd = process.env.VISUAL || process.env.EDITOR;
        if (!editorCmd) {
            this.showWarning("No editor configured. Set $VISUAL or $EDITOR environment variable.");
            return;
        }
        const currentText = (_c = (_b = (_a = this.editor).getExpandedText) === null || _b === void 0 ? void 0 : _b.call(_a)) !== null && _c !== void 0 ? _c : this.editor.getText();
        const tmpFile = path.join(os.tmpdir(), `pi-editor-${Date.now()}.pi.md`);
        try {
            // Write current content to temp file
            fs.writeFileSync(tmpFile, currentText, "utf-8");
            // Stop TUI to release terminal
            this.ui.stop();
            // Split by space to support editor arguments (e.g., "code --wait")
            const [editor, ...editorArgs] = editorCmd.split(" ");
            // Spawn editor synchronously with inherited stdio for interactive editing
            const result = (0, child_process_1.spawnSync)(editor, [...editorArgs, tmpFile], {
                stdio: "inherit",
            });
            // On successful exit (status 0), replace editor content
            if (result.status === 0) {
                const newContent = fs.readFileSync(tmpFile, "utf-8").replace(/\n$/, "");
                this.editor.setText(newContent);
            }
            // On non-zero exit, keep original text (no action needed)
        }
        finally {
            // Clean up temp file
            try {
                fs.unlinkSync(tmpFile);
            }
            catch (_d) {
                // Ignore cleanup errors
            }
            // Restart TUI
            this.ui.start();
            // Force full re-render since external editor uses alternate screen
            this.ui.requestRender(true);
        }
    }
    // =========================================================================
    // UI helpers
    // =========================================================================
    clearEditor() {
        this.editor.setText("");
        this.ui.requestRender();
    }
    showError(errorMessage) {
        this.chatContainer.addChild(new pi_tui_1.Spacer(1));
        this.chatContainer.addChild(new pi_tui_1.Text(theme_js_1.theme.fg("error", `Error: ${errorMessage}`), 1, 0));
        this.ui.requestRender();
    }
    showWarning(warningMessage) {
        this.chatContainer.addChild(new pi_tui_1.Spacer(1));
        this.chatContainer.addChild(new pi_tui_1.Text(theme_js_1.theme.fg("warning", `Warning: ${warningMessage}`), 1, 0));
        this.ui.requestRender();
    }
    showNewVersionNotification(newVersion) {
        const action = theme_js_1.theme.fg("accent", (0, config_js_1.getUpdateInstruction)("@mariozechner/pi-coding-agent"));
        const updateInstruction = theme_js_1.theme.fg("muted", `New version ${newVersion} is available. `) + action;
        const changelogUrl = theme_js_1.theme.fg("accent", "https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/CHANGELOG.md");
        const changelogLine = theme_js_1.theme.fg("muted", "Changelog: ") + changelogUrl;
        this.chatContainer.addChild(new pi_tui_1.Spacer(1));
        this.chatContainer.addChild(new dynamic_border_js_1.DynamicBorder((text) => theme_js_1.theme.fg("warning", text)));
        this.chatContainer.addChild(new pi_tui_1.Text(`${theme_js_1.theme.bold(theme_js_1.theme.fg("warning", "Update Available"))}\n${updateInstruction}\n${changelogLine}`, 1, 0));
        this.chatContainer.addChild(new dynamic_border_js_1.DynamicBorder((text) => theme_js_1.theme.fg("warning", text)));
        this.ui.requestRender();
    }
    /**
     * Get all queued messages (read-only).
     * Combines session queue and compaction queue.
     */
    getAllQueuedMessages() {
        return {
            steering: [
                ...this.session.getSteeringMessages(),
                ...this.compactionQueuedMessages.filter((msg) => msg.mode === "steer").map((msg) => msg.text),
            ],
            followUp: [
                ...this.session.getFollowUpMessages(),
                ...this.compactionQueuedMessages.filter((msg) => msg.mode === "followUp").map((msg) => msg.text),
            ],
        };
    }
    /**
     * Clear all queued messages and return their contents.
     * Clears both session queue and compaction queue.
     */
    clearAllQueues() {
        const { steering, followUp } = this.session.clearQueue();
        const compactionSteering = this.compactionQueuedMessages
            .filter((msg) => msg.mode === "steer")
            .map((msg) => msg.text);
        const compactionFollowUp = this.compactionQueuedMessages
            .filter((msg) => msg.mode === "followUp")
            .map((msg) => msg.text);
        this.compactionQueuedMessages = [];
        return {
            steering: [...steering, ...compactionSteering],
            followUp: [...followUp, ...compactionFollowUp],
        };
    }
    updatePendingMessagesDisplay() {
        this.pendingMessagesContainer.clear();
        const { steering: steeringMessages, followUp: followUpMessages } = this.getAllQueuedMessages();
        if (steeringMessages.length > 0 || followUpMessages.length > 0) {
            this.pendingMessagesContainer.addChild(new pi_tui_1.Spacer(1));
            for (const message of steeringMessages) {
                const text = theme_js_1.theme.fg("dim", `Steering: ${message}`);
                this.pendingMessagesContainer.addChild(new pi_tui_1.TruncatedText(text, 1, 0));
            }
            for (const message of followUpMessages) {
                const text = theme_js_1.theme.fg("dim", `Follow-up: ${message}`);
                this.pendingMessagesContainer.addChild(new pi_tui_1.TruncatedText(text, 1, 0));
            }
            const dequeueHint = this.getAppKeyDisplay("dequeue");
            const hintText = theme_js_1.theme.fg("dim", `↳ ${dequeueHint} to edit all queued messages`);
            this.pendingMessagesContainer.addChild(new pi_tui_1.TruncatedText(hintText, 1, 0));
        }
    }
    restoreQueuedMessagesToEditor(options) {
        var _a;
        const { steering, followUp } = this.clearAllQueues();
        const allQueued = [...steering, ...followUp];
        if (allQueued.length === 0) {
            this.updatePendingMessagesDisplay();
            if (options === null || options === void 0 ? void 0 : options.abort) {
                this.agent.abort();
            }
            return 0;
        }
        const queuedText = allQueued.join("\n\n");
        const currentText = (_a = options === null || options === void 0 ? void 0 : options.currentText) !== null && _a !== void 0 ? _a : this.editor.getText();
        const combinedText = [queuedText, currentText].filter((t) => t.trim()).join("\n\n");
        this.editor.setText(combinedText);
        this.updatePendingMessagesDisplay();
        if (options === null || options === void 0 ? void 0 : options.abort) {
            this.agent.abort();
        }
        return allQueued.length;
    }
    queueCompactionMessage(text, mode) {
        var _a, _b;
        this.compactionQueuedMessages.push({ text, mode });
        (_b = (_a = this.editor).addToHistory) === null || _b === void 0 ? void 0 : _b.call(_a, text);
        this.editor.setText("");
        this.updatePendingMessagesDisplay();
        this.showStatus("Queued message for after compaction");
    }
    isExtensionCommand(text) {
        if (!text.startsWith("/"))
            return false;
        const extensionRunner = this.session.extensionRunner;
        if (!extensionRunner)
            return false;
        const spaceIndex = text.indexOf(" ");
        const commandName = spaceIndex === -1 ? text.slice(1) : text.slice(1, spaceIndex);
        return !!extensionRunner.getCommand(commandName);
    }
    async flushCompactionQueue(options) {
        if (this.compactionQueuedMessages.length === 0) {
            return;
        }
        const queuedMessages = [...this.compactionQueuedMessages];
        this.compactionQueuedMessages = [];
        this.updatePendingMessagesDisplay();
        const restoreQueue = (error) => {
            this.session.clearQueue();
            this.compactionQueuedMessages = queuedMessages;
            this.updatePendingMessagesDisplay();
            this.showError(`Failed to send queued message${queuedMessages.length > 1 ? "s" : ""}: ${error instanceof Error ? error.message : String(error)}`);
        };
        try {
            if (options === null || options === void 0 ? void 0 : options.willRetry) {
                // When retry is pending, queue messages for the retry turn
                for (const message of queuedMessages) {
                    if (this.isExtensionCommand(message.text)) {
                        await this.session.prompt(message.text);
                    }
                    else if (message.mode === "followUp") {
                        await this.session.followUp(message.text);
                    }
                    else {
                        await this.session.steer(message.text);
                    }
                }
                this.updatePendingMessagesDisplay();
                return;
            }
            // Find first non-extension-command message to use as prompt
            const firstPromptIndex = queuedMessages.findIndex((message) => !this.isExtensionCommand(message.text));
            if (firstPromptIndex === -1) {
                // All extension commands - execute them all
                for (const message of queuedMessages) {
                    await this.session.prompt(message.text);
                }
                return;
            }
            // Execute any extension commands before the first prompt
            const preCommands = queuedMessages.slice(0, firstPromptIndex);
            const firstPrompt = queuedMessages[firstPromptIndex];
            const rest = queuedMessages.slice(firstPromptIndex + 1);
            for (const message of preCommands) {
                await this.session.prompt(message.text);
            }
            // Send first prompt (starts streaming)
            const promptPromise = this.session.prompt(firstPrompt.text).catch((error) => {
                restoreQueue(error);
            });
            // Queue remaining messages
            for (const message of rest) {
                if (this.isExtensionCommand(message.text)) {
                    await this.session.prompt(message.text);
                }
                else if (message.mode === "followUp") {
                    await this.session.followUp(message.text);
                }
                else {
                    await this.session.steer(message.text);
                }
            }
            this.updatePendingMessagesDisplay();
            void promptPromise;
        }
        catch (error) {
            restoreQueue(error);
        }
    }
    /** Move pending bash components from pending area to chat */
    flushPendingBashComponents() {
        for (const component of this.pendingBashComponents) {
            this.pendingMessagesContainer.removeChild(component);
            this.chatContainer.addChild(component);
        }
        this.pendingBashComponents = [];
    }
    // =========================================================================
    // Selectors
    // =========================================================================
    /**
     * Shows a selector component in place of the editor.
     * @param create Factory that receives a `done` callback and returns the component and focus target
     */
    showSelector(create) {
        const done = () => {
            this.editorContainer.clear();
            this.editorContainer.addChild(this.editor);
            this.ui.setFocus(this.editor);
        };
        const { component, focus } = create(done);
        this.editorContainer.clear();
        this.editorContainer.addChild(component);
        this.ui.setFocus(focus);
        this.ui.requestRender();
    }
    showSettingsSelector() {
        this.showSelector((done) => {
            const selector = new settings_selector_js_1.SettingsSelectorComponent({
                autoCompact: this.session.autoCompactionEnabled,
                showImages: this.settingsManager.getShowImages(),
                autoResizeImages: this.settingsManager.getImageAutoResize(),
                blockImages: this.settingsManager.getBlockImages(),
                enableSkillCommands: this.settingsManager.getEnableSkillCommands(),
                steeringMode: this.session.steeringMode,
                followUpMode: this.session.followUpMode,
                thinkingLevel: this.session.thinkingLevel,
                availableThinkingLevels: this.session.getAvailableThinkingLevels(),
                currentTheme: this.settingsManager.getTheme() || "dark",
                availableThemes: (0, theme_js_1.getAvailableThemes)(),
                hideThinkingBlock: this.hideThinkingBlock,
                collapseChangelog: this.settingsManager.getCollapseChangelog(),
                doubleEscapeAction: this.settingsManager.getDoubleEscapeAction(),
                showHardwareCursor: this.settingsManager.getShowHardwareCursor(),
                editorPaddingX: this.settingsManager.getEditorPaddingX(),
                autocompleteMaxVisible: this.settingsManager.getAutocompleteMaxVisible(),
                quietStartup: this.settingsManager.getQuietStartup(),
                clearOnShrink: this.settingsManager.getClearOnShrink(),
            }, {
                onAutoCompactChange: (enabled) => {
                    this.session.setAutoCompactionEnabled(enabled);
                    this.footer.setAutoCompactEnabled(enabled);
                },
                onShowImagesChange: (enabled) => {
                    this.settingsManager.setShowImages(enabled);
                    for (const child of this.chatContainer.children) {
                        if (child instanceof tool_execution_js_1.ToolExecutionComponent) {
                            child.setShowImages(enabled);
                        }
                    }
                },
                onAutoResizeImagesChange: (enabled) => {
                    this.settingsManager.setImageAutoResize(enabled);
                },
                onBlockImagesChange: (blocked) => {
                    this.settingsManager.setBlockImages(blocked);
                },
                onEnableSkillCommandsChange: (enabled) => {
                    this.settingsManager.setEnableSkillCommands(enabled);
                    this.setupAutocomplete(this.fdPath);
                },
                onSteeringModeChange: (mode) => {
                    this.session.setSteeringMode(mode);
                },
                onFollowUpModeChange: (mode) => {
                    this.session.setFollowUpMode(mode);
                },
                onThinkingLevelChange: (level) => {
                    this.session.setThinkingLevel(level);
                    this.footer.invalidate();
                    this.updateEditorBorderColor();
                },
                onThemeChange: (themeName) => {
                    const result = (0, theme_js_1.setTheme)(themeName, true);
                    this.settingsManager.setTheme(themeName);
                    this.ui.invalidate();
                    if (!result.success) {
                        this.showError(`Failed to load theme "${themeName}": ${result.error}\nFell back to dark theme.`);
                    }
                },
                onThemePreview: (themeName) => {
                    const result = (0, theme_js_1.setTheme)(themeName, true);
                    if (result.success) {
                        this.ui.invalidate();
                        this.ui.requestRender();
                    }
                },
                onHideThinkingBlockChange: (hidden) => {
                    this.hideThinkingBlock = hidden;
                    this.settingsManager.setHideThinkingBlock(hidden);
                    for (const child of this.chatContainer.children) {
                        if (child instanceof assistant_message_js_1.AssistantMessageComponent) {
                            child.setHideThinkingBlock(hidden);
                        }
                    }
                    this.chatContainer.clear();
                    this.rebuildChatFromMessages();
                },
                onCollapseChangelogChange: (collapsed) => {
                    this.settingsManager.setCollapseChangelog(collapsed);
                },
                onQuietStartupChange: (enabled) => {
                    this.settingsManager.setQuietStartup(enabled);
                },
                onDoubleEscapeActionChange: (action) => {
                    this.settingsManager.setDoubleEscapeAction(action);
                },
                onShowHardwareCursorChange: (enabled) => {
                    this.settingsManager.setShowHardwareCursor(enabled);
                    this.ui.setShowHardwareCursor(enabled);
                },
                onEditorPaddingXChange: (padding) => {
                    this.settingsManager.setEditorPaddingX(padding);
                    this.defaultEditor.setPaddingX(padding);
                    if (this.editor !== this.defaultEditor && this.editor.setPaddingX !== undefined) {
                        this.editor.setPaddingX(padding);
                    }
                },
                onAutocompleteMaxVisibleChange: (maxVisible) => {
                    this.settingsManager.setAutocompleteMaxVisible(maxVisible);
                    this.defaultEditor.setAutocompleteMaxVisible(maxVisible);
                    if (this.editor !== this.defaultEditor && this.editor.setAutocompleteMaxVisible !== undefined) {
                        this.editor.setAutocompleteMaxVisible(maxVisible);
                    }
                },
                onClearOnShrinkChange: (enabled) => {
                    this.settingsManager.setClearOnShrink(enabled);
                    this.ui.setClearOnShrink(enabled);
                },
                onCancel: () => {
                    done();
                    this.ui.requestRender();
                },
            });
            return { component: selector, focus: selector.getSettingsList() };
        });
    }
    async handleModelCommand(searchTerm) {
        if (!searchTerm) {
            this.showModelSelector();
            return;
        }
        const model = await this.findExactModelMatch(searchTerm);
        if (model) {
            try {
                await this.session.setModel(model);
                this.footer.invalidate();
                this.updateEditorBorderColor();
                this.showStatus(`Model: ${model.id}`);
                this.checkDaxnutsEasterEgg(model);
            }
            catch (error) {
                this.showError(error instanceof Error ? error.message : String(error));
            }
            return;
        }
        this.showModelSelector(searchTerm);
    }
    async findExactModelMatch(searchTerm) {
        var _a, _b;
        var _c;
        const term = searchTerm.trim();
        if (!term)
            return undefined;
        let targetProvider;
        let targetModelId = "";
        if (term.includes("/")) {
            const parts = term.split("/", 2);
            targetProvider = (_a = parts[0]) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase();
            targetModelId = (_c = (_b = parts[1]) === null || _b === void 0 ? void 0 : _b.trim().toLowerCase()) !== null && _c !== void 0 ? _c : "";
        }
        else {
            targetModelId = term.toLowerCase();
        }
        if (!targetModelId)
            return undefined;
        const models = await this.getModelCandidates();
        const exactMatches = models.filter((item) => {
            const idMatch = item.id.toLowerCase() === targetModelId;
            const providerMatch = !targetProvider || item.provider.toLowerCase() === targetProvider;
            return idMatch && providerMatch;
        });
        return exactMatches.length === 1 ? exactMatches[0] : undefined;
    }
    async getModelCandidates() {
        if (this.session.scopedModels.length > 0) {
            return this.session.scopedModels.map((scoped) => scoped.model);
        }
        this.session.modelRegistry.refresh();
        try {
            return await this.session.modelRegistry.getAvailable();
        }
        catch (_a) {
            return [];
        }
    }
    /** Update the footer's available provider count from current model candidates */
    async updateAvailableProviderCount() {
        const models = await this.getModelCandidates();
        const uniqueProviders = new Set(models.map((m) => m.provider));
        this.footerDataProvider.setAvailableProviderCount(uniqueProviders.size);
    }
    showModelSelector(initialSearchInput) {
        this.showSelector((done) => {
            const selector = new model_selector_js_1.ModelSelectorComponent(this.ui, this.session.model, this.settingsManager, this.session.modelRegistry, this.session.scopedModels, async (model) => {
                try {
                    await this.session.setModel(model);
                    this.footer.invalidate();
                    this.updateEditorBorderColor();
                    done();
                    this.showStatus(`Model: ${model.id}`);
                    this.checkDaxnutsEasterEgg(model);
                }
                catch (error) {
                    done();
                    this.showError(error instanceof Error ? error.message : String(error));
                }
            }, () => {
                done();
                this.ui.requestRender();
            }, initialSearchInput);
            return { component: selector, focus: selector };
        });
    }
    async showModelsSelector() {
        // Get all available models
        this.session.modelRegistry.refresh();
        const allModels = this.session.modelRegistry.getAvailable();
        if (allModels.length === 0) {
            this.showStatus("No models available");
            return;
        }
        // Check if session has scoped models (from previous session-only changes or CLI --models)
        const sessionScopedModels = this.session.scopedModels;
        const hasSessionScope = sessionScopedModels.length > 0;
        // Build enabled model IDs from session state or settings
        const enabledModelIds = new Set();
        let hasFilter = false;
        if (hasSessionScope) {
            // Use current session's scoped models
            for (const sm of sessionScopedModels) {
                enabledModelIds.add(`${sm.model.provider}/${sm.model.id}`);
            }
            hasFilter = true;
        }
        else {
            // Fall back to settings
            const patterns = this.settingsManager.getEnabledModels();
            if (patterns !== undefined && patterns.length > 0) {
                hasFilter = true;
                const scopedModels = await (0, model_resolver_js_1.resolveModelScope)(patterns, this.session.modelRegistry);
                for (const sm of scopedModels) {
                    enabledModelIds.add(`${sm.model.provider}/${sm.model.id}`);
                }
            }
        }
        // Track current enabled state (session-only until persisted)
        const currentEnabledIds = new Set(enabledModelIds);
        let currentHasFilter = hasFilter;
        // Helper to update session's scoped models (session-only, no persist)
        const updateSessionModels = async (enabledIds) => {
            if (enabledIds.size > 0 && enabledIds.size < allModels.length) {
                // Use current session thinking level, not settings default
                const currentThinkingLevel = this.session.thinkingLevel;
                const newScopedModels = await (0, model_resolver_js_1.resolveModelScope)(Array.from(enabledIds), this.session.modelRegistry);
                this.session.setScopedModels(newScopedModels.map((sm) => {
                    var _a;
                    return ({
                        model: sm.model,
                        thinkingLevel: (_a = sm.thinkingLevel) !== null && _a !== void 0 ? _a : currentThinkingLevel,
                    });
                }));
            }
            else {
                // All enabled or none enabled = no filter
                this.session.setScopedModels([]);
            }
            await this.updateAvailableProviderCount();
            this.ui.requestRender();
        };
        this.showSelector((done) => {
            const selector = new scoped_models_selector_js_1.ScopedModelsSelectorComponent({
                allModels,
                enabledModelIds: currentEnabledIds,
                hasEnabledModelsFilter: currentHasFilter,
            }, {
                onModelToggle: async (modelId, enabled) => {
                    if (enabled) {
                        currentEnabledIds.add(modelId);
                    }
                    else {
                        currentEnabledIds.delete(modelId);
                    }
                    currentHasFilter = true;
                    await updateSessionModels(currentEnabledIds);
                },
                onEnableAll: async (allModelIds) => {
                    currentEnabledIds.clear();
                    for (const id of allModelIds) {
                        currentEnabledIds.add(id);
                    }
                    currentHasFilter = false;
                    await updateSessionModels(currentEnabledIds);
                },
                onClearAll: async () => {
                    currentEnabledIds.clear();
                    currentHasFilter = true;
                    await updateSessionModels(currentEnabledIds);
                },
                onToggleProvider: async (_provider, modelIds, enabled) => {
                    for (const id of modelIds) {
                        if (enabled) {
                            currentEnabledIds.add(id);
                        }
                        else {
                            currentEnabledIds.delete(id);
                        }
                    }
                    currentHasFilter = true;
                    await updateSessionModels(currentEnabledIds);
                },
                onPersist: (enabledIds) => {
                    // Persist to settings
                    const newPatterns = enabledIds.length === allModels.length
                        ? undefined // All enabled = clear filter
                        : enabledIds;
                    this.settingsManager.setEnabledModels(newPatterns);
                    this.showStatus("Model selection saved to settings");
                },
                onCancel: () => {
                    done();
                    this.ui.requestRender();
                },
            });
            return { component: selector, focus: selector };
        });
    }
    showUserMessageSelector() {
        const userMessages = this.session.getUserMessagesForForking();
        if (userMessages.length === 0) {
            this.showStatus("No messages to fork from");
            return;
        }
        this.showSelector((done) => {
            const selector = new user_message_selector_js_1.UserMessageSelectorComponent(userMessages.map((m) => ({ id: m.entryId, text: m.text })), async (entryId) => {
                const result = await this.session.fork(entryId);
                if (result.cancelled) {
                    // Extension cancelled the fork
                    done();
                    this.ui.requestRender();
                    return;
                }
                this.chatContainer.clear();
                this.renderInitialMessages();
                this.editor.setText(result.selectedText);
                done();
                this.showStatus("Branched to new session");
            }, () => {
                done();
                this.ui.requestRender();
            });
            return { component: selector, focus: selector.getMessageList() };
        });
    }
    showTreeSelector(initialSelectedId) {
        const tree = this.sessionManager.getTree();
        const realLeafId = this.sessionManager.getLeafId();
        if (tree.length === 0) {
            this.showStatus("No entries in session");
            return;
        }
        this.showSelector((done) => {
            const selector = new tree_selector_js_1.TreeSelectorComponent(tree, realLeafId, this.ui.terminal.rows, async (entryId) => {
                // Selecting the current leaf is a no-op (already there)
                if (entryId === realLeafId) {
                    done();
                    this.showStatus("Already at this point");
                    return;
                }
                // Ask about summarization
                done(); // Close selector first
                // Loop until user makes a complete choice or cancels to tree
                let wantsSummary = false;
                let customInstructions;
                while (true) {
                    const summaryChoice = await this.showExtensionSelector("Summarize branch?", [
                        "No summary",
                        "Summarize",
                        "Summarize with custom prompt",
                    ]);
                    if (summaryChoice === undefined) {
                        // User pressed escape - re-show tree selector with same selection
                        this.showTreeSelector(entryId);
                        return;
                    }
                    wantsSummary = summaryChoice !== "No summary";
                    if (summaryChoice === "Summarize with custom prompt") {
                        customInstructions = await this.showExtensionEditor("Custom summarization instructions");
                        if (customInstructions === undefined) {
                            // User cancelled - loop back to summary selector
                            continue;
                        }
                    }
                    // User made a complete choice
                    break;
                }
                // Set up escape handler and loader if summarizing
                let summaryLoader;
                const originalOnEscape = this.defaultEditor.onEscape;
                if (wantsSummary) {
                    this.defaultEditor.onEscape = () => {
                        this.session.abortBranchSummary();
                    };
                    this.chatContainer.addChild(new pi_tui_1.Spacer(1));
                    summaryLoader = new pi_tui_1.Loader(this.ui, (spinner) => theme_js_1.theme.fg("accent", spinner), (text) => theme_js_1.theme.fg("muted", text), `Summarizing branch... (${(0, keybinding_hints_js_1.appKey)(this.keybindings, "interrupt")} to cancel)`);
                    this.statusContainer.addChild(summaryLoader);
                    this.ui.requestRender();
                }
                try {
                    const result = await this.session.navigateTree(entryId, {
                        summarize: wantsSummary,
                        customInstructions,
                    });
                    if (result.aborted) {
                        // Summarization aborted - re-show tree selector with same selection
                        this.showStatus("Branch summarization cancelled");
                        this.showTreeSelector(entryId);
                        return;
                    }
                    if (result.cancelled) {
                        this.showStatus("Navigation cancelled");
                        return;
                    }
                    // Update UI
                    this.chatContainer.clear();
                    this.renderInitialMessages();
                    if (result.editorText && !this.editor.getText().trim()) {
                        this.editor.setText(result.editorText);
                    }
                    this.showStatus("Navigated to selected point");
                }
                catch (error) {
                    this.showError(error instanceof Error ? error.message : String(error));
                }
                finally {
                    if (summaryLoader) {
                        summaryLoader.stop();
                        this.statusContainer.clear();
                    }
                    this.defaultEditor.onEscape = originalOnEscape;
                }
            }, () => {
                done();
                this.ui.requestRender();
            }, (entryId, label) => {
                this.sessionManager.appendLabelChange(entryId, label);
                this.ui.requestRender();
            }, initialSelectedId);
            return { component: selector, focus: selector };
        });
    }
    showSessionSelector() {
        this.showSelector((done) => {
            const selector = new session_selector_js_1.SessionSelectorComponent((onProgress) => session_manager_js_1.SessionManager.list(this.sessionManager.getCwd(), this.sessionManager.getSessionDir(), onProgress), session_manager_js_1.SessionManager.listAll, async (sessionPath) => {
                done();
                await this.handleResumeSession(sessionPath);
            }, () => {
                done();
                this.ui.requestRender();
            }, () => {
                void this.shutdown();
            }, () => this.ui.requestRender(), {
                renameSession: async (sessionFilePath, nextName) => {
                    const next = (nextName !== null && nextName !== void 0 ? nextName : "").trim();
                    if (!next)
                        return;
                    const mgr = session_manager_js_1.SessionManager.open(sessionFilePath);
                    mgr.appendSessionInfo(next);
                },
                showRenameHint: true,
                keybindings: this.keybindings,
            }, this.sessionManager.getSessionFile());
            return { component: selector, focus: selector };
        });
    }
    async handleResumeSession(sessionPath) {
        // Stop loading animation
        if (this.loadingAnimation) {
            this.loadingAnimation.stop();
            this.loadingAnimation = undefined;
        }
        this.statusContainer.clear();
        // Clear UI state
        this.pendingMessagesContainer.clear();
        this.compactionQueuedMessages = [];
        this.streamingComponent = undefined;
        this.streamingMessage = undefined;
        this.pendingTools.clear();
        // Switch session via AgentSession (emits extension session events)
        await this.session.switchSession(sessionPath);
        // Clear and re-render the chat
        this.chatContainer.clear();
        this.renderInitialMessages();
        this.showStatus("Resumed session");
    }
    async showOAuthSelector(mode) {
        if (mode === "logout") {
            const providers = this.session.modelRegistry.authStorage.list();
            const loggedInProviders = providers.filter((p) => {
                var _a;
                return ((_a = this.session.modelRegistry.authStorage.get(p)) === null || _a === void 0 ? void 0 : _a.type) === "oauth";
            });
            if (loggedInProviders.length === 0) {
                this.showStatus("No OAuth providers logged in. Use /login first.");
                return;
            }
        }
        this.showSelector((done) => {
            const selector = new oauth_selector_js_1.OAuthSelectorComponent(mode, this.session.modelRegistry.authStorage, async (providerId) => {
                done();
                if (mode === "login") {
                    await this.showLoginDialog(providerId);
                }
                else {
                    // Logout flow
                    const providerInfo = (0, pi_ai_1.getOAuthProviders)().find((p) => p.id === providerId);
                    const providerName = (providerInfo === null || providerInfo === void 0 ? void 0 : providerInfo.name) || providerId;
                    try {
                        this.session.modelRegistry.authStorage.logout(providerId);
                        this.session.modelRegistry.refresh();
                        await this.updateAvailableProviderCount();
                        this.showStatus(`Logged out of ${providerName}`);
                    }
                    catch (error) {
                        this.showError(`Logout failed: ${error instanceof Error ? error.message : String(error)}`);
                    }
                }
            }, () => {
                done();
                this.ui.requestRender();
            });
            return { component: selector, focus: selector };
        });
    }
    async showLoginDialog(providerId) {
        var _a;
        const providerInfo = (0, pi_ai_1.getOAuthProviders)().find((p) => p.id === providerId);
        const providerName = (providerInfo === null || providerInfo === void 0 ? void 0 : providerInfo.name) || providerId;
        // Providers that use callback servers (can paste redirect URL)
        const usesCallbackServer = (_a = providerInfo === null || providerInfo === void 0 ? void 0 : providerInfo.usesCallbackServer) !== null && _a !== void 0 ? _a : false;
        // Create login dialog component
        const dialog = new login_dialog_js_1.LoginDialogComponent(this.ui, providerId, (_success, _message) => {
            // Completion handled below
        });
        // Show dialog in editor container
        this.editorContainer.clear();
        this.editorContainer.addChild(dialog);
        this.ui.setFocus(dialog);
        this.ui.requestRender();
        // Promise for manual code input (racing with callback server)
        let manualCodeResolve;
        let manualCodeReject;
        const manualCodePromise = new Promise((resolve, reject) => {
            manualCodeResolve = resolve;
            manualCodeReject = reject;
        });
        // Restore editor helper
        const restoreEditor = () => {
            this.editorContainer.clear();
            this.editorContainer.addChild(this.editor);
            this.ui.setFocus(this.editor);
            this.ui.requestRender();
        };
        try {
            await this.session.modelRegistry.authStorage.login(providerId, {
                onAuth: (info) => {
                    dialog.showAuth(info.url, info.instructions);
                    if (usesCallbackServer) {
                        // Show input for manual paste, racing with callback
                        dialog
                            .showManualInput("Paste redirect URL below, or complete login in browser:")
                            .then((value) => {
                            if (value && manualCodeResolve) {
                                manualCodeResolve(value);
                                manualCodeResolve = undefined;
                            }
                        })
                            .catch(() => {
                            if (manualCodeReject) {
                                manualCodeReject(new Error("Login cancelled"));
                                manualCodeReject = undefined;
                            }
                        });
                    }
                    else if (providerId === "github-copilot") {
                        // GitHub Copilot polls after onAuth
                        dialog.showWaiting("Waiting for browser authentication...");
                    }
                    // For Anthropic: onPrompt is called immediately after
                },
                onPrompt: async (prompt) => {
                    return dialog.showPrompt(prompt.message, prompt.placeholder);
                },
                onProgress: (message) => {
                    dialog.showProgress(message);
                },
                onManualCodeInput: () => manualCodePromise,
                signal: dialog.signal,
            });
            // Success
            restoreEditor();
            this.session.modelRegistry.refresh();
            await this.updateAvailableProviderCount();
            this.showStatus(`Logged in to ${providerName}. Credentials saved to ${(0, config_js_1.getAuthPath)()}`);
        }
        catch (error) {
            restoreEditor();
            const errorMsg = error instanceof Error ? error.message : String(error);
            if (errorMsg !== "Login cancelled") {
                this.showError(`Failed to login to ${providerName}: ${errorMsg}`);
            }
        }
    }
    // =========================================================================
    // Command handlers
    // =========================================================================
    async handleReloadCommand() {
        var _a, _b, _c, _d;
        var _e;
        if (this.session.isStreaming) {
            this.showWarning("Wait for the current response to finish before reloading.");
            return;
        }
        if (this.session.isCompacting) {
            this.showWarning("Wait for compaction to finish before reloading.");
            return;
        }
        this.resetExtensionUI();
        const loader = new bordered_loader_js_1.BorderedLoader(this.ui, theme_js_1.theme, "Reloading extensions, skills, prompts, themes...", {
            cancellable: false,
        });
        const previousEditor = this.editor;
        this.editorContainer.clear();
        this.editorContainer.addChild(loader);
        this.ui.setFocus(loader);
        this.ui.requestRender();
        const dismissLoader = (editor) => {
            loader.dispose();
            this.editorContainer.clear();
            this.editorContainer.addChild(editor);
            this.ui.setFocus(editor);
            this.ui.requestRender();
        };
        try {
            await this.session.reload();
            (0, theme_js_1.setRegisteredThemes)(this.session.resourceLoader.getThemes().themes);
            this.hideThinkingBlock = this.settingsManager.getHideThinkingBlock();
            const themeName = this.settingsManager.getTheme();
            const themeResult = themeName ? (0, theme_js_1.setTheme)(themeName, true) : { success: true };
            if (!themeResult.success) {
                this.showError(`Failed to load theme "${themeName}": ${themeResult.error}\nFell back to dark theme.`);
            }
            const editorPaddingX = this.settingsManager.getEditorPaddingX();
            const autocompleteMaxVisible = this.settingsManager.getAutocompleteMaxVisible();
            this.defaultEditor.setPaddingX(editorPaddingX);
            this.defaultEditor.setAutocompleteMaxVisible(autocompleteMaxVisible);
            if (this.editor !== this.defaultEditor) {
                (_b = (_a = this.editor).setPaddingX) === null || _b === void 0 ? void 0 : _b.call(_a, editorPaddingX);
                (_d = (_c = this.editor).setAutocompleteMaxVisible) === null || _d === void 0 ? void 0 : _d.call(_c, autocompleteMaxVisible);
            }
            this.ui.setShowHardwareCursor(this.settingsManager.getShowHardwareCursor());
            this.ui.setClearOnShrink(this.settingsManager.getClearOnShrink());
            this.setupAutocomplete(this.fdPath);
            const runner = this.session.extensionRunner;
            if (runner) {
                this.setupExtensionShortcuts(runner);
            }
            this.rebuildChatFromMessages();
            dismissLoader(this.editor);
            this.showLoadedResources({ extensionPaths: (_e = runner === null || runner === void 0 ? void 0 : runner.getExtensionPaths()) !== null && _e !== void 0 ? _e : [], force: true });
            const modelsJsonError = this.session.modelRegistry.getError();
            if (modelsJsonError) {
                this.showError(`models.json error: ${modelsJsonError}`);
            }
            this.showStatus("Reloaded extensions, skills, prompts, themes");
        }
        catch (error) {
            dismissLoader(previousEditor);
            this.showError(`Reload failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async handleExportCommand(text) {
        const parts = text.split(/\s+/);
        const outputPath = parts.length > 1 ? parts[1] : undefined;
        try {
            const filePath = await this.session.exportToHtml(outputPath);
            this.showStatus(`Session exported to: ${filePath}`);
        }
        catch (error) {
            this.showError(`Failed to export session: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    async handleShareCommand() {
        var _a, _b;
        // Check if gh is available and logged in
        try {
            const authResult = (0, child_process_1.spawnSync)("gh", ["auth", "status"], { encoding: "utf-8" });
            if (authResult.status !== 0) {
                this.showError("GitHub CLI is not logged in. Run 'gh auth login' first.");
                return;
            }
        }
        catch (_c) {
            this.showError("GitHub CLI (gh) is not installed. Install it from https://cli.github.com/");
            return;
        }
        // Export to a temp file
        const tmpFile = path.join(os.tmpdir(), "session.html");
        try {
            await this.session.exportToHtml(tmpFile);
        }
        catch (error) {
            this.showError(`Failed to export session: ${error instanceof Error ? error.message : "Unknown error"}`);
            return;
        }
        // Show cancellable loader, replacing the editor
        const loader = new bordered_loader_js_1.BorderedLoader(this.ui, theme_js_1.theme, "Creating gist...");
        this.editorContainer.clear();
        this.editorContainer.addChild(loader);
        this.ui.setFocus(loader);
        this.ui.requestRender();
        const restoreEditor = () => {
            loader.dispose();
            this.editorContainer.clear();
            this.editorContainer.addChild(this.editor);
            this.ui.setFocus(this.editor);
            try {
                fs.unlinkSync(tmpFile);
            }
            catch (_a) {
                // Ignore cleanup errors
            }
        };
        // Create a secret gist asynchronously
        let proc = null;
        loader.onAbort = () => {
            proc === null || proc === void 0 ? void 0 : proc.kill();
            restoreEditor();
            this.showStatus("Share cancelled");
        };
        try {
            const result = await new Promise((resolve) => {
                var _a, _b;
                proc = (0, child_process_1.spawn)("gh", ["gist", "create", "--public=false", tmpFile]);
                let stdout = "";
                let stderr = "";
                (_a = proc.stdout) === null || _a === void 0 ? void 0 : _a.on("data", (data) => {
                    stdout += data.toString();
                });
                (_b = proc.stderr) === null || _b === void 0 ? void 0 : _b.on("data", (data) => {
                    stderr += data.toString();
                });
                proc.on("close", (code) => resolve({ stdout, stderr, code }));
            });
            if (loader.signal.aborted)
                return;
            restoreEditor();
            if (result.code !== 0) {
                const errorMsg = ((_a = result.stderr) === null || _a === void 0 ? void 0 : _a.trim()) || "Unknown error";
                this.showError(`Failed to create gist: ${errorMsg}`);
                return;
            }
            // Extract gist ID from the URL returned by gh
            // gh returns something like: https://gist.github.com/username/GIST_ID
            const gistUrl = (_b = result.stdout) === null || _b === void 0 ? void 0 : _b.trim();
            const gistId = gistUrl === null || gistUrl === void 0 ? void 0 : gistUrl.split("/").pop();
            if (!gistId) {
                this.showError("Failed to parse gist ID from gh output");
                return;
            }
            // Create the preview URL
            const previewUrl = (0, config_js_1.getShareViewerUrl)(gistId);
            this.showStatus(`Share URL: ${previewUrl}\nGist: ${gistUrl}`);
        }
        catch (error) {
            if (!loader.signal.aborted) {
                restoreEditor();
                this.showError(`Failed to create gist: ${error instanceof Error ? error.message : "Unknown error"}`);
            }
        }
    }
    handleCopyCommand() {
        const text = this.session.getLastAssistantText();
        if (!text) {
            this.showError("No agent messages to copy yet.");
            return;
        }
        try {
            (0, clipboard_js_1.copyToClipboard)(text);
            this.showStatus("Copied last agent message to clipboard");
        }
        catch (error) {
            this.showError(error instanceof Error ? error.message : String(error));
        }
    }
    handleNameCommand(text) {
        const name = text.replace(/^\/name\s*/, "").trim();
        if (!name) {
            const currentName = this.sessionManager.getSessionName();
            if (currentName) {
                this.chatContainer.addChild(new pi_tui_1.Spacer(1));
                this.chatContainer.addChild(new pi_tui_1.Text(theme_js_1.theme.fg("dim", `Session name: ${currentName}`), 1, 0));
            }
            else {
                this.showWarning("Usage: /name <name>");
            }
            this.ui.requestRender();
            return;
        }
        this.sessionManager.appendSessionInfo(name);
        this.updateTerminalTitle();
        this.chatContainer.addChild(new pi_tui_1.Spacer(1));
        this.chatContainer.addChild(new pi_tui_1.Text(theme_js_1.theme.fg("dim", `Session name set: ${name}`), 1, 0));
        this.ui.requestRender();
    }
    handleSessionCommand() {
        var _a;
        const stats = this.session.getSessionStats();
        const sessionName = this.sessionManager.getSessionName();
        let info = `${theme_js_1.theme.bold("Session Info")}\n\n`;
        if (sessionName) {
            info += `${theme_js_1.theme.fg("dim", "Name:")} ${sessionName}\n`;
        }
        info += `${theme_js_1.theme.fg("dim", "File:")} ${(_a = stats.sessionFile) !== null && _a !== void 0 ? _a : "In-memory"}\n`;
        info += `${theme_js_1.theme.fg("dim", "ID:")} ${stats.sessionId}\n\n`;
        info += `${theme_js_1.theme.bold("Messages")}\n`;
        info += `${theme_js_1.theme.fg("dim", "User:")} ${stats.userMessages}\n`;
        info += `${theme_js_1.theme.fg("dim", "Assistant:")} ${stats.assistantMessages}\n`;
        info += `${theme_js_1.theme.fg("dim", "Tool Calls:")} ${stats.toolCalls}\n`;
        info += `${theme_js_1.theme.fg("dim", "Tool Results:")} ${stats.toolResults}\n`;
        info += `${theme_js_1.theme.fg("dim", "Total:")} ${stats.totalMessages}\n\n`;
        info += `${theme_js_1.theme.bold("Tokens")}\n`;
        info += `${theme_js_1.theme.fg("dim", "Input:")} ${stats.tokens.input.toLocaleString()}\n`;
        info += `${theme_js_1.theme.fg("dim", "Output:")} ${stats.tokens.output.toLocaleString()}\n`;
        if (stats.tokens.cacheRead > 0) {
            info += `${theme_js_1.theme.fg("dim", "Cache Read:")} ${stats.tokens.cacheRead.toLocaleString()}\n`;
        }
        if (stats.tokens.cacheWrite > 0) {
            info += `${theme_js_1.theme.fg("dim", "Cache Write:")} ${stats.tokens.cacheWrite.toLocaleString()}\n`;
        }
        info += `${theme_js_1.theme.fg("dim", "Total:")} ${stats.tokens.total.toLocaleString()}\n`;
        if (stats.cost > 0) {
            info += `\n${theme_js_1.theme.bold("Cost")}\n`;
            info += `${theme_js_1.theme.fg("dim", "Total:")} ${stats.cost.toFixed(4)}`;
        }
        this.chatContainer.addChild(new pi_tui_1.Spacer(1));
        this.chatContainer.addChild(new pi_tui_1.Text(info, 1, 0));
        this.ui.requestRender();
    }
    handleChangelogCommand() {
        const changelogPath = (0, changelog_js_1.getChangelogPath)();
        const allEntries = (0, changelog_js_1.parseChangelog)(changelogPath);
        const changelogMarkdown = allEntries.length > 0
            ? allEntries
                .reverse()
                .map((e) => e.content)
                .join("\n\n")
            : "No changelog entries found.";
        this.chatContainer.addChild(new pi_tui_1.Spacer(1));
        this.chatContainer.addChild(new dynamic_border_js_1.DynamicBorder());
        this.chatContainer.addChild(new pi_tui_1.Text(theme_js_1.theme.bold(theme_js_1.theme.fg("accent", "What's New")), 1, 0));
        this.chatContainer.addChild(new pi_tui_1.Spacer(1));
        this.chatContainer.addChild(new pi_tui_1.Markdown(changelogMarkdown, 1, 1, this.getMarkdownThemeWithSettings()));
        this.chatContainer.addChild(new dynamic_border_js_1.DynamicBorder());
        this.ui.requestRender();
    }
    /**
     * Capitalize keybinding for display (e.g., "ctrl+c" -> "Ctrl+C").
     */
    capitalizeKey(key) {
        return key
            .split("/")
            .map((k) => k
            .split("+")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join("+"))
            .join("/");
    }
    /**
     * Get capitalized display string for an app keybinding action.
     */
    getAppKeyDisplay(action) {
        return this.capitalizeKey((0, keybinding_hints_js_1.appKey)(this.keybindings, action));
    }
    /**
     * Get capitalized display string for an editor keybinding action.
     */
    getEditorKeyDisplay(action) {
        return this.capitalizeKey((0, keybinding_hints_js_1.editorKey)(action));
    }
    handleHotkeysCommand() {
        var _a;
        // Navigation keybindings
        const cursorWordLeft = this.getEditorKeyDisplay("cursorWordLeft");
        const cursorWordRight = this.getEditorKeyDisplay("cursorWordRight");
        const cursorLineStart = this.getEditorKeyDisplay("cursorLineStart");
        const cursorLineEnd = this.getEditorKeyDisplay("cursorLineEnd");
        const jumpForward = this.getEditorKeyDisplay("jumpForward");
        const jumpBackward = this.getEditorKeyDisplay("jumpBackward");
        const pageUp = this.getEditorKeyDisplay("pageUp");
        const pageDown = this.getEditorKeyDisplay("pageDown");
        // Editing keybindings
        const submit = this.getEditorKeyDisplay("submit");
        const newLine = this.getEditorKeyDisplay("newLine");
        const deleteWordBackward = this.getEditorKeyDisplay("deleteWordBackward");
        const deleteWordForward = this.getEditorKeyDisplay("deleteWordForward");
        const deleteToLineStart = this.getEditorKeyDisplay("deleteToLineStart");
        const deleteToLineEnd = this.getEditorKeyDisplay("deleteToLineEnd");
        const yank = this.getEditorKeyDisplay("yank");
        const yankPop = this.getEditorKeyDisplay("yankPop");
        const undo = this.getEditorKeyDisplay("undo");
        const tab = this.getEditorKeyDisplay("tab");
        // App keybindings
        const interrupt = this.getAppKeyDisplay("interrupt");
        const clear = this.getAppKeyDisplay("clear");
        const exit = this.getAppKeyDisplay("exit");
        const suspend = this.getAppKeyDisplay("suspend");
        const cycleThinkingLevel = this.getAppKeyDisplay("cycleThinkingLevel");
        const cycleModelForward = this.getAppKeyDisplay("cycleModelForward");
        const selectModel = this.getAppKeyDisplay("selectModel");
        const expandTools = this.getAppKeyDisplay("expandTools");
        const toggleThinking = this.getAppKeyDisplay("toggleThinking");
        const externalEditor = this.getAppKeyDisplay("externalEditor");
        const followUp = this.getAppKeyDisplay("followUp");
        const dequeue = this.getAppKeyDisplay("dequeue");
        let hotkeys = `
**Navigation**
| Key | Action |
|-----|--------|
| \`Arrow keys\` | Move cursor / browse history (Up when empty) |
| \`${cursorWordLeft}\` / \`${cursorWordRight}\` | Move by word |
| \`${cursorLineStart}\` | Start of line |
| \`${cursorLineEnd}\` | End of line |
| \`${jumpForward}\` | Jump forward to character |
| \`${jumpBackward}\` | Jump backward to character |
| \`${pageUp}\` / \`${pageDown}\` | Scroll by page |

**Editing**
| Key | Action |
|-----|--------|
| \`${submit}\` | Send message |
| \`${newLine}\` | New line${process.platform === "win32" ? " (Ctrl+Enter on Windows Terminal)" : ""} |
| \`${deleteWordBackward}\` | Delete word backwards |
| \`${deleteWordForward}\` | Delete word forwards |
| \`${deleteToLineStart}\` | Delete to start of line |
| \`${deleteToLineEnd}\` | Delete to end of line |
| \`${yank}\` | Paste the most-recently-deleted text |
| \`${yankPop}\` | Cycle through the deleted text after pasting |
| \`${undo}\` | Undo |

**Other**
| Key | Action |
|-----|--------|
| \`${tab}\` | Path completion / accept autocomplete |
| \`${interrupt}\` | Cancel autocomplete / abort streaming |
| \`${clear}\` | Clear editor (first) / exit (second) |
| \`${exit}\` | Exit (when editor is empty) |
| \`${suspend}\` | Suspend to background |
| \`${cycleThinkingLevel}\` | Cycle thinking level |
| \`${cycleModelForward}\` | Cycle models |
| \`${selectModel}\` | Open model selector |
| \`${expandTools}\` | Toggle tool output expansion |
| \`${toggleThinking}\` | Toggle thinking block visibility |
| \`${externalEditor}\` | Edit message in external editor |
| \`${followUp}\` | Queue follow-up message |
| \`${dequeue}\` | Restore queued messages |
| \`Ctrl+V\` | Paste image from clipboard |
| \`/\` | Slash commands |
| \`!\` | Run bash command |
| \`!!\` | Run bash command (excluded from context) |
`;
        // Add extension-registered shortcuts
        const extensionRunner = this.session.extensionRunner;
        if (extensionRunner) {
            const shortcuts = extensionRunner.getShortcuts(this.keybindings.getEffectiveConfig());
            if (shortcuts.size > 0) {
                hotkeys += `
**Extensions**
| Key | Action |
|-----|--------|
`;
                for (const [key, shortcut] of shortcuts) {
                    const description = (_a = shortcut.description) !== null && _a !== void 0 ? _a : shortcut.extensionPath;
                    const keyDisplay = key.replace(/\b\w/g, (c) => c.toUpperCase());
                    hotkeys += `| \`${keyDisplay}\` | ${description} |\n`;
                }
            }
        }
        this.chatContainer.addChild(new pi_tui_1.Spacer(1));
        this.chatContainer.addChild(new dynamic_border_js_1.DynamicBorder());
        this.chatContainer.addChild(new pi_tui_1.Text(theme_js_1.theme.bold(theme_js_1.theme.fg("accent", "Keyboard Shortcuts")), 1, 0));
        this.chatContainer.addChild(new pi_tui_1.Spacer(1));
        this.chatContainer.addChild(new pi_tui_1.Markdown(hotkeys.trim(), 1, 1, this.getMarkdownThemeWithSettings()));
        this.chatContainer.addChild(new dynamic_border_js_1.DynamicBorder());
        this.ui.requestRender();
    }
    async handleClearCommand() {
        // Stop loading animation
        if (this.loadingAnimation) {
            this.loadingAnimation.stop();
            this.loadingAnimation = undefined;
        }
        this.statusContainer.clear();
        // New session via session (emits extension session events)
        await this.session.newSession();
        // Clear UI state
        this.chatContainer.clear();
        this.pendingMessagesContainer.clear();
        this.compactionQueuedMessages = [];
        this.streamingComponent = undefined;
        this.streamingMessage = undefined;
        this.pendingTools.clear();
        this.chatContainer.addChild(new pi_tui_1.Spacer(1));
        this.chatContainer.addChild(new pi_tui_1.Text(`${theme_js_1.theme.fg("accent", "✓ New session started")}`, 1, 1));
        this.ui.requestRender();
    }
    handleDebugCommand() {
        const width = this.ui.terminal.columns;
        const height = this.ui.terminal.rows;
        const allLines = this.ui.render(width);
        const debugLogPath = (0, config_js_1.getDebugLogPath)();
        const debugData = [
            `Debug output at ${new Date().toISOString()}`,
            `Terminal: ${width}x${height}`,
            `Total lines: ${allLines.length}`,
            "",
            "=== All rendered lines with visible widths ===",
            ...allLines.map((line, idx) => {
                const vw = (0, pi_tui_1.visibleWidth)(line);
                const escaped = JSON.stringify(line);
                return `[${idx}] (w=${vw}) ${escaped}`;
            }),
            "",
            "=== Agent messages (JSONL) ===",
            ...this.session.messages.map((msg) => JSON.stringify(msg)),
            "",
        ].join("\n");
        fs.mkdirSync(path.dirname(debugLogPath), { recursive: true });
        fs.writeFileSync(debugLogPath, debugData);
        this.chatContainer.addChild(new pi_tui_1.Spacer(1));
        this.chatContainer.addChild(new pi_tui_1.Text(`${theme_js_1.theme.fg("accent", "✓ Debug log written")}\n${theme_js_1.theme.fg("muted", debugLogPath)}`, 1, 1));
        this.ui.requestRender();
    }
    handleArminSaysHi() {
        this.chatContainer.addChild(new pi_tui_1.Spacer(1));
        this.chatContainer.addChild(new armin_js_1.ArminComponent(this.ui));
        this.ui.requestRender();
    }
    handleDaxnuts() {
        this.chatContainer.addChild(new pi_tui_1.Spacer(1));
        this.chatContainer.addChild(new daxnuts_js_1.DaxnutsComponent(this.ui));
        this.ui.requestRender();
    }
    checkDaxnutsEasterEgg(model) {
        if (model.provider === "opencode" && model.id.toLowerCase().includes("kimi-k2.5")) {
            this.handleDaxnuts();
        }
    }
    async handleBashCommand(command, excludeFromContext = false) {
        const extensionRunner = this.session.extensionRunner;
        // Emit user_bash event to let extensions intercept
        const eventResult = extensionRunner
            ? await extensionRunner.emitUserBash({
                type: "user_bash",
                command,
                excludeFromContext,
                cwd: process.cwd(),
            })
            : undefined;
        // If extension returned a full result, use it directly
        if (eventResult === null || eventResult === void 0 ? void 0 : eventResult.result) {
            const result = eventResult.result;
            // Create UI component for display
            this.bashComponent = new bash_execution_js_1.BashExecutionComponent(command, this.ui, excludeFromContext);
            if (this.session.isStreaming) {
                this.pendingMessagesContainer.addChild(this.bashComponent);
                this.pendingBashComponents.push(this.bashComponent);
            }
            else {
                this.chatContainer.addChild(this.bashComponent);
            }
            // Show output and complete
            if (result.output) {
                this.bashComponent.appendOutput(result.output);
            }
            this.bashComponent.setComplete(result.exitCode, result.cancelled, result.truncated ? { truncated: true, content: result.output } : undefined, result.fullOutputPath);
            // Record the result in session
            this.session.recordBashResult(command, result, { excludeFromContext });
            this.bashComponent = undefined;
            this.ui.requestRender();
            return;
        }
        // Normal execution path (possibly with custom operations)
        const isDeferred = this.session.isStreaming;
        this.bashComponent = new bash_execution_js_1.BashExecutionComponent(command, this.ui, excludeFromContext);
        if (isDeferred) {
            // Show in pending area when agent is streaming
            this.pendingMessagesContainer.addChild(this.bashComponent);
            this.pendingBashComponents.push(this.bashComponent);
        }
        else {
            // Show in chat immediately when agent is idle
            this.chatContainer.addChild(this.bashComponent);
        }
        this.ui.requestRender();
        try {
            const result = await this.session.executeBash(command, (chunk) => {
                if (this.bashComponent) {
                    this.bashComponent.appendOutput(chunk);
                    this.ui.requestRender();
                }
            }, { excludeFromContext, operations: eventResult === null || eventResult === void 0 ? void 0 : eventResult.operations });
            if (this.bashComponent) {
                this.bashComponent.setComplete(result.exitCode, result.cancelled, result.truncated ? { truncated: true, content: result.output } : undefined, result.fullOutputPath);
            }
        }
        catch (error) {
            if (this.bashComponent) {
                this.bashComponent.setComplete(undefined, false);
            }
            this.showError(`Bash command failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
        this.bashComponent = undefined;
        this.ui.requestRender();
    }
    async handleCompactCommand(customInstructions) {
        const entries = this.sessionManager.getEntries();
        const messageCount = entries.filter((e) => e.type === "message").length;
        if (messageCount < 2) {
            this.showWarning("Nothing to compact (no messages yet)");
            return;
        }
        await this.executeCompaction(customInstructions, false);
    }
    async executeCompaction(customInstructions, isAuto = false) {
        // Stop loading animation
        if (this.loadingAnimation) {
            this.loadingAnimation.stop();
            this.loadingAnimation = undefined;
        }
        this.statusContainer.clear();
        // Set up escape handler during compaction
        const originalOnEscape = this.defaultEditor.onEscape;
        this.defaultEditor.onEscape = () => {
            this.session.abortCompaction();
        };
        // Show compacting status
        this.chatContainer.addChild(new pi_tui_1.Spacer(1));
        const cancelHint = `(${(0, keybinding_hints_js_1.appKey)(this.keybindings, "interrupt")} to cancel)`;
        const label = isAuto ? `Auto-compacting context... ${cancelHint}` : `Compacting context... ${cancelHint}`;
        const compactingLoader = new pi_tui_1.Loader(this.ui, (spinner) => theme_js_1.theme.fg("accent", spinner), (text) => theme_js_1.theme.fg("muted", text), label);
        this.statusContainer.addChild(compactingLoader);
        this.ui.requestRender();
        let result;
        try {
            result = await this.session.compact(customInstructions);
            // Rebuild UI
            this.rebuildChatFromMessages();
            // Add compaction component at bottom so user sees it without scrolling
            const msg = (0, messages_js_1.createCompactionSummaryMessage)(result.summary, result.tokensBefore, new Date().toISOString());
            this.addMessageToChat(msg);
            this.footer.invalidate();
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message === "Compaction cancelled" || (error instanceof Error && error.name === "AbortError")) {
                this.showError("Compaction cancelled");
            }
            else {
                this.showError(`Compaction failed: ${message}`);
            }
        }
        finally {
            compactingLoader.stop();
            this.statusContainer.clear();
            this.defaultEditor.onEscape = originalOnEscape;
        }
        void this.flushCompactionQueue({ willRetry: false });
        return result;
    }
    stop() {
        if (this.loadingAnimation) {
            this.loadingAnimation.stop();
            this.loadingAnimation = undefined;
        }
        this.footer.dispose();
        this.footerDataProvider.dispose();
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        if (this.isInitialized) {
            this.ui.stop();
            this.isInitialized = false;
        }
    }
}
exports.InteractiveMode = InteractiveMode;
