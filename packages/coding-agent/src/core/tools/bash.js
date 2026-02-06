"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bashTool = void 0;
exports.createBashTool = createBashTool;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const typebox_1 = require("@sinclair/typebox");
const child_process_1 = require("child_process");
const shell_js_1 = require("../../utils/shell.js");
const truncate_js_1 = require("./truncate.js");
/**
 * Generate a unique temp file path for bash output
 */
function getTempFilePath() {
    const id = (0, node_crypto_1.randomBytes)(8).toString("hex");
    return (0, node_path_1.join)((0, node_os_1.tmpdir)(), `pi-bash-${id}.log`);
}
const bashSchema = typebox_1.Type.Object({
    command: typebox_1.Type.String({ description: "Bash command to execute" }),
    timeout: typebox_1.Type.Optional(typebox_1.Type.Number({ description: "Timeout in seconds (optional, no default timeout)" })),
});
/**
 * Default bash operations using local shell
 */
const defaultBashOperations = {
    exec: (command, cwd, { onData, signal, timeout, env }) => {
        return new Promise((resolve, reject) => {
            const { shell, args } = (0, shell_js_1.getShellConfig)();
            if (!(0, node_fs_1.existsSync)(cwd)) {
                reject(new Error(`Working directory does not exist: ${cwd}\nCannot execute bash commands.`));
                return;
            }
            const child = (0, child_process_1.spawn)(shell, [...args, command], {
                cwd,
                detached: true,
                env: env !== null && env !== void 0 ? env : (0, shell_js_1.getShellEnv)(),
                stdio: ["ignore", "pipe", "pipe"],
            });
            let timedOut = false;
            // Set timeout if provided
            let timeoutHandle;
            if (timeout !== undefined && timeout > 0) {
                timeoutHandle = setTimeout(() => {
                    timedOut = true;
                    if (child.pid) {
                        (0, shell_js_1.killProcessTree)(child.pid);
                    }
                }, timeout * 1000);
            }
            // Stream stdout and stderr
            if (child.stdout) {
                child.stdout.on("data", onData);
            }
            if (child.stderr) {
                child.stderr.on("data", onData);
            }
            // Handle shell spawn errors
            child.on("error", (err) => {
                if (timeoutHandle)
                    clearTimeout(timeoutHandle);
                if (signal)
                    signal.removeEventListener("abort", onAbort);
                reject(err);
            });
            // Handle abort signal - kill entire process tree
            const onAbort = () => {
                if (child.pid) {
                    (0, shell_js_1.killProcessTree)(child.pid);
                }
            };
            if (signal) {
                if (signal.aborted) {
                    onAbort();
                }
                else {
                    signal.addEventListener("abort", onAbort, { once: true });
                }
            }
            // Handle process exit
            child.on("close", (code) => {
                if (timeoutHandle)
                    clearTimeout(timeoutHandle);
                if (signal)
                    signal.removeEventListener("abort", onAbort);
                if (signal === null || signal === void 0 ? void 0 : signal.aborted) {
                    reject(new Error("aborted"));
                    return;
                }
                if (timedOut) {
                    reject(new Error(`timeout:${timeout}`));
                    return;
                }
                resolve({ exitCode: code });
            });
        });
    },
};
function resolveSpawnContext(command, cwd, spawnHook) {
    const baseContext = {
        command,
        cwd,
        env: Object.assign({}, (0, shell_js_1.getShellEnv)()),
    };
    return spawnHook ? spawnHook(baseContext) : baseContext;
}
function createBashTool(cwd, options) {
    var _a;
    const ops = (_a = options === null || options === void 0 ? void 0 : options.operations) !== null && _a !== void 0 ? _a : defaultBashOperations;
    const commandPrefix = options === null || options === void 0 ? void 0 : options.commandPrefix;
    const spawnHook = options === null || options === void 0 ? void 0 : options.spawnHook;
    return {
        name: "bash",
        label: "bash",
        description: `Execute a bash command in the current working directory. Returns stdout and stderr. Output is truncated to last ${truncate_js_1.DEFAULT_MAX_LINES} lines or ${truncate_js_1.DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first). If truncated, full output is saved to a temp file. Optionally provide a timeout in seconds.`,
        parameters: bashSchema,
        execute: async (_toolCallId, { command, timeout }, signal, onUpdate) => {
            // Apply command prefix if configured (e.g., "shopt -s expand_aliases" for alias support)
            const resolvedCommand = commandPrefix ? `${commandPrefix}\n${command}` : command;
            const spawnContext = resolveSpawnContext(resolvedCommand, cwd, spawnHook);
            return new Promise((resolve, reject) => {
                // We'll stream to a temp file if output gets large
                let tempFilePath;
                let tempFileStream;
                let totalBytes = 0;
                // Keep a rolling buffer of the last chunk for tail truncation
                const chunks = [];
                let chunksBytes = 0;
                // Keep more than we need so we have enough for truncation
                const maxChunksBytes = truncate_js_1.DEFAULT_MAX_BYTES * 2;
                const handleData = (data) => {
                    totalBytes += data.length;
                    // Start writing to temp file once we exceed the threshold
                    if (totalBytes > truncate_js_1.DEFAULT_MAX_BYTES && !tempFilePath) {
                        tempFilePath = getTempFilePath();
                        tempFileStream = (0, node_fs_1.createWriteStream)(tempFilePath);
                        // Write all buffered chunks to the file
                        for (const chunk of chunks) {
                            tempFileStream.write(chunk);
                        }
                    }
                    // Write to temp file if we have one
                    if (tempFileStream) {
                        tempFileStream.write(data);
                    }
                    // Keep rolling buffer of recent data
                    chunks.push(data);
                    chunksBytes += data.length;
                    // Trim old chunks if buffer is too large
                    while (chunksBytes > maxChunksBytes && chunks.length > 1) {
                        const removed = chunks.shift();
                        chunksBytes -= removed.length;
                    }
                    // Stream partial output to callback (truncated rolling buffer)
                    if (onUpdate) {
                        const fullBuffer = Buffer.concat(chunks);
                        const fullText = fullBuffer.toString("utf-8");
                        const truncation = (0, truncate_js_1.truncateTail)(fullText);
                        onUpdate({
                            content: [{ type: "text", text: truncation.content || "" }],
                            details: {
                                truncation: truncation.truncated ? truncation : undefined,
                                fullOutputPath: tempFilePath,
                            },
                        });
                    }
                };
                ops.exec(spawnContext.command, spawnContext.cwd, {
                    onData: handleData,
                    signal,
                    timeout,
                    env: spawnContext.env,
                })
                    .then(({ exitCode }) => {
                    // Close temp file stream
                    if (tempFileStream) {
                        tempFileStream.end();
                    }
                    // Combine all buffered chunks
                    const fullBuffer = Buffer.concat(chunks);
                    const fullOutput = fullBuffer.toString("utf-8");
                    // Apply tail truncation
                    const truncation = (0, truncate_js_1.truncateTail)(fullOutput);
                    let outputText = truncation.content || "(no output)";
                    // Build details with truncation info
                    let details;
                    if (truncation.truncated) {
                        details = {
                            truncation,
                            fullOutputPath: tempFilePath,
                        };
                        // Build actionable notice
                        const startLine = truncation.totalLines - truncation.outputLines + 1;
                        const endLine = truncation.totalLines;
                        if (truncation.lastLinePartial) {
                            // Edge case: last line alone > 30KB
                            const lastLineSize = (0, truncate_js_1.formatSize)(Buffer.byteLength(fullOutput.split("\n").pop() || "", "utf-8"));
                            outputText += `\n\n[Showing last ${(0, truncate_js_1.formatSize)(truncation.outputBytes)} of line ${endLine} (line is ${lastLineSize}). Full output: ${tempFilePath}]`;
                        }
                        else if (truncation.truncatedBy === "lines") {
                            outputText += `\n\n[Showing lines ${startLine}-${endLine} of ${truncation.totalLines}. Full output: ${tempFilePath}]`;
                        }
                        else {
                            outputText += `\n\n[Showing lines ${startLine}-${endLine} of ${truncation.totalLines} (${(0, truncate_js_1.formatSize)(truncate_js_1.DEFAULT_MAX_BYTES)} limit). Full output: ${tempFilePath}]`;
                        }
                    }
                    if (exitCode !== 0 && exitCode !== null) {
                        outputText += `\n\nCommand exited with code ${exitCode}`;
                        reject(new Error(outputText));
                    }
                    else {
                        resolve({ content: [{ type: "text", text: outputText }], details });
                    }
                })
                    .catch((err) => {
                    // Close temp file stream
                    if (tempFileStream) {
                        tempFileStream.end();
                    }
                    // Combine all buffered chunks for error output
                    const fullBuffer = Buffer.concat(chunks);
                    let output = fullBuffer.toString("utf-8");
                    if (err.message === "aborted") {
                        if (output)
                            output += "\n\n";
                        output += "Command aborted";
                        reject(new Error(output));
                    }
                    else if (err.message.startsWith("timeout:")) {
                        const timeoutSecs = err.message.split(":")[1];
                        if (output)
                            output += "\n\n";
                        output += `Command timed out after ${timeoutSecs} seconds`;
                        reject(new Error(output));
                    }
                    else {
                        reject(err);
                    }
                });
            });
        },
    };
}
/** Default bash tool using process.cwd() - for backwards compatibility */
exports.bashTool = createBashTool(process.cwd());
