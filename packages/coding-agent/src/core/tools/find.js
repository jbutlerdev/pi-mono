"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findTool = void 0;
exports.createFindTool = createFindTool;
const typebox_1 = require("@sinclair/typebox");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const glob_1 = require("glob");
const path_1 = __importDefault(require("path"));
const tools_manager_js_1 = require("../../utils/tools-manager.js");
const path_utils_js_1 = require("./path-utils.js");
const truncate_js_1 = require("./truncate.js");
const findSchema = typebox_1.Type.Object({
    pattern: typebox_1.Type.String({
        description: "Glob pattern to match files, e.g. '*.ts', '**/*.json', or 'src/**/*.spec.ts'",
    }),
    path: typebox_1.Type.Optional(typebox_1.Type.String({ description: "Directory to search in (default: current directory)" })),
    limit: typebox_1.Type.Optional(typebox_1.Type.Number({ description: "Maximum number of results (default: 1000)" })),
});
const DEFAULT_LIMIT = 1000;
const defaultFindOperations = {
    exists: fs_1.existsSync,
    glob: (_pattern, _searchCwd, _options) => {
        // This is a placeholder - actual fd execution happens in execute
        return [];
    },
};
function createFindTool(cwd, options) {
    const customOps = options === null || options === void 0 ? void 0 : options.operations;
    return {
        name: "find",
        label: "find",
        description: `Search for files by glob pattern. Returns matching file paths relative to the search directory. Respects .gitignore. Output is truncated to ${DEFAULT_LIMIT} results or ${truncate_js_1.DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first).`,
        parameters: findSchema,
        execute: async (_toolCallId, { pattern, path: searchDir, limit }, signal) => {
            return new Promise((resolve, reject) => {
                if (signal === null || signal === void 0 ? void 0 : signal.aborted) {
                    reject(new Error("Operation aborted"));
                    return;
                }
                const onAbort = () => reject(new Error("Operation aborted"));
                signal === null || signal === void 0 ? void 0 : signal.addEventListener("abort", onAbort, { once: true });
                (async () => {
                    var _a, _b;
                    try {
                        const searchPath = (0, path_utils_js_1.resolveToCwd)(searchDir || ".", cwd);
                        const effectiveLimit = limit !== null && limit !== void 0 ? limit : DEFAULT_LIMIT;
                        const ops = customOps !== null && customOps !== void 0 ? customOps : defaultFindOperations;
                        // If custom operations provided with glob, use that
                        if (customOps === null || customOps === void 0 ? void 0 : customOps.glob) {
                            if (!(await ops.exists(searchPath))) {
                                reject(new Error(`Path not found: ${searchPath}`));
                                return;
                            }
                            const results = await ops.glob(pattern, searchPath, {
                                ignore: ["**/node_modules/**", "**/.git/**"],
                                limit: effectiveLimit,
                            });
                            signal === null || signal === void 0 ? void 0 : signal.removeEventListener("abort", onAbort);
                            if (results.length === 0) {
                                resolve({
                                    content: [{ type: "text", text: "No files found matching pattern" }],
                                    details: undefined,
                                });
                                return;
                            }
                            // Relativize paths
                            const relativized = results.map((p) => {
                                if (p.startsWith(searchPath)) {
                                    return p.slice(searchPath.length + 1);
                                }
                                return path_1.default.relative(searchPath, p);
                            });
                            const resultLimitReached = relativized.length >= effectiveLimit;
                            const rawOutput = relativized.join("\n");
                            const truncation = (0, truncate_js_1.truncateHead)(rawOutput, { maxLines: Number.MAX_SAFE_INTEGER });
                            let resultOutput = truncation.content;
                            const details = {};
                            const notices = [];
                            if (resultLimitReached) {
                                notices.push(`${effectiveLimit} results limit reached`);
                                details.resultLimitReached = effectiveLimit;
                            }
                            if (truncation.truncated) {
                                notices.push(`${(0, truncate_js_1.formatSize)(truncate_js_1.DEFAULT_MAX_BYTES)} limit reached`);
                                details.truncation = truncation;
                            }
                            if (notices.length > 0) {
                                resultOutput += `\n\n[${notices.join(". ")}]`;
                            }
                            resolve({
                                content: [{ type: "text", text: resultOutput }],
                                details: Object.keys(details).length > 0 ? details : undefined,
                            });
                            return;
                        }
                        // Default: use fd
                        const fdPath = await (0, tools_manager_js_1.ensureTool)("fd", true);
                        if (!fdPath) {
                            reject(new Error("fd is not available and could not be downloaded"));
                            return;
                        }
                        // Build fd arguments
                        const args = [
                            "--glob",
                            "--color=never",
                            "--hidden",
                            "--max-results",
                            String(effectiveLimit),
                        ];
                        // Include .gitignore files
                        const gitignoreFiles = new Set();
                        const rootGitignore = path_1.default.join(searchPath, ".gitignore");
                        if ((0, fs_1.existsSync)(rootGitignore)) {
                            gitignoreFiles.add(rootGitignore);
                        }
                        try {
                            const nestedGitignores = (0, glob_1.globSync)("**/.gitignore", {
                                cwd: searchPath,
                                dot: true,
                                absolute: true,
                                ignore: ["**/node_modules/**", "**/.git/**"],
                            });
                            for (const file of nestedGitignores) {
                                gitignoreFiles.add(file);
                            }
                        }
                        catch (_c) {
                            // Ignore glob errors
                        }
                        for (const gitignorePath of gitignoreFiles) {
                            args.push("--ignore-file", gitignorePath);
                        }
                        args.push(pattern, searchPath);
                        const result = (0, child_process_1.spawnSync)(fdPath, args, {
                            encoding: "utf-8",
                            maxBuffer: 10 * 1024 * 1024,
                        });
                        signal === null || signal === void 0 ? void 0 : signal.removeEventListener("abort", onAbort);
                        if (result.error) {
                            reject(new Error(`Failed to run fd: ${result.error.message}`));
                            return;
                        }
                        const output = ((_a = result.stdout) === null || _a === void 0 ? void 0 : _a.trim()) || "";
                        if (result.status !== 0) {
                            const errorMsg = ((_b = result.stderr) === null || _b === void 0 ? void 0 : _b.trim()) || `fd exited with code ${result.status}`;
                            if (!output) {
                                reject(new Error(errorMsg));
                                return;
                            }
                        }
                        if (!output) {
                            resolve({
                                content: [{ type: "text", text: "No files found matching pattern" }],
                                details: undefined,
                            });
                            return;
                        }
                        const lines = output.split("\n");
                        const relativized = [];
                        for (const rawLine of lines) {
                            const line = rawLine.replace(/\r$/, "").trim();
                            if (!line)
                                continue;
                            const hadTrailingSlash = line.endsWith("/") || line.endsWith("\\");
                            let relativePath = line;
                            if (line.startsWith(searchPath)) {
                                relativePath = line.slice(searchPath.length + 1);
                            }
                            else {
                                relativePath = path_1.default.relative(searchPath, line);
                            }
                            if (hadTrailingSlash && !relativePath.endsWith("/")) {
                                relativePath += "/";
                            }
                            relativized.push(relativePath);
                        }
                        const resultLimitReached = relativized.length >= effectiveLimit;
                        const rawOutput = relativized.join("\n");
                        const truncation = (0, truncate_js_1.truncateHead)(rawOutput, { maxLines: Number.MAX_SAFE_INTEGER });
                        let resultOutput = truncation.content;
                        const details = {};
                        const notices = [];
                        if (resultLimitReached) {
                            notices.push(`${effectiveLimit} results limit reached. Use limit=${effectiveLimit * 2} for more, or refine pattern`);
                            details.resultLimitReached = effectiveLimit;
                        }
                        if (truncation.truncated) {
                            notices.push(`${(0, truncate_js_1.formatSize)(truncate_js_1.DEFAULT_MAX_BYTES)} limit reached`);
                            details.truncation = truncation;
                        }
                        if (notices.length > 0) {
                            resultOutput += `\n\n[${notices.join(". ")}]`;
                        }
                        resolve({
                            content: [{ type: "text", text: resultOutput }],
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
/** Default find tool using process.cwd() - for backwards compatibility */
exports.findTool = createFindTool(process.cwd());
