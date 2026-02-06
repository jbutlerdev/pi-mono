"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLsTool = exports.createFindTool = exports.createGrepTool = exports.createWriteTool = exports.createEditTool = exports.createBashTool = exports.createReadTool = exports.createReadOnlyTools = exports.
// Tool factories (for custom cwd)
createCodingTools = exports.allBuiltInTools = exports.readOnlyTools = exports.codingTools = exports.lsTool = exports.findTool = exports.grepTool = exports.writeTool = exports.editTool = exports.bashTool = exports.
// Pre-built tools (use process.cwd())
readTool = void 0;
exports.createAgentSession = createAgentSession;
const node_path_1 = require("node:path");
const pi_agent_core_1 = require("@mariozechner/pi-agent-core");
const config_js_1 = require("../config.js");
const agent_session_js_1 = require("./agent-session.js");
const auth_storage_js_1 = require("./auth-storage.js");
const defaults_js_1 = require("./defaults.js");
const messages_js_1 = require("./messages.js");
const model_registry_js_1 = require("./model-registry.js");
const model_resolver_js_1 = require("./model-resolver.js");
const resource_loader_js_1 = require("./resource-loader.js");
const session_manager_js_1 = require("./session-manager.js");
const settings_manager_js_1 = require("./settings-manager.js");
const timings_js_1 = require("./timings.js");
const index_js_1 = require("./tools/index.js");
Object.defineProperty(exports, "allBuiltInTools", { enumerable: true, get: function () { return index_js_1.allTools; } });
Object.defineProperty(exports, "bashTool", { enumerable: true, get: function () { return index_js_1.bashTool; } });
Object.defineProperty(exports, "codingTools", { enumerable: true, get: function () { return index_js_1.codingTools; } });
Object.defineProperty(exports, "createBashTool", { enumerable: true, get: function () { return index_js_1.createBashTool; } });
Object.defineProperty(exports, "createCodingTools", { enumerable: true, get: function () { return index_js_1.createCodingTools; } });
Object.defineProperty(exports, "createEditTool", { enumerable: true, get: function () { return index_js_1.createEditTool; } });
Object.defineProperty(exports, "createFindTool", { enumerable: true, get: function () { return index_js_1.createFindTool; } });
Object.defineProperty(exports, "createGrepTool", { enumerable: true, get: function () { return index_js_1.createGrepTool; } });
Object.defineProperty(exports, "createLsTool", { enumerable: true, get: function () { return index_js_1.createLsTool; } });
Object.defineProperty(exports, "createReadOnlyTools", { enumerable: true, get: function () { return index_js_1.createReadOnlyTools; } });
Object.defineProperty(exports, "createReadTool", { enumerable: true, get: function () { return index_js_1.createReadTool; } });
Object.defineProperty(exports, "createWriteTool", { enumerable: true, get: function () { return index_js_1.createWriteTool; } });
Object.defineProperty(exports, "editTool", { enumerable: true, get: function () { return index_js_1.editTool; } });
Object.defineProperty(exports, "findTool", { enumerable: true, get: function () { return index_js_1.findTool; } });
Object.defineProperty(exports, "grepTool", { enumerable: true, get: function () { return index_js_1.grepTool; } });
Object.defineProperty(exports, "lsTool", { enumerable: true, get: function () { return index_js_1.lsTool; } });
Object.defineProperty(exports, "readOnlyTools", { enumerable: true, get: function () { return index_js_1.readOnlyTools; } });
Object.defineProperty(exports, "readTool", { enumerable: true, get: function () { return index_js_1.readTool; } });
Object.defineProperty(exports, "writeTool", { enumerable: true, get: function () { return index_js_1.writeTool; } });
// Helper Functions
function getDefaultAgentDir() {
    return (0, config_js_1.getAgentDir)();
}
/**
 * Create an AgentSession with the specified options.
 *
 * @example
 * ```typescript
 * // Minimal - uses defaults
 * const { session } = await createAgentSession();
 *
 * // With explicit model
 * import { getModel } from '@mariozechner/pi-ai';
 * const { session } = await createAgentSession({
 *   model: getModel('anthropic', 'claude-opus-4-5'),
 *   thinkingLevel: 'high',
 * });
 *
 * // Continue previous session
 * const { session, modelFallbackMessage } = await createAgentSession({
 *   continueSession: true,
 * });
 *
 * // Full control
 * const loader = new DefaultResourceLoader({
 *   cwd: process.cwd(),
 *   agentDir: getAgentDir(),
 *   settingsManager: SettingsManager.create(),
 * });
 * await loader.reload();
 * const { session } = await createAgentSession({
 *   model: myModel,
 *   tools: [readTool, bashTool],
 *   resourceLoader: loader,
 *   sessionManager: SessionManager.inMemory(),
 * });
 * ```
 */
