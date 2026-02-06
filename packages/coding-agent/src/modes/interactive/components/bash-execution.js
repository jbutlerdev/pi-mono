"use strict";
/**
 * Component for displaying bash command execution with streaming output.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BashExecutionComponent = void 0;
const pi_tui_1 = require("@mariozechner/pi-tui");
const strip_ansi_1 = __importDefault(require("strip-ansi"));
const truncate_js_1 = require("../../../core/tools/truncate.js");
const theme_js_1 = require("../theme/theme.js");
const dynamic_border_js_1 = require("./dynamic-border.js");
const keybinding_hints_js_1 = require("./keybinding-hints.js");
const visual_truncate_js_1 = require("./visual-truncate.js");
// Preview line limit when not expanded (matches tool execution behavior)
const PREVIEW_LINES = 20;
class BashExecutionComponent extends pi_tui_1.Container {
    command;
    outputLines = [];
    status = "running";
    exitCode = undefined;
    loader;
    truncationResult;
    fullOutputPath;
    expanded = false;
    contentContainer;
    ui;
    constructor(command, ui, excludeFromContext = false) {
        super();
        this.command = command;
        this.ui = ui;
        // Use dim border for excluded-from-context commands (!! prefix)
        const colorKey = excludeFromContext ? "dim" : "bashMode";
        const borderColor = (str) => theme_js_1.theme.fg(colorKey, str);
        // Add spacer
        this.addChild(new pi_tui_1.Spacer(1));
        // Top border
        this.addChild(new dynamic_border_js_1.DynamicBorder(borderColor));
        // Content container (holds dynamic content between borders)
        this.contentContainer = new pi_tui_1.Container();
        this.addChild(this.contentContainer);
        // Command header
        const header = new pi_tui_1.Text(theme_js_1.theme.fg(colorKey, theme_js_1.theme.bold(`$ ${command}`)), 1, 0);
        this.contentContainer.addChild(header);
        // Loader
        this.loader = new pi_tui_1.Loader(ui, (spinner) => theme_js_1.theme.fg(colorKey, spinner), (text) => theme_js_1.theme.fg("muted", text), `Running... (${(0, keybinding_hints_js_1.editorKey)("selectCancel")} to cancel)`);
        this.contentContainer.addChild(this.loader);
        // Bottom border
        this.addChild(new dynamic_border_js_1.DynamicBorder(borderColor));
    }
    /**
     * Set whether the output is expanded (shows full output) or collapsed (preview only).
     */
    setExpanded(expanded) {
        this.expanded = expanded;
        this.updateDisplay();
    }
    invalidate() {
        super.invalidate();
        this.updateDisplay();
    }
    appendOutput(chunk) {
        // Strip ANSI codes and normalize line endings
        // Note: binary data is already sanitized in tui-renderer.ts executeBashCommand
        const clean = (0, strip_ansi_1.default)(chunk).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        // Append to output lines
        const newLines = clean.split("\n");
        if (this.outputLines.length > 0 && newLines.length > 0) {
            // Append first chunk to last line (incomplete line continuation)
            this.outputLines[this.outputLines.length - 1] += newLines[0];
            this.outputLines.push(...newLines.slice(1));
        }
        else {
            this.outputLines.push(...newLines);
        }
        this.updateDisplay();
    }
    setComplete(exitCode, cancelled, truncationResult, fullOutputPath) {
        this.exitCode = exitCode;
        this.status = cancelled
            ? "cancelled"
            : exitCode !== 0 && exitCode !== undefined && exitCode !== null
                ? "error"
                : "complete";
        this.truncationResult = truncationResult;
        this.fullOutputPath = fullOutputPath;
        // Stop loader
        this.loader.stop();
        this.updateDisplay();
    }
    updateDisplay() {
        var _a;
        // Apply truncation for LLM context limits (same limits as bash tool)
        const fullOutput = this.outputLines.join("\n");
        const contextTruncation = (0, truncate_js_1.truncateTail)(fullOutput, {
            maxLines: truncate_js_1.DEFAULT_MAX_LINES,
            maxBytes: truncate_js_1.DEFAULT_MAX_BYTES,
        });
        // Get the lines to potentially display (after context truncation)
        const availableLines = contextTruncation.content ? contextTruncation.content.split("\n") : [];
        // Apply preview truncation based on expanded state
        const previewLogicalLines = availableLines.slice(-PREVIEW_LINES);
        const hiddenLineCount = availableLines.length - previewLogicalLines.length;
        // Rebuild content container
        this.contentContainer.clear();
        // Command header
        const header = new pi_tui_1.Text(theme_js_1.theme.fg("bashMode", theme_js_1.theme.bold(`$ ${this.command}`)), 1, 0);
        this.contentContainer.addChild(header);
        // Output
        if (availableLines.length > 0) {
            if (this.expanded) {
                // Show all lines
                const displayText = availableLines.map((line) => theme_js_1.theme.fg("muted", line)).join("\n");
                this.contentContainer.addChild(new pi_tui_1.Text(`\n${displayText}`, 1, 0));
            }
            else {
                // Use shared visual truncation utility
                const styledOutput = previewLogicalLines.map((line) => theme_js_1.theme.fg("muted", line)).join("\n");
                const { visualLines } = (0, visual_truncate_js_1.truncateToVisualLines)(`\n${styledOutput}`, PREVIEW_LINES, this.ui.terminal.columns, 1);
                this.contentContainer.addChild({ render: () => visualLines, invalidate: () => { } });
            }
        }
        // Loader or status
        if (this.status === "running") {
            this.contentContainer.addChild(this.loader);
        }
        else {
            const statusParts = [];
            // Show how many lines are hidden (collapsed preview)
            if (hiddenLineCount > 0) {
                if (this.expanded) {
                    statusParts.push(`(${(0, keybinding_hints_js_1.keyHint)("expandTools", "to collapse")})`);
                }
                else {
                    statusParts.push(`${theme_js_1.theme.fg("muted", `... ${hiddenLineCount} more lines`)} (${(0, keybinding_hints_js_1.keyHint)("expandTools", "to expand")})`);
                }
            }
            if (this.status === "cancelled") {
                statusParts.push(theme_js_1.theme.fg("warning", "(cancelled)"));
            }
            else if (this.status === "error") {
                statusParts.push(theme_js_1.theme.fg("error", `(exit ${this.exitCode})`));
            }
            // Add truncation warning (context truncation, not preview truncation)
            const wasTruncated = ((_a = this.truncationResult) === null || _a === void 0 ? void 0 : _a.truncated) || contextTruncation.truncated;
            if (wasTruncated && this.fullOutputPath) {
                statusParts.push(theme_js_1.theme.fg("warning", `Output truncated. Full output: ${this.fullOutputPath}`));
            }
            if (statusParts.length > 0) {
                this.contentContainer.addChild(new pi_tui_1.Text(`\n${statusParts.join("\n")}`, 1, 0));
            }
        }
    }
    /**
     * Get the raw output for creating BashExecutionMessage.
     */
    getOutput() {
        return this.outputLines.join("\n");
    }
    /**
     * Get the command that was executed.
     */
    getCommand() {
        return this.command;
    }
}
exports.BashExecutionComponent = BashExecutionComponent;
