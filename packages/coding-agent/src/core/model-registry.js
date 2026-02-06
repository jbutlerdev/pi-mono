"use strict";
/**
 * Model registry - manages built-in and custom models, provides API key resolution.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelRegistry = exports.clearApiKeyCache = void 0;
const pi_ai_1 = require("@mariozechner/pi-ai");
const typebox_1 = require("@sinclair/typebox");
const ajv_1 = __importDefault(require("ajv"));
const fs_1 = require("fs");
const path_1 = require("path");
const config_js_1 = require("../config.js");
const resolve_config_value_js_1 = require("./resolve-config-value.js");
const Ajv = ajv_1.default.default || ajv_1.default;
// Schema for OpenRouter routing preferences
const OpenRouterRoutingSchema = typebox_1.Type.Object({
    only: typebox_1.Type.Optional(typebox_1.Type.Array(typebox_1.Type.String())),
    order: typebox_1.Type.Optional(typebox_1.Type.Array(typebox_1.Type.String())),
});
// Schema for Vercel AI Gateway routing preferences
const VercelGatewayRoutingSchema = typebox_1.Type.Object({
    only: typebox_1.Type.Optional(typebox_1.Type.Array(typebox_1.Type.String())),
    order: typebox_1.Type.Optional(typebox_1.Type.Array(typebox_1.Type.String())),
});
// Schema for OpenAI compatibility settings
const OpenAICompletionsCompatSchema = typebox_1.Type.Object({
    supportsStore: typebox_1.Type.Optional(typebox_1.Type.Boolean()),
    supportsDeveloperRole: typebox_1.Type.Optional(typebox_1.Type.Boolean()),
    supportsReasoningEffort: typebox_1.Type.Optional(typebox_1.Type.Boolean()),
    supportsUsageInStreaming: typebox_1.Type.Optional(typebox_1.Type.Boolean()),
    maxTokensField: typebox_1.Type.Optional(typebox_1.Type.Union([typebox_1.Type.Literal("max_completion_tokens"), typebox_1.Type.Literal("max_tokens")])),
    requiresToolResultName: typebox_1.Type.Optional(typebox_1.Type.Boolean()),
    requiresAssistantAfterToolResult: typebox_1.Type.Optional(typebox_1.Type.Boolean()),
    requiresThinkingAsText: typebox_1.Type.Optional(typebox_1.Type.Boolean()),
    requiresMistralToolIds: typebox_1.Type.Optional(typebox_1.Type.Boolean()),
    thinkingFormat: typebox_1.Type.Optional(typebox_1.Type.Union([typebox_1.Type.Literal("openai"), typebox_1.Type.Literal("zai"), typebox_1.Type.Literal("qwen")])),
    openRouterRouting: typebox_1.Type.Optional(OpenRouterRoutingSchema),
    vercelGatewayRouting: typebox_1.Type.Optional(VercelGatewayRoutingSchema),
});
const OpenAIResponsesCompatSchema = typebox_1.Type.Object({});
const OpenAICompatSchema = typebox_1.Type.Union([OpenAICompletionsCompatSchema, OpenAIResponsesCompatSchema]);
// Schema for custom model definition
// Most fields are optional with sensible defaults for local models (Ollama, LM Studio, etc.)
const ModelDefinitionSchema = typebox_1.Type.Object({
    id: typebox_1.Type.String({ minLength: 1 }),
    name: typebox_1.Type.Optional(typebox_1.Type.String({ minLength: 1 })),
    api: typebox_1.Type.Optional(typebox_1.Type.String({ minLength: 1 })),
    reasoning: typebox_1.Type.Optional(typebox_1.Type.Boolean()),
    input: typebox_1.Type.Optional(typebox_1.Type.Array(typebox_1.Type.Union([typebox_1.Type.Literal("text"), typebox_1.Type.Literal("image")]))),
    cost: typebox_1.Type.Optional(typebox_1.Type.Object({
        input: typebox_1.Type.Number(),
        output: typebox_1.Type.Number(),
        cacheRead: typebox_1.Type.Number(),
        cacheWrite: typebox_1.Type.Number(),
    })),
    contextWindow: typebox_1.Type.Optional(typebox_1.Type.Number()),
    maxTokens: typebox_1.Type.Optional(typebox_1.Type.Number()),
    headers: typebox_1.Type.Optional(typebox_1.Type.Record(typebox_1.Type.String(), typebox_1.Type.String())),
    compat: typebox_1.Type.Optional(OpenAICompatSchema),
});
const ProviderConfigSchema = typebox_1.Type.Object({
    baseUrl: typebox_1.Type.Optional(typebox_1.Type.String({ minLength: 1 })),
    apiKey: typebox_1.Type.Optional(typebox_1.Type.String({ minLength: 1 })),
    api: typebox_1.Type.Optional(typebox_1.Type.String({ minLength: 1 })),
    headers: typebox_1.Type.Optional(typebox_1.Type.Record(typebox_1.Type.String(), typebox_1.Type.String())),
    authHeader: typebox_1.Type.Optional(typebox_1.Type.Boolean()),
    models: typebox_1.Type.Optional(typebox_1.Type.Array(ModelDefinitionSchema)),
});
const ModelsConfigSchema = typebox_1.Type.Object({
    providers: typebox_1.Type.Record(typebox_1.Type.String(), ProviderConfigSchema),
});
function emptyCustomModelsResult(error) {
    return { models: [], replacedProviders: new Set(), overrides: new Map(), error };
}
/** Clear the config value command cache. Exported for testing. */
exports.clearApiKeyCache = resolve_config_value_js_1.clearConfigValueCache;
/**
 * Model registry - loads and manages models, resolves API keys via AuthStorage.
 */