async function createAgentSession(options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const cwd = (_a = options.cwd) !== null && _a !== void 0 ? _a : process.cwd();
    const agentDir = (_b = options.agentDir) !== null && _b !== void 0 ? _b : getDefaultAgentDir();
    let resourceLoader = options.resourceLoader;
    // Use provided or create AuthStorage and ModelRegistry
    const authPath = options.agentDir ? (0, node_path_1.join)(agentDir, "auth.json") : undefined;
    const modelsPath = options.agentDir ? (0, node_path_1.join)(agentDir, "models.json") : undefined;
    const authStorage = (_c = options.authStorage) !== null && _c !== void 0 ? _c : new auth_storage_js_1.AuthStorage(authPath);
    const modelRegistry = (_d = options.modelRegistry) !== null && _d !== void 0 ? _d : new model_registry_js_1.ModelRegistry(authStorage, modelsPath);
    const settingsManager = (_e = options.settingsManager) !== null && _e !== void 0 ? _e : settings_manager_js_1.SettingsManager.create(cwd, agentDir);
    const sessionManager = (_f = options.sessionManager) !== null && _f !== void 0 ? _f : session_manager_js_1.SessionManager.create(cwd);
    if (!resourceLoader) {
        resourceLoader = new resource_loader_js_1.DefaultResourceLoader({ cwd, agentDir, settingsManager });
        await resourceLoader.reload();
        (0, timings_js_1.time)("resourceLoader.reload");
    }
    // Check if session has existing data to restore
    const existingSession = sessionManager.buildSessionContext();
    const hasExistingSession = existingSession.messages.length > 0;
    const hasThinkingEntry = sessionManager.getBranch().some((entry) => entry.type === "thinking_level_change");
    let model = options.model;
    let modelFallbackMessage;
    // If session has data, try to restore model from it
    if (!model && hasExistingSession && existingSession.model) {
        const restoredModel = modelRegistry.find(existingSession.model.provider, existingSession.model.modelId);
        if (restoredModel && (await modelRegistry.getApiKey(restoredModel))) {
            model = restoredModel;
        }
        if (!model) {
            modelFallbackMessage = `Could not restore model ${existingSession.model.provider}/${existingSession.model.modelId}`;
        }
    }
    // If still no model, use findInitialModel (checks settings default, then provider defaults)
    if (!model) {
        const result = await (0, model_resolver_js_1.findInitialModel)({
            scopedModels: [],
            isContinuing: hasExistingSession,
            defaultProvider: settingsManager.getDefaultProvider(),
            defaultModelId: settingsManager.getDefaultModel(),
            defaultThinkingLevel: settingsManager.getDefaultThinkingLevel(),
            modelRegistry,
        });
        model = result.model;
        if (!model) {
            modelFallbackMessage = `No models available. Use /login or set an API key environment variable. See ${(0, node_path_1.join)((0, config_js_1.getDocsPath)(), "providers.md")}. Then use /model to select a model.`;
        }
        else if (modelFallbackMessage) {
            modelFallbackMessage += `. Using ${model.provider}/${model.id}`;
        }
    }
    let thinkingLevel = options.thinkingLevel;
    // If session has data, restore thinking level from it
    if (thinkingLevel === undefined && hasExistingSession) {
        thinkingLevel = hasThinkingEntry
            ? existingSession.thinkingLevel
            : ((_g = settingsManager.getDefaultThinkingLevel()) !== null && _g !== void 0 ? _g : defaults_js_1.DEFAULT_THINKING_LEVEL);
    }
    // Fall back to settings default
    if (thinkingLevel === undefined) {
        thinkingLevel = (_h = settingsManager.getDefaultThinkingLevel()) !== null && _h !== void 0 ? _h : defaults_js_1.DEFAULT_THINKING_LEVEL;
    }
    // Clamp to model capabilities
    if (!model || !model.reasoning) {
        thinkingLevel = "off";
    }
    const defaultActiveToolNames = ["read", "bash", "edit", "write"];
    const initialActiveToolNames = options.tools
        ? options.tools.map((t) => t.name).filter((n) => n in index_js_1.allTools)
        : defaultActiveToolNames;
    let agent;
    // Create convertToLlm wrapper that filters images if blockImages is enabled (defense-in-depth)
    const convertToLlmWithBlockImages = (messages) => {
        const converted = (0, messages_js_1.convertToLlm)(messages);
        // Check setting dynamically so mid-session changes take effect
        if (!settingsManager.getBlockImages()) {
            return converted;
        }
        // Filter out ImageContent from all messages, replacing with text placeholder
        return converted.map((msg) => {
            if (msg.role === "user" || msg.role === "toolResult") {
                const content = msg.content;
                if (Array.isArray(content)) {
                    const hasImages = content.some((c) => c.type === "image");
                    if (hasImages) {
                        const filteredContent = content
                            .map((c) => c.type === "image" ? { type: "text", text: "Image reading is disabled." } : c)
                            .filter((c, i, arr) => 
                        // Dedupe consecutive "Image reading is disabled." texts
                        !(c.type === "text" &&
                            c.text === "Image reading is disabled." &&
                            i > 0 &&
                            arr[i - 1].type === "text" &&
                            arr[i - 1].text === "Image reading is disabled."));
                        return Object.assign(Object.assign({}, msg), { content: filteredContent });
                    }
                }
            }
            return msg;
        });
    };
    const extensionRunnerRef = {};
    agent = new pi_agent_core_1.Agent({
        initialState: {
            systemPrompt: "",
            model,
            thinkingLevel,
            tools: [],
        },
        convertToLlm: convertToLlmWithBlockImages,
        sessionId: sessionManager.getSessionId(),
        timeout: options.timeout,
        transformContext: async (messages) => {
            const runner = extensionRunnerRef.current;
            if (!runner)
                return messages;
            return runner.emitContext(messages);
        },
        steeringMode: settingsManager.getSteeringMode(),
        followUpMode: settingsManager.getFollowUpMode(),
        thinkingBudgets: settingsManager.getThinkingBudgets(),
        maxRetryDelayMs: settingsManager.getRetrySettings().maxDelayMs,
        getApiKey: async (provider) => {
            var _a;
            // Use the provider argument from the in-flight request;
            // agent.state.model may already be switched mid-turn.
            const resolvedProvider = provider || ((_a = agent.state.model) === null || _a === void 0 ? void 0 : _a.provider);
            if (!resolvedProvider) {
                throw new Error("No model selected");
            }
            const key = await modelRegistry.getApiKeyForProvider(resolvedProvider);
            if (!key) {
                const model = agent.state.model;
                const isOAuth = model && modelRegistry.isUsingOAuth(model);
                if (isOAuth) {
                    throw new Error(`Authentication failed for "${resolvedProvider}". ` +
                        `Credentials may have expired or network is unavailable. ` +
                        `Run '/login ${resolvedProvider}' to re-authenticate.`);
                }
                throw new Error(`No API key found for "${resolvedProvider}". ` +
                    `Set an API key environment variable or run '/login ${resolvedProvider}'.`);
            }
            return key;
        },
    });
    // Restore messages if session has existing data
    if (hasExistingSession) {
        agent.replaceMessages(existingSession.messages);
        if (!hasThinkingEntry) {
            sessionManager.appendThinkingLevelChange(thinkingLevel);
        }
    }
    else {
        // Save initial model and thinking level for new sessions so they can be restored on resume
        if (model) {
            sessionManager.appendModelChange(model.provider, model.id);
        }
        sessionManager.appendThinkingLevelChange(thinkingLevel);
    }
    const session = new agent_session_js_1.AgentSession({
        agent,
        sessionManager,
        settingsManager,
        cwd,
        scopedModels: options.scopedModels,
        resourceLoader,
        customTools: options.customTools,
        modelRegistry,
        initialActiveToolNames,
        extensionRunnerRef,
    });
    const extensionsResult = resourceLoader.getExtensions();
    return {
        session,
        extensionsResult,
        modelFallbackMessage,
    };
}
