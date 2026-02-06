"use strict";
/**
 * Credential storage for API keys and OAuth tokens.
 * Handles loading, saving, and refreshing credentials from auth.json.
 *
 * Uses file locking to prevent race conditions when multiple pi instances
 * try to refresh tokens simultaneously.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthStorage = void 0;
const pi_ai_1 = require("@mariozechner/pi-ai");
const fs_1 = require("fs");
const path_1 = require("path");
const proper_lockfile_1 = __importDefault(require("proper-lockfile"));
const config_js_1 = require("../config.js");
const resolve_config_value_js_1 = require("./resolve-config-value.js");
/**
 * Credential storage backed by a JSON file.
 */
class AuthStorage {
    authPath;
    data = {};
    runtimeOverrides = new Map();
    fallbackResolver;
    constructor(authPath = (0, path_1.join)((0, config_js_1.getAgentDir)(), "auth.json")) {
        this.authPath = authPath;
        this.reload();
    }
    /**
     * Set a runtime API key override (not persisted to disk).
     * Used for CLI --api-key flag.
     */
    setRuntimeApiKey(provider, apiKey) {
        this.runtimeOverrides.set(provider, apiKey);
    }
    /**
     * Remove a runtime API key override.
     */
    removeRuntimeApiKey(provider) {
        this.runtimeOverrides.delete(provider);
    }
    /**
     * Set a fallback resolver for API keys not found in auth.json or env vars.
     * Used for custom provider keys from models.json.
     */
    setFallbackResolver(resolver) {
        this.fallbackResolver = resolver;
    }
    /**
     * Reload credentials from disk.
     */
    reload() {
        if (!(0, fs_1.existsSync)(this.authPath)) {
            this.data = {};
            return;
        }
        try {
            this.data = JSON.parse((0, fs_1.readFileSync)(this.authPath, "utf-8"));
        }
        catch (_a) {
            this.data = {};
        }
    }
    /**
     * Save credentials to disk.
     */
    save() {
        const dir = (0, path_1.dirname)(this.authPath);
        if (!(0, fs_1.existsSync)(dir)) {
            (0, fs_1.mkdirSync)(dir, { recursive: true, mode: 0o700 });
        }
        (0, fs_1.writeFileSync)(this.authPath, JSON.stringify(this.data, null, 2), "utf-8");
        (0, fs_1.chmodSync)(this.authPath, 0o600);
    }
    /**
     * Get credential for a provider.
     */
    get(provider) {
        var _a;
        return (_a = this.data[provider]) !== null && _a !== void 0 ? _a : undefined;
    }
    /**
     * Set credential for a provider.
     */
    set(provider, credential) {
        this.data[provider] = credential;
        this.save();
    }
    /**
     * Remove credential for a provider.
     */
    remove(provider) {
        delete this.data[provider];
        this.save();
    }
    /**
     * List all providers with credentials.
     */
    list() {
        return Object.keys(this.data);
    }
    /**
     * Check if credentials exist for a provider in auth.json.
     */
    has(provider) {
        return provider in this.data;
    }
    /**
     * Check if any form of auth is configured for a provider.
     * Unlike getApiKey(), this doesn't refresh OAuth tokens.
     */
    hasAuth(provider) {
        var _a;
        if (this.runtimeOverrides.has(provider))
            return true;
        if (this.data[provider])
            return true;
        if ((0, pi_ai_1.getEnvApiKey)(provider))
            return true;
        if ((_a = this.fallbackResolver) === null || _a === void 0 ? void 0 : _a.call(this, provider))
            return true;
        return false;
    }
    /**
     * Get all credentials (for passing to getOAuthApiKey).
     */
    getAll() {
        return Object.assign({}, this.data);
    }
    /**
     * Login to an OAuth provider.
     */
    async login(providerId, callbacks) {
        const provider = (0, pi_ai_1.getOAuthProvider)(providerId);
        if (!provider) {
            throw new Error(`Unknown OAuth provider: ${providerId}`);
        }
        const credentials = await provider.login(callbacks);
        this.set(providerId, Object.assign({ type: "oauth" }, credentials));
    }
    /**
     * Logout from a provider.
     */
    logout(provider) {
        this.remove(provider);
    }
    /**
     * Refresh OAuth token with file locking to prevent race conditions.
     * Multiple pi instances may try to refresh simultaneously when tokens expire.
     * This ensures only one instance refreshes while others wait and use the result.
     */
    async refreshOAuthTokenWithLock(providerId) {
        const provider = (0, pi_ai_1.getOAuthProvider)(providerId);
        if (!provider) {
            return null;
        }
        // Ensure auth file exists for locking
        if (!(0, fs_1.existsSync)(this.authPath)) {
            const dir = (0, path_1.dirname)(this.authPath);
            if (!(0, fs_1.existsSync)(dir)) {
                (0, fs_1.mkdirSync)(dir, { recursive: true, mode: 0o700 });
            }
            (0, fs_1.writeFileSync)(this.authPath, "{}", "utf-8");
            (0, fs_1.chmodSync)(this.authPath, 0o600);
        }
        let release;
        try {
            // Acquire exclusive lock with retry and timeout
            // Use generous retry window to handle slow token endpoints
            release = await proper_lockfile_1.default.lock(this.authPath, {
                retries: {
                    retries: 10,
                    factor: 2,
                    minTimeout: 100,
                    maxTimeout: 10000,
                    randomize: true,
                },
                stale: 30000, // Consider lock stale after 30 seconds
            });
            // Re-read file after acquiring lock - another instance may have refreshed
            this.reload();
            const cred = this.data[providerId];
            if ((cred === null || cred === void 0 ? void 0 : cred.type) !== "oauth") {
                return null;
            }
            // Check if token is still expired after re-reading
            // (another instance may have already refreshed it)
            if (Date.now() < cred.expires) {
                // Token is now valid - another instance refreshed it
                const apiKey = provider.getApiKey(cred);
                return { apiKey, newCredentials: cred };
            }
            // Token still expired, we need to refresh
            const oauthCreds = {};
            for (const [key, value] of Object.entries(this.data)) {
                if (value.type === "oauth") {
                    oauthCreds[key] = value;
                }
            }
            const result = await (0, pi_ai_1.getOAuthApiKey)(providerId, oauthCreds);
            if (result) {
                this.data[providerId] = Object.assign({ type: "oauth" }, result.newCredentials);
                this.save();
                return result;
            }
            return null;
        }
        finally {
            // Always release the lock
            if (release) {
                try {
                    await release();
                }
                catch (_a) {
                    // Ignore unlock errors (lock may have been compromised)
                }
            }
        }
    }
    /**
     * Get API key for a provider.
     * Priority:
     * 1. Runtime override (CLI --api-key)
     * 2. API key from auth.json
     * 3. OAuth token from auth.json (auto-refreshed with locking)
     * 4. Environment variable
     * 5. Fallback resolver (models.json custom providers)
     */
    async getApiKey(providerId) {
        var _a;
        var _b;
        // Runtime override takes highest priority
        const runtimeKey = this.runtimeOverrides.get(providerId);
        if (runtimeKey) {
            return runtimeKey;
        }
        const cred = this.data[providerId];
        if ((cred === null || cred === void 0 ? void 0 : cred.type) === "api_key") {
            return (0, resolve_config_value_js_1.resolveConfigValue)(cred.key);
        }
        if ((cred === null || cred === void 0 ? void 0 : cred.type) === "oauth") {
            const provider = (0, pi_ai_1.getOAuthProvider)(providerId);
            if (!provider) {
                // Unknown OAuth provider, can't get API key
                return undefined;
            }
            // Check if token needs refresh
            const needsRefresh = Date.now() >= cred.expires;
            if (needsRefresh) {
                // Use locked refresh to prevent race conditions
                try {
                    const result = await this.refreshOAuthTokenWithLock(providerId);
                    if (result) {
                        return result.apiKey;
                    }
                }
                catch (_c) {
                    // Refresh failed - re-read file to check if another instance succeeded
                    this.reload();
                    const updatedCred = this.data[providerId];
                    if ((updatedCred === null || updatedCred === void 0 ? void 0 : updatedCred.type) === "oauth" && Date.now() < updatedCred.expires) {
                        // Another instance refreshed successfully, use those credentials
                        return provider.getApiKey(updatedCred);
                    }
                    // Refresh truly failed - return undefined so model discovery skips this provider
                    // User can /login to re-authenticate (credentials preserved for retry)
                    return undefined;
                }
            }
            else {
                // Token not expired, use current access token
                return provider.getApiKey(cred);
            }
        }
        // Fall back to environment variable
        const envKey = (0, pi_ai_1.getEnvApiKey)(providerId);
        if (envKey)
            return envKey;
        // Fall back to custom resolver (e.g., models.json custom providers)
        return (_b = (_a = this.fallbackResolver) === null || _a === void 0 ? void 0 : _a.call(this, providerId)) !== null && _b !== void 0 ? _b : undefined;
    }
    /**
     * Get all registered OAuth providers
     */
    getOAuthProviders() {
        return (0, pi_ai_1.getOAuthProviders)();
    }
}
exports.AuthStorage = AuthStorage;
