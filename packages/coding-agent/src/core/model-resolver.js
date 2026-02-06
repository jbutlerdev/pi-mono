"use strict";
/**
 * Model resolution, scoping, and initial selection
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultModelPerProvider = void 0;
exports.parseModelPattern = parseModelPattern;
exports.resolveModelScope = resolveModelScope;
exports.findInitialModel = findInitialModel;
exports.restoreModelFromSession = restoreModelFromSession;
const pi_ai_1 = require("@mariozechner/pi-ai");
const chalk_1 = __importDefault(require("chalk"));
const minimatch_1 = require("minimatch");
const args_js_1 = require("../cli/args.js");
const defaults_js_1 = require("./defaults.js");
/** Default model IDs for each known provider */
exports.defaultModelPerProvider = {
    "amazon-bedrock": "us.anthropic.claude-opus-4-6-v1",
    anthropic: "claude-opus-4-6",
    openai: "gpt-5.1-codex",
    "azure-openai-responses": "gpt-5.2",
    "openai-codex": "gpt-5.3-codex",
    google: "gemini-2.5-pro",
    "google-gemini-cli": "gemini-2.5-pro",
    "google-antigravity": "gemini-3-pro-high",
    "google-vertex": "gemini-3-pro-preview",
    "github-copilot": "gpt-4o",
    openrouter: "openai/gpt-5.1-codex",
    "vercel-ai-gateway": "anthropic/claude-opus-4-6",
    xai: "grok-4-fast-non-reasoning",
    groq: "openai/gpt-oss-120b",
    cerebras: "zai-glm-4.6",
    zai: "glm-4.6",
    mistral: "devstral-medium-latest",
    minimax: "MiniMax-M2.1",
    "minimax-cn": "MiniMax-M2.1",
    huggingface: "moonshotai/Kimi-K2.5",
    opencode: "claude-opus-4-6",
    "kimi-coding": "kimi-k2-thinking",
};
/**
 * Helper to check if a model ID looks like an alias (no date suffix)
 * Dates are typically in format: -20241022 or -20250929
 */
function isAlias(id) {
    // Check if ID ends with -latest
    if (id.endsWith("-latest"))
        return true;
    // Check if ID ends with a date pattern (-YYYYMMDD)
    const datePattern = /-\d{8}$/;
    return !datePattern.test(id);
}
/**
 * Try to match a pattern to a model from the available models list.
 * Returns the matched model or undefined if no match found.
 */
function tryMatchModel(modelPattern, availableModels) {
    // Check for provider/modelId format (provider is everything before the first /)
    const slashIndex = modelPattern.indexOf("/");
    if (slashIndex !== -1) {
        const provider = modelPattern.substring(0, slashIndex);
        const modelId = modelPattern.substring(slashIndex + 1);
        const providerMatch = availableModels.find((m) => m.provider.toLowerCase() === provider.toLowerCase() && m.id.toLowerCase() === modelId.toLowerCase());
        if (providerMatch) {
            return providerMatch;
        }
        // No exact provider/model match - fall through to other matching
    }
    // Check for exact ID match (case-insensitive)
    const exactMatch = availableModels.find((m) => m.id.toLowerCase() === modelPattern.toLowerCase());
    if (exactMatch) {
        return exactMatch;
    }
    // No exact match - fall back to partial matching
    const matches = availableModels.filter((m) => {
        var _a;
        return m.id.toLowerCase().includes(modelPattern.toLowerCase()) ||
            ((_a = m.name) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(modelPattern.toLowerCase()));
    });
    if (matches.length === 0) {
        return undefined;
    }
    // Separate into aliases and dated versions
    const aliases = matches.filter((m) => isAlias(m.id));
    const datedVersions = matches.filter((m) => !isAlias(m.id));
    if (aliases.length > 0) {
        // Prefer alias - if multiple aliases, pick the one that sorts highest
        aliases.sort((a, b) => b.id.localeCompare(a.id));
        return aliases[0];
    }
    else {
        // No alias found, pick latest dated version
        datedVersions.sort((a, b) => b.id.localeCompare(a.id));
        return datedVersions[0];
    }
}
/**
 * Parse a pattern to extract model and thinking level.
 * Handles models with colons in their IDs (e.g., OpenRouter's :exacto suffix).
 *
 * Algorithm:
 * 1. Try to match full pattern as a model
 * 2. If found, return it with "off" thinking level
 * 3. If not found and has colons, split on last colon:
 *    - If suffix is valid thinking level, use it and recurse on prefix
 *    - If suffix is invalid, warn and recurse on prefix with "off"
 *
 * @internal Exported for testing
 */
