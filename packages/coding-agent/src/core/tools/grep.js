"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.grepTool = void 0;
exports.createGrepTool = createGrepTool;
const node_readline_1 = require("node:readline");
const typebox_1 = require("@sinclair/typebox");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const tools_manager_js_1 = require("../../utils/tools-manager.js");
const path_utils_js_1 = require("./path-utils.js");
const truncate_js_1 = require("./truncate.js");
const grepSchema = typebox_1.Type.Object({
    pattern: typebox_1.Type.String({ description: "Search pattern (regex or literal string)" }),
    path: typebox_1.Type.Optional(typebox_1.Type.String({ description: "Directory or file to search (default: current directory)" })),
    glob: typebox_1.Type.Optional(typebox_1.Type.String({ description: "Filter files by glob pattern, e.g. '*.ts' or '**/*.spec.ts'" })),
    ignoreCase: typebox_1.Type.Optional(typebox_1.Type.Boolean({ description: "Case-insensitive search (default: false)" })),
    literal: typebox_1.Type.Optional(typebox_1.Type.Boolean({ description: "Treat pattern as literal string instead of regex (default: false)" })),
    context: typebox_1.Type.Optional(typebox_1.Type.Number({ description: "Number of lines to show before and after each match (default: 0)" })),
    limit: typebox_1.Type.Optional(typebox_1.Type.Number({ description: "Maximum number of matches to return (default: 100)" })),
});
const DEFAULT_LIMIT = 100;
const defaultGrepOperations = {
    isDirectory: (p) => (0, fs_1.statSync)(p).isDirectory(),
    readFile: (p) => (0, fs_1.readFileSync)(p, "utf-8"),
};
function createGrepTool(cwd, options) {
    const customOps = options === null || options === void 0 ? void 0 : options.operations;
    return {
        name: "grep",
        label: "grep",
        description: `Search file contents for a pattern. Returns matching lines with file paths and line numbers. Respects .gitignore. Output is truncated to ${DEFAULT_LIMIT} matches or ${truncate_js_1.DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first). Long lines are truncated to ${truncate_js_1.GREP_MAX_LINE_LENGTH} chars.`,
        parameters: grepSchema,
        execute: async (_toolCallId, { pattern, path: searchDir, glob, ignoreCase, literal, context, limit, }, signal) => {
            return new Promise((resolve, reject) => {
                if (signal === null || signal === void 0 ? void 0 : signal.aborted) {
                    reject(new Error("Operation aborted"));
                    return;
                }
                let settled = false;
                const settle = (fn) => {
                    if (!settled) {
                        settled = true;
                        fn();
                    }
                };
                (async () => {
                    var _a;
                    try {
                        const rgPath = await (0, tools_manager_js_1.ensureTool)("rg", true);
                        if (!rgPath) {
                            settle(() => reject(new Error("ripgrep (rg) is not available and could not be downloaded")));
                            return;
                        }
                        const searchPath = (0, path_utils_js_1.resolveToCwd)(searchDir || ".", cwd);
                        const ops = customOps !== null && customOps !== void 0 ? customOps : defaultGrepOperations;
                        let isDirectory;
                        try {
                            isDirectory = await ops.isDirectory(searchPath);
                        }
                        catch (_err) {
                            settle(() => reject(new Error(`Path not found: ${searchPath}`)));
                            return;
                        }
                        const contextValue = context && context > 0 ? context : 0;
                        const effectiveLimit = Math.max(1, limit !== null && limit !== void 0 ? limit : DEFAULT_LIMIT);
                        const formatPath = (filePath) => {
                            if (isDirectory) {
                                const relative = path_1.default.relative(searchPath, filePath);
                                if (relative && !relative.startsWith("..")) {
                                    return relative.replace(/\\/g, "/");
                                }
                            }
                            return path_1.default.basename(filePath);
                        };
                        const fileCache = new Map();
                        const getFileLines = async (filePath) => {
                            let lines = fileCache.get(filePath);
                            if (!lines) {
                                try {
                                    const content = await ops.readFile(filePath);
                                    lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
                                }
                                catch (_a) {
                                    lines = [];
                                }
                                fileCache.set(filePath, lines);
                            }
                            return lines;
                        };
                        const args = ["--json", "--line-number", "--color=never", "--hidden"];
                        if (ignoreCase) {
                            args.push("--ignore-case");
                        }
                        if (literal) {
                            args.push("--fixed-strings");
                        }
                        if (glob) {
                            args.push("--glob", glob);
                        }
                        args.push(pattern, searchPath);
                        const child = (0, child_process_1.spawn)(rgPath, args, { stdio: ["ignore", "pipe", "pipe"] });
                        const rl = (0, node_readline_1.createInterface)({ input: child.stdout });
                        let stderr = "";
                        let matchCount = 0;
                        let matchLimitReached = false;
                        let linesTruncated = false;
                        let aborted = false;
                        let killedDueToLimit = false;
                        const outputLines = [];
                        const cleanup = () => {
                            rl.close();
                            signal === null || signal === void 0 ? void 0 : signal.removeEventListener("abort", onAbort);
                        };
                        const stopChild = (dueToLimit = false) => {
                            if (!child.killed) {
                                killedDueToLimit = dueToLimit;
                                child.kill();
                            }
                        };
                        const onAbort = () => {
                            aborted = true;
                            stopChild();
                        };
                        signal === null || signal === void 0 ? void 0 : signal.addEventListener("abort", onAbort, { once: true });
                        (_a = child.stderr) === null || _a === void 0 ? void 0 : _a.on("data", (chunk) => {
                            stderr += chunk.toString();
                        });
                        const formatBlock = async (filePath, lineNumber) => {
                            var _a;
                            const relativePath = formatPath(filePath);
                            const lines = await getFileLines(filePath);
                            if (!lines.length) {
                                return [`${relativePath}:${lineNumber}: (unable to read file)`];
                            }
                            const block = [];
                            const start = contextValue > 0 ? Math.max(1, lineNumber - contextValue) : lineNumber;
                            const end = contextValue > 0 ? Math.min(lines.length, lineNumber + contextValue) : lineNumber;
                            for (let current = start; current <= end; current++) {
                                const lineText = (_a = lines[current - 1]) !== null && _a !== void 0 ? _a : "";
                                const sanitized = lineText.replace(/\r/g, "");
                                const isMatchLine = current === lineNumber;
                                // Truncate long lines
                                const { text: truncatedText, wasTruncated } = (0, truncate_js_1.truncateLine)(sanitized);
                                if (wasTruncated) {
                                    linesTruncated = true;
                                }
                                if (isMatchLine) {
                                    block.push(`${relativePath}:${current}: ${truncatedText}`);
                                }
                                else {
                                    block.push(`${relativePath}-${current}- ${truncatedText}`);
                                }
                            }
                            return block;
                        };
                        // Collect matches during streaming, format after
                        const matches = [];
                        rl.on("line", (line) => {
                            var _a, _b, _c;
                            if (!line.trim() || matchCount >= effectiveLimit) {
                                return;
                            }
                            let event;
                            try {
                                event = JSON.parse(line);
                            }
                            catch (_d) {
                                return;
                            }
                            if (event.type === "match") {
                                matchCount++;
                                const filePath = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.path) === null || _b === void 0 ? void 0 : _b.text;
                                const lineNumber = (_c = event.data) === null || _c === void 0 ? void 0 : _c.line_number;
                                if (filePath && typeof lineNumber === "number") {
                                    matches.push({ filePath, lineNumber });
                                }
                                if (matchCount >= effectiveLimit) {
                                    matchLimitReached = true;
                                    stopChild(true);
                                }
                            }
                        });
                        child.on("error", (error) => {
                            cleanup();
                            settle(() => reject(new Error(`Failed to run ripgrep: ${error.message}`)));
                        });
                        child.on("close", async (code) => {
                            cleanup();
                            if (aborted) {
                                settle(() => reject(new Error("Operation aborted")));
                                return;
                            }
                            if (!killedDueToLimit && code !== 0 && code !== 1) {
                                const errorMsg = stderr.trim() || `ripgrep exited with code ${code}`;
                                settle(() => reject(new Error(errorMsg)));
                                return;
                            }
                            if (matchCount === 0) {
                                settle(() => resolve({ content: [{ type: "text", text: "No matches found" }], details: undefined }));
                                return;
                            }
                            // Format matches (async to support remote file reading)
                            for (const match of matches) {
                                const block = await formatBlock(match.filePath, match.lineNumber);
                                outputLines.push(...block);
                            }
                            // Apply byte truncation (no line limit since we already have match limit)
                            const rawOutput = outputLines.join("\n");
                            const truncation = (0, truncate_js_1.truncateHead)(rawOutput, { maxLines: Number.MAX_SAFE_INTEGER });
                            let output = truncation.content;
                            const details = {};
                            // Build notices
                            const notices = [];
                            if (matchLimitReached) {
                                notices.push(`${effectiveLimit} matches limit reached. Use limit=${effectiveLimit * 2} for more, or refine pattern`);
                                details.matchLimitReached = effectiveLimit;
                            }
                            if (truncation.truncated) {
                                notices.push(`${(0, truncate_js_1.formatSize)(truncate_js_1.DEFAULT_MAX_BYTES)} limit reached`);
                                details.truncation = truncation;
                            }
                            if (linesTruncated) {
                                notices.push(`Some lines truncated to ${truncate_js_1.GREP_MAX_LINE_LENGTH} chars. Use read tool to see full lines`);
                                details.linesTruncated = true;
                            }
                            if (notices.length > 0) {
                                output += `\n\n[${notices.join(". ")}]`;
                            }
                            settle(() => resolve({
                                content: [{ type: "text", text: output }],
                                details: Object.keys(details).length > 0 ? details : undefined,
                            }));
                        });
                    }
                    catch (err) {
                        settle(() => reject(err));
                    }
                })();
            });
        },
    };
}
/** Default grep tool using process.cwd() - for backwards compatibility */
exports.grepTool = createGrepTool(process.cwd());
