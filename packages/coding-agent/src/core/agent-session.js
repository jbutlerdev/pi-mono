"use strict";
/**
 * AgentSession - Core abstraction for agent lifecycle and session management.
 *
 * This class is shared between all run modes (interactive, print, rpc).
 * It encapsulates:
 * - Agent state access
 * - Event subscription with automatic session persistence
 * - Model and thinking level management
 * - Compaction (manual and auto)
 * - Bash execution
 * - Session switching and branching
 *
 * Modes use this class and add their own I/O layer on top.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentSession = void 0;
exports.parseSkillBlock = parseSkillBlock;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const pi_ai_1 = require("@mariozechner/pi-ai");
const config_js_1 = require("../config.js");
const theme_js_1 = require("../modes/interactive/theme/theme.js");
const frontmatter_js_1 = require("../utils/frontmatter.js");
const sleep_js_1 = require("../utils/sleep.js");
const bash_executor_js_1 = require("./bash-executor.js");
const index_js_1 = require("./compaction/index.js");
const defaults_js_1 = require("./defaults.js");
const index_js_2 = require("./export-html/index.js");
const tool_renderer_js_1 = require("./export-html/tool-renderer.js");
const index_js_3 = require("./extensions/index.js");
const prompt_templates_js_1 = require("./prompt-templates.js");
const slash_commands_js_1 = require("./slash-commands.js");
const system_prompt_js_1 = require("./system-prompt.js");
const index_js_4 = require("./tools/index.js");
/**
 * Parse a skill block from message text.
 * Returns null if the text doesn't contain a skill block.
 */
