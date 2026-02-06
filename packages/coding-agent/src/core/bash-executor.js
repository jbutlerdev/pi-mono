"use strict";
/**
 * Bash command execution with streaming support and cancellation.
 *
 * This module provides a unified bash execution implementation used by:
 * - AgentSession.executeBash() for interactive and RPC modes
 * - Direct calls from modes that need bash execution
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeBash = executeBash;
exports.executeBashWithOperations = executeBashWithOperations;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const child_process_1 = require("child_process");
const strip_ansi_1 = __importDefault(require("strip-ansi"));
const shell_js_1 = require("../utils/shell.js");
const truncate_js_1 = require("./tools/truncate.js");
// ============================================================================
// Implementation
// ============================================================================
/**
 * Execute a bash command with optional streaming and cancellation support.
 *
 * Features:
 * - Streams sanitized output via onChunk callback
 * - Writes large output to temp file for later retrieval
 * - Supports cancellation via AbortSignal
 * - Sanitizes output (strips ANSI, removes binary garbage, normalizes newlines)
 * - Truncates output if it exceeds the default max bytes
 *
 * @param command - The bash command to execute
 * @param options - Optional streaming callback and abort signal
 * @returns Promise resolving to execution result
 */
function executeBash(command, options) {
    return new Promise((resolve, reject) => {
        var _a, _b;
        const { shell, args } = (0, shell_js_1.getShellConfig)();
        const child = (0, child_process_1.spawn)(shell, [...args, command], {
            detached: true,
            env: (0, shell_js_1.getShellEnv)(),
            stdio: ["ignore", "pipe", "pipe"],
        });
        // Track sanitized output for truncation
        const outputChunks = [];
        let outputBytes = 0;
        const maxOutputBytes = truncate_js_1.DEFAULT_MAX_BYTES * 2;
        // Temp file for large output
        let tempFilePath;
        let tempFileStream;
        let totalBytes = 0;
        // Handle abort signal
        const abortHandler = () => {
            if (child.pid) {
                (0, shell_js_1.killProcessTree)(child.pid);
            }
        };
        if (options === null || options === void 0 ? void 0 : options.signal) {
            if (options.signal.aborted) {
                // Already aborted, don't even start
                child.kill();
                resolve({
                    output: "",
                    exitCode: undefined,
                    cancelled: true,
                    truncated: false,
                });
                return;
            }
            options.signal.addEventListener("abort", abortHandler, { once: true });
        }
        const decoder = new TextDecoder();
        const handleData = (data) => {
            totalBytes += data.length;
            // Sanitize once at the source: strip ANSI, replace binary garbage, normalize newlines
            const text = (0, shell_js_1.sanitizeBinaryOutput)((0, strip_ansi_1.default)(decoder.decode(data, { stream: true }))).replace(/\r/g, "");
            // Start writing to temp file if exceeds threshold
            if (totalBytes > truncate_js_1.DEFAULT_MAX_BYTES && !tempFilePath) {
                const id = (0, node_crypto_1.randomBytes)(8).toString("hex");
                tempFilePath = (0, node_path_1.join)((0, node_os_1.tmpdir)(), `pi-bash-${id}.log`);
                tempFileStream = (0, node_fs_1.createWriteStream)(tempFilePath);
                // Write already-buffered chunks to temp file
                for (const chunk of outputChunks) {
                    tempFileStream.write(chunk);
                }
            }
            if (tempFileStream) {
                tempFileStream.write(text);
            }
            // Keep rolling buffer of sanitized text
            outputChunks.push(text);
            outputBytes += text.length;
            while (outputBytes > maxOutputBytes && outputChunks.length > 1) {
                const removed = outputChunks.shift();
                outputBytes -= removed.length;
            }
            // Stream to callback if provided
            if (options === null || options === void 0 ? void 0 : options.onChunk) {
                options.onChunk(text);
            }
        };
        (_a = child.stdout) === null || _a === void 0 ? void 0 : _a.on("data", handleData);
        (_b = child.stderr) === null || _b === void 0 ? void 0 : _b.on("data", handleData);
        child.on("close", (code) => {
            // Clean up abort listener
            if (options === null || options === void 0 ? void 0 : options.signal) {
                options.signal.removeEventListener("abort", abortHandler);
            }
            if (tempFileStream) {
                tempFileStream.end();
            }
            // Combine buffered chunks for truncation (already sanitized)
            const fullOutput = outputChunks.join("");
            const truncationResult = (0, truncate_js_1.truncateTail)(fullOutput);
            // code === null means killed (cancelled)
            const cancelled = code === null;
            resolve({
                output: truncationResult.truncated ? truncationResult.content : fullOutput,
                exitCode: cancelled ? undefined : code,
                cancelled,
                truncated: truncationResult.truncated,
                fullOutputPath: tempFilePath,
            });
        });
        child.on("error", (err) => {
            // Clean up abort listener
            if (options === null || options === void 0 ? void 0 : options.signal) {
                options.signal.removeEventListener("abort", abortHandler);
            }
            if (tempFileStream) {
                tempFileStream.end();
            }
            reject(err);
        });
    });
}
/**
 * Execute a bash command using custom BashOperations.
 * Used for remote execution (SSH, containers, etc.).
 */
