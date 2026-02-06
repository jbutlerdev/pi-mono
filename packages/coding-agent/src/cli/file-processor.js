"use strict";
/**
 * Process @file CLI arguments into text content and image attachments
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processFileArguments = processFileArguments;
const promises_1 = require("node:fs/promises");
const chalk_1 = __importDefault(require("chalk"));
const path_1 = require("path");
const path_utils_js_1 = require("../core/tools/path-utils.js");
const image_resize_js_1 = require("../utils/image-resize.js");
const mime_js_1 = require("../utils/mime.js");
/** Process @file arguments into text content and image attachments */
async function processFileArguments(fileArgs, options) {
    var _a;
    const autoResizeImages = (_a = options === null || options === void 0 ? void 0 : options.autoResizeImages) !== null && _a !== void 0 ? _a : true;
    let text = "";
    const images = [];
    for (const fileArg of fileArgs) {
        // Expand and resolve path (handles ~ expansion and macOS screenshot Unicode spaces)
        const absolutePath = (0, path_1.resolve)((0, path_utils_js_1.resolveReadPath)(fileArg, process.cwd()));
        // Check if file exists
        try {
            await (0, promises_1.access)(absolutePath);
        }
        catch (_b) {
            console.error(chalk_1.default.red(`Error: File not found: ${absolutePath}`));
            process.exit(1);
        }
        // Check if file is empty
        const stats = await (0, promises_1.stat)(absolutePath);
        if (stats.size === 0) {
            // Skip empty files
            continue;
        }
        const mimeType = await (0, mime_js_1.detectSupportedImageMimeTypeFromFile)(absolutePath);
        if (mimeType) {
            // Handle image file
            const content = await (0, promises_1.readFile)(absolutePath);
            const base64Content = content.toString("base64");
            let attachment;
            let dimensionNote;
            if (autoResizeImages) {
                const resized = await (0, image_resize_js_1.resizeImage)({ type: "image", data: base64Content, mimeType });
                dimensionNote = (0, image_resize_js_1.formatDimensionNote)(resized);
                attachment = {
                    type: "image",
                    mimeType: resized.mimeType,
                    data: resized.data,
                };
            }
            else {
                attachment = {
                    type: "image",
                    mimeType,
                    data: base64Content,
                };
            }
            images.push(attachment);
            // Add text reference to image with optional dimension note
            if (dimensionNote) {
                text += `<file name="${absolutePath}">${dimensionNote}</file>\n`;
            }
            else {
                text += `<file name="${absolutePath}"></file>\n`;
            }
        }
        else {
            // Handle text file
            try {
                const content = await (0, promises_1.readFile)(absolutePath, "utf-8");
                text += `<file name="${absolutePath}">\n${content}\n</file>\n`;
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                console.error(chalk_1.default.red(`Error: Could not read file ${absolutePath}: ${message}`));
                process.exit(1);
            }
        }
    }
    return { text, images };
}