function parseModelPattern(pattern, availableModels) {
    // Try exact match first
    const exactMatch = tryMatchModel(pattern, availableModels);
    if (exactMatch) {
        return { model: exactMatch, thinkingLevel: undefined, warning: undefined };
    }
    // No match - try splitting on last colon if present
    const lastColonIndex = pattern.lastIndexOf(":");
    if (lastColonIndex === -1) {
        // No colons, pattern simply doesn't match any model
        return { model: undefined, thinkingLevel: undefined, warning: undefined };
    }
    const prefix = pattern.substring(0, lastColonIndex);
    const suffix = pattern.substring(lastColonIndex + 1);
    if ((0, args_js_1.isValidThinkingLevel)(suffix)) {
        // Valid thinking level - recurse on prefix and use this level
        const result = parseModelPattern(prefix, availableModels);
        if (result.model) {
            // Only use this thinking level if no warning from inner recursion
            return {
                model: result.model,
                thinkingLevel: result.warning ? undefined : suffix,
                warning: result.warning,
            };
        }
        return result;
    }
    else {
        // Invalid suffix - recurse on prefix and warn
        const result = parseModelPattern(prefix, availableModels);
        if (result.model) {
            return {
                model: result.model,
                thinkingLevel: undefined,
                warning: `Invalid thinking level "${suffix}" in pattern "${pattern}". Using default instead.`,
            };
        }
        return result;
    }
}
/**
 * Resolve model patterns to actual Model objects with optional thinking levels
 * Format: "pattern:level" where :level is optional
 * For each pattern, finds all matching models and picks the best version:
 * 1. Prefer alias (e.g., claude-sonnet-4-5) over dated versions (claude-sonnet-4-5-20250929)
 * 2. If no alias, pick the latest dated version
 *
 * Supports models with colons in their IDs (e.g., OpenRouter's model:exacto).
 * The algorithm tries to match the full pattern first, then progressively
 * strips colon-suffixes to find a match.
 */
async function resolveModelScope(patterns, modelRegistry) {
    const availableModels = await modelRegistry.getAvailable();
    const scopedModels = [];
    for (const pattern of patterns) {
        // Check if pattern contains glob characters
        if (pattern.includes("*") || pattern.includes("?") || pattern.includes("[")) {
            // Extract optional thinking level suffix (e.g., "provider/*:high")
            const colonIdx = pattern.lastIndexOf(":");
            let globPattern = pattern;
            let thinkingLevel;
            if (colonIdx !== -1) {
                const suffix = pattern.substring(colonIdx + 1);
                if ((0, args_js_1.isValidThinkingLevel)(suffix)) {
                    thinkingLevel = suffix;
                    globPattern = pattern.substring(0, colonIdx);
                }
            }
            // Match against "provider/modelId" format OR just model ID
            // This allows "*sonnet*" to match without requiring "anthropic/*sonnet*"
            const matchingModels = availableModels.filter((m) => {
                const fullId = `${m.provider}/${m.id}`;
                return (0, minimatch_1.minimatch)(fullId, globPattern, { nocase: true }) || (0, minimatch_1.minimatch)(m.id, globPattern, { nocase: true });
            });
            if (matchingModels.length === 0) {
                console.warn(chalk_1.default.yellow(`Warning: No models match pattern "${pattern}"`));
                continue;
            }
            for (const model of matchingModels) {
                if (!scopedModels.find((sm) => (0, pi_ai_1.modelsAreEqual)(sm.model, model))) {
                    scopedModels.push({ model, thinkingLevel });
                }
            }
            continue;
        }
        const { model, thinkingLevel, warning } = parseModelPattern(pattern, availableModels);
        if (warning) {
            console.warn(chalk_1.default.yellow(`Warning: ${warning}`));
        }
        if (!model) {
            console.warn(chalk_1.default.yellow(`Warning: No models match pattern "${pattern}"`));
            continue;
        }
        // Avoid duplicates
        if (!scopedModels.find((sm) => (0, pi_ai_1.modelsAreEqual)(sm.model, model))) {
            scopedModels.push({ model, thinkingLevel });
        }
    }
    return scopedModels;
}
/**
 * Find the initial model to use based on priority:
 * 1. CLI args (provider + model)
 * 2. First model from scoped models (if not continuing/resuming)
 * 3. Restored from session (if continuing/resuming)
 * 4. Saved default from settings
 * 5. First available model with valid API key
 */
