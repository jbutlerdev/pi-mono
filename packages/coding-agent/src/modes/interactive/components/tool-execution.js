"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolExecutionComponent = void 0;
const os = __importStar(require("node:os"));
const pi_tui_1 = require("@mariozechner/pi-tui");
const strip_ansi_1 = __importDefault(require("strip-ansi"));
const edit_diff_js_1 = require("../../../core/tools/edit-diff.js");
const index_js_1 = require("../../../core/tools/index.js");
const truncate_js_1 = require("../../../core/tools/truncate.js");
const image_convert_js_1 = require("../../../utils/image-convert.js");
const shell_js_1 = require("../../../utils/shell.js");
const theme_js_1 = require("../theme/theme.js");
const diff_js_1 = require("./diff.js");
const keybinding_hints_js_1 = require("./keybinding-hints.js");
const visual_truncate_js_1 = require("./visual-truncate.js");
// Preview line limit for bash when not expanded
const BASH_PREVIEW_LINES = 5;
/**
 * Convert absolute path to tilde notation if it's in home directory
 */
function shortenPath(path) {
    if (typeof path !== "string")
        return "";
    const home = os.homedir();
    if (path.startsWith(home)) {
        return `~${path.slice(home.length)}`;
    }
    return path;
}
/**
 * Replace tabs with spaces for consistent rendering
 */
function replaceTabs(text) {
    return text.replace(/\t/g, "   ");
}
/** Safely coerce value to string for display. Returns null if invalid type. */
function str(value) {
    if (typeof value === "string")
        return value;
    if (value == null)
        return "";
    return null; // Invalid type
}
/**
 * Component that renders a tool call with its result (updateable)
 */
