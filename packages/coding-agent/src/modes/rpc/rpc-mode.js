"use strict";
/**
 * RPC mode: Headless operation with JSON stdin/stdout protocol.
 *
 * Used for embedding the agent in other applications.
 * Receives commands as JSON on stdin, outputs events and responses as JSON on stdout.
 *
 * Protocol:
 * - Commands: JSON objects with `type` field, optional `id` for correlation
 * - Responses: JSON objects with `type: "response"`, `command`, `success`, and optional `data`/`error`
 * - Events: AgentSessionEvent objects streamed as they occur
 * - Extension UI: Extension UI requests are emitted, client responds with extension_ui_response
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
exports.runRpcMode = runRpcMode;
const crypto = __importStar(require("node:crypto"));
const readline = __importStar(require("readline"));
const theme_js_1 = require("../interactive/theme/theme.js");
/**
 * Run in RPC mode.
 * Listens for JSON commands on stdin, outputs events and responses on stdout.
 */
async function runRpcMode(session) {
    const output = (obj) => {
        console.log(JSON.stringify(obj));
    };
    const success = (id, command, data) => {
        if (data === undefined) {
            return { id, type: "response", command, success: true };
        }
        return { id, type: "response", command, success: true, data };
    };
    const error = (id, command, message) => {
        return { id, type: "response", command, success: false, error: message };
    };
    // Pending extension UI requests waiting for response
    const pendingExtensionRequests = new Map();
    // Shutdown request flag
    let shutdownRequested = false;
    /** Helper for dialog methods with signal/timeout support */
    function createDialogPromise(opts, defaultValue, request, parseResponse) {
        var _a;
        if ((_a = opts === null || opts === void 0 ? void 0 : opts.signal) === null || _a === void 0 ? void 0 : _a.aborted)
            return Promise.resolve(defaultValue);
        const id = crypto.randomUUID();
        return new Promise((resolve, reject) => {
            var _a;
            let timeoutId;
            const cleanup = () => {
                var _a;
                if (timeoutId)
                    clearTimeout(timeoutId);
                (_a = opts === null || opts === void 0 ? void 0 : opts.signal) === null || _a === void 0 ? void 0 : _a.removeEventListener("abort", onAbort);
                pendingExtensionRequests.delete(id);
            };
            const onAbort = () => {
                cleanup();
                resolve(defaultValue);
            };
            (_a = opts === null || opts === void 0 ? void 0 : opts.signal) === null || _a === void 0 ? void 0 : _a.addEventListener("abort", onAbort, { once: true });
            if (opts === null || opts === void 0 ? void 0 : opts.timeout) {
                timeoutId = setTimeout(() => {
                    cleanup();
                    resolve(defaultValue);
                }, opts.timeout);
            }
            pendingExtensionRequests.set(id, {
                resolve: (response) => {
                    cleanup();
                    resolve(parseResponse(response));
                },
                reject,
            });
            output(Object.assign({ type: "extension_ui_request", id }, request));
        });
    }
    /**
     * Create an extension UI context that uses the RPC protocol.
     */
    const createExtensionUIContext = () => ({
        select: (title, options, opts) => createDialogPromise(opts, undefined, { method: "select", title, options, timeout: opts === null || opts === void 0 ? void 0 : opts.timeout }, (r) => "cancelled" in r && r.cancelled ? undefined : "value" in r ? r.value : undefined),
        confirm: (title, message, opts) => createDialogPromise(opts, false, { method: "confirm", title, message, timeout: opts === null || opts === void 0 ? void 0 : opts.timeout }, (r) => "cancelled" in r && r.cancelled ? false : "confirmed" in r ? r.confirmed : false),
        input: (title, placeholder, opts) => createDialogPromise(opts, undefined, { method: "input", title, placeholder, timeout: opts === null || opts === void 0 ? void 0 : opts.timeout }, (r) => "cancelled" in r && r.cancelled ? undefined : "value" in r ? r.value : undefined),
        notify(message, type) {
            // Fire and forget - no response needed
            output({
                type: "extension_ui_request",
                id: crypto.randomUUID(),
                method: "notify",
                message,
                notifyType: type,
            });
        },
        setStatus(key, text) {
            // Fire and forget - no response needed
            output({
                type: "extension_ui_request",
                id: crypto.randomUUID(),
                method: "setStatus",
                statusKey: key,
                statusText: text,
            });
        },
        setWorkingMessage(_message) {
            // Working message not supported in RPC mode - requires TUI loader access
        },
        setWidget(key, content, options) {
            // Only support string arrays in RPC mode - factory functions are ignored
            if (content === undefined || Array.isArray(content)) {
                output({
                    type: "extension_ui_request",
                    id: crypto.randomUUID(),
                    method: "setWidget",
                    widgetKey: key,
                    widgetLines: content,
                    widgetPlacement: options === null || options === void 0 ? void 0 : options.placement,
                });
            }
            // Component factories are not supported in RPC mode - would need TUI access
        },
        setFooter(_factory) {
            // Custom footer not supported in RPC mode - requires TUI access
        },
        setHeader(_factory) {
            // Custom header not supported in RPC mode - requires TUI access
        },
        setTitle(title) {
            // Fire and forget - host can implement terminal title control
            output({
                type: "extension_ui_request",
                id: crypto.randomUUID(),
                method: "setTitle",
                title,
            });
        },
        async custom() {
            // Custom UI not supported in RPC mode
            return undefined;
        },
        setEditorText(text) {
            // Fire and forget - host can implement editor control
            output({
                type: "extension_ui_request",
                id: crypto.randomUUID(),
                method: "set_editor_text",
                text,
            });
        },
        getEditorText() {
            // Synchronous method can't wait for RPC response
            // Host should track editor state locally if needed
            return "";
        },
        async editor(title, prefill) {
            const id = crypto.randomUUID();
            return new Promise((resolve, reject) => {
                pendingExtensionRequests.set(id, {
                    resolve: (response) => {
                        if ("cancelled" in response && response.cancelled) {
                            resolve(undefined);
                        }
                        else if ("value" in response) {
                            resolve(response.value);
                        }
                        else {
                            resolve(undefined);
                        }
                    },
                    reject,
                });
                output({ type: "extension_ui_request", id, method: "editor", title, prefill });
            });
        },
        setEditorComponent() {
            // Custom editor components not supported in RPC mode
        },
        get theme() {
            return theme_js_1.theme;
        },
        getAllThemes() {
            return [];
        },
        getTheme(_name) {
            return undefined;
        },
        setTheme(_theme) {
            // Theme switching not supported in RPC mode
            return { success: false, error: "Theme switching not supported in RPC mode" };
        },
        getToolsExpanded() {
            // Tool expansion not supported in RPC mode - no TUI
            return false;
        },
        setToolsExpanded(_expanded) {
            // Tool expansion not supported in RPC mode - no TUI
        },
    });
    // Set up extensions with RPC-based UI context
    await session.bindExtensions({
        uiContext: createExtensionUIContext(),
        commandContextActions: {
            waitForIdle: () => session.agent.waitForIdle(),
            newSession: async (options) => {
                // Delegate to AgentSession (handles setup + agent state sync)
                const success = await session.newSession(options);
                return { cancelled: !success };
            },
            fork: async (entryId) => {
                const result = await session.fork(entryId);
                return { cancelled: result.cancelled };
            },
            navigateTree: async (targetId, options) => {
                const result = await session.navigateTree(targetId, {
                    summarize: options === null || options === void 0 ? void 0 : options.summarize,
                    customInstructions: options === null || options === void 0 ? void 0 : options.customInstructions,
                    replaceInstructions: options === null || options === void 0 ? void 0 : options.replaceInstructions,
                    label: options === null || options === void 0 ? void 0 : options.label,
                });
                return { cancelled: result.cancelled };
            },
            switchSession: async (sessionPath) => {
                const success = await session.switchSession(sessionPath);
                return { cancelled: !success };
            },
        },
        shutdownHandler: () => {
            shutdownRequested = true;
        },
        onError: (err) => {
            output({ type: "extension_error", extensionPath: err.extensionPath, event: err.event, error: err.error });
        },
    });
    // Output all agent events as JSON
    session.subscribe((event) => {
        output(event);
    });
    // Handle a single command
    const handleCommand = async (command) => {
        var _a;
        var _b;
        const id = command.id;
        switch (command.type) {
            // =================================================================
            // Prompting
            // =================================================================
            case "prompt": {
                // Don't await - events will stream
                // Extension commands are executed immediately, file prompt templates are expanded
                // If streaming and streamingBehavior specified, queues via steer/followUp
                session
                    .prompt(command.message, {
                    images: command.images,
                    streamingBehavior: command.streamingBehavior,
                    source: "rpc",
                })
                    .catch((e) => output(error(id, "prompt", e.message)));
                return success(id, "prompt");
            }
            case "steer": {
                await session.steer(command.message, command.images);
                return success(id, "steer");
            }
            case "follow_up": {
                await session.followUp(command.message, command.images);
                return success(id, "follow_up");
            }
            case "abort": {
                await session.abort();
                return success(id, "abort");
            }
            case "new_session": {
                const options = command.parentSession ? { parentSession: command.parentSession } : undefined;
                const cancelled = !(await session.newSession(options));
                return success(id, "new_session", { cancelled });
            }
            // =================================================================
            // State
            // =================================================================
            case "get_state": {
                const state = {
                    model: session.model,
                    thinkingLevel: session.thinkingLevel,
                    isStreaming: session.isStreaming,
                    isCompacting: session.isCompacting,
                    steeringMode: session.steeringMode,
                    followUpMode: session.followUpMode,
                    sessionFile: session.sessionFile,
                    sessionId: session.sessionId,
                    sessionName: session.sessionName,
                    autoCompactionEnabled: session.autoCompactionEnabled,
                    messageCount: session.messages.length,
                    pendingMessageCount: session.pendingMessageCount,
                };
                return success(id, "get_state", state);
            }
            // =================================================================
            // Model
            // =================================================================
            case "set_model": {
                const models = await session.modelRegistry.getAvailable();
                const model = models.find((m) => m.provider === command.provider && m.id === command.modelId);
                if (!model) {
                    return error(id, "set_model", `Model not found: ${command.provider}/${command.modelId}`);
                }
                await session.setModel(model);
                return success(id, "set_model", model);
            }
            case "cycle_model": {
                const result = await session.cycleModel();
                if (!result) {
                    return success(id, "cycle_model", null);
                }
                return success(id, "cycle_model", result);
            }
            case "get_available_models": {
                const models = await session.modelRegistry.getAvailable();
                return success(id, "get_available_models", { models });
            }
            // =================================================================
            // Thinking
            // =================================================================
            case "set_thinking_level": {
                session.setThinkingLevel(command.level);
                return success(id, "set_thinking_level");
            }
            case "cycle_thinking_level": {
                const level = session.cycleThinkingLevel();
                if (!level) {
                    return success(id, "cycle_thinking_level", null);
                }
                return success(id, "cycle_thinking_level", { level });
            }
            // =================================================================
            // Queue Modes
            // =================================================================
            case "set_steering_mode": {
                session.setSteeringMode(command.mode);
                return success(id, "set_steering_mode");
            }
            case "set_follow_up_mode": {
                session.setFollowUpMode(command.mode);
                return success(id, "set_follow_up_mode");
            }
            // =================================================================
            // Compaction
            // =================================================================
            case "compact": {
                const result = await session.compact(command.customInstructions);
                return success(id, "compact", result);
            }
            case "set_auto_compaction": {
                session.setAutoCompactionEnabled(command.enabled);
                return success(id, "set_auto_compaction");
            }
            // =================================================================
            // Retry
            // =================================================================
            case "set_auto_retry": {
                session.setAutoRetryEnabled(command.enabled);
                return success(id, "set_auto_retry");
            }
            case "abort_retry": {
                session.abortRetry();
                return success(id, "abort_retry");
            }
            // =================================================================
            // Bash
            // =================================================================
            case "bash": {
                const result = await session.executeBash(command.command);
                return success(id, "bash", result);
            }
            case "abort_bash": {
                session.abortBash();
                return success(id, "abort_bash");
            }
            // =================================================================
            // Session
            // =================================================================
            case "get_session_stats": {
                const stats = session.getSessionStats();
                return success(id, "get_session_stats", stats);
            }
            case "export_html": {
                const path = await session.exportToHtml(command.outputPath);
                return success(id, "export_html", { path });
            }
            case "switch_session": {
                const cancelled = !(await session.switchSession(command.sessionPath));
                return success(id, "switch_session", { cancelled });
            }
            case "fork": {
                const result = await session.fork(command.entryId);
                return success(id, "fork", { text: result.selectedText, cancelled: result.cancelled });
            }
            case "get_fork_messages": {
                const messages = session.getUserMessagesForForking();
                return success(id, "get_fork_messages", { messages });
            }
            case "get_last_assistant_text": {
                const text = session.getLastAssistantText();
                return success(id, "get_last_assistant_text", { text });
            }
            case "set_session_name": {
                const name = command.name.trim();
                if (!name) {
                    return error(id, "set_session_name", "Session name cannot be empty");
                }
                session.setSessionName(name);
                return success(id, "set_session_name");
            }
            // =================================================================
            // Messages
            // =================================================================
            case "get_messages": {
                return success(id, "get_messages", { messages: session.messages });
            }
            // =================================================================
            // Commands (available for invocation via prompt)
            // =================================================================
            case "get_commands": {
                const commands = [];
                // Extension commands
                for (const { command, extensionPath } of (_b = (_a = session.extensionRunner) === null || _a === void 0 ? void 0 : _a.getRegisteredCommandsWithPaths()) !== null && _b !== void 0 ? _b : []) {
                    commands.push({
                        name: command.name,
                        description: command.description,
                        source: "extension",
                        path: extensionPath,
                    });
                }
                // Prompt templates (source is always "user" | "project" | "path" in coding-agent)
                for (const template of session.promptTemplates) {
                    commands.push({
                        name: template.name,
                        description: template.description,
                        source: "prompt",
                        location: template.source,
                        path: template.filePath,
                    });
                }
                // Skills (source is always "user" | "project" | "path" in coding-agent)
                for (const skill of session.resourceLoader.getSkills().skills) {
                    commands.push({
                        name: `skill:${skill.name}`,
                        description: skill.description,
                        source: "skill",
                        location: skill.source,
                        path: skill.filePath,
                    });
                }
                return success(id, "get_commands", { commands });
            }
            default: {
                const unknownCommand = command;
                return error(undefined, unknownCommand.type, `Unknown command: ${unknownCommand.type}`);
            }
        }
    };
    /**
     * Check if shutdown was requested and perform shutdown if so.
     * Called after handling each command when waiting for the next command.
     */
    async function checkShutdownRequested() {
        if (!shutdownRequested)
            return;
        const currentRunner = session.extensionRunner;
        if (currentRunner === null || currentRunner === void 0 ? void 0 : currentRunner.hasHandlers("session_shutdown")) {
            await currentRunner.emit({ type: "session_shutdown" });
        }
        // Close readline interface to stop waiting for input
        rl.close();
        process.exit(0);
    }
    // Listen for JSON input
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
    });
    rl.on("line", async (line) => {
        try {
            const parsed = JSON.parse(line);
            // Handle extension UI responses
            if (parsed.type === "extension_ui_response") {
                const response = parsed;
                const pending = pendingExtensionRequests.get(response.id);
                if (pending) {
                    pendingExtensionRequests.delete(response.id);
                    pending.resolve(response);
                }
                return;
            }
            // Handle regular commands
            const command = parsed;
            const response = await handleCommand(command);
            output(response);
            // Check for deferred shutdown request (idle between commands)
            await checkShutdownRequested();
        }
        catch (e) {
            output(error(undefined, "parse", `Failed to parse command: ${e.message}`));
            // Don't close rl, just wait for the next line
        }
    });
    rl.on("error", (err) => {
        output(error(undefined, "readline", `Readline error: ${err.message}`));
    });
    // Keep process alive forever
    return new Promise(() => { });
}
