"use strict";
// Core session management
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSessionContext = exports.
// Pre-built tools (use process.cwd())
readOnlyTools = exports.createWriteTool = exports.createReadTool = exports.createReadOnlyTools = exports.createLsTool = exports.createGrepTool = exports.createFindTool = exports.createEditTool = exports.
// Tool factories (for custom cwd)
createCodingTools = exports.createBashTool = exports.
// Factory
createAgentSession = exports.DefaultResourceLoader = exports.DefaultPackageManager = exports.ModelRegistry = exports.convertToLlm = exports.wrapToolWithExtensions = exports.wrapToolsWithExtensions = exports.wrapRegisteredTools = exports.wrapRegisteredTool = exports.isWriteToolResult = exports.isToolCallEventType = exports.isReadToolResult = exports.isLsToolResult = exports.isGrepToolResult = exports.isFindToolResult = exports.isEditToolResult = exports.isBashToolResult = exports.ExtensionRunner = exports.discoverAndLoadExtensions = exports.createExtensionRuntime = exports.createEventBus = exports.shouldCompact = exports.serializeConversation = exports.prepareBranchEntries = exports.getLastAssistantUsage = exports.generateSummary = exports.generateBranchSummary = exports.findTurnStartIndex = exports.findCutPoint = exports.estimateTokens = exports.DEFAULT_COMPACTION_SETTINGS = exports.compact = exports.collectEntriesForBranchSummary = exports.calculateContextTokens = exports.AuthStorage = exports.parseSkillBlock = exports.AgentSession = exports.VERSION = exports.getAgentDir = void 0;
exports.SessionSelectorComponent = exports.renderDiff = exports.rawKeyHint = exports.OAuthSelectorComponent = exports.ModelSelectorComponent = exports.LoginDialogComponent = exports.keyHint = exports.FooterComponent = exports.editorKey = exports.ExtensionSelectorComponent = exports.ExtensionInputComponent = exports.ExtensionEditorComponent = exports.DynamicBorder = exports.CustomMessageComponent = exports.CustomEditor = exports.CompactionSummaryMessageComponent = exports.BranchSummaryMessageComponent = exports.BorderedLoader = exports.BashExecutionComponent = exports.appKeyHint = exports.appKey = exports.AssistantMessageComponent = exports.ArminComponent = exports.runRpcMode = exports.runPrintMode = exports.InteractiveMode = exports.main = exports.writeTool = exports.truncateTail = exports.truncateLine = exports.truncateHead = exports.readTool = exports.lsTool = exports.grepTool = exports.formatSize = exports.findTool = exports.editTool = exports.DEFAULT_MAX_LINES = exports.DEFAULT_MAX_BYTES = exports.codingTools = exports.bashTool = exports.loadSkillsFromDir = exports.loadSkills = exports.formatSkillsForPrompt = exports.SettingsManager = exports.SessionManager = exports.parseSessionEntries = exports.migrateSessionEntries = exports.getLatestCompactionEntry = exports.CURRENT_SESSION_VERSION = void 0;
exports.getShellConfig = exports.stripFrontmatter = exports.parseFrontmatter = exports.copyToClipboard = exports.Theme = exports.initTheme = exports.highlightCode = exports.getSettingsListTheme = exports.getSelectListTheme = exports.getMarkdownTheme = exports.getLanguageFromPath = exports.UserMessageSelectorComponent = exports.UserMessageComponent = exports.truncateToVisualLines = exports.TreeSelectorComponent = exports.ToolExecutionComponent = exports.ThinkingSelectorComponent = exports.ThemeSelectorComponent = exports.SkillInvocationMessageComponent = exports.ShowImagesSelectorComponent = exports.SettingsSelectorComponent = void 0;
// Config paths
const config_js_1 = require("./config.js");
Object.defineProperty(exports, "getAgentDir", { enumerable: true, get: function () { return config_js_1.getAgentDir; } });
Object.defineProperty(exports, "VERSION", { enumerable: true, get: function () { return config_js_1.VERSION; } });
const agent_session_js_1 = require("./core/agent-session.js");
Object.defineProperty(exports, "AgentSession", { enumerable: true, get: function () { return agent_session_js_1.AgentSession; } });
Object.defineProperty(exports, "parseSkillBlock", { enumerable: true, get: function () { return agent_session_js_1.parseSkillBlock; } });
// Auth and model registry
const auth_storage_js_1 = require("./core/auth-storage.js");
Object.defineProperty(exports, "AuthStorage", { enumerable: true, get: function () { return auth_storage_js_1.AuthStorage; } });
// Compaction
const index_js_1 = require("./core/compaction/index.js");
Object.defineProperty(exports, "calculateContextTokens", { enumerable: true, get: function () { return index_js_1.calculateContextTokens; } });
Object.defineProperty(exports, "collectEntriesForBranchSummary", { enumerable: true, get: function () { return index_js_1.collectEntriesForBranchSummary; } });
Object.defineProperty(exports, "compact", { enumerable: true, get: function () { return index_js_1.compact; } });
Object.defineProperty(exports, "DEFAULT_COMPACTION_SETTINGS", { enumerable: true, get: function () { return index_js_1.DEFAULT_COMPACTION_SETTINGS; } });
Object.defineProperty(exports, "estimateTokens", { enumerable: true, get: function () { return index_js_1.estimateTokens; } });
Object.defineProperty(exports, "findCutPoint", { enumerable: true, get: function () { return index_js_1.findCutPoint; } });
Object.defineProperty(exports, "findTurnStartIndex", { enumerable: true, get: function () { return index_js_1.findTurnStartIndex; } });
Object.defineProperty(exports, "generateBranchSummary", { enumerable: true, get: function () { return index_js_1.generateBranchSummary; } });
Object.defineProperty(exports, "generateSummary", { enumerable: true, get: function () { return index_js_1.generateSummary; } });
Object.defineProperty(exports, "getLastAssistantUsage", { enumerable: true, get: function () { return index_js_1.getLastAssistantUsage; } });
Object.defineProperty(exports, "prepareBranchEntries", { enumerable: true, get: function () { return index_js_1.prepareBranchEntries; } });
Object.defineProperty(exports, "serializeConversation", { enumerable: true, get: function () { return index_js_1.serializeConversation; } });
Object.defineProperty(exports, "shouldCompact", { enumerable: true, get: function () { return index_js_1.shouldCompact; } });
const event_bus_js_1 = require("./core/event-bus.js");
Object.defineProperty(exports, "createEventBus", { enumerable: true, get: function () { return event_bus_js_1.createEventBus; } });
const index_js_2 = require("./core/extensions/index.js");
Object.defineProperty(exports, "createExtensionRuntime", { enumerable: true, get: function () { return index_js_2.createExtensionRuntime; } });
Object.defineProperty(exports, "discoverAndLoadExtensions", { enumerable: true, get: function () { return index_js_2.discoverAndLoadExtensions; } });
Object.defineProperty(exports, "ExtensionRunner", { enumerable: true, get: function () { return index_js_2.ExtensionRunner; } });
Object.defineProperty(exports, "isBashToolResult", { enumerable: true, get: function () { return index_js_2.isBashToolResult; } });
Object.defineProperty(exports, "isEditToolResult", { enumerable: true, get: function () { return index_js_2.isEditToolResult; } });
Object.defineProperty(exports, "isFindToolResult", { enumerable: true, get: function () { return index_js_2.isFindToolResult; } });
Object.defineProperty(exports, "isGrepToolResult", { enumerable: true, get: function () { return index_js_2.isGrepToolResult; } });
Object.defineProperty(exports, "isLsToolResult", { enumerable: true, get: function () { return index_js_2.isLsToolResult; } });
Object.defineProperty(exports, "isReadToolResult", { enumerable: true, get: function () { return index_js_2.isReadToolResult; } });
Object.defineProperty(exports, "isToolCallEventType", { enumerable: true, get: function () { return index_js_2.isToolCallEventType; } });
Object.defineProperty(exports, "isWriteToolResult", { enumerable: true, get: function () { return index_js_2.isWriteToolResult; } });
Object.defineProperty(exports, "wrapRegisteredTool", { enumerable: true, get: function () { return index_js_2.wrapRegisteredTool; } });
Object.defineProperty(exports, "wrapRegisteredTools", { enumerable: true, get: function () { return index_js_2.wrapRegisteredTools; } });
Object.defineProperty(exports, "wrapToolsWithExtensions", { enumerable: true, get: function () { return index_js_2.wrapToolsWithExtensions; } });
Object.defineProperty(exports, "wrapToolWithExtensions", { enumerable: true, get: function () { return index_js_2.wrapToolWithExtensions; } });
const messages_js_1 = require("./core/messages.js");
Object.defineProperty(exports, "convertToLlm", { enumerable: true, get: function () { return messages_js_1.convertToLlm; } });
const model_registry_js_1 = require("./core/model-registry.js");
Object.defineProperty(exports, "ModelRegistry", { enumerable: true, get: function () { return model_registry_js_1.ModelRegistry; } });
const package_manager_js_1 = require("./core/package-manager.js");
Object.defineProperty(exports, "DefaultPackageManager", { enumerable: true, get: function () { return package_manager_js_1.DefaultPackageManager; } });
const resource_loader_js_1 = require("./core/resource-loader.js");
Object.defineProperty(exports, "DefaultResourceLoader", { enumerable: true, get: function () { return resource_loader_js_1.DefaultResourceLoader; } });
// SDK for programmatic usage
const sdk_js_1 = require("./core/sdk.js");
// Factory
Object.defineProperty(exports, "createAgentSession", { enumerable: true, get: function () { return sdk_js_1.createAgentSession; } });
Object.defineProperty(exports, "createBashTool", { enumerable: true, get: function () { return sdk_js_1.createBashTool; } });
// Tool factories (for custom cwd)
Object.defineProperty(exports, "createCodingTools", { enumerable: true, get: function () { return sdk_js_1.createCodingTools; } });
Object.defineProperty(exports, "createEditTool", { enumerable: true, get: function () { return sdk_js_1.createEditTool; } });
Object.defineProperty(exports, "createFindTool", { enumerable: true, get: function () { return sdk_js_1.createFindTool; } });
Object.defineProperty(exports, "createGrepTool", { enumerable: true, get: function () { return sdk_js_1.createGrepTool; } });
Object.defineProperty(exports, "createLsTool", { enumerable: true, get: function () { return sdk_js_1.createLsTool; } });
Object.defineProperty(exports, "createReadOnlyTools", { enumerable: true, get: function () { return sdk_js_1.createReadOnlyTools; } });
Object.defineProperty(exports, "createReadTool", { enumerable: true, get: function () { return sdk_js_1.createReadTool; } });
Object.defineProperty(exports, "createWriteTool", { enumerable: true, get: function () { return sdk_js_1.createWriteTool; } });
// Pre-built tools (use process.cwd())
Object.defineProperty(exports, "readOnlyTools", { enumerable: true, get: function () { return sdk_js_1.readOnlyTools; } });
const session_manager_js_1 = require("./core/session-manager.js");
Object.defineProperty(exports, "buildSessionContext", { enumerable: true, get: function () { return session_manager_js_1.buildSessionContext; } });
Object.defineProperty(exports, "CURRENT_SESSION_VERSION", { enumerable: true, get: function () { return session_manager_js_1.CURRENT_SESSION_VERSION; } });
Object.defineProperty(exports, "getLatestCompactionEntry", { enumerable: true, get: function () { return session_manager_js_1.getLatestCompactionEntry; } });
Object.defineProperty(exports, "migrateSessionEntries", { enumerable: true, get: function () { return session_manager_js_1.migrateSessionEntries; } });
Object.defineProperty(exports, "parseSessionEntries", { enumerable: true, get: function () { return session_manager_js_1.parseSessionEntries; } });
Object.defineProperty(exports, "SessionManager", { enumerable: true, get: function () { return session_manager_js_1.SessionManager; } });
const settings_manager_js_1 = require("./core/settings-manager.js");
Object.defineProperty(exports, "SettingsManager", { enumerable: true, get: function () { return settings_manager_js_1.SettingsManager; } });
// Skills
const skills_js_1 = require("./core/skills.js");
Object.defineProperty(exports, "formatSkillsForPrompt", { enumerable: true, get: function () { return skills_js_1.formatSkillsForPrompt; } });
Object.defineProperty(exports, "loadSkills", { enumerable: true, get: function () { return skills_js_1.loadSkills; } });
Object.defineProperty(exports, "loadSkillsFromDir", { enumerable: true, get: function () { return skills_js_1.loadSkillsFromDir; } });
// Tools
const index_js_3 = require("./core/tools/index.js");
Object.defineProperty(exports, "bashTool", { enumerable: true, get: function () { return index_js_3.bashTool; } });
Object.defineProperty(exports, "codingTools", { enumerable: true, get: function () { return index_js_3.codingTools; } });
Object.defineProperty(exports, "DEFAULT_MAX_BYTES", { enumerable: true, get: function () { return index_js_3.DEFAULT_MAX_BYTES; } });
Object.defineProperty(exports, "DEFAULT_MAX_LINES", { enumerable: true, get: function () { return index_js_3.DEFAULT_MAX_LINES; } });
Object.defineProperty(exports, "editTool", { enumerable: true, get: function () { return index_js_3.editTool; } });
Object.defineProperty(exports, "findTool", { enumerable: true, get: function () { return index_js_3.findTool; } });
Object.defineProperty(exports, "formatSize", { enumerable: true, get: function () { return index_js_3.formatSize; } });
Object.defineProperty(exports, "grepTool", { enumerable: true, get: function () { return index_js_3.grepTool; } });
Object.defineProperty(exports, "lsTool", { enumerable: true, get: function () { return index_js_3.lsTool; } });
Object.defineProperty(exports, "readTool", { enumerable: true, get: function () { return index_js_3.readTool; } });
Object.defineProperty(exports, "truncateHead", { enumerable: true, get: function () { return index_js_3.truncateHead; } });
Object.defineProperty(exports, "truncateLine", { enumerable: true, get: function () { return index_js_3.truncateLine; } });
Object.defineProperty(exports, "truncateTail", { enumerable: true, get: function () { return index_js_3.truncateTail; } });
Object.defineProperty(exports, "writeTool", { enumerable: true, get: function () { return index_js_3.writeTool; } });
// Main entry point
const main_js_1 = require("./main.js");
Object.defineProperty(exports, "main", { enumerable: true, get: function () { return main_js_1.main; } });
// Run modes for programmatic SDK usage
const index_js_4 = require("./modes/index.js");
Object.defineProperty(exports, "InteractiveMode", { enumerable: true, get: function () { return index_js_4.InteractiveMode; } });
Object.defineProperty(exports, "runPrintMode", { enumerable: true, get: function () { return index_js_4.runPrintMode; } });
Object.defineProperty(exports, "runRpcMode", { enumerable: true, get: function () { return index_js_4.runRpcMode; } });
// UI components for extensions
const index_js_5 = require("./modes/interactive/components/index.js");
Object.defineProperty(exports, "ArminComponent", { enumerable: true, get: function () { return index_js_5.ArminComponent; } });
Object.defineProperty(exports, "AssistantMessageComponent", { enumerable: true, get: function () { return index_js_5.AssistantMessageComponent; } });
Object.defineProperty(exports, "appKey", { enumerable: true, get: function () { return index_js_5.appKey; } });
Object.defineProperty(exports, "appKeyHint", { enumerable: true, get: function () { return index_js_5.appKeyHint; } });
Object.defineProperty(exports, "BashExecutionComponent", { enumerable: true, get: function () { return index_js_5.BashExecutionComponent; } });
Object.defineProperty(exports, "BorderedLoader", { enumerable: true, get: function () { return index_js_5.BorderedLoader; } });
Object.defineProperty(exports, "BranchSummaryMessageComponent", { enumerable: true, get: function () { return index_js_5.BranchSummaryMessageComponent; } });
Object.defineProperty(exports, "CompactionSummaryMessageComponent", { enumerable: true, get: function () { return index_js_5.CompactionSummaryMessageComponent; } });
Object.defineProperty(exports, "CustomEditor", { enumerable: true, get: function () { return index_js_5.CustomEditor; } });
Object.defineProperty(exports, "CustomMessageComponent", { enumerable: true, get: function () { return index_js_5.CustomMessageComponent; } });
Object.defineProperty(exports, "DynamicBorder", { enumerable: true, get: function () { return index_js_5.DynamicBorder; } });
Object.defineProperty(exports, "ExtensionEditorComponent", { enumerable: true, get: function () { return index_js_5.ExtensionEditorComponent; } });
Object.defineProperty(exports, "ExtensionInputComponent", { enumerable: true, get: function () { return index_js_5.ExtensionInputComponent; } });
Object.defineProperty(exports, "ExtensionSelectorComponent", { enumerable: true, get: function () { return index_js_5.ExtensionSelectorComponent; } });
Object.defineProperty(exports, "editorKey", { enumerable: true, get: function () { return index_js_5.editorKey; } });
Object.defineProperty(exports, "FooterComponent", { enumerable: true, get: function () { return index_js_5.FooterComponent; } });
Object.defineProperty(exports, "keyHint", { enumerable: true, get: function () { return index_js_5.keyHint; } });
Object.defineProperty(exports, "LoginDialogComponent", { enumerable: true, get: function () { return index_js_5.LoginDialogComponent; } });
Object.defineProperty(exports, "ModelSelectorComponent", { enumerable: true, get: function () { return index_js_5.ModelSelectorComponent; } });
Object.defineProperty(exports, "OAuthSelectorComponent", { enumerable: true, get: function () { return index_js_5.OAuthSelectorComponent; } });
Object.defineProperty(exports, "rawKeyHint", { enumerable: true, get: function () { return index_js_5.rawKeyHint; } });
Object.defineProperty(exports, "renderDiff", { enumerable: true, get: function () { return index_js_5.renderDiff; } });
Object.defineProperty(exports, "SessionSelectorComponent", { enumerable: true, get: function () { return index_js_5.SessionSelectorComponent; } });
Object.defineProperty(exports, "SettingsSelectorComponent", { enumerable: true, get: function () { return index_js_5.SettingsSelectorComponent; } });
Object.defineProperty(exports, "ShowImagesSelectorComponent", { enumerable: true, get: function () { return index_js_5.ShowImagesSelectorComponent; } });
Object.defineProperty(exports, "SkillInvocationMessageComponent", { enumerable: true, get: function () { return index_js_5.SkillInvocationMessageComponent; } });
Object.defineProperty(exports, "ThemeSelectorComponent", { enumerable: true, get: function () { return index_js_5.ThemeSelectorComponent; } });
Object.defineProperty(exports, "ThinkingSelectorComponent", { enumerable: true, get: function () { return index_js_5.ThinkingSelectorComponent; } });
Object.defineProperty(exports, "ToolExecutionComponent", { enumerable: true, get: function () { return index_js_5.ToolExecutionComponent; } });
Object.defineProperty(exports, "TreeSelectorComponent", { enumerable: true, get: function () { return index_js_5.TreeSelectorComponent; } });
Object.defineProperty(exports, "truncateToVisualLines", { enumerable: true, get: function () { return index_js_5.truncateToVisualLines; } });
Object.defineProperty(exports, "UserMessageComponent", { enumerable: true, get: function () { return index_js_5.UserMessageComponent; } });
Object.defineProperty(exports, "UserMessageSelectorComponent", { enumerable: true, get: function () { return index_js_5.UserMessageSelectorComponent; } });
// Theme utilities for custom tools and extensions
const theme_js_1 = require("./modes/interactive/theme/theme.js");
Object.defineProperty(exports, "getLanguageFromPath", { enumerable: true, get: function () { return theme_js_1.getLanguageFromPath; } });
Object.defineProperty(exports, "getMarkdownTheme", { enumerable: true, get: function () { return theme_js_1.getMarkdownTheme; } });
Object.defineProperty(exports, "getSelectListTheme", { enumerable: true, get: function () { return theme_js_1.getSelectListTheme; } });
Object.defineProperty(exports, "getSettingsListTheme", { enumerable: true, get: function () { return theme_js_1.getSettingsListTheme; } });
Object.defineProperty(exports, "highlightCode", { enumerable: true, get: function () { return theme_js_1.highlightCode; } });
Object.defineProperty(exports, "initTheme", { enumerable: true, get: function () { return theme_js_1.initTheme; } });
Object.defineProperty(exports, "Theme", { enumerable: true, get: function () { return theme_js_1.Theme; } });
// Clipboard utilities
const clipboard_js_1 = require("./utils/clipboard.js");
Object.defineProperty(exports, "copyToClipboard", { enumerable: true, get: function () { return clipboard_js_1.copyToClipboard; } });
const frontmatter_js_1 = require("./utils/frontmatter.js");
Object.defineProperty(exports, "parseFrontmatter", { enumerable: true, get: function () { return frontmatter_js_1.parseFrontmatter; } });
Object.defineProperty(exports, "stripFrontmatter", { enumerable: true, get: function () { return frontmatter_js_1.stripFrontmatter; } });
// Shell utilities
const shell_js_1 = require("./utils/shell.js");
Object.defineProperty(exports, "getShellConfig", { enumerable: true, get: function () { return shell_js_1.getShellConfig; } });