async function findInitialModel(options) {
    var _a, _b;
    const { cliProvider, cliModel, scopedModels, isContinuing, defaultProvider, defaultModelId, defaultThinkingLevel, modelRegistry, } = options;
    let model;
    let thinkingLevel = defaults_js_1.DEFAULT_THINKING_LEVEL;
    // 1. CLI args take priority
    if (cliProvider && cliModel) {
        const found = modelRegistry.find(cliProvider, cliModel);
        if (!found) {
            console.error(chalk_1.default.red(`Model ${cliProvider}/${cliModel} not found`));
            process.exit(1);
        }
        return { model: found, thinkingLevel: defaults_js_1.DEFAULT_THINKING_LEVEL, fallbackMessage: undefined };
    }
    // 2. Use first model from scoped models (skip if continuing/resuming)
    if (scopedModels.length > 0 && !isContinuing) {
        return {
            model: scopedModels[0].model,
            thinkingLevel: (_b = (_a = scopedModels[0].thinkingLevel) !== null && _a !== void 0 ? _a : defaultThinkingLevel) !== null && _b !== void 0 ? _b : defaults_js_1.DEFAULT_THINKING_LEVEL,
            fallbackMessage: undefined,
        };
    }
    // 3. Try saved default from settings
    if (defaultProvider && defaultModelId) {
        const found = modelRegistry.find(defaultProvider, defaultModelId);
        if (found) {
            model = found;
            if (defaultThinkingLevel) {
                thinkingLevel = defaultThinkingLevel;
            }
            return { model, thinkingLevel, fallbackMessage: undefined };
        }
    }
    // 4. Try first available model with valid API key
    const availableModels = await modelRegistry.getAvailable();
    if (availableModels.length > 0) {
        // Try to find a default model from known providers
        for (const provider of Object.keys(exports.defaultModelPerProvider)) {
            const defaultId = exports.defaultModelPerProvider[provider];
            const match = availableModels.find((m) => m.provider === provider && m.id === defaultId);
            if (match) {
                return { model: match, thinkingLevel: defaults_js_1.DEFAULT_THINKING_LEVEL, fallbackMessage: undefined };
            }
        }
        // If no default found, use first available
        return { model: availableModels[0], thinkingLevel: defaults_js_1.DEFAULT_THINKING_LEVEL, fallbackMessage: undefined };
    }
    // 5. No model found
    return { model: undefined, thinkingLevel: defaults_js_1.DEFAULT_THINKING_LEVEL, fallbackMessage: undefined };
}
/**
 * Restore model from session, with fallback to available models
 */
async function restoreModelFromSession(savedProvider, savedModelId, currentModel, shouldPrintMessages, modelRegistry) {
    const restoredModel = modelRegistry.find(savedProvider, savedModelId);
    // Check if restored model exists and has a valid API key
    const hasApiKey = restoredModel ? !!(await modelRegistry.getApiKey(restoredModel)) : false;
    if (restoredModel && hasApiKey) {
        if (shouldPrintMessages) {
            console.log(chalk_1.default.dim(`Restored model: ${savedProvider}/${savedModelId}`));
        }
        return { model: restoredModel, fallbackMessage: undefined };
    }
    // Model not found or no API key - fall back
    const reason = !restoredModel ? "model no longer exists" : "no API key available";
    if (shouldPrintMessages) {
        console.error(chalk_1.default.yellow(`Warning: Could not restore model ${savedProvider}/${savedModelId} (${reason}).`));
    }
    // If we already have a model, use it as fallback
    if (currentModel) {
        if (shouldPrintMessages) {
            console.log(chalk_1.default.dim(`Falling back to: ${currentModel.provider}/${currentModel.id}`));
        }
        return {
            model: currentModel,
            fallbackMessage: `Could not restore model ${savedProvider}/${savedModelId} (${reason}). Using ${currentModel.provider}/${currentModel.id}.`,
        };
    }
    // Try to find any available model
    const availableModels = await modelRegistry.getAvailable();
    if (availableModels.length > 0) {
        // Try to find a default model from known providers
        let fallbackModel;
        for (const provider of Object.keys(exports.defaultModelPerProvider)) {
            const defaultId = exports.defaultModelPerProvider[provider];
            const match = availableModels.find((m) => m.provider === provider && m.id === defaultId);
            if (match) {
                fallbackModel = match;
                break;
            }
        }
        // If no default found, use first available
        if (!fallbackModel) {
            fallbackModel = availableModels[0];
        }
        if (shouldPrintMessages) {
            console.log(chalk_1.default.dim(`Falling back to: ${fallbackModel.provider}/${fallbackModel.id}`));
        }
        return {
            model: fallbackModel,
            fallbackMessage: `Could not restore model ${savedProvider}/${savedModelId} (${reason}). Using ${fallbackModel.provider}/${fallbackModel.id}.`,
        };
    }
    // No models available
    return { model: undefined, fallbackMessage: undefined };
}
