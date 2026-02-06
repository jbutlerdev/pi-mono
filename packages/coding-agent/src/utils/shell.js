"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getShellConfig = getShellConfig;
exports.getShellEnv = getShellEnv;
exports.sanitizeBinaryOutput = sanitizeBinaryOutput;
exports.killProcessTree = killProcessTree;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const child_process_1 = require("child_process");
const config_js_1 = require("../config.js");
const settings_manager_js_1 = require("../core/settings-manager.js");
let cachedShellConfig = null;
/**
 * Find bash executable on PATH (cross-platform)
 */
function findBashOnPath() {
    if (process.platform === "win32") {
        // Windows: Use 'where' and verify file exists (where can return non-existent paths)
        try {
            const result = (0, child_process_1.spawnSync)("where", ["bash.exe"], { encoding: "utf-8", timeout: 5000 });
            if (result.status === 0 && result.stdout) {
                const firstMatch = result.stdout.trim().split(/\r?\n/)[0];
                if (firstMatch && (0, node_fs_1.existsSync)(firstMatch)) {
                    return firstMatch;
                }
            }
        }
        catch (_a) {
            // Ignore errors
        }
        return null;
    }
    // Unix: Use 'which' and trust its output (handles Termux and special filesystems)
    try {
        const result = (0, child_process_1.spawnSync)("which", ["bash"], { encoding: "utf-8", timeout: 5000 });
        if (result.status === 0 && result.stdout) {
            const firstMatch = result.stdout.trim().split(/\r?\n/)[0];
            if (firstMatch) {
                return firstMatch;
            }
        }
    }
    catch (_b) {
        // Ignore errors
    }
    return null;
}
/**
 * Get shell configuration based on platform.
 * Resolution order:
 * 1. User-specified shellPath in settings.json
 * 2. On Windows: Git Bash in known locations, then bash on PATH
 * 3. On Unix: /bin/bash, then bash on PATH, then fallback to sh
 */
function getShellConfig() {
    if (cachedShellConfig) {
        return cachedShellConfig;
    }
    const settings = settings_manager_js_1.SettingsManager.create();
    const customShellPath = settings.getShellPath();
    // 1. Check user-specified shell path
    if (customShellPath) {
        if ((0, node_fs_1.existsSync)(customShellPath)) {
            cachedShellConfig = { shell: customShellPath, args: ["-c"] };
            return cachedShellConfig;
        }
        throw new Error(`Custom shell path not found: ${customShellPath}\nPlease update shellPath in ${(0, config_js_1.getSettingsPath)()}`);
    }
    if (process.platform === "win32") {
        // 2. Try Git Bash in known locations
        const paths = [];
        const programFiles = process.env.ProgramFiles;
        if (programFiles) {
            paths.push(`${programFiles}\\Git\\bin\\bash.exe`);
        }
        const programFilesX86 = process.env["ProgramFiles(x86)"];
        if (programFilesX86) {
            paths.push(`${programFilesX86}\\Git\\bin\\bash.exe`);
        }
        for (const path of paths) {
            if ((0, node_fs_1.existsSync)(path)) {
                cachedShellConfig = { shell: path, args: ["-c"] };
                return cachedShellConfig;
            }
        }
        // 3. Fallback: search bash.exe on PATH (Cygwin, MSYS2, WSL, etc.)
        const bashOnPath = findBashOnPath();
        if (bashOnPath) {
            cachedShellConfig = { shell: bashOnPath, args: ["-c"] };
            return cachedShellConfig;
        }
        throw new Error(`No bash shell found. Options:\n` +
            `  1. Install Git for Windows: https://git-scm.com/download/win\n` +
            `  2. Add your bash to PATH (Cygwin, MSYS2, etc.)\n` +
            `  3. Set shellPath in ${(0, config_js_1.getSettingsPath)()}\n\n` +
            `Searched Git Bash in:\n${paths.map((p) => `  ${p}`).join("\n")}`);
    }
    // Unix: try /bin/bash, then bash on PATH, then fallback to sh
    if ((0, node_fs_1.existsSync)("/bin/bash")) {
        cachedShellConfig = { shell: "/bin/bash", args: ["-c"] };
        return cachedShellConfig;
    }
    const bashOnPath = findBashOnPath();
    if (bashOnPath) {
        cachedShellConfig = { shell: bashOnPath, args: ["-c"] };
        return cachedShellConfig;
    }
    cachedShellConfig = { shell: "sh", args: ["-c"] };
    return cachedShellConfig;
}
function getShellEnv() {
    var _a, _b;
    const binDir = (0, config_js_1.getBinDir)();
    const pathKey = (_a = Object.keys(process.env).find((key) => key.toLowerCase() === "path")) !== null && _a !== void 0 ? _a : "PATH";
    const currentPath = (_b = process.env[pathKey]) !== null && _b !== void 0 ? _b : "";
    const pathEntries = currentPath.split(node_path_1.delimiter).filter(Boolean);
    const hasBinDir = pathEntries.includes(binDir);
    const updatedPath = hasBinDir ? currentPath : [binDir, currentPath].filter(Boolean).join(node_path_1.delimiter);
    return Object.assign(Object.assign({}, process.env), { [pathKey]: updatedPath });
}
/**
 * Sanitize binary output for display/storage.
 * Removes characters that crash string-width or cause display issues:
 * - Control characters (except tab, newline, carriage return)
 * - Lone surrogates
 * - Unicode Format characters (crash string-width due to a bug)
 * - Characters with undefined code points
 */
function sanitizeBinaryOutput(str) {
    // Use Array.from to properly iterate over code points (not code units)
    // This handles surrogate pairs correctly and catches edge cases where
    // codePointAt() might return undefined
    return Array.from(str)
        .filter((char) => {
        // Filter out characters that cause string-width to crash
        // This includes:
        // - Unicode format characters
        // - Lone surrogates (already filtered by Array.from)
        // - Control chars except \t \n \r
        // - Characters with undefined code points
        const code = char.codePointAt(0);
        // Skip if code point is undefined (edge case with invalid strings)
        if (code === undefined)
            return false;
        // Allow tab, newline, carriage return
        if (code === 0x09 || code === 0x0a || code === 0x0d)
            return true;
        // Filter out control characters (0x00-0x1F, except 0x09, 0x0a, 0x0x0d)
        if (code <= 0x1f)
            return false;
        // Filter out Unicode format characters
        if (code >= 0xfff9 && code <= 0xfffb)
            return false;
        return true;
    })
        .join("");
}
/**
 * Kill a process and all its children (cross-platform)
 */
function killProcessTree(pid) {
    if (process.platform === "win32") {
        // Use taskkill on Windows to kill process tree
        try {
            (0, child_process_1.spawn)("taskkill", ["/F", "/T", "/PID", String(pid)], {
                stdio: "ignore",
                detached: true,
            });
        }
        catch (_a) {
            // Ignore errors if taskkill fails
        }
    }
    else {
        // Use SIGKILL on Unix/Linux/Mac
        try {
            process.kill(-pid, "SIGKILL");
        }
        catch (_b) {
            // Fallback to killing just the child if process group kill fails
            try {
                process.kill(pid, "SIGKILL");
            }
            catch (_c) {
                // Process already dead
            }
        }
    }
}
