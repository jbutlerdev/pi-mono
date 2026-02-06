"use strict";
/**
 * One-time migrations that run on startup.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateAuthToAuthJson = migrateAuthToAuthJson;
exports.migrateSessionsFromAgentRoot = migrateSessionsFromAgentRoot;
exports.showDeprecationWarnings = showDeprecationWarnings;
exports.runMigrations = runMigrations;
const chalk_1 = __importDefault(require("chalk"));
const fs_1 = require("fs");
const path_1 = require("path");
const config_js_1 = require("./config.js");
const MIGRATION_GUIDE_URL = "https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/CHANGELOG.md#extensions-migration";
const EXTENSIONS_DOC_URL = "https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md";
/**
 * Migrate legacy oauth.json and settings.json apiKeys to auth.json.
 *
 * @returns Array of provider names that were migrated
 */
function migrateAuthToAuthJson() {
    const agentDir = (0, config_js_1.getAgentDir)();
    const authPath = (0, path_1.join)(agentDir, "auth.json");
    const oauthPath = (0, path_1.join)(agentDir, "oauth.json");
    const settingsPath = (0, path_1.join)(agentDir, "settings.json");
    // Skip if auth.json already exists
    if ((0, fs_1.existsSync)(authPath))
        return [];
    const migrated = {};
    const providers = [];
    // Migrate oauth.json
    if ((0, fs_1.existsSync)(oauthPath)) {
        try {
            const oauth = JSON.parse((0, fs_1.readFileSync)(oauthPath, "utf-8"));
            for (const [provider, cred] of Object.entries(oauth)) {
                migrated[provider] = Object.assign({ type: "oauth" }, cred);
                providers.push(provider);
            }
            (0, fs_1.renameSync)(oauthPath, `${oauthPath}.migrated`);
        }
        catch (_a) {
            // Skip on error
        }
    }
    // Migrate settings.json apiKeys
    if ((0, fs_1.existsSync)(settingsPath)) {
        try {
            const content = (0, fs_1.readFileSync)(settingsPath, "utf-8");
            const settings = JSON.parse(content);
            if (settings.apiKeys && typeof settings.apiKeys === "object") {
                for (const [provider, key] of Object.entries(settings.apiKeys)) {
                    if (!migrated[provider] && typeof key === "string") {
                        migrated[provider] = { type: "api_key", key };
                        providers.push(provider);
                    }
                }
                delete settings.apiKeys;
                (0, fs_1.writeFileSync)(settingsPath, JSON.stringify(settings, null, 2));
            }
        }
        catch (_b) {
            // Skip on error
        }
    }
    if (Object.keys(migrated).length > 0) {
        (0, fs_1.mkdirSync)((0, path_1.dirname)(authPath), { recursive: true });
        (0, fs_1.writeFileSync)(authPath, JSON.stringify(migrated, null, 2), { mode: 0o600 });
    }
    return providers;
}
/**
 * Migrate sessions from ~/.pi/agent/*.jsonl to proper session directories.
 *
 * Bug in v0.30.0: Sessions were saved to ~/.pi/agent/ instead of
 * ~/.pi/agent/sessions/<encoded-cwd>/. This migration moves them
 * to the correct location based on the cwd in their session header.
 *
 * See: https://github.com/badlogic/pi-mono/issues/320
 */