class ToolExecutionComponent extends pi_tui_1.Container {
    contentBox; // Used for custom tools and bash visual truncation
    contentText; // For built-in tools (with its own padding/bg)
    imageComponents = [];
    imageSpacers = [];
    toolName;
    args;
    expanded = false;
    showImages;
    isPartial = true;
    toolDefinition;
    ui;
    cwd;
    result;
    // Cached edit diff preview (computed when args arrive, before tool executes)
    editDiffPreview;
    editDiffArgsKey; // Track which args the preview is for
    // Cached converted images for Kitty protocol (which requires PNG), keyed by index
    convertedImages = new Map();
    constructor(toolName, args, options = {}, toolDefinition, ui, cwd = process.cwd()) {
        var _a;
        super();
        this.toolName = toolName;
        this.args = args;
        this.showImages = (_a = options.showImages) !== null && _a !== void 0 ? _a : true;
        this.toolDefinition = toolDefinition;
        this.ui = ui;
        this.cwd = cwd;
        this.addChild(new pi_tui_1.Spacer(1));
        // Always create both - contentBox for custom tools/bash, contentText for other built-ins
        this.contentBox = new pi_tui_1.Box(1, 1, (text) => theme_js_1.theme.bg("toolPendingBg", text));
        this.contentText = new pi_tui_1.Text("", 1, 1, (text) => theme_js_1.theme.bg("toolPendingBg", text));
        // Use contentBox for bash (visual truncation) or custom tools with custom renderers
        // Use contentText for built-in tools (including overrides without custom renderers)
        if (toolName === "bash" || (toolDefinition && !this.shouldUseBuiltInRenderer())) {
            this.addChild(this.contentBox);
        }
        else {
            this.addChild(this.contentText);
        }
        this.updateDisplay();
    }
    /**
     * Check if we should use built-in rendering for this tool.
     * Returns true if the tool name is a built-in AND either there's no toolDefinition
     * or the toolDefinition doesn't provide custom renderers.
     */
    shouldUseBuiltInRenderer() {
        var _a, _b;
        const isBuiltInName = this.toolName in index_js_1.allTools;
        const hasCustomRenderers = ((_a = this.toolDefinition) === null || _a === void 0 ? void 0 : _a.renderCall) || ((_b = this.toolDefinition) === null || _b === void 0 ? void 0 : _b.renderResult);
        return isBuiltInName && !hasCustomRenderers;
    }
    updateArgs(args) {
        this.args = args;
        this.updateDisplay();
    }
    /**
     * Signal that args are complete (tool is about to execute).
     * This triggers diff computation for edit tool.
     */
    setArgsComplete() {
        this.maybeComputeEditDiff();
    }
    /**
     * Compute edit diff preview when we have complete args.
     * This runs async and updates display when done.
     */
    maybeComputeEditDiff() {
        var _a, _b, _c;
        if (this.toolName !== "edit")
            return;
        const path = (_a = this.args) === null || _a === void 0 ? void 0 : _a.path;
        const oldText = (_b = this.args) === null || _b === void 0 ? void 0 : _b.oldText;
        const newText = (_c = this.args) === null || _c === void 0 ? void 0 : _c.newText;
        // Need all three params to compute diff
        if (!path || oldText === undefined || newText === undefined)
            return;
        // Create a key to track which args this computation is for
        const argsKey = JSON.stringify({ path, oldText, newText });
        // Skip if we already computed for these exact args
        if (this.editDiffArgsKey === argsKey)
            return;
        this.editDiffArgsKey = argsKey;
        // Compute diff async
        (0, edit_diff_js_1.computeEditDiff)(path, oldText, newText, this.cwd).then((result) => {
            // Only update if args haven't changed since we started
            if (this.editDiffArgsKey === argsKey) {
                this.editDiffPreview = result;
                this.updateDisplay();
                this.ui.requestRender();
            }
        });
    }
    updateResult(result, isPartial = false) {
        this.result = result;
        this.isPartial = isPartial;
        this.updateDisplay();
        // Convert non-PNG images to PNG for Kitty protocol (async)
        this.maybeConvertImagesForKitty();
    }
    /**
     * Convert non-PNG images to PNG for Kitty graphics protocol.
     * Kitty requires PNG format (f=100), so JPEG/GIF/WebP won't display.
     */
    maybeConvertImagesForKitty() {
        var _a;
        const caps = (0, pi_tui_1.getCapabilities)();
        // Only needed for Kitty protocol
        if (caps.images !== "kitty")
            return;
        if (!this.result)
            return;
        const imageBlocks = ((_a = this.result.content) === null || _a === void 0 ? void 0 : _a.filter((c) => c.type === "image")) || [];
        for (let i = 0; i < imageBlocks.length; i++) {
            const img = imageBlocks[i];
            if (!img.data || !img.mimeType)
                continue;
            // Skip if already PNG or already converted
            if (img.mimeType === "image/png")
                continue;
            if (this.convertedImages.has(i))
                continue;
            // Convert async
            const index = i;
            (0, image_convert_js_1.convertToPng)(img.data, img.mimeType).then((converted) => {
                if (converted) {
                    this.convertedImages.set(index, converted);
                    this.updateDisplay();
                    this.ui.requestRender();
                }
            });
        }
    }
    setExpanded(expanded) {
        this.expanded = expanded;
        this.updateDisplay();
    }
    setShowImages(show) {
        this.showImages = show;
        this.updateDisplay();
    }
    invalidate() {
        super.invalidate();
        this.updateDisplay();
    }
    updateDisplay() {
        var _a, _b;
        var _c, _d;
        // Set background based on state
        const bgFn = this.isPartial
            ? (text) => theme_js_1.theme.bg("toolPendingBg", text)
            : ((_a = this.result) === null || _a === void 0 ? void 0 : _a.isError)
                ? (text) => theme_js_1.theme.bg("toolErrorBg", text)
                : (text) => theme_js_1.theme.bg("toolSuccessBg", text);
        // Use built-in rendering for built-in tools (or overrides without custom renderers)
        if (this.shouldUseBuiltInRenderer()) {
            if (this.toolName === "bash") {
                // Bash uses Box with visual line truncation
                this.contentBox.setBgFn(bgFn);
                this.contentBox.clear();
                this.renderBashContent();
            }
            else {
                // Other built-in tools: use Text directly with caching
                this.contentText.setCustomBgFn(bgFn);
                this.contentText.setText(this.formatToolExecution());
            }
        }
        else if (this.toolDefinition) {
            // Custom tools use Box for flexible component rendering
            this.contentBox.setBgFn(bgFn);
            this.contentBox.clear();
            // Render call component
            if (this.toolDefinition.renderCall) {
                try {
                    const callComponent = this.toolDefinition.renderCall(this.args, theme_js_1.theme);
                    if (callComponent) {
                        this.contentBox.addChild(callComponent);
                    }
                }
                catch (_e) {
                    // Fall back to default on error
                    this.contentBox.addChild(new pi_tui_1.Text(theme_js_1.theme.fg("toolTitle", theme_js_1.theme.bold(this.toolName)), 0, 0));
                }
            }
            else {
                // No custom renderCall, show tool name
                this.contentBox.addChild(new pi_tui_1.Text(theme_js_1.theme.fg("toolTitle", theme_js_1.theme.bold(this.toolName)), 0, 0));
            }
            // Render result component if we have a result
            if (this.result && this.toolDefinition.renderResult) {
                try {
                    const resultComponent = this.toolDefinition.renderResult({ content: this.result.content, details: this.result.details }, { expanded: this.expanded, isPartial: this.isPartial }, theme_js_1.theme);
                    if (resultComponent) {
                        this.contentBox.addChild(resultComponent);
                    }
                }
                catch (_f) {
                    // Fall back to showing raw output on error
                    const output = this.getTextOutput();
                    if (output) {
                        this.contentBox.addChild(new pi_tui_1.Text(theme_js_1.theme.fg("toolOutput", output), 0, 0));
                    }
                }
            }
            else if (this.result) {
                // Has result but no custom renderResult
                const output = this.getTextOutput();
                if (output) {
                    this.contentBox.addChild(new pi_tui_1.Text(theme_js_1.theme.fg("toolOutput", output), 0, 0));
                }
            }
        }
        // Handle images (same for both custom and built-in)
        for (const img of this.imageComponents) {
            this.removeChild(img);
        }
        this.imageComponents = [];
        for (const spacer of this.imageSpacers) {
            this.removeChild(spacer);
        }
        this.imageSpacers = [];
        if (this.result) {
            const imageBlocks = ((_b = this.result.content) === null || _b === void 0 ? void 0 : _b.filter((c) => c.type === "image")) || [];
            const caps = (0, pi_tui_1.getCapabilities)();
            for (let i = 0; i < imageBlocks.length; i++) {
                const img = imageBlocks[i];
                if (caps.images && this.showImages && img.data && img.mimeType) {
                    // Use converted PNG for Kitty protocol if available
                    const converted = this.convertedImages.get(i);
                    const imageData = (_c = converted === null || converted === void 0 ? void 0 : converted.data) !== null && _c !== void 0 ? _c : img.data;
                    const imageMimeType = (_d = converted === null || converted === void 0 ? void 0 : converted.mimeType) !== null && _d !== void 0 ? _d : img.mimeType;
                    // For Kitty, skip non-PNG images that haven't been converted yet
                    if (caps.images === "kitty" && imageMimeType !== "image/png") {
                        continue;
                    }
                    const spacer = new pi_tui_1.Spacer(1);
                    this.addChild(spacer);
                    this.imageSpacers.push(spacer);
                    const imageComponent = new pi_tui_1.Image(imageData, imageMimeType, { fallbackColor: (s) => theme_js_1.theme.fg("toolOutput", s) }, { maxWidthCells: 60 });
                    this.imageComponents.push(imageComponent);
                    this.addChild(imageComponent);
                }
            }
        }
    }
    /**
     * Render bash content using visual line truncation (like bash-execution.ts)
     */
    renderBashContent() {
        var _a, _b, _c, _d;
        var _e;
        const command = str((_a = this.args) === null || _a === void 0 ? void 0 : _a.command);
        const timeout = (_b = this.args) === null || _b === void 0 ? void 0 : _b.timeout;
        // Header
        const timeoutSuffix = timeout ? theme_js_1.theme.fg("muted", ` (timeout ${timeout}s)`) : "";
        const commandDisplay = command === null ? theme_js_1.theme.fg("error", "[invalid arg]") : command ? command : theme_js_1.theme.fg("toolOutput", "...");
        this.contentBox.addChild(new pi_tui_1.Text(theme_js_1.theme.fg("toolTitle", theme_js_1.theme.bold(`$ ${commandDisplay}`)) + timeoutSuffix, 0, 0));
        if (this.result) {
            const output = this.getTextOutput().trim();
            if (output) {
                // Style each line for the output
                const styledOutput = output
                    .split("\n")
                    .map((line) => theme_js_1.theme.fg("toolOutput", line))
                    .join("\n");
                if (this.expanded) {
                    // Show all lines when expanded
                    this.contentBox.addChild(new pi_tui_1.Text(`\n${styledOutput}`, 0, 0));
                }
                else {
                    // Use visual line truncation when collapsed with width-aware caching
                    let cachedWidth;
                    let cachedLines;
                    let cachedSkipped;
                    this.contentBox.addChild({
                        render: (width) => {
                            if (cachedLines === undefined || cachedWidth !== width) {
                                const result = (0, visual_truncate_js_1.truncateToVisualLines)(styledOutput, BASH_PREVIEW_LINES, width);
                                cachedLines = result.visualLines;
                                cachedSkipped = result.skippedCount;
                                cachedWidth = width;
                            }
                            if (cachedSkipped && cachedSkipped > 0) {
                                const hint = theme_js_1.theme.fg("muted", `... (${cachedSkipped} earlier lines,`) +
                                    ` ${(0, keybinding_hints_js_1.keyHint)("expandTools", "to expand")})`;
                                return ["", (0, pi_tui_1.truncateToWidth)(hint, width, "..."), ...cachedLines];
                            }
                            // Add blank line for spacing (matches expanded case)
                            return ["", ...cachedLines];
                        },
                        invalidate: () => {
                            cachedWidth = undefined;
                            cachedLines = undefined;
                            cachedSkipped = undefined;
                        },
                    });
                }
            }
            // Truncation warnings
            const truncation = (_c = this.result.details) === null || _c === void 0 ? void 0 : _c.truncation;
            const fullOutputPath = (_d = this.result.details) === null || _d === void 0 ? void 0 : _d.fullOutputPath;
            if ((truncation === null || truncation === void 0 ? void 0 : truncation.truncated) || fullOutputPath) {
                const warnings = [];
                if (fullOutputPath) {
                    warnings.push(`Full output: ${fullOutputPath}`);
                }
                if (truncation === null || truncation === void 0 ? void 0 : truncation.truncated) {
                    if (truncation.truncatedBy === "lines") {
                        warnings.push(`Truncated: showing ${truncation.outputLines} of ${truncation.totalLines} lines`);
                    }
                    else {
                        warnings.push(`Truncated: ${truncation.outputLines} lines shown (${(0, truncate_js_1.formatSize)((_e = truncation.maxBytes) !== null && _e !== void 0 ? _e : truncate_js_1.DEFAULT_MAX_BYTES)} limit)`);
                    }
                }
                this.contentBox.addChild(new pi_tui_1.Text(`\n${theme_js_1.theme.fg("warning", `[${warnings.join(". ")}]`)}`, 0, 0));
            }
        }
    }
    getTextOutput() {
        var _a, _b;
        if (!this.result)
            return "";
        const textBlocks = ((_a = this.result.content) === null || _a === void 0 ? void 0 : _a.filter((c) => c.type === "text")) || [];
        const imageBlocks = ((_b = this.result.content) === null || _b === void 0 ? void 0 : _b.filter((c) => c.type === "image")) || [];
        let output = textBlocks
            .map((c) => {
            // Use sanitizeBinaryOutput to handle binary data that crashes string-width
            return (0, shell_js_1.sanitizeBinaryOutput)((0, strip_ansi_1.default)(c.text || "")).replace(/\r/g, "");
        })
            .join("\n");
        const caps = (0, pi_tui_1.getCapabilities)();
        if (imageBlocks.length > 0 && (!caps.images || !this.showImages)) {
            const imageIndicators = imageBlocks
                .map((img) => {
                var _a;
                const dims = img.data ? ((_a = (0, pi_tui_1.getImageDimensions)(img.data, img.mimeType)) !== null && _a !== void 0 ? _a : undefined) : undefined;
                return (0, pi_tui_1.imageFallback)(img.mimeType, dims);
            })
                .join("\n");
            output = output ? `${output}\n${imageIndicators}` : imageIndicators;
        }
        return output;
    }
    formatToolExecution() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8;
        var _9, _10, _11, _12, _13, _14, _15, _16, _17, _18;
        let text = "";
        const invalidArg = theme_js_1.theme.fg("error", "[invalid arg]");
        if (this.toolName === "read") {
            const rawPath = str((_9 = (_a = this.args) === null || _a === void 0 ? void 0 : _a.file_path) !== null && _9 !== void 0 ? _9 : (_b = this.args) === null || _b === void 0 ? void 0 : _b.path);
            const path = rawPath !== null ? shortenPath(rawPath) : null;
            const offset = (_c = this.args) === null || _c === void 0 ? void 0 : _c.offset;
            const limit = (_d = this.args) === null || _d === void 0 ? void 0 : _d.limit;
            let pathDisplay = path === null ? invalidArg : path ? theme_js_1.theme.fg("accent", path) : theme_js_1.theme.fg("toolOutput", "...");
            if (offset !== undefined || limit !== undefined) {
                const startLine = offset !== null && offset !== void 0 ? offset : 1;
                const endLine = limit !== undefined ? startLine + limit - 1 : "";
                pathDisplay += theme_js_1.theme.fg("warning", `:${startLine}${endLine ? `-${endLine}` : ""}`);
            }
            text = `${theme_js_1.theme.fg("toolTitle", theme_js_1.theme.bold("read"))} ${pathDisplay}`;
            if (this.result) {
                const output = this.getTextOutput();
                const rawPath = str((_10 = (_e = this.args) === null || _e === void 0 ? void 0 : _e.file_path) !== null && _10 !== void 0 ? _10 : (_f = this.args) === null || _f === void 0 ? void 0 : _f.path);
                const lang = rawPath ? (0, theme_js_1.getLanguageFromPath)(rawPath) : undefined;
                const lines = lang ? (0, theme_js_1.highlightCode)(replaceTabs(output), lang) : output.split("\n");
                const maxLines = this.expanded ? lines.length : 10;
                const displayLines = lines.slice(0, maxLines);
                const remaining = lines.length - maxLines;
                text +=
                    "\n\n" +
                        displayLines
                            .map((line) => (lang ? replaceTabs(line) : theme_js_1.theme.fg("toolOutput", replaceTabs(line))))
                            .join("\n");
                if (remaining > 0) {
                    text += `${theme_js_1.theme.fg("muted", `\n... (${remaining} more lines,`)} ${(0, keybinding_hints_js_1.keyHint)("expandTools", "to expand")})`;
                }
                const truncation = (_g = this.result.details) === null || _g === void 0 ? void 0 : _g.truncation;
                if (truncation === null || truncation === void 0 ? void 0 : truncation.truncated) {
                    if (truncation.firstLineExceedsLimit) {
                        text +=
                            "\n" +
                                theme_js_1.theme.fg("warning", `[First line exceeds ${(0, truncate_js_1.formatSize)((_11 = truncation.maxBytes) !== null && _11 !== void 0 ? _11 : truncate_js_1.DEFAULT_MAX_BYTES)} limit]`);
                    }
                    else if (truncation.truncatedBy === "lines") {
                        text +=
                            "\n" +
                                theme_js_1.theme.fg("warning", `[Truncated: showing ${truncation.outputLines} of ${truncation.totalLines} lines (${(_12 = truncation.maxLines) !== null && _12 !== void 0 ? _12 : truncate_js_1.DEFAULT_MAX_LINES} line limit)]`);
                    }
                    else {
                        text +=
                            "\n" +
                                theme_js_1.theme.fg("warning", `[Truncated: ${truncation.outputLines} lines shown (${(0, truncate_js_1.formatSize)((_13 = truncation.maxBytes) !== null && _13 !== void 0 ? _13 : truncate_js_1.DEFAULT_MAX_BYTES)} limit)]`);
                    }
                }
            }
        }
        else if (this.toolName === "write") {
            const rawPath = str((_14 = (_h = this.args) === null || _h === void 0 ? void 0 : _h.file_path) !== null && _14 !== void 0 ? _14 : (_j = this.args) === null || _j === void 0 ? void 0 : _j.path);
            const fileContent = str((_k = this.args) === null || _k === void 0 ? void 0 : _k.content);
            const path = rawPath !== null ? shortenPath(rawPath) : null;
            text =
                theme_js_1.theme.fg("toolTitle", theme_js_1.theme.bold("write")) +
                    " " +
                    (path === null ? invalidArg : path ? theme_js_1.theme.fg("accent", path) : theme_js_1.theme.fg("toolOutput", "..."));
            if (fileContent === null) {
                text += `\n\n${theme_js_1.theme.fg("error", "[invalid content arg - expected string]")}`;
            }
            else if (fileContent) {
                const lang = rawPath ? (0, theme_js_1.getLanguageFromPath)(rawPath) : undefined;
                const lines = lang ? (0, theme_js_1.highlightCode)(replaceTabs(fileContent), lang) : fileContent.split("\n");
                const totalLines = lines.length;
                const maxLines = this.expanded ? lines.length : 10;
                const displayLines = lines.slice(0, maxLines);
                const remaining = lines.length - maxLines;
                text +=
                    "\n\n" +
                        displayLines
                            .map((line) => (lang ? replaceTabs(line) : theme_js_1.theme.fg("toolOutput", replaceTabs(line))))
                            .join("\n");
                if (remaining > 0) {
                    text +=
                        theme_js_1.theme.fg("muted", `\n... (${remaining} more lines, ${totalLines} total,`) +
                            ` ${(0, keybinding_hints_js_1.keyHint)("expandTools", "to expand")})`;
                }
            }
            // Show error if tool execution failed
            if ((_l = this.result) === null || _l === void 0 ? void 0 : _l.isError) {
                const errorText = this.getTextOutput();
                if (errorText) {
                    text += `\n\n${theme_js_1.theme.fg("error", errorText)}`;
                }
            }
        }
        else if (this.toolName === "edit") {
            const rawPath = str((_15 = (_m = this.args) === null || _m === void 0 ? void 0 : _m.file_path) !== null && _15 !== void 0 ? _15 : (_o = this.args) === null || _o === void 0 ? void 0 : _o.path);
            const path = rawPath !== null ? shortenPath(rawPath) : null;
            // Build path display, appending :line if we have diff info
            let pathDisplay = path === null ? invalidArg : path ? theme_js_1.theme.fg("accent", path) : theme_js_1.theme.fg("toolOutput", "...");
            const firstChangedLine = (this.editDiffPreview && "firstChangedLine" in this.editDiffPreview
                ? this.editDiffPreview.firstChangedLine
                : undefined) ||
                (this.result && !this.result.isError ? (_p = this.result.details) === null || _p === void 0 ? void 0 : _p.firstChangedLine : undefined);
            if (firstChangedLine) {
                pathDisplay += theme_js_1.theme.fg("warning", `:${firstChangedLine}`);
            }
            text = `${theme_js_1.theme.fg("toolTitle", theme_js_1.theme.bold("edit"))} ${pathDisplay}`;
            if ((_q = this.result) === null || _q === void 0 ? void 0 : _q.isError) {
                // Show error from result
                const errorText = this.getTextOutput();
                if (errorText) {
                    text += `\n\n${theme_js_1.theme.fg("error", errorText)}`;
                }
            }
            else if ((_s = (_r = this.result) === null || _r === void 0 ? void 0 : _r.details) === null || _s === void 0 ? void 0 : _s.diff) {
                // Tool executed successfully - use the diff from result
                // This takes priority over editDiffPreview which may have a stale error
                // due to race condition (async preview computed after file was modified)
                text += `\n\n${(0, diff_js_1.renderDiff)(this.result.details.diff, { filePath: rawPath !== null && rawPath !== void 0 ? rawPath : undefined })}`;
            }
            else if (this.editDiffPreview) {
                // Use cached diff preview (before tool executes)
                if ("error" in this.editDiffPreview) {
                    text += `\n\n${theme_js_1.theme.fg("error", this.editDiffPreview.error)}`;
                }
                else if (this.editDiffPreview.diff) {
                    text += `\n\n${(0, diff_js_1.renderDiff)(this.editDiffPreview.diff, { filePath: rawPath !== null && rawPath !== void 0 ? rawPath : undefined })}`;
                }
            }
        }
        else if (this.toolName === "ls") {
            const rawPath = str((_t = this.args) === null || _t === void 0 ? void 0 : _t.path);
            const path = rawPath !== null ? shortenPath(rawPath || ".") : null;
            const limit = (_u = this.args) === null || _u === void 0 ? void 0 : _u.limit;
            text = `${theme_js_1.theme.fg("toolTitle", theme_js_1.theme.bold("ls"))} ${path === null ? invalidArg : theme_js_1.theme.fg("accent", path)}`;
            if (limit !== undefined) {
                text += theme_js_1.theme.fg("toolOutput", ` (limit ${limit})`);
            }
            if (this.result) {
                const output = this.getTextOutput().trim();
                if (output) {
                    const lines = output.split("\n");
                    const maxLines = this.expanded ? lines.length : 20;
                    const displayLines = lines.slice(0, maxLines);
                    const remaining = lines.length - maxLines;
                    text += `\n\n${displayLines.map((line) => theme_js_1.theme.fg("toolOutput", line)).join("\n")}`;
                    if (remaining > 0) {
                        text += `${theme_js_1.theme.fg("muted", `\n... (${remaining} more lines,`)} ${(0, keybinding_hints_js_1.keyHint)("expandTools", "to expand")})`;
                    }
                }
                const entryLimit = (_v = this.result.details) === null || _v === void 0 ? void 0 : _v.entryLimitReached;
                const truncation = (_w = this.result.details) === null || _w === void 0 ? void 0 : _w.truncation;
                if (entryLimit || (truncation === null || truncation === void 0 ? void 0 : truncation.truncated)) {
                    const warnings = [];
                    if (entryLimit) {
                        warnings.push(`${entryLimit} entries limit`);
                    }
                    if (truncation === null || truncation === void 0 ? void 0 : truncation.truncated) {
                        warnings.push(`${(0, truncate_js_1.formatSize)((_16 = truncation.maxBytes) !== null && _16 !== void 0 ? _16 : truncate_js_1.DEFAULT_MAX_BYTES)} limit`);
                    }
                    text += `\n${theme_js_1.theme.fg("warning", `[Truncated: ${warnings.join(", ")}]`)}`;
                }
            }
        }
        else if (this.toolName === "find") {
            const pattern = str((_x = this.args) === null || _x === void 0 ? void 0 : _x.pattern);
            const rawPath = str((_y = this.args) === null || _y === void 0 ? void 0 : _y.path);
            const path = rawPath !== null ? shortenPath(rawPath || ".") : null;
            const limit = (_z = this.args) === null || _z === void 0 ? void 0 : _z.limit;
            text =
                theme_js_1.theme.fg("toolTitle", theme_js_1.theme.bold("find")) +
                    " " +
                    (pattern === null ? invalidArg : theme_js_1.theme.fg("accent", pattern || "")) +
                    theme_js_1.theme.fg("toolOutput", ` in ${path === null ? invalidArg : path}`);
            if (limit !== undefined) {
                text += theme_js_1.theme.fg("toolOutput", ` (limit ${limit})`);
            }
            if (this.result) {
                const output = this.getTextOutput().trim();
                if (output) {
                    const lines = output.split("\n");
                    const maxLines = this.expanded ? lines.length : 20;
                    const displayLines = lines.slice(0, maxLines);
                    const remaining = lines.length - maxLines;
                    text += `\n\n${displayLines.map((line) => theme_js_1.theme.fg("toolOutput", line)).join("\n")}`;
                    if (remaining > 0) {
                        text += `${theme_js_1.theme.fg("muted", `\n... (${remaining} more lines,`)} ${(0, keybinding_hints_js_1.keyHint)("expandTools", "to expand")})`;
                    }
                }
                const resultLimit = (_0 = this.result.details) === null || _0 === void 0 ? void 0 : _0.resultLimitReached;
                const truncation = (_1 = this.result.details) === null || _1 === void 0 ? void 0 : _1.truncation;
                if (resultLimit || (truncation === null || truncation === void 0 ? void 0 : truncation.truncated)) {
                    const warnings = [];
                    if (resultLimit) {
                        warnings.push(`${resultLimit} results limit`);
                    }
                    if (truncation === null || truncation === void 0 ? void 0 : truncation.truncated) {
                        warnings.push(`${(0, truncate_js_1.formatSize)((_17 = truncation.maxBytes) !== null && _17 !== void 0 ? _17 : truncate_js_1.DEFAULT_MAX_BYTES)} limit`);
                    }
                    text += `\n${theme_js_1.theme.fg("warning", `[Truncated: ${warnings.join(", ")}]`)}`;
                }
            }
        }
        else if (this.toolName === "grep") {
            const pattern = str((_2 = this.args) === null || _2 === void 0 ? void 0 : _2.pattern);
            const rawPath = str((_3 = this.args) === null || _3 === void 0 ? void 0 : _3.path);
            const path = rawPath !== null ? shortenPath(rawPath || ".") : null;
            const glob = str((_4 = this.args) === null || _4 === void 0 ? void 0 : _4.glob);
            const limit = (_5 = this.args) === null || _5 === void 0 ? void 0 : _5.limit;
            text =
                theme_js_1.theme.fg("toolTitle", theme_js_1.theme.bold("grep")) +
                    " " +
                    (pattern === null ? invalidArg : theme_js_1.theme.fg("accent", `/${pattern || ""}/`)) +
                    theme_js_1.theme.fg("toolOutput", ` in ${path === null ? invalidArg : path}`);
            if (glob) {
                text += theme_js_1.theme.fg("toolOutput", ` (${glob})`);
            }
            if (limit !== undefined) {
                text += theme_js_1.theme.fg("toolOutput", ` limit ${limit}`);
            }
            if (this.result) {
                const output = this.getTextOutput().trim();
                if (output) {
                    const lines = output.split("\n");
                    const maxLines = this.expanded ? lines.length : 15;
                    const displayLines = lines.slice(0, maxLines);
                    const remaining = lines.length - maxLines;
                    text += `\n\n${displayLines.map((line) => theme_js_1.theme.fg("toolOutput", line)).join("\n")}`;
                    if (remaining > 0) {
                        text += `${theme_js_1.theme.fg("muted", `\n... (${remaining} more lines,`)} ${(0, keybinding_hints_js_1.keyHint)("expandTools", "to expand")})`;
                    }
                }
                const matchLimit = (_6 = this.result.details) === null || _6 === void 0 ? void 0 : _6.matchLimitReached;
                const truncation = (_7 = this.result.details) === null || _7 === void 0 ? void 0 : _7.truncation;
                const linesTruncated = (_8 = this.result.details) === null || _8 === void 0 ? void 0 : _8.linesTruncated;
                if (matchLimit || (truncation === null || truncation === void 0 ? void 0 : truncation.truncated) || linesTruncated) {
                    const warnings = [];
                    if (matchLimit) {
                        warnings.push(`${matchLimit} matches limit`);
                    }
                    if (truncation === null || truncation === void 0 ? void 0 : truncation.truncated) {
                        warnings.push(`${(0, truncate_js_1.formatSize)((_18 = truncation.maxBytes) !== null && _18 !== void 0 ? _18 : truncate_js_1.DEFAULT_MAX_BYTES)} limit`);
                    }
                    if (linesTruncated) {
                        warnings.push("some lines truncated");
                    }
                    text += `\n${theme_js_1.theme.fg("warning", `[Truncated: ${warnings.join(", ")}]`)}`;
                }
            }
        }
        else {
            // Generic tool (shouldn't reach here for custom tools)
            text = theme_js_1.theme.fg("toolTitle", theme_js_1.theme.bold(this.toolName));
            const content = JSON.stringify(this.args, null, 2);
            text += `\n\n${content}`;
            const output = this.getTextOutput();
            if (output) {
                text += `\n${output}`;
            }
        }
        return text;
    }
}
exports.ToolExecutionComponent = ToolExecutionComponent;
