"use strict";
/**
 * Shared command execution utilities for extensions and custom tools.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.execCommand = execCommand;
const node_child_process_1 = require("node:child_process");
/**
 * Execute a shell command and return stdout/stderr/code.
 * Supports timeout and abort signal.
 */
async function execCommand(command, args, cwd, options) {
    return new Promise((resolve) => {
        var _a, _b;
        const proc = (0, node_child_process_1.spawn)(command, args, {
            cwd,
            shell: false,
            stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        let killed = false;
        let timeoutId;
        const killProcess = () => {
            if (!killed) {
                killed = true;
                proc.kill("SIGTERM");
                // Force kill after 5 seconds if SIGTERM doesn't work
                setTimeout(() => {
                    if (!proc.killed) {
                        proc.kill("SIGKILL");
                    }
                }, 5000);
            }
        };
        // Handle abort signal
        if (options === null || options === void 0 ? void 0 : options.signal) {
            if (options.signal.aborted) {
                killProcess();
            }
            else {
                options.signal.addEventListener("abort", killProcess, { once: true });
            }
        }
        // Handle timeout
        if ((options === null || options === void 0 ? void 0 : options.timeout) && options.timeout > 0) {
            timeoutId = setTimeout(() => {
                killProcess();
            }, options.timeout);
        }
        (_a = proc.stdout) === null || _a === void 0 ? void 0 : _a.on("data", (data) => {
            stdout += data.toString();
        });
        (_b = proc.stderr) === null || _b === void 0 ? void 0 : _b.on("data", (data) => {
            stderr += data.toString();
        });
        proc.on("close", (code) => {
            if (timeoutId)
                clearTimeout(timeoutId);
            if (options === null || options === void 0 ? void 0 : options.signal) {
                options.signal.removeEventListener("abort", killProcess);
            }
            resolve({ stdout, stderr, code: code !== null && code !== void 0 ? code : 0, killed });
        });
        proc.on("error", (_err) => {
            if (timeoutId)
                clearTimeout(timeoutId);
            if (options === null || options === void 0 ? void 0 : options.signal) {
                options.signal.removeEventListener("abort", killProcess);
            }
            resolve({ stdout, stderr, code: 1, killed });
        });
    });
}
