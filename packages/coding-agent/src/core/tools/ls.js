"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.lsTool = void 0;
exports.createLsTool = createLsTool;
const typebox_1 = require("@sinclair/typebox");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const path_utils_js_1 = require("./path-utils.js");
const truncate_js_1 = require("./truncate.js");
const lsSchema = typebox_1.Type.Object({
    path: typebox_1.Type.Optional(typebox_1.Type.String({ description: "Directory to list (default: current directory)" })),
    limit: typebox_1.Type.Optional(typebox_1.Type.Number({ description: "Maximum number of entries to return (default: 500)" })),
});
const DEFAULT_LIMIT = 500;
const defaultLsOperations = {
    exists: fs_1.existsSync,
    stat: fs_1.statSync,
    readdir: fs_1.readdirSync,
};
function createLsTool(cwd, options) {
    var _a;
    const ops = (_a = options === null || options === void 0 ? void 0 : options.operations) !== null && _a !== void 0 ? _a : defaultLsOperations;
    return {
        name: "ls",
        label: "ls",
        description: `List directory contents. Returns entries sorted alphabetically, with '/' suffix for directories. Includes dotfiles. Output is truncated to ${DEFAULT_LIMIT} entries or ${truncate_js_1.DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first).`,
        parameters: lsSchema,
        execute: async (_toolCallId, { path, limit }, signal) => {
            return new Promise((resolve, reject) => {
                if (signal === null || signal === void 0 ? void 0 : signal.aborted) {
                    reject(new Error("Operation aborted"));
                    return;
                }
                const onAbort = () => reject(new Error("Operation aborted"));
                signal === null || signal === void 0 ? void 0 : signal.addEventListener("abort", onAbort, { once: true });
                (async () => {
                    try {
                        const dirPath = (0, path_utils_js_1.resolveToCwd)(path || ".", cwd);
                        const effectiveLimit = limit !== null && limit !== void 0 ? limit : DEFAULT_LIMIT;
                        // Check if path exists
                        if (!(await ops.exists(dirPath))) {
                            reject(new Error(`Path not found: ${dirPath}`));
                            return;
                        }
                        // Check if path is a directory
                        const stat = await ops.stat(dirPath);
                        if (!stat.isDirectory()) {
                            reject(new Error(`Not a directory: ${dirPath}`));
                            return;
                        }
                        // Read directory entries
                        let entries;
                        try {
                            entries = await ops.readdir(dirPath);
                        }
                        catch (e) {
                            reject(new Error(`Cannot read directory: ${e.message}`));
                            return;
                        }
                        // Sort alphabetically (case-insensitive)
                        entries.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
                        // Format entries with directory indicators
                        const results = [];
                        let entryLimitReached = false;
                        for (const entry of entries) {
                            if (results.length >= effectiveLimit) {
                                entryLimitReached = true;
                                break;
                            }
                            const fullPath = path_1.default.join(dirPath, entry);
                            let suffix = "";
                            try {
                                const entryStat = await ops.stat(fullPath);
                                if (entryStat.isDirectory()) {
                                    suffix = "/";
                                }
                            }
                            catch (_a) {
                                // Skip entries we can't stat
                                continue;
                            }
                            results.push(entry + suffix);
                        }
                        signal === null || signal === void 0 ? void 0 : signal.removeEventListener("abort", onAbort);
                        if (results.length === 0) {
                            resolve({ content: [{ type: "text", text: "(empty directory)" }], details: undefined });
                            return;
                        }
                        // Apply byte truncation (no line limit since we already have entry limit)
                        const rawOutput = results.join("\n");
                        const truncation = (0, truncate_js_1.truncateHead)(rawOutput, { maxLines: Number.MAX_SAFE_INTEGER });
                        let output = truncation.content;
                        const details = {};
                        // Build notices
                        const notices = [];
                        if (entryLimitReached) {
                            notices.push(`${effectiveLimit} entries limit reached. Use limit=${effectiveLimit * 2} for more`);
                            details.entryLimitReached = effectiveLimit;
                        }
                        if (truncation.truncated) {
                            notices.push(`${(0, truncate_js_1.formatSize)(truncate_js_1.DEFAULT_MAX_BYTES)} limit reached`);
                            details.truncation = truncation;
                        }
                        if (notices.length > 0) {
                            output += `\n\n[${notices.join(". ")}]`;
                        }
                        resolve({
                            content: [{ type: "text", text: output }],
                            details: Object.keys(details).length > 0 ? details : undefined,
                        });
                    }
                    catch (e) {
                        signal === null || signal === void 0 ? void 0 : signal.removeEventListener("abort", onAbort);
                        reject(e);
                    }
                })();
            });
        },
    };
}
/** Default ls tool using process.cwd() - for backwards compatibility */
exports.lsTool = createLsTool(process.cwd());
