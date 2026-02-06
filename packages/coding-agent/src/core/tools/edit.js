"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.editTool = void 0;
exports.createEditTool = createEditTool;
const typebox_1 = require("@sinclair/typebox");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const edit_diff_js_1 = require("./edit-diff.js");
const path_utils_js_1 = require("./path-utils.js");
const editSchema = typebox_1.Type.Object({
    path: typebox_1.Type.String({ description: "Path to the file to edit (relative or absolute)" }),
    oldText: typebox_1.Type.String({ description: "Exact text to find and replace (must match exactly)" }),
    newText: typebox_1.Type.String({ description: "New text to replace the old text with" }),
});
const defaultEditOperations = {
    readFile: (path) => (0, promises_1.readFile)(path),
    writeFile: (path, content) => (0, promises_1.writeFile)(path, content, "utf-8"),
    access: (path) => (0, promises_1.access)(path, fs_1.constants.R_OK | fs_1.constants.W_OK),
};
function createEditTool(cwd, options) {
    var _a;
    const ops = (_a = options === null || options === void 0 ? void 0 : options.operations) !== null && _a !== void 0 ? _a : defaultEditOperations;
    return {
        name: "edit",
        label: "edit",
        description: "Edit a file by replacing exact text. The oldText must match exactly (including whitespace). Use this for precise, surgical edits.",
        parameters: editSchema,
        execute: async (_toolCallId, { path, oldText, newText }, signal) => {
            const absolutePath = (0, path_utils_js_1.resolveToCwd)(path, cwd);
            return new Promise((resolve, reject) => {
                // Check if already aborted
                if (signal === null || signal === void 0 ? void 0 : signal.aborted) {
                    reject(new Error("Operation aborted"));
                    return;
                }
                let aborted = false;
                // Set up abort handler
                const onAbort = () => {
                    aborted = true;
                    reject(new Error("Operation aborted"));
                };
                if (signal) {
                    signal.addEventListener("abort", onAbort, { once: true });
                }
                // Perform the edit operation
                (async () => {
                    try {
                        // Check if file exists
                        try {
                            await ops.access(absolutePath);
                        }
                        catch (_a) {
                            if (signal) {
                                signal.removeEventListener("abort", onAbort);
                            }
                            reject(new Error(`File not found: ${path}`));
                            return;
                        }
                        // Check if aborted before reading
                        if (aborted) {
                            return;
                        }
                        // Read the file
                        const buffer = await ops.readFile(absolutePath);
                        const rawContent = buffer.toString("utf-8");
                        // Check if aborted after reading
                        if (aborted) {
                            return;
                        }
                        // Strip BOM before matching (LLM won't include invisible BOM in oldText)
                        const { bom, text: content } = (0, edit_diff_js_1.stripBom)(rawContent);
                        const originalEnding = (0, edit_diff_js_1.detectLineEnding)(content);
                        const normalizedContent = (0, edit_diff_js_1.normalizeToLF)(content);
                        const normalizedOldText = (0, edit_diff_js_1.normalizeToLF)(oldText);
                        const normalizedNewText = (0, edit_diff_js_1.normalizeToLF)(newText);
                        // Find the old text using fuzzy matching (tries exact match first, then fuzzy)
                        const matchResult = (0, edit_diff_js_1.fuzzyFindText)(normalizedContent, normalizedOldText);
                        if (!matchResult.found) {
                            if (signal) {
                                signal.removeEventListener("abort", onAbort);
                            }
                            reject(new Error(`Could not find the exact text in ${path}. The old text must match exactly including all whitespace and newlines.`));
                            return;
                        }
                        // Count occurrences using fuzzy-normalized content for consistency
                        const fuzzyContent = (0, edit_diff_js_1.normalizeForFuzzyMatch)(normalizedContent);
                        const fuzzyOldText = (0, edit_diff_js_1.normalizeForFuzzyMatch)(normalizedOldText);
                        const occurrences = fuzzyContent.split(fuzzyOldText).length - 1;
                        if (occurrences > 1) {
                            if (signal) {
                                signal.removeEventListener("abort", onAbort);
                            }
                            reject(new Error(`Found ${occurrences} occurrences of the text in ${path}. The text must be unique. Please provide more context to make it unique.`));
                            return;
                        }
                        // Check if aborted before writing
                        if (aborted) {
                            return;
                        }
                        // Perform replacement using the matched text position
                        // When fuzzy matching was used, contentForReplacement is the normalized version
                        const baseContent = matchResult.contentForReplacement;
                        const newContent = baseContent.substring(0, matchResult.index) +
                            normalizedNewText +
                            baseContent.substring(matchResult.index + matchResult.matchLength);
                        // Verify the replacement actually changed something
                        if (baseContent === newContent) {
                            if (signal) {
                                signal.removeEventListener("abort", onAbort);
                            }
                            reject(new Error(`No changes made to ${path}. The replacement produced identical content. This might indicate an issue with special characters or the text not existing as expected.`));
                            return;
                        }
                        const finalContent = bom + (0, edit_diff_js_1.restoreLineEndings)(newContent, originalEnding);
                        await ops.writeFile(absolutePath, finalContent);
                        // Check if aborted after writing
                        if (aborted) {
                            return;
                        }
                        // Clean up abort handler
                        if (signal) {
                            signal.removeEventListener("abort", onAbort);
                        }
                        const diffResult = (0, edit_diff_js_1.generateDiffString)(baseContent, newContent);
                        resolve({
                            content: [
                                {
                                    type: "text",
                                    text: `Successfully replaced text in ${path}.`,
                                },
                            ],
                            details: { diff: diffResult.diff, firstChangedLine: diffResult.firstChangedLine },
                        });
                    }
                    catch (error) {
                        // Clean up abort handler
                        if (signal) {
                            signal.removeEventListener("abort", onAbort);
                        }
                        if (!aborted) {
                            reject(error);
                        }
                    }
                })();
            });
        },
    };
}
/** Default edit tool using process.cwd() - for backwards compatibility */
exports.editTool = createEditTool(process.cwd());
