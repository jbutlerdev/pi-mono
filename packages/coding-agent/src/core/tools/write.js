"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeTool = void 0;
exports.createWriteTool = createWriteTool;
const typebox_1 = require("@sinclair/typebox");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const path_utils_js_1 = require("./path-utils.js");
const writeSchema = typebox_1.Type.Object({
    path: typebox_1.Type.String({ description: "Path to the file to write (relative or absolute)" }),
    content: typebox_1.Type.String({ description: "Content to write to the file" }),
});
const defaultWriteOperations = {
    writeFile: (path, content) => (0, promises_1.writeFile)(path, content, "utf-8"),
    mkdir: (dir) => (0, promises_1.mkdir)(dir, { recursive: true }).then(() => { }),
};
function createWriteTool(cwd, options) {
    var _a;
    const ops = (_a = options === null || options === void 0 ? void 0 : options.operations) !== null && _a !== void 0 ? _a : defaultWriteOperations;
    return {
        name: "write",
        label: "write",
        description: "Write content to a file. Creates the file if it doesn't exist, overwrites if it does. Automatically creates parent directories.",
        parameters: writeSchema,
        execute: async (_toolCallId, { path, content }, signal) => {
            const absolutePath = (0, path_utils_js_1.resolveToCwd)(path, cwd);
            const dir = (0, path_1.dirname)(absolutePath);
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
                // Perform the write operation
                (async () => {
                    try {
                        // Create parent directories if needed
                        await ops.mkdir(dir);
                        // Check if aborted before writing
                        if (aborted) {
                            return;
                        }
                        // Write the file
                        await ops.writeFile(absolutePath, content);
                        // Check if aborted after writing
                        if (aborted) {
                            return;
                        }
                        // Clean up abort handler
                        if (signal) {
                            signal.removeEventListener("abort", onAbort);
                        }
                        resolve({
                            content: [{ type: "text", text: `Successfully wrote ${content.length} bytes to ${path}` }],
                            details: undefined,
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
/** Default write tool using process.cwd() - for backwards compatibility */
exports.writeTool = createWriteTool(process.cwd());