class ModelRegistry {
    authStorage;
    modelsJsonPath;
    models = [];
    customProviderApiKeys = new Map();
    registeredProviders = new Map();
    loadError = undefined;
    constructor(authStorage, modelsJsonPath = (0, path_1.join)((0, config_js_1.getAgentDir)(), "models.json")) {
        this.authStorage = authStorage;
        this.modelsJsonPath = modelsJsonPath;
        // Set up fallback resolver for custom provider API keys
        this.authStorage.setFallbackResolver((provider) => {
            const keyConfig = this.customProviderApiKeys.get(provider);
            if (keyConfig) {
                return (0, resolve_config_value_js_1.resolveConfigValue)(keyConfig);
            }
            return undefined;
        });
        // Load models
        this.loadModels();
    }
    /**
     * Reload models from disk (built-in + custom from models.json).
     */
    refresh() {
        this.customProviderApiKeys.clear();
        this.loadError = undefined;
        this.loadModels();
        for (const [providerName, config] of this.registeredProviders.entries()) {
            this.applyProviderConfig(providerName, config);
        }
    }
    /**
     * Get any error from loading models.json (undefined if no error).
     */
    getError() {
        return this.loadError;
    }
    loadModels() {
        // Load custom models from models.json first (to know which providers to skip/override)
        const { models: customModels, replacedProviders, overrides, error, } = this.modelsJsonPath ? this.loadCustomModels(this.modelsJsonPath) : emptyCustomModelsResult();
        if (error) {
            this.loadError = error;
            // Keep built-in models even if custom models failed to load
        }
        const builtInModels = this.loadBuiltInModels(replacedProviders, overrides);
        let combined = [...builtInModels, ...customModels];
        // Let OAuth providers modify their models (e.g., update baseUrl)
        for (const oauthProvider of this.authStorage.getOAuthProviders()) {
            const cred = this.authStorage.get(oauthProvider.id);
            if ((cred === null || cred === void 0 ? void 0 : cred.type) === "oauth" && oauthProvider.modifyModels) {
                combined = oauthProvider.modifyModels(combined, cred);
            }
        }
        this.models = combined;
    }
    /** Load built-in models, skipping replaced providers and applying overrides */
    loadBuiltInModels(replacedProviders, overrides) {
        return (0, pi_ai_1.getProviders)()
            .filter((provider) => !replacedProviders.has(provider))
            .flatMap((provider) => {
            const models = (0, pi_ai_1.getModels)(provider);
            const override = overrides.get(provider);
            if (!override)
                return models;
            // Apply baseUrl/headers override to all models of this provider
            const resolvedHeaders = (0, resolve_config_value_js_1.resolveHeaders)(override.headers);
            return models.map((m) => {
                var _a;
                return (Object.assign(Object.assign({}, m), { baseUrl: (_a = override.baseUrl) !== null && _a !== void 0 ? _a : m.baseUrl, headers: resolvedHeaders ? Object.assign(Object.assign({}, m.headers), resolvedHeaders) : m.headers }));
            });
        });
    }
    loadCustomModels(modelsJsonPath) {
        var _a;
        if (!(0, fs_1.existsSync)(modelsJsonPath)) {
            return emptyCustomModelsResult();
        }
        try {
            const content = (0, fs_1.readFileSync)(modelsJsonPath, "utf-8");
            const config = JSON.parse(content);
            // Validate schema
            const ajv = new Ajv();
            const validate = ajv.compile(ModelsConfigSchema);
            if (!validate(config)) {
                const errors = ((_a = validate.errors) === null || _a === void 0 ? void 0 : _a.map((e) => `  - ${e.instancePath || "root"}: ${e.message}`).join("\n")) ||
                    "Unknown schema error";
                return emptyCustomModelsResult(`Invalid models.json schema:\n${errors}\n\nFile: ${modelsJsonPath}`);
            }
            // Additional validation
            this.validateConfig(config);
            // Separate providers into "full replacement" (has models) vs "override-only" (no models)
            const replacedProviders = new Set();
            const overrides = new Map();
            for (const [providerName, providerConfig] of Object.entries(config.providers)) {
                if (providerConfig.models && providerConfig.models.length > 0) {
                    // Has custom models -> full replacement
                    replacedProviders.add(providerName);
                }
                else {
                    // No models -> just override baseUrl/headers on built-in
                    overrides.set(providerName, {
                        baseUrl: providerConfig.baseUrl,
                        headers: providerConfig.headers,
                        apiKey: providerConfig.apiKey,
                    });
                    // Store API key for fallback resolver
                    if (providerConfig.apiKey) {
                        this.customProviderApiKeys.set(providerName, providerConfig.apiKey);
                    }
                }
            }
            return { models: this.parseModels(config), replacedProviders, overrides, error: undefined };
        }
        catch (error) {
            if (error instanceof SyntaxError) {
                return emptyCustomModelsResult(`Failed to parse models.json: ${error.message}\n\nFile: ${modelsJsonPath}`);
            }
            return emptyCustomModelsResult(`Failed to load models.json: ${error instanceof Error ? error.message : error}\n\nFile: ${modelsJsonPath}`);
        }
    }
    validateConfig(config) {
        var _a;
        for (const [providerName, providerConfig] of Object.entries(config.providers)) {
            const hasProviderApi = !!providerConfig.api;
            const models = (_a = providerConfig.models) !== null && _a !== void 0 ? _a : [];
            if (models.length === 0) {
                // Override-only config: just needs baseUrl (to override built-in)
                if (!providerConfig.baseUrl) {
                    throw new Error(`Provider ${providerName}: must specify either "baseUrl" (for override) or "models" (for replacement).`);
                }
            }
            else {
                // Full replacement: needs baseUrl and apiKey
                if (!providerConfig.baseUrl) {
                    throw new Error(`Provider ${providerName}: "baseUrl" is required when defining custom models.`);
                }
                if (!providerConfig.apiKey) {
                    throw new Error(`Provider ${providerName}: "apiKey" is required when defining custom models.`);
                }
            }
            for (const modelDef of models) {
                const hasModelApi = !!modelDef.api;
                if (!hasProviderApi && !hasModelApi) {
                    throw new Error(`Provider ${providerName}, model ${modelDef.id}: no "api" specified. Set at provider or model level.`);
                }
                if (!modelDef.id)
                    throw new Error(`Provider ${providerName}: model missing "id"`);
                // Validate contextWindow/maxTokens only if provided (they have defaults)
                if (modelDef.contextWindow !== undefined && modelDef.contextWindow <= 0)
                    throw new Error(`Provider ${providerName}, model ${modelDef.id}: invalid contextWindow`);
                if (modelDef.maxTokens !== undefined && modelDef.maxTokens <= 0)
                    throw new Error(`Provider ${providerName}, model ${modelDef.id}: invalid maxTokens`);
            }
        }
    }
    parseModels(config) {
        var _a, _b, _c, _d, _e, _f, _g;
        const models = [];
        for (const [providerName, providerConfig] of Object.entries(config.providers)) {
            const modelDefs = (_a = providerConfig.models) !== null && _a !== void 0 ? _a : [];
            if (modelDefs.length === 0)
                continue; // Override-only, no custom models
            // Store API key config for fallback resolver
            if (providerConfig.apiKey) {
                this.customProviderApiKeys.set(providerName, providerConfig.apiKey);
            }
            for (const modelDef of modelDefs) {
                const api = modelDef.api || providerConfig.api;
                if (!api)
                    continue;
                // Merge headers: provider headers are base, model headers override
                // Resolve env vars and shell commands in header values
                const providerHeaders = (0, resolve_config_value_js_1.resolveHeaders)(providerConfig.headers);
                const modelHeaders = (0, resolve_config_value_js_1.resolveHeaders)(modelDef.headers);
                let headers = providerHeaders || modelHeaders ? Object.assign(Object.assign({}, providerHeaders), modelHeaders) : undefined;
                // If authHeader is true, add Authorization header with resolved API key
                if (providerConfig.authHeader && providerConfig.apiKey) {
                    const resolvedKey = (0, resolve_config_value_js_1.resolveConfigValue)(providerConfig.apiKey);
                    if (resolvedKey) {
                        headers = Object.assign(Object.assign({}, headers), { Authorization: `Bearer ${resolvedKey}` });
                    }
                }
                // baseUrl is validated to exist for providers with models
                // Apply defaults for optional fields
                const defaultCost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
                models.push({
                    id: modelDef.id,
                    name: (_b = modelDef.name) !== null && _b !== void 0 ? _b : modelDef.id,
                    api: api,
                    provider: providerName,
                    baseUrl: providerConfig.baseUrl,
                    reasoning: (_c = modelDef.reasoning) !== null && _c !== void 0 ? _c : false,
                    input: ((_d = modelDef.input) !== null && _d !== void 0 ? _d : ["text"]),
                    cost: (_e = modelDef.cost) !== null && _e !== void 0 ? _e : defaultCost,
                    contextWindow: (_f = modelDef.contextWindow) !== null && _f !== void 0 ? _f : 128000,
                    maxTokens: (_g = modelDef.maxTokens) !== null && _g !== void 0 ? _g : 16384,
                    headers,
                    compat: modelDef.compat,
                });
            }
        }
        return models;
    }
    /**
     * Get all models (built-in + custom).
     * If models.json had errors, returns only built-in models.
     */
    getAll() {
        return this.models;
    }
    /**
     * Get only models that have auth configured.
     * This is a fast check that doesn't refresh OAuth tokens.
     */
    getAvailable() {
        return this.models.filter((m) => this.authStorage.hasAuth(m.provider));
    }
    /**
     * Find a model by provider and ID.
     */
    find(provider, modelId) {
        return this.models.find((m) => m.provider === provider && m.id === modelId);
    }
    /**
     * Get API key for a model.
     */
    async getApiKey(model) {
        return this.authStorage.getApiKey(model.provider);
    }
    /**
     * Get API key for a provider.
     */
    async getApiKeyForProvider(provider) {
        return this.authStorage.getApiKey(provider);
    }
    /**
     * Check if a model is using OAuth credentials (subscription).
     */
    isUsingOAuth(model) {
        const cred = this.authStorage.get(model.provider);
        return (cred === null || cred === void 0 ? void 0 : cred.type) === "oauth";
    }
    /**
     * Register a provider dynamically (from extensions).
     *
     * If provider has models: replaces all existing models for this provider.
     * If provider has only baseUrl/headers: overrides existing models' URLs.
     * If provider has oauth: registers OAuth provider for /login support.
     */
    registerProvider(providerName, config) {
        this.registeredProviders.set(providerName, config);
        this.applyProviderConfig(providerName, config);
    }
    applyProviderConfig(providerName, config) {
        var _a;
        // Register OAuth provider if provided
        if (config.oauth) {
            // Ensure the OAuth provider ID matches the provider name
            const oauthProvider = Object.assign(Object.assign({}, config.oauth), { id: providerName });
            (0, pi_ai_1.registerOAuthProvider)(oauthProvider);
        }
        if (config.streamSimple) {
            if (!config.api) {
                throw new Error(`Provider ${providerName}: "api" is required when registering streamSimple.`);
            }
            const streamSimple = config.streamSimple;
            (0, pi_ai_1.registerApiProvider)({
                api: config.api,
                stream: (model, context, options) => streamSimple(model, context, options),
                streamSimple,
            });
        }
        // Store API key for auth resolution
        if (config.apiKey) {
            this.customProviderApiKeys.set(providerName, config.apiKey);
        }
        if (config.models && config.models.length > 0) {
            // Full replacement: remove existing models for this provider
            this.models = this.models.filter((m) => m.provider !== providerName);
            // Validate required fields
            if (!config.baseUrl) {
                throw new Error(`Provider ${providerName}: "baseUrl" is required when defining models.`);
            }
            if (!config.apiKey && !config.oauth) {
                throw new Error(`Provider ${providerName}: "apiKey" or "oauth" is required when defining models.`);
            }
            // Parse and add new models
            for (const modelDef of config.models) {
                const api = modelDef.api || config.api;
                if (!api) {
                    throw new Error(`Provider ${providerName}, model ${modelDef.id}: no "api" specified.`);
                }
                // Merge headers
                const providerHeaders = (0, resolve_config_value_js_1.resolveHeaders)(config.headers);
                const modelHeaders = (0, resolve_config_value_js_1.resolveHeaders)(modelDef.headers);
                let headers = providerHeaders || modelHeaders ? Object.assign(Object.assign({}, providerHeaders), modelHeaders) : undefined;
                // If authHeader is true, add Authorization header
                if (config.authHeader && config.apiKey) {
                    const resolvedKey = (0, resolve_config_value_js_1.resolveConfigValue)(config.apiKey);
                    if (resolvedKey) {
                        headers = Object.assign(Object.assign({}, headers), { Authorization: `Bearer ${resolvedKey}` });
                    }
                }
                this.models.push({
                    id: modelDef.id,
                    name: modelDef.name,
                    api: api,
                    provider: providerName,
                    baseUrl: config.baseUrl,
                    reasoning: modelDef.reasoning,
                    input: modelDef.input,
                    cost: modelDef.cost,
                    contextWindow: modelDef.contextWindow,
                    maxTokens: modelDef.maxTokens,
                    headers,
                    compat: modelDef.compat,
                });
            }
            // Apply OAuth modifyModels if credentials exist (e.g., to update baseUrl)
            if ((_a = config.oauth) === null || _a === void 0 ? void 0 : _a.modifyModels) {
                const cred = this.authStorage.get(providerName);
                if ((cred === null || cred === void 0 ? void 0 : cred.type) === "oauth") {
                    this.models = config.oauth.modifyModels(this.models, cred);
                }
            }
        }
        else if (config.baseUrl) {
            // Override-only: update baseUrl/headers for existing models
            const resolvedHeaders = (0, resolve_config_value_js_1.resolveHeaders)(config.headers);
            this.models = this.models.map((m) => {
                var _a;
                if (m.provider !== providerName)
                    return m;
                return Object.assign(Object.assign({}, m), { baseUrl: (_a = config.baseUrl) !== null && _a !== void 0 ? _a : m.baseUrl, headers: resolvedHeaders ? Object.assign(Object.assign({}, m.headers), resolvedHeaders) : m.headers });
            });
        }
    }
}
exports.ModelRegistry = ModelRegistry;