async function executeBashWithOperations(command, cwd, operations, options) {
    var _a, _b;
    var _c, _d;
    const outputChunks = [];
    let outputBytes = 0;
    const maxOutputBytes = truncate_js_1.DEFAULT_MAX_BYTES * 2;
    let tempFilePath;
    let tempFileStream;
    let totalBytes = 0;
    const decoder = new TextDecoder();
    const onData = (data) => {
        totalBytes += data.length;
        // Sanitize: strip ANSI, replace binary garbage, normalize newlines
        const text = (0, shell_js_1.sanitizeBinaryOutput)((0, strip_ansi_1.default)(decoder.decode(data, { stream: true }))).replace(/\r/g, "");
        // Start writing to temp file if exceeds threshold
        if (totalBytes > truncate_js_1.DEFAULT_MAX_BYTES && !tempFilePath) {
            const id = (0, node_crypto_1.randomBytes)(8).toString("hex");
            tempFilePath = (0, node_path_1.join)((0, node_os_1.tmpdir)(), `pi-bash-${id}.log`);
            tempFileStream = (0, node_fs_1.createWriteStream)(tempFilePath);
            for (const chunk of outputChunks) {
                tempFileStream.write(chunk);
            }
        }
        if (tempFileStream) {
            tempFileStream.write(text);
        }
        // Keep rolling buffer
        outputChunks.push(text);
        outputBytes += text.length;
        while (outputBytes > maxOutputBytes && outputChunks.length > 1) {
            const removed = outputChunks.shift();
            outputBytes -= removed.length;
        }
        // Stream to callback
        if (options === null || options === void 0 ? void 0 : options.onChunk) {
            options.onChunk(text);
        }
    };
    try {
        const result = await operations.exec(command, cwd, {
            onData,
            signal: options === null || options === void 0 ? void 0 : options.signal,
        });
        if (tempFileStream) {
            tempFileStream.end();
        }
        const fullOutput = outputChunks.join("");
        const truncationResult = (0, truncate_js_1.truncateTail)(fullOutput);
        const cancelled = (_c = (_a = options === null || options === void 0 ? void 0 : options.signal) === null || _a === void 0 ? void 0 : _a.aborted) !== null && _c !== void 0 ? _c : false;
        return {
            output: truncationResult.truncated ? truncationResult.content : fullOutput,
            exitCode: cancelled ? undefined : ((_d = result.exitCode) !== null && _d !== void 0 ? _d : undefined),
            cancelled,
            truncated: truncationResult.truncated,
            fullOutputPath: tempFilePath,
        };
    }
    catch (err) {
        if (tempFileStream) {
            tempFileStream.end();
        }
        // Check if it was an abort
        if ((_b = options === null || options === void 0 ? void 0 : options.signal) === null || _b === void 0 ? void 0 : _b.aborted) {
            const fullOutput = outputChunks.join("");
            const truncationResult = (0, truncate_js_1.truncateTail)(fullOutput);
            return {
                output: truncationResult.truncated ? truncationResult.content : fullOutput,
                exitCode: undefined,
                cancelled: true,
                truncated: truncationResult.truncated,
                fullOutputPath: tempFilePath,
            };
        }
        throw err;
    }
}