function parseSkillBlock(text) {
    var _a;
    const match = text.match(/^<skill name="([^"]+)" location="([^"]+)">\n([\s\S]*?)\n<\/skill>(?:\n\n([\s\S]+))?$/);
    if (!match)
        return null;
    return {
        name: match[1],
        location: match[2],
        content: match[3],
        userMessage: ((_a = match[4]) === null || _a === void 0 ? void 0 : _a.trim()) || undefined,
    };
}
// ============================================================================
// Constants
// ============================================================================
/** Standard thinking levels */
const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high"];
/** Thinking levels including xhigh (for supported models) */
const THINKING_LEVELS_WITH_XHIGH = ["off", "minimal", "low", "medium", "high", "xhigh"];
// ============================================================================
// AgentSession Class
// ============================================================================
class AgentSession {
    agent;
    sessionManager;
    settingsManager;
    _scopedModels;
    // Event subscription state
    _unsubscribeAgent;
    _eventListeners = [];
    /** Tracks pending steering messages for UI display. Removed when delivered. */
    _steeringMessages = [];
    /** Tracks pending follow-up messages for UI display. Removed when delivered. */
    _followUpMessages = [];
    /** Messages queued to be included with the next user prompt as context ("asides"). */
    _pendingNextTurnMessages = [];
    // Compaction state
    _compactionAbortController = undefined;
    _autoCompactionAbortController = undefined;
    // Branch summarization state
    _branchSummaryAbortController = undefined;
    // Retry state
    _retryAbortController = undefined;
    _retryAttempt = 0;
    _retryPromise = undefined;
    _retryResolve = undefined;
    // Bash execution state
    _bashAbortController = undefined;
    _pendingBashMessages = [];
    // Extension system
    _extensionRunner = undefined;
    _turnIndex = 0;
    _resourceLoader;
    _customTools;
    _baseToolRegistry = new Map();
    _cwd;
    _extensionRunnerRef;
    _initialActiveToolNames;
    _baseToolsOverride;
    _extensionUIContext;
    _extensionCommandContextActions;
    _extensionShutdownHandler;
    _extensionErrorListener;
    _extensionErrorUnsubscriber;
    // Model registry for API key resolution
    _modelRegistry;
    // Tool registry for extension getTools/setTools
    _toolRegistry = new Map();
    // Base system prompt (without extension appends) - used to apply fresh appends each turn
    _baseSystemPrompt = "";
    constructor(config) {
        var _a, _b;
        this.agent = config.agent;
        this.sessionManager = config.sessionManager;
        this.settingsManager = config.settingsManager;
        this._scopedModels = (_a = config.scopedModels) !== null && _a !== void 0 ? _a : [];
        this._resourceLoader = config.resourceLoader;
        this._customTools = (_b = config.customTools) !== null && _b !== void 0 ? _b : [];
        this._cwd = config.cwd;
        this._modelRegistry = config.modelRegistry;
        this._extensionRunnerRef = config.extensionRunnerRef;
        this._initialActiveToolNames = config.initialActiveToolNames;
        this._baseToolsOverride = config.baseToolsOverride;
        // Always subscribe to agent events for internal handling
        // (session persistence, extensions, auto-compaction, retry logic)
        this._unsubscribeAgent = this.agent.subscribe(this._handleAgentEvent);
        this._buildRuntime({
            activeToolNames: this._initialActiveToolNames,
            includeAllExtensionTools: true,
        });
    }
    /** Model registry for API key resolution and model discovery */
    get modelRegistry() {
        return this._modelRegistry;
    }
    // =========================================================================
    // Event Subscription
    // =========================================================================
    /** Emit an event to all listeners */
    _emit(event) {
        for (const l of this._eventListeners) {
            l(event);
        }
    }
    // Track last assistant message for auto-compaction check
    _lastAssistantMessage = undefined;
    /** Internal handler for agent events - shared by subscribe and reconnect */
    _handleAgentEvent = async (event) => {
        // When a user message starts, check if it's from either queue and remove it BEFORE emitting
        // This ensures the UI sees the updated queue state
        if (event.type === "message_start" && event.message.role === "user") {
            const messageText = this._getUserMessageText(event.message);
            if (messageText) {
                // Check steering queue first
                const steeringIndex = this._steeringMessages.indexOf(messageText);
                if (steeringIndex !== -1) {
                    this._steeringMessages.splice(steeringIndex, 1);
                }
                else {
                    // Check follow-up queue
                    const followUpIndex = this._followUpMessages.indexOf(messageText);
                    if (followUpIndex !== -1) {
                        this._followUpMessages.splice(followUpIndex, 1);
                    }
                }
            }
        }
        // Emit to extensions first
        await this._emitExtensionEvent(event);
        // Notify all listeners
        this._emit(event);
        // Handle session persistence
        if (event.type === "message_end") {
            // Check if this is a custom message from extensions
            if (event.message.role === "custom") {
                // Persist as CustomMessageEntry
                this.sessionManager.appendCustomMessageEntry(event.message.customType, event.message.content, event.message.display, event.message.details);
            }
            else if (event.message.role === "user" ||
                event.message.role === "assistant" ||
                event.message.role === "toolResult") {
                // Regular LLM message - persist as SessionMessageEntry
                this.sessionManager.appendMessage(event.message);
            }
            // Other message types (bashExecution, compactionSummary, branchSummary) are persisted elsewhere
            // Track assistant message for auto-compaction (checked on agent_end)
            if (event.message.role === "assistant") {
                this._lastAssistantMessage = event.message;
                // Reset retry counter immediately on successful assistant response
                // This prevents accumulation across multiple LLM calls within a turn
                const assistantMsg = event.message;
                if (assistantMsg.stopReason !== "error" && this._retryAttempt > 0) {
                    this._emit({
                        type: "auto_retry_end",
                        success: true,
                        attempt: this._retryAttempt,
                    });
                    this._retryAttempt = 0;
                    this._resolveRetry();
                }
            }
        }
        // Check auto-retry and auto-compaction after agent completes
        if (event.type === "agent_end" && this._lastAssistantMessage) {
            const msg = this._lastAssistantMessage;
            this._lastAssistantMessage = undefined;
            // Check for retryable errors first (overloaded, rate limit, server errors)
            if (this._isRetryableError(msg)) {
                const didRetry = await this._handleRetryableError(msg);
                if (didRetry)
                    return; // Retry was initiated, don't proceed to compaction
            }
            await this._checkCompaction(msg);
        }
    };
    /** Resolve the pending retry promise */
    _resolveRetry() {
        if (this._retryResolve) {
            this._retryResolve();
            this._retryResolve = undefined;
            this._retryPromise = undefined;
        }
    }
    /** Extract text content from a message */
    _getUserMessageText(message) {
        if (message.role !== "user")
            return "";
        const content = message.content;
        if (typeof content === "string")
            return content;
        const textBlocks = content.filter((c) => c.type === "text");
        return textBlocks.map((c) => c.text).join("");
    }
    /** Find the last assistant message in agent state (including aborted ones) */
    _findLastAssistantMessage() {
        const messages = this.agent.state.messages;
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (msg.role === "assistant") {
                return msg;
            }
        }
        return undefined;
    }
    /** Emit extension events based on agent events */
    async _emitExtensionEvent(event) {
        if (!this._extensionRunner)
            return;
        if (event.type === "agent_start") {
            this._turnIndex = 0;
            await this._extensionRunner.emit({ type: "agent_start" });
        }
        else if (event.type === "agent_end") {
            await this._extensionRunner.emit({ type: "agent_end", messages: event.messages });
        }
        else if (event.type === "turn_start") {
            const extensionEvent = {
                type: "turn_start",
                turnIndex: this._turnIndex,
                timestamp: Date.now(),
            };
            await this._extensionRunner.emit(extensionEvent);
        }
        else if (event.type === "turn_end") {
            const extensionEvent = {
                type: "turn_end",
                turnIndex: this._turnIndex,
                message: event.message,
                toolResults: event.toolResults,
            };
            await this._extensionRunner.emit(extensionEvent);
            this._turnIndex++;
        }
    }
    /**
     * Subscribe to agent events.
     * Session persistence is handled internally (saves messages on message_end).
     * Multiple listeners can be added. Returns unsubscribe function for this listener.
     */
    subscribe(listener) {
        this._eventListeners.push(listener);
        // Return unsubscribe function for this specific listener
        return () => {
            const index = this._eventListeners.indexOf(listener);
            if (index !== -1) {
                this._eventListeners.splice(index, 1);
            }
        };
    }
    /**
     * Temporarily disconnect from agent events.
     * User listeners are preserved and will receive events again after resubscribe().
     * Used internally during operations that need to pause event processing.
     */
    _disconnectFromAgent() {
        if (this._unsubscribeAgent) {
            this._unsubscribeAgent();
            this._unsubscribeAgent = undefined;
        }
    }
    /**
     * Reconnect to agent events after _disconnectFromAgent().
     * Preserves all existing listeners.
     */
    _reconnectToAgent() {
        if (this._unsubscribeAgent)
            return; // Already connected
        this._unsubscribeAgent = this.agent.subscribe(this._handleAgentEvent);
    }
    /**
     * Remove all listeners and disconnect from agent.
     * Call this when completely done with the session.
     */
    dispose() {
        this._disconnectFromAgent();
        this._eventListeners = [];
    }
    // =========================================================================
    // Read-only State Access
    // =========================================================================
    /** Full agent state */
    get state() {
        return this.agent.state;
    }
    /** Current model (may be undefined if not yet selected) */
    get model() {
        return this.agent.state.model;
    }
    /** Current thinking level */
    get thinkingLevel() {
        return this.agent.state.thinkingLevel;
    }
    /** Whether agent is currently streaming a response */
    get isStreaming() {
        return this.agent.state.isStreaming;
    }
    /** Current effective system prompt (includes any per-turn extension modifications) */
    get systemPrompt() {
        return this.agent.state.systemPrompt;
    }
    /** Current retry attempt (0 if not retrying) */
    get retryAttempt() {
        return this._retryAttempt;
    }
    /**
     * Get the names of currently active tools.
     * Returns the names of tools currently set on the agent.
     */
    getActiveToolNames() {
        return this.agent.state.tools.map((t) => t.name);
    }
    /**
     * Get all configured tools with name and description.
     */
    getAllTools() {
        return Array.from(this._toolRegistry.values()).map((t) => ({
            name: t.name,
            description: t.description,
        }));
    }
    /**
     * Set active tools by name.
     * Only tools in the registry can be enabled. Unknown tool names are ignored.
     * Also rebuilds the system prompt to reflect the new tool set.
     * Changes take effect on the next agent turn.
     */
    setActiveToolsByName(toolNames) {
        const tools = [];
        const validToolNames = [];
        for (const name of toolNames) {
            const tool = this._toolRegistry.get(name);
            if (tool) {
                tools.push(tool);
                validToolNames.push(name);
            }
        }
        this.agent.setTools(tools);
        // Rebuild base system prompt with new tool set
        this._baseSystemPrompt = this._rebuildSystemPrompt(validToolNames);
        this.agent.setSystemPrompt(this._baseSystemPrompt);
    }
    /** Whether auto-compaction is currently running */
    get isCompacting() {
        return this._autoCompactionAbortController !== undefined || this._compactionAbortController !== undefined;
    }
    /** All messages including custom types like BashExecutionMessage */
    get messages() {
        return this.agent.state.messages;
    }
    /** Current steering mode */
    get steeringMode() {
        return this.agent.getSteeringMode();
    }
    /** Current follow-up mode */
    get followUpMode() {
        return this.agent.getFollowUpMode();
    }
    /** Current session file path, or undefined if sessions are disabled */
    get sessionFile() {
        return this.sessionManager.getSessionFile();
    }
    /** Current session ID */
    get sessionId() {
        return this.sessionManager.getSessionId();
    }
    /** Current session display name, if set */
    get sessionName() {
        return this.sessionManager.getSessionName();
    }
    /** Scoped models for cycling (from --models flag) */
    get scopedModels() {
        return this._scopedModels;
    }
    /** Update scoped models for cycling */
    setScopedModels(scopedModels) {
        this._scopedModels = scopedModels;
    }
    /** File-based prompt templates */
    get promptTemplates() {
        return this._resourceLoader.getPrompts().prompts;
    }
    _rebuildSystemPrompt(toolNames) {
        const validToolNames = toolNames.filter((name) => this._baseToolRegistry.has(name));
        const loaderSystemPrompt = this._resourceLoader.getSystemPrompt();
        const loaderAppendSystemPrompt = this._resourceLoader.getAppendSystemPrompt();
        const appendSystemPrompt = loaderAppendSystemPrompt.length > 0 ? loaderAppendSystemPrompt.join("\n\n") : undefined;
        const loadedSkills = this._resourceLoader.getSkills().skills;
        const loadedContextFiles = this._resourceLoader.getAgentsFiles().agentsFiles;
        return (0, system_prompt_js_1.buildSystemPrompt)({
            cwd: this._cwd,
            skills: loadedSkills,
            contextFiles: loadedContextFiles,
            customPrompt: loaderSystemPrompt,
            appendSystemPrompt,
            selectedTools: validToolNames,
        });
    }
    // =========================================================================
    // Prompting
    // =========================================================================
    /**
     * Send a prompt to the agent.
     * - Handles extension commands (registered via pi.registerCommand) immediately, even during streaming
     * - Expands file-based prompt templates by default
     * - During streaming, queues via steer() or followUp() based on streamingBehavior option
     * - Validates model and API key before sending (when not streaming)
     * @throws Error if streaming and no streamingBehavior specified
     * @throws Error if no model selected or no API key available (when not streaming)
     */
    async prompt(text, options) {
        var _a;
        var _b, _c, _d;
        const expandPromptTemplates = (_b = options === null || options === void 0 ? void 0 : options.expandPromptTemplates) !== null && _b !== void 0 ? _b : true;
        // Handle extension commands first (execute immediately, even during streaming)
        // Extension commands manage their own LLM interaction via pi.sendMessage()
        if (expandPromptTemplates && text.startsWith("/")) {
            const handled = await this._tryExecuteExtensionCommand(text);
            if (handled) {
                // Extension command executed, no prompt to send
                return;
            }
        }
        // Emit input event for extension interception (before skill/template expansion)
        let currentText = text;
        let currentImages = options === null || options === void 0 ? void 0 : options.images;
        if ((_a = this._extensionRunner) === null || _a === void 0 ? void 0 : _a.hasHandlers("input")) {
            const inputResult = await this._extensionRunner.emitInput(currentText, currentImages, (_c = options === null || options === void 0 ? void 0 : options.source) !== null && _c !== void 0 ? _c : "interactive");
            if (inputResult.action === "handled") {
                return;
            }
            if (inputResult.action === "transform") {
                currentText = inputResult.text;
                currentImages = (_d = inputResult.images) !== null && _d !== void 0 ? _d : currentImages;
            }
        }
        // Expand skill commands (/skill:name args) and prompt templates (/template args)
        let expandedText = currentText;
        if (expandPromptTemplates) {
            expandedText = this._expandSkillCommand(expandedText);
            expandedText = (0, prompt_templates_js_1.expandPromptTemplate)(expandedText, [...this.promptTemplates]);
        }
        // If streaming, queue via steer() or followUp() based on option
        if (this.isStreaming) {
            if (!(options === null || options === void 0 ? void 0 : options.streamingBehavior)) {
                throw new Error("Agent is already processing. Specify streamingBehavior ('steer' or 'followUp') to queue the message.");
            }
            if (options.streamingBehavior === "followUp") {
                await this._queueFollowUp(expandedText, currentImages);
            }
            else {
                await this._queueSteer(expandedText, currentImages);
            }
            return;
        }
        // Flush any pending bash messages before the new prompt
        this._flushPendingBashMessages();
        // Validate model
        if (!this.model) {
            throw new Error("No model selected.\n\n" +
                `Use /login or set an API key environment variable. See ${(0, node_path_1.join)((0, config_js_1.getDocsPath)(), "providers.md")}\n\n` +
                "Then use /model to select a model.");
        }
        // Validate API key
        const apiKey = await this._modelRegistry.getApiKey(this.model);
        if (!apiKey) {
            const isOAuth = this._modelRegistry.isUsingOAuth(this.model);
            if (isOAuth) {
                throw new Error(`Authentication failed for "${this.model.provider}". ` +
                    `Credentials may have expired or network is unavailable. ` +
                    `Run '/login ${this.model.provider}' to re-authenticate.`);
            }
            throw new Error(`No API key found for ${this.model.provider}.\n\n` +
                `Use /login or set an API key environment variable. See ${(0, node_path_1.join)((0, config_js_1.getDocsPath)(), "providers.md")}`);
        }
        // Check if we need to compact before sending (catches aborted responses)
        const lastAssistant = this._findLastAssistantMessage();
        if (lastAssistant) {
            await this._checkCompaction(lastAssistant, false);
        }
        // Build messages array (custom message if any, then user message)
        const messages = [];
        // Add user message
        const userContent = [{ type: "text", text: expandedText }];
        if (currentImages) {
            userContent.push(...currentImages);
        }
        messages.push({
            role: "user",
            content: userContent,
            timestamp: Date.now(),
        });
        // Inject any pending "nextTurn" messages as context alongside the user message
        for (const msg of this._pendingNextTurnMessages) {
            messages.push(msg);
        }
        this._pendingNextTurnMessages = [];
        // Emit before_agent_start extension event
        if (this._extensionRunner) {
            const result = await this._extensionRunner.emitBeforeAgentStart(expandedText, currentImages, this._baseSystemPrompt);
            // Add all custom messages from extensions
            if (result === null || result === void 0 ? void 0 : result.messages) {
                for (const msg of result.messages) {
                    messages.push({
                        role: "custom",
                        customType: msg.customType,
                        content: msg.content,
                        display: msg.display,
                        details: msg.details,
                        timestamp: Date.now(),
                    });
                }
            }
            // Apply extension-modified system prompt, or reset to base
            if (result === null || result === void 0 ? void 0 : result.systemPrompt) {
                this.agent.setSystemPrompt(result.systemPrompt);
            }
            else {
                // Ensure we're using the base prompt (in case previous turn had modifications)
                this.agent.setSystemPrompt(this._baseSystemPrompt);
            }
        }
        await this.agent.prompt(messages);
        await this.waitForRetry();
    }
    /**
     * Try to execute an extension command. Returns true if command was found and executed.
     */
    async _tryExecuteExtensionCommand(text) {
        if (!this._extensionRunner)
            return false;
        // Parse command name and args
        const spaceIndex = text.indexOf(" ");
        const commandName = spaceIndex === -1 ? text.slice(1) : text.slice(1, spaceIndex);
        const args = spaceIndex === -1 ? "" : text.slice(spaceIndex + 1);
        const command = this._extensionRunner.getCommand(commandName);
        if (!command)
            return false;
        // Get command context from extension runner (includes session control methods)
        const ctx = this._extensionRunner.createCommandContext();
        try {
            await command.handler(args, ctx);
            return true;
        }
        catch (err) {
            // Emit error via extension runner
            this._extensionRunner.emitError({
                extensionPath: `command:${commandName}`,
                event: "command",
                error: err instanceof Error ? err.message : String(err),
            });
            return true;
        }
    }
    /**
     * Expand skill commands (/skill:name args) to their full content.
     * Returns the expanded text, or the original text if not a skill command or skill not found.
     * Emits errors via extension runner if file read fails.
     */
    _expandSkillCommand(text) {
        var _a;
        if (!text.startsWith("/skill:"))
            return text;
        const spaceIndex = text.indexOf(" ");
        const skillName = spaceIndex === -1 ? text.slice(7) : text.slice(7, spaceIndex);
        const args = spaceIndex === -1 ? "" : text.slice(spaceIndex + 1).trim();
        const skill = this.resourceLoader.getSkills().skills.find((s) => s.name === skillName);
        if (!skill)
            return text; // Unknown skill, pass through
        try {
            const content = (0, node_fs_1.readFileSync)(skill.filePath, "utf-8");
            const body = (0, frontmatter_js_1.stripFrontmatter)(content).trim();
            const skillBlock = `<skill name="${skill.name}" location="${skill.filePath}">\nReferences are relative to ${skill.baseDir}.\n\n${body}\n</skill>`;
            return args ? `${skillBlock}\n\n${args}` : skillBlock;
        }
        catch (err) {
            // Emit error like extension commands do
            (_a = this._extensionRunner) === null || _a === void 0 ? void 0 : _a.emitError({
                extensionPath: skill.filePath,
                event: "skill_expansion",
                error: err instanceof Error ? err.message : String(err),
            });
            return text; // Return original on error
        }
    }
    /**
     * Queue a steering message to interrupt the agent mid-run.
     * Delivered after current tool execution, skips remaining tools.
     * Expands skill commands and prompt templates. Errors on extension commands.
     * @param images Optional image attachments to include with the message
     * @throws Error if text is an extension command
     */
    async steer(text, images) {
        // Check for extension commands (cannot be queued)
        if (text.startsWith("/")) {
            this._throwIfExtensionCommand(text);
        }
        // Expand skill commands and prompt templates
        let expandedText = this._expandSkillCommand(text);
        expandedText = (0, prompt_templates_js_1.expandPromptTemplate)(expandedText, [...this.promptTemplates]);
        await this._queueSteer(expandedText, images);
    }
    /**
     * Queue a follow-up message to be processed after the agent finishes.
     * Delivered only when agent has no more tool calls or steering messages.
     * Expands skill commands and prompt templates. Errors on extension commands.
     * @param images Optional image attachments to include with the message
     * @throws Error if text is an extension command
     */
    async followUp(text, images) {
        // Check for extension commands (cannot be queued)
        if (text.startsWith("/")) {
            this._throwIfExtensionCommand(text);
        }
        // Expand skill commands and prompt templates
        let expandedText = this._expandSkillCommand(text);
        expandedText = (0, prompt_templates_js_1.expandPromptTemplate)(expandedText, [...this.promptTemplates]);
        await this._queueFollowUp(expandedText, images);
    }
    /**
     * Internal: Queue a steering message (already expanded, no extension command check).
     */
    async _queueSteer(text, images) {
        this._steeringMessages.push(text);
        const content = [{ type: "text", text }];
        if (images) {
            content.push(...images);
        }
        this.agent.steer({
            role: "user",
            content,
            timestamp: Date.now(),
        });
    }
    /**
     * Internal: Queue a follow-up message (already expanded, no extension command check).
     */
    async _queueFollowUp(text, images) {
        this._followUpMessages.push(text);
        const content = [{ type: "text", text }];
        if (images) {
            content.push(...images);
        }
        this.agent.followUp({
            role: "user",
            content,
            timestamp: Date.now(),
        });
    }
    /**
     * Throw an error if the text is an extension command.
     */
    _throwIfExtensionCommand(text) {
        if (!this._extensionRunner)
            return;
        const spaceIndex = text.indexOf(" ");
        const commandName = spaceIndex === -1 ? text.slice(1) : text.slice(1, spaceIndex);
        const command = this._extensionRunner.getCommand(commandName);
        if (command) {
            throw new Error(`Extension command "/${commandName}" cannot be queued. Use prompt() or execute the command when not streaming.`);
        }
    }
    /**
     * Send a custom message to the session. Creates a CustomMessageEntry.
     *
     * Handles three cases:
     * - Streaming: queues message, processed when loop pulls from queue
     * - Not streaming + triggerTurn: appends to state/session, starts new turn
     * - Not streaming + no trigger: appends to state/session, no turn
     *
     * @param message Custom message with customType, content, display, details
     * @param options.triggerTurn If true and not streaming, triggers a new LLM turn
     * @param options.deliverAs Delivery mode: "steer", "followUp", or "nextTurn"
     */
    async sendCustomMessage(message, options) {
        const appMessage = {
            role: "custom",
            customType: message.customType,
            content: message.content,
            display: message.display,
            details: message.details,
            timestamp: Date.now(),
        };
        if ((options === null || options === void 0 ? void 0 : options.deliverAs) === "nextTurn") {
            this._pendingNextTurnMessages.push(appMessage);
        }
        else if (this.isStreaming) {
            if ((options === null || options === void 0 ? void 0 : options.deliverAs) === "followUp") {
                this.agent.followUp(appMessage);
            }
            else {
                this.agent.steer(appMessage);
            }
        }
        else if (options === null || options === void 0 ? void 0 : options.triggerTurn) {
            await this.agent.prompt(appMessage);
        }
        else {
            this.agent.appendMessage(appMessage);
            this.sessionManager.appendCustomMessageEntry(message.customType, message.content, message.display, message.details);
            this._emit({ type: "message_start", message: appMessage });
            this._emit({ type: "message_end", message: appMessage });
        }
    }
    /**
     * Send a user message to the agent. Always triggers a turn.
     * When the agent is streaming, use deliverAs to specify how to queue the message.
     *
     * @param content User message content (string or content array)
     * @param options.deliverAs Delivery mode when streaming: "steer" or "followUp"
     */
    async sendUserMessage(content, options) {
        // Normalize content to text string + optional images
        let text;
        let images;
        if (typeof content === "string") {
            text = content;
        }
        else {
            const textParts = [];
            images = [];
            for (const part of content) {
                if (part.type === "text") {
                    textParts.push(part.text);
                }
                else {
                    images.push(part);
                }
            }
            text = textParts.join("\n");
            if (images.length === 0)
                images = undefined;
        }
        // Use prompt() with expandPromptTemplates: false to skip command handling and template expansion
        await this.prompt(text, {
            expandPromptTemplates: false,
            streamingBehavior: options === null || options === void 0 ? void 0 : options.deliverAs,
            images,
            source: "extension",
        });
    }
    /**
     * Clear all queued messages and return them.
     * Useful for restoring to editor when user aborts.
     * @returns Object with steering and followUp arrays
     */
    clearQueue() {
        const steering = [...this._steeringMessages];
        const followUp = [...this._followUpMessages];
        this._steeringMessages = [];
        this._followUpMessages = [];
        this.agent.clearAllQueues();
        return { steering, followUp };
    }
    /** Number of pending messages (includes both steering and follow-up) */
    get pendingMessageCount() {
        return this._steeringMessages.length + this._followUpMessages.length;
    }
    /** Get pending steering messages (read-only) */
    getSteeringMessages() {
        return this._steeringMessages;
    }
    /** Get pending follow-up messages (read-only) */
    getFollowUpMessages() {
        return this._followUpMessages;
    }
    get resourceLoader() {
        return this._resourceLoader;
    }
    /**
     * Abort current operation and wait for agent to become idle.
     */
    async abort() {
        this.abortRetry();
        this.agent.abort();
        await this.agent.waitForIdle();
    }
    /**
     * Start a new session, optionally with initial messages and parent tracking.
     * Clears all messages and starts a new session.
     * Listeners are preserved and will continue receiving events.
     * @param options.parentSession - Optional parent session path for tracking
     * @param options.setup - Optional callback to initialize session (e.g., append messages)
     * @returns true if completed, false if cancelled by extension
     */
    async newSession(options) {
        var _a;
        const previousSessionFile = this.sessionFile;
        // Emit session_before_switch event with reason "new" (can be cancelled)
        if ((_a = this._extensionRunner) === null || _a === void 0 ? void 0 : _a.hasHandlers("session_before_switch")) {
            const result = (await this._extensionRunner.emit({
                type: "session_before_switch",
                reason: "new",
            }));
            if (result === null || result === void 0 ? void 0 : result.cancel) {
                return false;
            }
        }
        this._disconnectFromAgent();
        await this.abort();
        this.agent.reset();
        this.sessionManager.newSession({ parentSession: options === null || options === void 0 ? void 0 : options.parentSession });
        this.agent.sessionId = this.sessionManager.getSessionId();
        this._steeringMessages = [];
        this._followUpMessages = [];
        this._pendingNextTurnMessages = [];
        this.sessionManager.appendThinkingLevelChange(this.thinkingLevel);
        // Run setup callback if provided (e.g., to append initial messages)
        if (options === null || options === void 0 ? void 0 : options.setup) {
            await options.setup(this.sessionManager);
            // Sync agent state with session manager after setup
            const sessionContext = this.sessionManager.buildSessionContext();
            this.agent.replaceMessages(sessionContext.messages);
        }
        this._reconnectToAgent();
        // Emit session_switch event with reason "new" to extensions
        if (this._extensionRunner) {
            await this._extensionRunner.emit({
                type: "session_switch",
                reason: "new",
                previousSessionFile,
            });
        }
        // Emit session event to custom tools
        return true;
    }
    // =========================================================================
    // Model Management
    // =========================================================================
    async _emitModelSelect(nextModel, previousModel, source) {
        if (!this._extensionRunner)
            return;
        if ((0, pi_ai_1.modelsAreEqual)(previousModel, nextModel))
            return;
        await this._extensionRunner.emit({
            type: "model_select",
            model: nextModel,
            previousModel,
            source,
        });
    }
    /**
     * Set model directly.
     * Validates API key, saves to session and settings.
     * @throws Error if no API key available for the model
     */
    async setModel(model) {
        const apiKey = await this._modelRegistry.getApiKey(model);
        if (!apiKey) {
            throw new Error(`No API key for ${model.provider}/${model.id}`);
        }
        const previousModel = this.model;
        this.agent.setModel(model);
        this.sessionManager.appendModelChange(model.provider, model.id);
        this.settingsManager.setDefaultModelAndProvider(model.provider, model.id);
        // Re-clamp thinking level for new model's capabilities
        this.setThinkingLevel(this.thinkingLevel);
        await this._emitModelSelect(model, previousModel, "set");
    }
    /**
     * Cycle to next/previous model.
     * Uses scoped models (from --models flag) if available, otherwise all available models.
     * @param direction - "forward" (default) or "backward"
     * @returns The new model info, or undefined if only one model available
     */
    async cycleModel(direction = "forward") {
        if (this._scopedModels.length > 0) {
            return this._cycleScopedModel(direction);
        }
        return this._cycleAvailableModel(direction);
    }
    async _getScopedModelsWithApiKey() {
        const apiKeysByProvider = new Map();
        const result = [];
        for (const scoped of this._scopedModels) {
            const provider = scoped.model.provider;
            let apiKey;
            if (apiKeysByProvider.has(provider)) {
                apiKey = apiKeysByProvider.get(provider);
            }
            else {
                apiKey = await this._modelRegistry.getApiKeyForProvider(provider);
                apiKeysByProvider.set(provider, apiKey);
            }
            if (apiKey) {
                result.push(scoped);
            }
        }
        return result;
    }
    async _cycleScopedModel(direction) {
        const scopedModels = await this._getScopedModelsWithApiKey();
        if (scopedModels.length <= 1)
            return undefined;
        const currentModel = this.model;
        let currentIndex = scopedModels.findIndex((sm) => (0, pi_ai_1.modelsAreEqual)(sm.model, currentModel));
        if (currentIndex === -1)
            currentIndex = 0;
        const len = scopedModels.length;
        const nextIndex = direction === "forward" ? (currentIndex + 1) % len : (currentIndex - 1 + len) % len;
        const next = scopedModels[nextIndex];
        // Apply model
        this.agent.setModel(next.model);
        this.sessionManager.appendModelChange(next.model.provider, next.model.id);
        this.settingsManager.setDefaultModelAndProvider(next.model.provider, next.model.id);
        // Apply thinking level (setThinkingLevel clamps to model capabilities)
        this.setThinkingLevel(next.thinkingLevel);
        await this._emitModelSelect(next.model, currentModel, "cycle");
        return { model: next.model, thinkingLevel: this.thinkingLevel, isScoped: true };
    }
    async _cycleAvailableModel(direction) {
        const availableModels = await this._modelRegistry.getAvailable();
        if (availableModels.length <= 1)
            return undefined;
        const currentModel = this.model;
        let currentIndex = availableModels.findIndex((m) => (0, pi_ai_1.modelsAreEqual)(m, currentModel));
        if (currentIndex === -1)
            currentIndex = 0;
        const len = availableModels.length;
        const nextIndex = direction === "forward" ? (currentIndex + 1) % len : (currentIndex - 1 + len) % len;
        const nextModel = availableModels[nextIndex];
        const apiKey = await this._modelRegistry.getApiKey(nextModel);
        if (!apiKey) {
            throw new Error(`No API key for ${nextModel.provider}/${nextModel.id}`);
        }
        this.agent.setModel(nextModel);
        this.sessionManager.appendModelChange(nextModel.provider, nextModel.id);
        this.settingsManager.setDefaultModelAndProvider(nextModel.provider, nextModel.id);
        // Re-clamp thinking level for new model's capabilities
        this.setThinkingLevel(this.thinkingLevel);
        await this._emitModelSelect(nextModel, currentModel, "cycle");
        return { model: nextModel, thinkingLevel: this.thinkingLevel, isScoped: false };
    }
    // =========================================================================
    // Thinking Level Management
    // =========================================================================
    /**
     * Set thinking level.
     * Clamps to model capabilities based on available thinking levels.
     * Saves to session and settings only if the level actually changes.
     */
    setThinkingLevel(level) {
        const availableLevels = this.getAvailableThinkingLevels();
        const effectiveLevel = availableLevels.includes(level) ? level : this._clampThinkingLevel(level, availableLevels);
        // Only persist if actually changing
        const isChanging = effectiveLevel !== this.agent.state.thinkingLevel;
        this.agent.setThinkingLevel(effectiveLevel);
        if (isChanging) {
            this.sessionManager.appendThinkingLevelChange(effectiveLevel);
            this.settingsManager.setDefaultThinkingLevel(effectiveLevel);
        }
    }
    /**
     * Cycle to next thinking level.
     * @returns New level, or undefined if model doesn't support thinking
     */
    cycleThinkingLevel() {
        if (!this.supportsThinking())
            return undefined;
        const levels = this.getAvailableThinkingLevels();
        const currentIndex = levels.indexOf(this.thinkingLevel);
        const nextIndex = (currentIndex + 1) % levels.length;
        const nextLevel = levels[nextIndex];
        this.setThinkingLevel(nextLevel);
        return nextLevel;
    }
    /**
     * Get available thinking levels for current model.
     * The provider will clamp to what the specific model supports internally.
     */
    getAvailableThinkingLevels() {
        if (!this.supportsThinking())
            return ["off"];
        return this.supportsXhighThinking() ? THINKING_LEVELS_WITH_XHIGH : THINKING_LEVELS;
    }
    /**
     * Check if current model supports xhigh thinking level.
     */
    supportsXhighThinking() {
        return this.model ? (0, pi_ai_1.supportsXhigh)(this.model) : false;
    }
    /**
     * Check if current model supports thinking/reasoning.
     */
    supportsThinking() {
        var _a;
        return !!((_a = this.model) === null || _a === void 0 ? void 0 : _a.reasoning);
    }
    _clampThinkingLevel(level, availableLevels) {
        var _a, _b;
        const ordered = THINKING_LEVELS_WITH_XHIGH;
        const available = new Set(availableLevels);
        const requestedIndex = ordered.indexOf(level);
        if (requestedIndex === -1) {
            return (_a = availableLevels[0]) !== null && _a !== void 0 ? _a : "off";
        }
        for (let i = requestedIndex; i < ordered.length; i++) {
            const candidate = ordered[i];
            if (available.has(candidate))
                return candidate;
        }
        for (let i = requestedIndex - 1; i >= 0; i--) {
            const candidate = ordered[i];
            if (available.has(candidate))
                return candidate;
        }
        return (_b = availableLevels[0]) !== null && _b !== void 0 ? _b : "off";
    }
    // =========================================================================
    // Queue Mode Management
    // =========================================================================
    /**
     * Set steering message mode.
     * Saves to settings.
     */
    setSteeringMode(mode) {
        this.agent.setSteeringMode(mode);
        this.settingsManager.setSteeringMode(mode);
    }
    /**
     * Set follow-up message mode.
     * Saves to settings.
     */
    setFollowUpMode(mode) {
        this.agent.setFollowUpMode(mode);
        this.settingsManager.setFollowUpMode(mode);
    }
    // =========================================================================
    // Compaction
    // =========================================================================
    /**
     * Manually compact the session context.
     * Aborts current agent operation first.
     * @param customInstructions Optional instructions for the compaction summary
     */
    async compact(customInstructions) {
        var _a;
        this._disconnectFromAgent();
        await this.abort();
        this._compactionAbortController = new AbortController();
        try {
            if (!this.model) {
                throw new Error("No model selected");
            }
            const apiKey = await this._modelRegistry.getApiKey(this.model);
            if (!apiKey) {
                throw new Error(`No API key for ${this.model.provider}`);
            }
            const pathEntries = this.sessionManager.getBranch();
            const settings = this.settingsManager.getCompactionSettings();
            const preparation = (0, index_js_1.prepareCompaction)(pathEntries, settings);
            if (!preparation) {
                // Check why we can't compact
                const lastEntry = pathEntries[pathEntries.length - 1];
                if ((lastEntry === null || lastEntry === void 0 ? void 0 : lastEntry.type) === "compaction") {
                    throw new Error("Already compacted");
                }
                throw new Error("Nothing to compact (session too small)");
            }
            let extensionCompaction;
            let fromExtension = false;
            if ((_a = this._extensionRunner) === null || _a === void 0 ? void 0 : _a.hasHandlers("session_before_compact")) {
                const result = (await this._extensionRunner.emit({
                    type: "session_before_compact",
                    preparation,
                    branchEntries: pathEntries,
                    customInstructions,
                    signal: this._compactionAbortController.signal,
                }));
                if (result === null || result === void 0 ? void 0 : result.cancel) {
                    throw new Error("Compaction cancelled");
                }
                if (result === null || result === void 0 ? void 0 : result.compaction) {
                    extensionCompaction = result.compaction;
                    fromExtension = true;
                }
            }
            let summary;
            let firstKeptEntryId;
            let tokensBefore;
            let details;
            if (extensionCompaction) {
                // Extension provided compaction content
                summary = extensionCompaction.summary;
                firstKeptEntryId = extensionCompaction.firstKeptEntryId;
                tokensBefore = extensionCompaction.tokensBefore;
                details = extensionCompaction.details;
            }
            else {
                // Generate compaction result
                const result = await (0, index_js_1.compact)(preparation, this.model, apiKey, customInstructions, this._compactionAbortController.signal);
                summary = result.summary;
                firstKeptEntryId = result.firstKeptEntryId;
                tokensBefore = result.tokensBefore;
                details = result.details;
            }
            if (this._compactionAbortController.signal.aborted) {
                throw new Error("Compaction cancelled");
            }
            this.sessionManager.appendCompaction(summary, firstKeptEntryId, tokensBefore, details, fromExtension);
            const newEntries = this.sessionManager.getEntries();
            const sessionContext = this.sessionManager.buildSessionContext();
            this.agent.replaceMessages(sessionContext.messages);
            // Get the saved compaction entry for the extension event
            const savedCompactionEntry = newEntries.find((e) => e.type === "compaction" && e.summary === summary);
            if (this._extensionRunner && savedCompactionEntry) {
                await this._extensionRunner.emit({
                    type: "session_compact",
                    compactionEntry: savedCompactionEntry,
                    fromExtension,
                });
            }
            return {
                summary,
                firstKeptEntryId,
                tokensBefore,
                details,
            };
        }
        finally {
            this._compactionAbortController = undefined;
            this._reconnectToAgent();
        }
    }
    /**
     * Cancel in-progress compaction (manual or auto).
     */
    abortCompaction() {
        var _a, _b;
        (_a = this._compactionAbortController) === null || _a === void 0 ? void 0 : _a.abort();
        (_b = this._autoCompactionAbortController) === null || _b === void 0 ? void 0 : _b.abort();
    }
    /**
     * Cancel in-progress branch summarization.
     */
    abortBranchSummary() {
        var _a;
        (_a = this._branchSummaryAbortController) === null || _a === void 0 ? void 0 : _a.abort();
    }
    /**
     * Check if compaction is needed and run it.
     * Called after agent_end and before prompt submission.
     *
     * Two cases:
     * 1. Overflow: LLM returned context overflow error, remove error message from agent state, compact, auto-retry
     * 2. Threshold: Context over threshold, compact, NO auto-retry (user continues manually)
     *
     * @param assistantMessage The assistant message to check
     * @param skipAbortedCheck If false, include aborted messages (for pre-prompt check). Default: true
     */
    async _checkCompaction(assistantMessage, skipAbortedCheck = true) {
        var _a;
        var _b;
        const settings = this.settingsManager.getCompactionSettings();
        if (!settings.enabled)
            return;
        // Skip if message was aborted (user cancelled) - unless skipAbortedCheck is false
        if (skipAbortedCheck && assistantMessage.stopReason === "aborted")
            return;
        const contextWindow = (_b = (_a = this.model) === null || _a === void 0 ? void 0 : _a.contextWindow) !== null && _b !== void 0 ? _b : 0;
        // Skip overflow check if the message came from a different model.
        // This handles the case where user switched from a smaller-context model (e.g. opus)
        // to a larger-context model (e.g. codex) - the overflow error from the old model
        // shouldn't trigger compaction for the new model.
        const sameModel = this.model && assistantMessage.provider === this.model.provider && assistantMessage.model === this.model.id;
        // Skip overflow check if the error is from before a compaction in the current path.
        // This handles the case where an error was kept after compaction (in the "kept" region).
        // The error shouldn't trigger another compaction since we already compacted.
        // Example: opus fails → switch to codex → compact → switch back to opus → opus error
        // is still in context but shouldn't trigger compaction again.
        const compactionEntry = this.sessionManager.getBranch().find((e) => e.type === "compaction");
        const errorIsFromBeforeCompaction = compactionEntry && assistantMessage.timestamp < new Date(compactionEntry.timestamp).getTime();
        // Case 1: Overflow - LLM returned context overflow error
        if (sameModel && !errorIsFromBeforeCompaction && (0, pi_ai_1.isContextOverflow)(assistantMessage, contextWindow)) {
            // Remove the error message from agent state (it IS saved to session for history,
            // but we don't want it in context for the retry)
            const messages = this.agent.state.messages;
            if (messages.length > 0 && messages[messages.length - 1].role === "assistant") {
                this.agent.replaceMessages(messages.slice(0, -1));
            }
            await this._runAutoCompaction("overflow", true);
            return;
        }
        // Case 2: Threshold - turn succeeded but context is getting large
        // Skip if this was an error (non-overflow errors don't have usage data)
        if (assistantMessage.stopReason === "error")
            return;
        const contextTokens = (0, index_js_1.calculateContextTokens)(assistantMessage.usage);
        if ((0, index_js_1.shouldCompact)(contextTokens, contextWindow, settings)) {
            await this._runAutoCompaction("threshold", false);
        }
    }
    /**
     * Internal: Run auto-compaction with events.
     */
    async _runAutoCompaction(reason, willRetry) {
        var _a;
        const settings = this.settingsManager.getCompactionSettings();
        this._emit({ type: "auto_compaction_start", reason });
        this._autoCompactionAbortController = new AbortController();
        try {
            if (!this.model) {
                this._emit({ type: "auto_compaction_end", result: undefined, aborted: false, willRetry: false });
                return;
            }
            const apiKey = await this._modelRegistry.getApiKey(this.model);
            if (!apiKey) {
                this._emit({ type: "auto_compaction_end", result: undefined, aborted: false, willRetry: false });
                return;
            }
            const pathEntries = this.sessionManager.getBranch();
            const preparation = (0, index_js_1.prepareCompaction)(pathEntries, settings);
            if (!preparation) {
                this._emit({ type: "auto_compaction_end", result: undefined, aborted: false, willRetry: false });
                return;
            }
            let extensionCompaction;
            let fromExtension = false;
            if ((_a = this._extensionRunner) === null || _a === void 0 ? void 0 : _a.hasHandlers("session_before_compact")) {
                const extensionResult = (await this._extensionRunner.emit({
                    type: "session_before_compact",
                    preparation,
                    branchEntries: pathEntries,
                    customInstructions: undefined,
                    signal: this._autoCompactionAbortController.signal,
                }));
                if (extensionResult === null || extensionResult === void 0 ? void 0 : extensionResult.cancel) {
                    this._emit({ type: "auto_compaction_end", result: undefined, aborted: true, willRetry: false });
                    return;
                }
                if (extensionResult === null || extensionResult === void 0 ? void 0 : extensionResult.compaction) {
                    extensionCompaction = extensionResult.compaction;
                    fromExtension = true;
                }
            }
            let summary;
            let firstKeptEntryId;
            let tokensBefore;
            let details;
            if (extensionCompaction) {
                // Extension provided compaction content
                summary = extensionCompaction.summary;
                firstKeptEntryId = extensionCompaction.firstKeptEntryId;
                tokensBefore = extensionCompaction.tokensBefore;
                details = extensionCompaction.details;
            }
            else {
                // Generate compaction result
                const compactResult = await (0, index_js_1.compact)(preparation, this.model, apiKey, undefined, this._autoCompactionAbortController.signal);
                summary = compactResult.summary;
                firstKeptEntryId = compactResult.firstKeptEntryId;
                tokensBefore = compactResult.tokensBefore;
                details = compactResult.details;
            }
            if (this._autoCompactionAbortController.signal.aborted) {
                this._emit({ type: "auto_compaction_end", result: undefined, aborted: true, willRetry: false });
                return;
            }
            this.sessionManager.appendCompaction(summary, firstKeptEntryId, tokensBefore, details, fromExtension);
            const newEntries = this.sessionManager.getEntries();
            const sessionContext = this.sessionManager.buildSessionContext();
            this.agent.replaceMessages(sessionContext.messages);
            // Get the saved compaction entry for the extension event
            const savedCompactionEntry = newEntries.find((e) => e.type === "compaction" && e.summary === summary);
            if (this._extensionRunner && savedCompactionEntry) {
                await this._extensionRunner.emit({
                    type: "session_compact",
                    compactionEntry: savedCompactionEntry,
                    fromExtension,
                });
            }
            const result = {
                summary,
                firstKeptEntryId,
                tokensBefore,
                details,
            };
            this._emit({ type: "auto_compaction_end", result, aborted: false, willRetry });
            if (willRetry) {
                const messages = this.agent.state.messages;
                const lastMsg = messages[messages.length - 1];
                if ((lastMsg === null || lastMsg === void 0 ? void 0 : lastMsg.role) === "assistant" && lastMsg.stopReason === "error") {
                    this.agent.replaceMessages(messages.slice(0, -1));
                }
                setTimeout(() => {
                    this.agent.continue().catch(() => { });
                }, 100);
            }
            else if (this.agent.hasQueuedMessages()) {
                // Auto-compaction can complete while follow-up/steering/custom messages are waiting.
                // Kick the loop so queued messages are actually delivered.
                setTimeout(() => {
                    this.agent.continue().catch(() => { });
                }, 100);
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : "compaction failed";
            this._emit({
                type: "auto_compaction_end",
                result: undefined,
                aborted: false,
                willRetry: false,
                errorMessage: reason === "overflow"
                    ? `Context overflow recovery failed: ${errorMessage}`
                    : `Auto-compaction failed: ${errorMessage}`,
            });
        }
        finally {
            this._autoCompactionAbortController = undefined;
        }
    }
    /**
     * Toggle auto-compaction setting.
     */
    setAutoCompactionEnabled(enabled) {
        this.settingsManager.setCompactionEnabled(enabled);
    }
    /** Whether auto-compaction is enabled */
    get autoCompactionEnabled() {
        return this.settingsManager.getCompactionEnabled();
    }
    async bindExtensions(bindings) {
        if (bindings.uiContext !== undefined) {
            this._extensionUIContext = bindings.uiContext;
        }
        if (bindings.commandContextActions !== undefined) {
            this._extensionCommandContextActions = bindings.commandContextActions;
        }
        if (bindings.shutdownHandler !== undefined) {
            this._extensionShutdownHandler = bindings.shutdownHandler;
        }
        if (bindings.onError !== undefined) {
            this._extensionErrorListener = bindings.onError;
        }
        if (this._extensionRunner) {
            this._applyExtensionBindings(this._extensionRunner);
            await this._extensionRunner.emit({ type: "session_start" });
            await this.extendResourcesFromExtensions("startup");
        }
    }
    async extendResourcesFromExtensions(reason) {
        var _a;
        if (!((_a = this._extensionRunner) === null || _a === void 0 ? void 0 : _a.hasHandlers("resources_discover"))) {
            return;
        }
        const { skillPaths, promptPaths, themePaths } = await this._extensionRunner.emitResourcesDiscover(this._cwd, reason);
        if (skillPaths.length === 0 && promptPaths.length === 0 && themePaths.length === 0) {
            return;
        }
        const extensionPaths = {
            skillPaths: this.buildExtensionResourcePaths(skillPaths),
            promptPaths: this.buildExtensionResourcePaths(promptPaths),
            themePaths: this.buildExtensionResourcePaths(themePaths),
        };
        this._resourceLoader.extendResources(extensionPaths);
        this._baseSystemPrompt = this._rebuildSystemPrompt(this.getActiveToolNames());
        this.agent.setSystemPrompt(this._baseSystemPrompt);
    }
    buildExtensionResourcePaths(entries) {
        return entries.map((entry) => {
            const source = this.getExtensionSourceLabel(entry.extensionPath);
            const baseDir = entry.extensionPath.startsWith("<") ? undefined : (0, node_path_1.dirname)(entry.extensionPath);
            return {
                path: entry.path,
                metadata: {
                    source,
                    scope: "temporary",
                    origin: "top-level",
                    baseDir,
                },
            };
        });
    }
    getExtensionSourceLabel(extensionPath) {
        if (extensionPath.startsWith("<")) {
            return `extension:${extensionPath.replace(/[<>]/g, "")}`;
        }
        const base = (0, node_path_1.basename)(extensionPath);
        const name = base.replace(/\.(ts|js)$/, "");
        return `extension:${name}`;
    }
    _applyExtensionBindings(runner) {
        var _a;
        runner.setUIContext(this._extensionUIContext);
        runner.bindCommandContext(this._extensionCommandContextActions);
        (_a = this._extensionErrorUnsubscriber) === null || _a === void 0 ? void 0 : _a.call(this);
        this._extensionErrorUnsubscriber = this._extensionErrorListener
            ? runner.onError(this._extensionErrorListener)
            : undefined;
    }
    _bindExtensionCore(runner) {
        const normalizeLocation = (source) => {
            if (source === "user" || source === "project" || source === "path") {
                return source;
            }
            return undefined;
        };
        const reservedBuiltins = new Set(slash_commands_js_1.BUILTIN_SLASH_COMMANDS.map((command) => command.name));
        const getCommands = () => {
            const extensionCommands = runner
                .getRegisteredCommandsWithPaths()
                .filter(({ command }) => !reservedBuiltins.has(command.name))
                .map(({ command, extensionPath }) => ({
                name: command.name,
                description: command.description,
                source: "extension",
                path: extensionPath,
            }));
            const templates = this.promptTemplates.map((template) => ({
                name: template.name,
                description: template.description,
                source: "prompt",
                location: normalizeLocation(template.source),
                path: template.filePath,
            }));
            const skills = this._resourceLoader.getSkills().skills.map((skill) => ({
                name: `skill:${skill.name}`,
                description: skill.description,
                source: "skill",
                location: normalizeLocation(skill.source),
                path: skill.filePath,
            }));
            return [...extensionCommands, ...templates, ...skills];
        };
        runner.bindCore({
            sendMessage: (message, options) => {
                this.sendCustomMessage(message, options).catch((err) => {
                    runner.emitError({
                        extensionPath: "<runtime>",
                        event: "send_message",
                        error: err instanceof Error ? err.message : String(err),
                    });
                });
            },
            sendUserMessage: (content, options) => {
                this.sendUserMessage(content, options).catch((err) => {
                    runner.emitError({
                        extensionPath: "<runtime>",
                        event: "send_user_message",
                        error: err instanceof Error ? err.message : String(err),
                    });
                });
            },
            appendEntry: (customType, data) => {
                this.sessionManager.appendCustomEntry(customType, data);
            },
            setSessionName: (name) => {
                this.sessionManager.appendSessionInfo(name);
            },
            getSessionName: () => {
                return this.sessionManager.getSessionName();
            },
            setLabel: (entryId, label) => {
                this.sessionManager.appendLabelChange(entryId, label);
            },
            getActiveTools: () => this.getActiveToolNames(),
            getAllTools: () => this.getAllTools(),
            setActiveTools: (toolNames) => this.setActiveToolsByName(toolNames),
            getCommands,
            setModel: async (model) => {
                const key = await this.modelRegistry.getApiKey(model);
                if (!key)
                    return false;
                await this.setModel(model);
                return true;
            },
            getThinkingLevel: () => this.thinkingLevel,
            setThinkingLevel: (level) => this.setThinkingLevel(level),
        }, {
            getModel: () => this.model,
            isIdle: () => !this.isStreaming,
            abort: () => this.abort(),
            hasPendingMessages: () => this.pendingMessageCount > 0,
            shutdown: () => {
                var _a;
                (_a = this._extensionShutdownHandler) === null || _a === void 0 ? void 0 : _a.call(this);
            },
            getContextUsage: () => this.getContextUsage(),
            compact: (options) => {
                void (async () => {
                    var _a, _b;
                    try {
                        const result = await this.compact(options === null || options === void 0 ? void 0 : options.customInstructions);
                        (_a = options === null || options === void 0 ? void 0 : options.onComplete) === null || _a === void 0 ? void 0 : _a.call(options, result);
                    }
                    catch (error) {
                        const err = error instanceof Error ? error : new Error(String(error));
                        (_b = options === null || options === void 0 ? void 0 : options.onError) === null || _b === void 0 ? void 0 : _b.call(options, err);
                    }
                })();
            },
            getSystemPrompt: () => this.systemPrompt,
        });
    }
    _buildRuntime(options) {
        var _a;
        var _b, _c;
        const autoResizeImages = this.settingsManager.getImageAutoResize();
        const shellCommandPrefix = this.settingsManager.getShellCommandPrefix();
        const baseTools = this._baseToolsOverride
            ? this._baseToolsOverride
            : (0, index_js_4.createAllTools)(this._cwd, {
                read: { autoResizeImages },
                bash: { commandPrefix: shellCommandPrefix },
            });
        this._baseToolRegistry = new Map(Object.entries(baseTools).map(([name, tool]) => [name, tool]));
        const extensionsResult = this._resourceLoader.getExtensions();
        if (options.flagValues) {
            for (const [name, value] of options.flagValues) {
                extensionsResult.runtime.flagValues.set(name, value);
            }
        }
        const hasExtensions = extensionsResult.extensions.length > 0;
        const hasCustomTools = this._customTools.length > 0;
        this._extensionRunner =
            hasExtensions || hasCustomTools
                ? new index_js_3.ExtensionRunner(extensionsResult.extensions, extensionsResult.runtime, this._cwd, this.sessionManager, this._modelRegistry)
                : undefined;
        if (this._extensionRunnerRef) {
            this._extensionRunnerRef.current = this._extensionRunner;
        }
        if (this._extensionRunner) {
            this._bindExtensionCore(this._extensionRunner);
            this._applyExtensionBindings(this._extensionRunner);
        }
        const registeredTools = (_b = (_a = this._extensionRunner) === null || _a === void 0 ? void 0 : _a.getAllRegisteredTools()) !== null && _b !== void 0 ? _b : [];
        const allCustomTools = [
            ...registeredTools,
            ...this._customTools.map((def) => ({ definition: def, extensionPath: "<sdk>" })),
        ];
        const wrappedExtensionTools = this._extensionRunner
            ? (0, index_js_3.wrapRegisteredTools)(allCustomTools, this._extensionRunner)
            : [];
        const toolRegistry = new Map(this._baseToolRegistry);
        for (const tool of wrappedExtensionTools) {
            toolRegistry.set(tool.name, tool);
        }
        const defaultActiveToolNames = this._baseToolsOverride
            ? Object.keys(this._baseToolsOverride)
            : ["read", "bash", "edit", "write"];
        const baseActiveToolNames = (_c = options.activeToolNames) !== null && _c !== void 0 ? _c : defaultActiveToolNames;
        const activeToolNameSet = new Set(baseActiveToolNames);
        if (options.includeAllExtensionTools) {
            for (const tool of wrappedExtensionTools) {
                activeToolNameSet.add(tool.name);
            }
        }
        const extensionToolNames = new Set(wrappedExtensionTools.map((tool) => tool.name));
        const activeBaseTools = Array.from(activeToolNameSet)
            .filter((name) => this._baseToolRegistry.has(name) && !extensionToolNames.has(name))
            .map((name) => this._baseToolRegistry.get(name));
        const activeExtensionTools = wrappedExtensionTools.filter((tool) => activeToolNameSet.has(tool.name));
        const activeToolsArray = [...activeBaseTools, ...activeExtensionTools];
        if (this._extensionRunner) {
            const wrappedActiveTools = (0, index_js_3.wrapToolsWithExtensions)(activeToolsArray, this._extensionRunner);
            this.agent.setTools(wrappedActiveTools);
            const wrappedAllTools = (0, index_js_3.wrapToolsWithExtensions)(Array.from(toolRegistry.values()), this._extensionRunner);
            this._toolRegistry = new Map(wrappedAllTools.map((tool) => [tool.name, tool]));
        }
        else {
            this.agent.setTools(activeToolsArray);
            this._toolRegistry = toolRegistry;
        }
        const systemPromptToolNames = Array.from(activeToolNameSet).filter((name) => this._baseToolRegistry.has(name));
        this._baseSystemPrompt = this._rebuildSystemPrompt(systemPromptToolNames);
        this.agent.setSystemPrompt(this._baseSystemPrompt);
    }
    async reload() {
        var _a, _b;
        const previousFlagValues = (_a = this._extensionRunner) === null || _a === void 0 ? void 0 : _a.getFlagValues();
        await ((_b = this._extensionRunner) === null || _b === void 0 ? void 0 : _b.emit({ type: "session_shutdown" }));
        this.settingsManager.reload();
        (0, pi_ai_1.resetApiProviders)();
        await this._resourceLoader.reload();
        this._buildRuntime({
            activeToolNames: this.getActiveToolNames(),
            flagValues: previousFlagValues,
            includeAllExtensionTools: true,
        });
        const hasBindings = this._extensionUIContext ||
            this._extensionCommandContextActions ||
            this._extensionShutdownHandler ||
            this._extensionErrorListener;
        if (this._extensionRunner && hasBindings) {
            await this._extensionRunner.emit({ type: "session_start" });
            await this.extendResourcesFromExtensions("reload");
        }
    }
    // =========================================================================
    // Auto-Retry
    // =========================================================================
    /**
     * Check if an error is retryable (overloaded, rate limit, server errors).
     * Context overflow errors are NOT retryable (handled by compaction instead).
     */
    _isRetryableError(message) {
        var _a;
        var _b;
        if (message.stopReason !== "error" || !message.errorMessage)
            return false;
        // Context overflow is handled by compaction, not retry
        const contextWindow = (_b = (_a = this.model) === null || _a === void 0 ? void 0 : _a.contextWindow) !== null && _b !== void 0 ? _b : 0;
        if ((0, pi_ai_1.isContextOverflow)(message, contextWindow))
            return false;
        const err = message.errorMessage;
        // Match: overloaded_error, rate limit, 429, 500, 502, 503, 504, service unavailable, connection errors, fetch failed, terminated, retry delay exceeded
        return /overloaded|rate.?limit|too many requests|429|500|502|503|504|service.?unavailable|server error|internal error|connection.?error|connection.?refused|other side closed|fetch failed|upstream.?connect|reset before headers|terminated|retry delay/i.test(err);
    }
    /**
     * Handle retryable errors with exponential backoff.
     * @returns true if retry was initiated, false if max retries exceeded or disabled
     */
    async _handleRetryableError(message) {
        const settings = this.settingsManager.getRetrySettings();
        if (!settings.enabled)
            return false;
        this._retryAttempt++;
        // Create retry promise on first attempt so waitForRetry() can await it
        if (this._retryAttempt === 1 && !this._retryPromise) {
            this._retryPromise = new Promise((resolve) => {
                this._retryResolve = resolve;
            });
        }
        if (this._retryAttempt > settings.maxRetries) {
            // Max retries exceeded, emit final failure and reset
            this._emit({
                type: "auto_retry_end",
                success: false,
                attempt: this._retryAttempt - 1,
                finalError: message.errorMessage,
            });
            this._retryAttempt = 0;
            this._resolveRetry(); // Resolve so waitForRetry() completes
            return false;
        }
        const delayMs = settings.baseDelayMs * Math.pow(2, (this._retryAttempt - 1));
        this._emit({
            type: "auto_retry_start",
            attempt: this._retryAttempt,
            maxAttempts: settings.maxRetries,
            delayMs,
            errorMessage: message.errorMessage || "Unknown error",
        });
        // Remove error message from agent state (keep in session for history)
        const messages = this.agent.state.messages;
        if (messages.length > 0 && messages[messages.length - 1].role === "assistant") {
            this.agent.replaceMessages(messages.slice(0, -1));
        }
        // Wait with exponential backoff (abortable)
        this._retryAbortController = new AbortController();
        try {
            await (0, sleep_js_1.sleep)(delayMs, this._retryAbortController.signal);
        }
        catch (_a) {
            // Aborted during sleep - emit end event so UI can clean up
            const attempt = this._retryAttempt;
            this._retryAttempt = 0;
            this._retryAbortController = undefined;
            this._emit({
                type: "auto_retry_end",
                success: false,
                attempt,
                finalError: "Retry cancelled",
            });
            this._resolveRetry();
            return false;
        }
        this._retryAbortController = undefined;
        // Retry via continue() - use setTimeout to break out of event handler chain
        setTimeout(() => {
            this.agent.continue().catch(() => {
                // Retry failed - will be caught by next agent_end
            });
        }, 0);
        return true;
    }
    /**
     * Cancel in-progress retry.
     */
    abortRetry() {
        var _a;
        (_a = this._retryAbortController) === null || _a === void 0 ? void 0 : _a.abort();
        // Note: _retryAttempt is reset in the catch block of _autoRetry
        this._resolveRetry();
    }
    /**
     * Wait for any in-progress retry to complete.
     * Returns immediately if no retry is in progress.
     */
    async waitForRetry() {
        if (this._retryPromise) {
            await this._retryPromise;
        }
    }
    /** Whether auto-retry is currently in progress */
    get isRetrying() {
        return this._retryPromise !== undefined;
    }
    /** Whether auto-retry is enabled */
    get autoRetryEnabled() {
        return this.settingsManager.getRetryEnabled();
    }
    /**
     * Toggle auto-retry setting.
     */
    setAutoRetryEnabled(enabled) {
        this.settingsManager.setRetryEnabled(enabled);
    }
    // =========================================================================
    // Bash Execution
    // =========================================================================
    /**
     * Execute a bash command.
     * Adds result to agent context and session.
     * @param command The bash command to execute
     * @param onChunk Optional streaming callback for output
     * @param options.excludeFromContext If true, command output won't be sent to LLM (!! prefix)
     * @param options.operations Custom BashOperations for remote execution
     */
    async executeBash(command, onChunk, options) {
        this._bashAbortController = new AbortController();
        // Apply command prefix if configured (e.g., "shopt -s expand_aliases" for alias support)
        const prefix = this.settingsManager.getShellCommandPrefix();
        const resolvedCommand = prefix ? `${prefix}\n${command}` : command;
        try {
            const result = (options === null || options === void 0 ? void 0 : options.operations)
                ? await (0, bash_executor_js_1.executeBashWithOperations)(resolvedCommand, process.cwd(), options.operations, {
                    onChunk,
                    signal: this._bashAbortController.signal,
                })
                : await (0, bash_executor_js_1.executeBash)(resolvedCommand, {
                    onChunk,
                    signal: this._bashAbortController.signal,
                });
            this.recordBashResult(command, result, options);
            return result;
        }
        finally {
            this._bashAbortController = undefined;
        }
    }
    /**
     * Record a bash execution result in session history.
     * Used by executeBash and by extensions that handle bash execution themselves.
     */
    recordBashResult(command, result, options) {
        const bashMessage = {
            role: "bashExecution",
            command,
            output: result.output,
            exitCode: result.exitCode,
            cancelled: result.cancelled,
            truncated: result.truncated,
            fullOutputPath: result.fullOutputPath,
            timestamp: Date.now(),
            excludeFromContext: options === null || options === void 0 ? void 0 : options.excludeFromContext,
        };
        // If agent is streaming, defer adding to avoid breaking tool_use/tool_result ordering
        if (this.isStreaming) {
            // Queue for later - will be flushed on agent_end
            this._pendingBashMessages.push(bashMessage);
        }
        else {
            // Add to agent state immediately
            this.agent.appendMessage(bashMessage);
            // Save to session
            this.sessionManager.appendMessage(bashMessage);
        }
    }
    /**
     * Cancel running bash command.
     */
    abortBash() {
        var _a;
        (_a = this._bashAbortController) === null || _a === void 0 ? void 0 : _a.abort();
    }
    /** Whether a bash command is currently running */
    get isBashRunning() {
        return this._bashAbortController !== undefined;
    }
    /** Whether there are pending bash messages waiting to be flushed */
    get hasPendingBashMessages() {
        return this._pendingBashMessages.length > 0;
    }
    /**
     * Flush pending bash messages to agent state and session.
     * Called after agent turn completes to maintain proper message ordering.
     */
    _flushPendingBashMessages() {
        if (this._pendingBashMessages.length === 0)
            return;
        for (const bashMessage of this._pendingBashMessages) {
            // Add to agent state
            this.agent.appendMessage(bashMessage);
            // Save to session
            this.sessionManager.appendMessage(bashMessage);
        }
        this._pendingBashMessages = [];
    }
    // =========================================================================
    // Session Management
    // =========================================================================
    /**
     * Switch to a different session file.
     * Aborts current operation, loads messages, restores model/thinking.
     * Listeners are preserved and will continue receiving events.
     * @returns true if switch completed, false if cancelled by extension
     */
    async switchSession(sessionPath) {
        var _a;
        var _b;
        const previousSessionFile = this.sessionManager.getSessionFile();
        // Emit session_before_switch event (can be cancelled)
        if ((_a = this._extensionRunner) === null || _a === void 0 ? void 0 : _a.hasHandlers("session_before_switch")) {
            const result = (await this._extensionRunner.emit({
                type: "session_before_switch",
                reason: "resume",
                targetSessionFile: sessionPath,
            }));
            if (result === null || result === void 0 ? void 0 : result.cancel) {
                return false;
            }
        }
        this._disconnectFromAgent();
        await this.abort();
        this._steeringMessages = [];
        this._followUpMessages = [];
        this._pendingNextTurnMessages = [];
        // Set new session
        this.sessionManager.setSessionFile(sessionPath);
        this.agent.sessionId = this.sessionManager.getSessionId();
        // Reload messages
        const sessionContext = this.sessionManager.buildSessionContext();
        // Emit session_switch event to extensions
        if (this._extensionRunner) {
            await this._extensionRunner.emit({
                type: "session_switch",
                reason: "resume",
                previousSessionFile,
            });
        }
        // Emit session event to custom tools
        this.agent.replaceMessages(sessionContext.messages);
        // Restore model if saved
        if (sessionContext.model) {
            const previousModel = this.model;
            const availableModels = await this._modelRegistry.getAvailable();
            const match = availableModels.find((m) => m.provider === sessionContext.model.provider && m.id === sessionContext.model.modelId);
            if (match) {
                this.agent.setModel(match);
                await this._emitModelSelect(match, previousModel, "restore");
            }
        }
        const hasThinkingEntry = this.sessionManager.getBranch().some((entry) => entry.type === "thinking_level_change");
        const defaultThinkingLevel = (_b = this.settingsManager.getDefaultThinkingLevel()) !== null && _b !== void 0 ? _b : defaults_js_1.DEFAULT_THINKING_LEVEL;
        if (hasThinkingEntry) {
            // Restore thinking level if saved (setThinkingLevel clamps to model capabilities)
            this.setThinkingLevel(sessionContext.thinkingLevel);
        }
        else {
            const availableLevels = this.getAvailableThinkingLevels();
            const effectiveLevel = availableLevels.includes(defaultThinkingLevel)
                ? defaultThinkingLevel
                : this._clampThinkingLevel(defaultThinkingLevel, availableLevels);
            this.agent.setThinkingLevel(effectiveLevel);
            this.sessionManager.appendThinkingLevelChange(effectiveLevel);
        }
        this._reconnectToAgent();
        return true;
    }
    /**
     * Set a display name for the current session.
     */
    setSessionName(name) {
        this.sessionManager.appendSessionInfo(name);
    }
    /**
     * Create a fork from a specific entry.
     * Emits before_fork/fork session events to extensions.
     *
     * @param entryId ID of the entry to fork from
     * @returns Object with:
     *   - selectedText: The text of the selected user message (for editor pre-fill)
     *   - cancelled: True if an extension cancelled the fork
     */
    async fork(entryId) {
        var _a;
        var _b;
        const previousSessionFile = this.sessionFile;
        const selectedEntry = this.sessionManager.getEntry(entryId);
        if (!selectedEntry || selectedEntry.type !== "message" || selectedEntry.message.role !== "user") {
            throw new Error("Invalid entry ID for forking");
        }
        const selectedText = this._extractUserMessageText(selectedEntry.message.content);
        let skipConversationRestore = false;
        // Emit session_before_fork event (can be cancelled)
        if ((_a = this._extensionRunner) === null || _a === void 0 ? void 0 : _a.hasHandlers("session_before_fork")) {
            const result = (await this._extensionRunner.emit({
                type: "session_before_fork",
                entryId,
            }));
            if (result === null || result === void 0 ? void 0 : result.cancel) {
                return { selectedText, cancelled: true };
            }
            skipConversationRestore = (_b = result === null || result === void 0 ? void 0 : result.skipConversationRestore) !== null && _b !== void 0 ? _b : false;
        }
        // Clear pending messages (bound to old session state)
        this._pendingNextTurnMessages = [];
        if (!selectedEntry.parentId) {
            this.sessionManager.newSession({ parentSession: previousSessionFile });
        }
        else {
            this.sessionManager.createBranchedSession(selectedEntry.parentId);
        }
        this.agent.sessionId = this.sessionManager.getSessionId();
        // Reload messages from entries (works for both file and in-memory mode)
        const sessionContext = this.sessionManager.buildSessionContext();
        // Emit session_fork event to extensions (after fork completes)
        if (this._extensionRunner) {
            await this._extensionRunner.emit({
                type: "session_fork",
                previousSessionFile,
            });
        }
        // Emit session event to custom tools (with reason "fork")
        if (!skipConversationRestore) {
            this.agent.replaceMessages(sessionContext.messages);
        }
        return { selectedText, cancelled: false };
    }
    // =========================================================================
    // Tree Navigation
    // =========================================================================
    /**
     * Navigate to a different node in the session tree.
     * Unlike fork() which creates a new session file, this stays in the same file.
     *
     * @param targetId The entry ID to navigate to
     * @param options.summarize Whether user wants to summarize abandoned branch
     * @param options.customInstructions Custom instructions for summarizer
     * @param options.replaceInstructions If true, customInstructions replaces the default prompt
     * @param options.label Label to attach to the branch summary entry
     * @returns Result with editorText (if user message) and cancelled status
     */
    async navigateTree(targetId, options = {}) {
        var _a;
        var _b;
        const oldLeafId = this.sessionManager.getLeafId();
        // No-op if already at target
        if (targetId === oldLeafId) {
            return { cancelled: false };
        }
        // Model required for summarization
        if (options.summarize && !this.model) {
            throw new Error("No model available for summarization");
        }
        const targetEntry = this.sessionManager.getEntry(targetId);
        if (!targetEntry) {
            throw new Error(`Entry ${targetId} not found`);
        }
        // Collect entries to summarize (from old leaf to common ancestor)
        const { entries: entriesToSummarize, commonAncestorId } = (0, index_js_1.collectEntriesForBranchSummary)(this.sessionManager, oldLeafId, targetId);
        // Prepare event data - mutable so extensions can override
        let customInstructions = options.customInstructions;
        let replaceInstructions = options.replaceInstructions;
        let label = options.label;
        const preparation = {
            targetId,
            oldLeafId,
            commonAncestorId,
            entriesToSummarize,
            userWantsSummary: (_b = options.summarize) !== null && _b !== void 0 ? _b : false,
            customInstructions,
            replaceInstructions,
            label,
        };
        // Set up abort controller for summarization
        this._branchSummaryAbortController = new AbortController();
        let extensionSummary;
        let fromExtension = false;
        // Emit session_before_tree event
        if ((_a = this._extensionRunner) === null || _a === void 0 ? void 0 : _a.hasHandlers("session_before_tree")) {
            const result = (await this._extensionRunner.emit({
                type: "session_before_tree",
                preparation,
                signal: this._branchSummaryAbortController.signal,
            }));
            if (result === null || result === void 0 ? void 0 : result.cancel) {
                return { cancelled: true };
            }
            if ((result === null || result === void 0 ? void 0 : result.summary) && options.summarize) {
                extensionSummary = result.summary;
                fromExtension = true;
            }
            // Allow extensions to override instructions and label
            if ((result === null || result === void 0 ? void 0 : result.customInstructions) !== undefined) {
                customInstructions = result.customInstructions;
            }
            if ((result === null || result === void 0 ? void 0 : result.replaceInstructions) !== undefined) {
                replaceInstructions = result.replaceInstructions;
            }
            if ((result === null || result === void 0 ? void 0 : result.label) !== undefined) {
                label = result.label;
            }
        }
        // Run default summarizer if needed
        let summaryText;
        let summaryDetails;
        if (options.summarize && entriesToSummarize.length > 0 && !extensionSummary) {
            const model = this.model;
            const apiKey = await this._modelRegistry.getApiKey(model);
            if (!apiKey) {
                throw new Error(`No API key for ${model.provider}`);
            }
            const branchSummarySettings = this.settingsManager.getBranchSummarySettings();
            const result = await (0, index_js_1.generateBranchSummary)(entriesToSummarize, {
                model,
                apiKey,
                signal: this._branchSummaryAbortController.signal,
                customInstructions,
                replaceInstructions,
                reserveTokens: branchSummarySettings.reserveTokens,
            });
            this._branchSummaryAbortController = undefined;
            if (result.aborted) {
                return { cancelled: true, aborted: true };
            }
            if (result.error) {
                throw new Error(result.error);
            }
            summaryText = result.summary;
            summaryDetails = {
                readFiles: result.readFiles || [],
                modifiedFiles: result.modifiedFiles || [],
            };
        }
        else if (extensionSummary) {
            summaryText = extensionSummary.summary;
            summaryDetails = extensionSummary.details;
        }
        // Determine the new leaf position based on target type
        let newLeafId;
        let editorText;
        if (targetEntry.type === "message" && targetEntry.message.role === "user") {
            // User message: leaf = parent (null if root), text goes to editor
            newLeafId = targetEntry.parentId;
            editorText = this._extractUserMessageText(targetEntry.message.content);
        }
        else if (targetEntry.type === "custom_message") {
            // Custom message: leaf = parent (null if root), text goes to editor
            newLeafId = targetEntry.parentId;
            editorText =
                typeof targetEntry.content === "string"
                    ? targetEntry.content
                    : targetEntry.content
                        .filter((c) => c.type === "text")
                        .map((c) => c.text)
                        .join("");
        }
        else {
            // Non-user message: leaf = selected node
            newLeafId = targetId;
        }
        // Switch leaf (with or without summary)
        // Summary is attached at the navigation target position (newLeafId), not the old branch
        let summaryEntry;
        if (summaryText) {
            // Create summary at target position (can be null for root)
            const summaryId = this.sessionManager.branchWithSummary(newLeafId, summaryText, summaryDetails, fromExtension);
            summaryEntry = this.sessionManager.getEntry(summaryId);
            // Attach label to the summary entry
            if (label) {
                this.sessionManager.appendLabelChange(summaryId, label);
            }
        }
        else if (newLeafId === null) {
            // No summary, navigating to root - reset leaf
            this.sessionManager.resetLeaf();
        }
        else {
            // No summary, navigating to non-root
            this.sessionManager.branch(newLeafId);
        }
        // Attach label to target entry when not summarizing (no summary entry to label)
        if (label && !summaryText) {
            this.sessionManager.appendLabelChange(targetId, label);
        }
        // Update agent state
        const sessionContext = this.sessionManager.buildSessionContext();
        this.agent.replaceMessages(sessionContext.messages);
        // Emit session_tree event
        if (this._extensionRunner) {
            await this._extensionRunner.emit({
                type: "session_tree",
                newLeafId: this.sessionManager.getLeafId(),
                oldLeafId,
                summaryEntry,
                fromExtension: summaryText ? fromExtension : undefined,
            });
        }
        // Emit to custom tools
        this._branchSummaryAbortController = undefined;
        return { editorText, cancelled: false, summaryEntry };
    }
    /**
     * Get all user messages from session for fork selector.
     */
    getUserMessagesForForking() {
        const entries = this.sessionManager.getEntries();
        const result = [];
        for (const entry of entries) {
            if (entry.type !== "message")
                continue;
            if (entry.message.role !== "user")
                continue;
            const text = this._extractUserMessageText(entry.message.content);
            if (text) {
                result.push({ entryId: entry.id, text });
            }
        }
        return result;
    }
    _extractUserMessageText(content) {
        if (typeof content === "string")
            return content;
        if (Array.isArray(content)) {
            return content
                .filter((c) => c.type === "text")
                .map((c) => c.text)
                .join("");
        }
        return "";
    }
    /**
     * Get session statistics.
     */
    getSessionStats() {
        const state = this.state;
        const userMessages = state.messages.filter((m) => m.role === "user").length;
        const assistantMessages = state.messages.filter((m) => m.role === "assistant").length;
        const toolResults = state.messages.filter((m) => m.role === "toolResult").length;
        let toolCalls = 0;
        let totalInput = 0;
        let totalOutput = 0;
        let totalCacheRead = 0;
        let totalCacheWrite = 0;
        let totalCost = 0;
        for (const message of state.messages) {
            if (message.role === "assistant") {
                const assistantMsg = message;
                toolCalls += assistantMsg.content.filter((c) => c.type === "toolCall").length;
                totalInput += assistantMsg.usage.input;
                totalOutput += assistantMsg.usage.output;
                totalCacheRead += assistantMsg.usage.cacheRead;
                totalCacheWrite += assistantMsg.usage.cacheWrite;
                totalCost += assistantMsg.usage.cost.total;
            }
        }
        return {
            sessionFile: this.sessionFile,
            sessionId: this.sessionId,
            userMessages,
            assistantMessages,
            toolCalls,
            toolResults,
            totalMessages: state.messages.length,
            tokens: {
                input: totalInput,
                output: totalOutput,
                cacheRead: totalCacheRead,
                cacheWrite: totalCacheWrite,
                total: totalInput + totalOutput + totalCacheRead + totalCacheWrite,
            },
            cost: totalCost,
        };
    }
    getContextUsage() {
        var _a;
        const model = this.model;
        if (!model)
            return undefined;
        const contextWindow = (_a = model.contextWindow) !== null && _a !== void 0 ? _a : 0;
        if (contextWindow <= 0)
            return undefined;
        const estimate = (0, index_js_1.estimateContextTokens)(this.messages);
        const percent = (estimate.tokens / contextWindow) * 100;
        return {
            tokens: estimate.tokens,
            contextWindow,
            percent,
            usageTokens: estimate.usageTokens,
            trailingTokens: estimate.trailingTokens,
            lastUsageIndex: estimate.lastUsageIndex,
        };
    }
    /**
     * Export session to HTML.
     * @param outputPath Optional output path (defaults to session directory)
     * @returns Path to exported file
     */
    async exportToHtml(outputPath) {
        const themeName = this.settingsManager.getTheme();
        // Create tool renderer if we have an extension runner (for custom tool HTML rendering)
        let toolRenderer;
        if (this._extensionRunner) {
            toolRenderer = (0, tool_renderer_js_1.createToolHtmlRenderer)({
                getToolDefinition: (name) => this._extensionRunner.getToolDefinition(name),
                theme: theme_js_1.theme,
            });
        }
        return await (0, index_js_2.exportSessionToHtml)(this.sessionManager, this.state, {
            outputPath,
            themeName,
            toolRenderer,
        });
    }
    // =========================================================================
    // Utilities
    // =========================================================================
    /**
     * Get text content of last assistant message.
     * Useful for /copy command.
     * @returns Text content, or undefined if no assistant message exists
     */
    getLastAssistantText() {
        const lastAssistant = this.messages
            .slice()
            .reverse()
            .find((m) => {
            if (m.role !== "assistant")
                return false;
            const msg = m;
            // Skip aborted messages with no content
            if (msg.stopReason === "aborted" && msg.content.length === 0)
                return false;
            return true;
        });
        if (!lastAssistant)
            return undefined;
        let text = "";
        for (const content of lastAssistant.content) {
            if (content.type === "text") {
                text += content.text;
            }
        }
        return text.trim() || undefined;
    }
    // =========================================================================
    // Extension System
    // =========================================================================
    /**
     * Check if extensions have handlers for a specific event type.
     */
    hasExtensionHandlers(eventType) {
        var _a;
        var _b;
        return (_b = (_a = this._extensionRunner) === null || _a === void 0 ? void 0 : _a.hasHandlers(eventType)) !== null && _b !== void 0 ? _b : false;
    }
    /**
     * Get the extension runner (for setting UI context and error handlers).
     */
    get extensionRunner() {
        return this._extensionRunner;
    }
}
exports.AgentSession = AgentSession;
