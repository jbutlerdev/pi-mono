"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readTool = void 0;
exports.createReadTool = createReadTool;
const typebox_1 = require("@sinclair/typebox");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const image_resize_js_1 = require("../../utils/image-resize.js");
const mime_js_1 = require("../../utils/mime.js");
const path_utils_js_1 = require("./path-utils.js");
const truncate_js_1 = require("./truncate.js");
const readSchema = typebox_1.Type.Object({
    path: typebox_1.Type.String({ description: "Path to the file to read (relative or absolute)" }),
    offset: typebox_1.Type.Optional(typebox_1.Type.Number({ description: "Line number to start reading from (1-indexed)" })),
    limit: typebox_1.Type.Optional(typebox_1.Type.Number({ description: "Maximum number of lines to read" })),
});
const defaultReadOperations = {
    readFile: (path) => (0, promises_1.readFile)(path),
    access: (path) => (0, promises_1.access)(path, fs_1.constants.R_OK),
    detectImageMimeType: mime_js_1.detectSupportedImageMimeTypeFromFile,
};
function createReadTool(cwd, options) {
    var _a, _b;
    const autoResizeImages = (_a = options === null || options === void 0 ? void 0 : options.autoResizeImages) !== null && _a !== void 0 ? _a : true;
    const ops = (_b = options === null || options === void 0 ? void 0 : options.operations) !== null && _b !== void 0 ? _b : defaultReadOperations;
    return {
        name: "read",
        label: "read",
        description: `Read the contents of a file. Supports text files and images (jpg, png, gif, webp). Images are sent as attachments. For text files, output is truncated to ${truncate_js_1.DEFAULT_MAX_LINES} lines or ${truncate_js_1.DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first). Use offset/limit for large files. When you need the full file, continue with offset until complete.`,
        parameters: readSchema,
        execute: async (_toolCallId, { path, offset, limit }, signal) => {
            const absolutePath = (0, path_utils_js_1.resolveReadPath)(path, cwd);
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
                // Perform the read operation
                (async () => {
                    try {
                        // Check if file exists
                        await ops.access(absolutePath);
                        // Check if aborted before reading
                        if (aborted) {
                            return;
                        }
                        const mimeType = ops.detectImageMimeType ? await ops.detectImageMimeType(absolutePath) : undefined;
                        // Read the file based on type
                        let content;
                        let details;
                        if (mimeType) {
                            // Read as image (binary)
                            const buffer = await ops.readFile(absolutePath);
                            const base64 = buffer.toString("base64");
                            if (autoResizeImages) {
                                // Resize image if needed
                                const resized = await (0, image_resize_js_1.resizeImage)({ type: "image", data: base64, mimeType });
                                const dimensionNote = (0, image_resize_js_1.formatDimensionNote)(resized);
                                let textNote = `Read image file [${resized.mimeType}]`;
                                if (dimensionNote) {
                                    textNote += `\n${dimensionNote}`;
                                }
                                content = [
                                    { type: "text", text: textNote },
                                    { type: "image", data: resized.data, mimeType: resized.mimeType },
                                ];
                            }
                            else {
                                const textNote = `Read image file [${mimeType}]`;
                                content = [
                                    { type: "text", text: textNote },
                                    { type: "image", data: base64, mimeType },
                                ];
                            }
                        }
                        else {
                            // Read as text
                            const buffer = await ops.readFile(absolutePath);
                            const textContent = buffer.toString("utf-8");
                            const allLines = textContent.split("\n");
                            const totalFileLines = allLines.length;
                            // Apply offset if specified (1-indexed to 0-indexed)
                            const startLine = offset ? Math.max(0, offset - 1) : 0;
                            const startLineDisplay = startLine + 1; // For display (1-indexed)
                            // Check if offset is out of bounds
                            if (startLine >= allLines.length) {
                                throw new Error(`Offset ${offset} is beyond end of file (${allLines.length} lines total)`);
                            }
                            // If limit is specified by user, use it; otherwise we'll let truncateHead decide
                            let selectedContent;
                            let userLimitedLines;
                            if (limit !== undefined) {
                                const endLine = Math.min(startLine + limit, allLines.length);
                                selectedContent = allLines.slice(startLine, endLine).join("\n");
                                userLimitedLines = endLine - startLine;
                            }
                            else {
                                selectedContent = allLines.slice(startLine).join("\n");
                            }
                            // Apply truncation (respects both line and byte limits)
                            const truncation = (0, truncate_js_1.truncateHead)(selectedContent);
                            let outputText;
                            if (truncation.firstLineExceedsLimit) {
                                // First line at offset exceeds 30KB - tell model to use bash
                                const firstLineSize = (0, truncate_js_1.formatSize)(Buffer.byteLength(allLines[startLine], "utf-8"));
                                outputText = `[Line ${startLineDisplay} is ${firstLineSize}, exceeds ${(0, truncate_js_1.formatSize)(truncate_js_1.DEFAULT_MAX_BYTES)} limit. Use bash: sed -n '${startLineDisplay}p' ${path} | head -c ${truncate_js_1.DEFAULT_MAX_BYTES}]`;
                                details = { truncation };
                            }
                            else if (truncation.truncated) {
                                // Truncation occurred - build actionable notice
                                const endLineDisplay = startLineDisplay + truncation.outputLines - 1;
                                const nextOffset = endLineDisplay + 1;
                                outputText = truncation.content;
                                if (truncation.truncatedBy === "lines") {
                                    outputText += `\n\n[Showing lines ${startLineDisplay}-${endLineDisplay} of ${totalFileLines}. Use offset=${nextOffset} to continue.]`;
                                }
                                else {
                                    outputText += `\n\n[Showing lines ${startLineDisplay}-${endLineDisplay} of ${totalFileLines} (${(0, truncate_js_1.formatSize)(truncate_js_1.DEFAULT_MAX_BYTES)} limit). Use offset=${nextOffset} to continue.]`;
                                }
                                details = { truncation };
                            }
                            else if (userLimitedLines !== undefined && startLine + userLimitedLines < allLines.length) {
                                // User specified limit, there's more content, but no truncation
                                const remaining = allLines.length - (startLine + userLimitedLines);
                                const nextOffset = startLine + userLimitedLines + 1;
                                outputText = truncation.content;
                                outputText += `\n\n[${remaining} more lines in file. Use offset=${nextOffset} to continue.]`;
                            }
                            else {
                                // No truncation, no user limit exceeded
                                outputText = truncation.content;
                            }
                            content = [{ type: "text", text: outputText }];
                        }
                        // Check if aborted after reading
                        if (aborted) {
                            return;
                        }
                        // Clean up abort handler
                        if (signal) {
                            signal.removeEventListener("abort", onAbort);
                        }
                        resolve({ content, details });
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
/** Default read tool using process.cwd() - for backwards compatibility */
exports.readTool = createReadTool(process.cwd());