function migrateSessionsFromAgentRoot() {
    const agentDir = (0, config_js_1.getAgentDir)();
    // Find all .jsonl files directly in agentDir (not in subdirectories)
    let files;
    try {
        files = (0, fs_1.readdirSync)(agentDir)
            .filter((f) => f.endsWith(".jsonl"))
            .map((f) => (0, path_1.join)(agentDir, f));
    }
    catch (_a) {
        return;
    }
    if (files.length === 0)
        return;
    for (const file of files) {
        try {
            // Read first line to get session header
            const content = (0, fs_1.readFileSync)(file, "utf8");
            const firstLine = content.split("\n")[0];
            if (!(firstLine === null || firstLine === void 0 ? void 0 : firstLine.trim()))
                continue;
            const header = JSON.parse(firstLine);
            if (header.type !== "session" || !header.cwd)
                continue;
            const cwd = header.cwd;
            // Compute the correct session directory (same encoding as session-manager.ts)
            const safePath = `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
            const correctDir = (0, path_1.join)(agentDir, "sessions", safePath);
            // Create directory if needed
            if (!(0, fs_1.existsSync)(correctDir)) {
                (0, fs_1.mkdirSync)(correctDir, { recursive: true });
            }
            // Move the file
            const fileName = file.split("/").pop() || file.split("\\").pop();
            const newPath = (0, path_1.join)(correctDir, fileName);
            if ((0, fs_1.existsSync)(newPath))
                continue; // Skip if target exists
            (0, fs_1.renameSync)(file, newPath);
        }
        catch (_b) {
            // Skip files that can't be migrated
        }
    }
}
/**
 * Migrate commands/ to prompts/ if needed.
 * Works for both regular directories and symlinks.
 */
function migrateCommandsToPrompts(baseDir, label) {
    const commandsDir = (0, path_1.join)(baseDir, "commands");
    const promptsDir = (0, path_1.join)(baseDir, "prompts");
    if ((0, fs_1.existsSync)(commandsDir) && !(0, fs_1.existsSync)(promptsDir)) {
        try {
            (0, fs_1.renameSync)(commandsDir, promptsDir);
            console.log(chalk_1.default.green(`Migrated ${label} commands/ → prompts/`));
            return true;
        }
        catch (err) {
            console.log(chalk_1.default.yellow(`Warning: Could not migrate ${label} commands/ to prompts/: ${err instanceof Error ? err.message : err}`));
        }
    }
    return false;
}
/**
 * Move fd/rg binaries from tools/ to bin/ if they exist.
 */
function migrateToolsToBin() {
    const agentDir = (0, config_js_1.getAgentDir)();
    const toolsDir = (0, path_1.join)(agentDir, "tools");
    const binDir = (0, config_js_1.getBinDir)();
    if (!(0, fs_1.existsSync)(toolsDir))
        return;
    const binaries = ["fd", "rg", "fd.exe", "rg.exe"];
    let movedAny = false;
    for (const bin of binaries) {
        const oldPath = (0, path_1.join)(toolsDir, bin);
        const newPath = (0, path_1.join)(binDir, bin);
        if ((0, fs_1.existsSync)(oldPath)) {
            if (!(0, fs_1.existsSync)(binDir)) {
                (0, fs_1.mkdirSync)(binDir, { recursive: true });
            }
            if (!(0, fs_1.existsSync)(newPath)) {
                try {
                    (0, fs_1.renameSync)(oldPath, newPath);
                    movedAny = true;
                }
                catch (_a) {
                    // Ignore errors
                }
            }
            else {
                // Target exists, just delete the old one
                try {
                    fs_1.rmSync === null || fs_1.rmSync === void 0 ? void 0 : (0, fs_1.rmSync)(oldPath, { force: true });
                }
                catch (_b) {
                    // Ignore
                }
            }
        }
    }
    if (movedAny) {
        console.log(chalk_1.default.green(`Migrated managed binaries tools/ → bin/`));
    }
}
/**
 * Check for deprecated hooks/ and tools/ directories.
 * Note: tools/ may contain fd/rg binaries extracted by pi, so only warn if it has other files.
 */
function checkDeprecatedExtensionDirs(baseDir, label) {
    const hooksDir = (0, path_1.join)(baseDir, "hooks");
    const toolsDir = (0, path_1.join)(baseDir, "tools");
    const warnings = [];
    if ((0, fs_1.existsSync)(hooksDir)) {
        warnings.push(`${label} hooks/ directory found. Hooks have been renamed to extensions.`);
    }
    if ((0, fs_1.existsSync)(toolsDir)) {
        // Check if tools/ contains anything other than fd/rg (which are auto-extracted binaries)
        try {
            const entries = (0, fs_1.readdirSync)(toolsDir);
            const customTools = entries.filter((e) => {
                const lower = e.toLowerCase();
                return (lower !== "fd" && lower !== "rg" && lower !== "fd.exe" && lower !== "rg.exe" && !e.startsWith(".") // Ignore .DS_Store and other hidden files
                );
            });
            if (customTools.length > 0) {
                warnings.push(`${label} tools/ directory contains custom tools. Custom tools have been merged into extensions.`);
            }
        }
        catch (_a) {
            // Ignore read errors
        }
    }
    return warnings;
}
/**
 * Run extension system migrations (commands→prompts) and collect warnings about deprecated directories.
 */
function migrateExtensionSystem(cwd) {
    const agentDir = (0, config_js_1.getAgentDir)();
    const projectDir = (0, path_1.join)(cwd, config_js_1.CONFIG_DIR_NAME);
    // Migrate commands/ to prompts/
    migrateCommandsToPrompts(agentDir, "Global");
    migrateCommandsToPrompts(projectDir, "Project");
    // Check for deprecated directories
    const warnings = [
        ...checkDeprecatedExtensionDirs(agentDir, "Global"),
        ...checkDeprecatedExtensionDirs(projectDir, "Project"),
    ];
    return warnings;
}
/**
 * Print deprecation warnings and wait for keypress.
 */
async function showDeprecationWarnings(warnings) {
    if (warnings.length === 0)
        return;
    for (const warning of warnings) {
        console.log(chalk_1.default.yellow(`Warning: ${warning}`));
    }
    console.log(chalk_1.default.yellow(`\nMove your extensions to the extensions/ directory.`));
    console.log(chalk_1.default.yellow(`Migration guide: ${MIGRATION_GUIDE_URL}`));
    console.log(chalk_1.default.yellow(`Documentation: ${EXTENSIONS_DOC_URL}`));
    console.log(chalk_1.default.dim(`\nPress any key to continue...`));
    await new Promise((resolve) => {
        var _a, _b;
        (_b = (_a = process.stdin).setRawMode) === null || _b === void 0 ? void 0 : _b.call(_a, true);
        process.stdin.resume();
        process.stdin.once("data", () => {
            var _a, _b;
            (_b = (_a = process.stdin).setRawMode) === null || _b === void 0 ? void 0 : _b.call(_a, false);
            process.stdin.pause();
            resolve();
        });
    });
    console.log();
}
/**
 * Run all migrations. Called once on startup.
 *
 * @returns Object with migration results and deprecation warnings
 */
function runMigrations(cwd = process.cwd()) {
    const migratedAuthProviders = migrateAuthToAuthJson();
    migrateSessionsFromAgentRoot();
    migrateToolsToBin();
    const deprecationWarnings = migrateExtensionSystem(cwd);
    return { migratedAuthProviders, deprecationWarnings };
}
