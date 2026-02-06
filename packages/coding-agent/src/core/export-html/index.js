"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportSessionToHtml = exportSessionToHtml;
exports.exportFromFile = exportFromFile;
const fs_1 = require("fs");
const path_1 = require("path");
const config_js_1 = require("../../config.js");
const theme_js_1 = require("../../modes/interactive/theme/theme.js");
const session_manager_js_1 = require("../session-manager.js");
/** Parse a color string to RGB values. Supports hex (#RRGGBB) and rgb(r,g,b) formats. */
function parseColor(color) {
    const hexMatch = color.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
    if (hexMatch) {
        return {
            r: Number.parseInt(hexMatch[1], 16),
            g: Number.parseInt(hexMatch[2], 16),
            b: Number.parseInt(hexMatch[3], 16),
        };
    }
    const rgbMatch = color.match(/^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
    if (rgbMatch) {
        return {
            r: Number.parseInt(rgbMatch[1], 10),
            g: Number.parseInt(rgbMatch[2], 10),
            b: Number.parseInt(rgbMatch[3], 10),
        };
    }
    return undefined;
}
/** Calculate relative luminance of a color (0-1, higher = lighter). */
function getLuminance(r, g, b) {
    const toLinear = (c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow(((s + 0.055) / 1.055), 2.4);
    };
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}
/** Adjust color brightness. Factor > 1 lightens, < 1 darkens. */
function adjustBrightness(color, factor) {
    const parsed = parseColor(color);
    if (!parsed)
        return color;
    const adjust = (c) => Math.min(255, Math.max(0, Math.round(c * factor)));
    return `rgb(${adjust(parsed.r)}, ${adjust(parsed.g)}, ${adjust(parsed.b)})`;
}
/** Derive export background colors from a base color (e.g., userMessageBg). */
function deriveExportColors(baseColor) {
    const parsed = parseColor(baseColor);
    if (!parsed) {
        return {
            pageBg: "rgb(24, 24, 30)",
            cardBg: "rgb(30, 30, 36)",
            infoBg: "rgb(60, 55, 40)",
        };
    }
    const luminance = getLuminance(parsed.r, parsed.g, parsed.b);
    const isLight = luminance > 0.5;
    if (isLight) {
        return {
            pageBg: adjustBrightness(baseColor, 0.96),
            cardBg: baseColor,
            infoBg: `rgb(${Math.min(255, parsed.r + 10)}, ${Math.min(255, parsed.g + 5)}, ${Math.max(0, parsed.b - 20)})`,
        };
    }
    return {
        pageBg: adjustBrightness(baseColor, 0.7),
        cardBg: adjustBrightness(baseColor, 0.85),
        infoBg: `rgb(${Math.min(255, parsed.r + 20)}, ${Math.min(255, parsed.g + 15)}, ${parsed.b})`,
    };
}
/**
 * Generate CSS custom property declarations from theme colors.
 */
function generateThemeVars(themeName) {
    var _a, _b, _c;
    const colors = (0, theme_js_1.getResolvedThemeColors)(themeName);
    const lines = [];
    for (const [key, value] of Object.entries(colors)) {
        lines.push(`--${key}: ${value};`);
    }
    // Use explicit theme export colors if available, otherwise derive from userMessageBg
    const themeExport = (0, theme_js_1.getThemeExportColors)(themeName);
    const userMessageBg = colors.userMessageBg || "#343541";
    const derivedColors = deriveExportColors(userMessageBg);
    lines.push(`--exportPageBg: ${(_a = themeExport.pageBg) !== null && _a !== void 0 ? _a : derivedColors.pageBg};`);
    lines.push(`--exportCardBg: ${(_b = themeExport.cardBg) !== null && _b !== void 0 ? _b : derivedColors.cardBg};`);
    lines.push(`--exportInfoBg: ${(_c = themeExport.infoBg) !== null && _c !== void 0 ? _c : derivedColors.infoBg};`);
    return lines.join("\n      ");
}
/**
 * Core HTML generation logic shared by both export functions.
 */
function generateHtml(sessionData, themeName) {
    const templateDir = (0, config_js_1.getExportTemplateDir)();
    const template = (0, fs_1.readFileSync)((0, path_1.join)(templateDir, "template.html"), "utf-8");
    const templateCss = (0, fs_1.readFileSync)((0, path_1.join)(templateDir, "template.css"), "utf-8");
    const templateJs = (0, fs_1.readFileSync)((0, path_1.join)(templateDir, "template.js"), "utf-8");
    const markedJs = (0, fs_1.readFileSync)((0, path_1.join)(templateDir, "vendor", "marked.min.js"), "utf-8");
    const hljsJs = (0, fs_1.readFileSync)((0, path_1.join)(templateDir, "vendor", "highlight.min.js"), "utf-8");
    const themeVars = generateThemeVars(themeName);
    const colors = (0, theme_js_1.getResolvedThemeColors)(themeName);
    const exportColors = deriveExportColors(colors.userMessageBg || "#343541");
    const bodyBg = exportColors.pageBg;
    const containerBg = exportColors.cardBg;
    const infoBg = exportColors.infoBg;
    // Base64 encode session data to avoid escaping issues
    const sessionDataBase64 = Buffer.from(JSON.stringify(sessionData)).toString("base64");
    // Build the CSS with theme variables injected
    const css = templateCss
        .replace("{{THEME_VARS}}", themeVars)
        .replace("{{BODY_BG}}", bodyBg)
        .replace("{{CONTAINER_BG}}", containerBg)
        .replace("{{INFO_BG}}", infoBg);
    return template
        .replace("{{CSS}}", css)
        .replace("{{JS}}", templateJs)
        .replace("{{SESSION_DATA}}", sessionDataBase64)
        .replace("{{MARKED_JS}}", markedJs)
        .replace("{{HIGHLIGHT_JS}}", hljsJs);
}
/** Built-in tool names that have custom rendering in template.js */
const BUILTIN_TOOLS = new Set(["bash", "read", "write", "edit", "ls", "find", "grep"]);
/**
 * Pre-render custom tools to HTML using their TUI renderers.
 */
function preRenderCustomTools(entries, toolRenderer) {
    const renderedTools = {};
    for (const entry of entries) {
        if (entry.type !== "message")
            continue;
        const msg = entry.message;
        // Find tool calls in assistant messages
        if (msg.role === "assistant" && Array.isArray(msg.content)) {
            for (const block of msg.content) {
                if (block.type === "toolCall" && !BUILTIN_TOOLS.has(block.name)) {
                    const callHtml = toolRenderer.renderCall(block.name, block.arguments);
                    if (callHtml) {
                        renderedTools[block.id] = { callHtml };
                    }
                }
            }
        }
        // Find tool results
        if (msg.role === "toolResult" && msg.toolCallId) {
            const toolName = msg.toolName || "";
            // Only render if we have a pre-rendered call OR it's not a built-in tool
            const existing = renderedTools[msg.toolCallId];
            if (existing || !BUILTIN_TOOLS.has(toolName)) {
                const resultHtml = toolRenderer.renderResult(toolName, msg.content, msg.details, msg.isError || false);
                if (resultHtml) {
                    renderedTools[msg.toolCallId] = Object.assign(Object.assign({}, existing), { resultHtml });
                }
            }
        }
    }
    return renderedTools;
}
/**
 * Export session to HTML using SessionManager and AgentState.
 * Used by TUI's /export command.
 */
async function exportSessionToHtml(sm, state, options) {
    var _a;
    const opts = typeof options === "string" ? { outputPath: options } : options || {};
    const sessionFile = sm.getSessionFile();
    if (!sessionFile) {
        throw new Error("Cannot export in-memory session to HTML");
    }
    if (!(0, fs_1.existsSync)(sessionFile)) {
        throw new Error("Nothing to export yet - start a conversation first");
    }
    const entries = sm.getEntries();
    // Pre-render custom tools if a tool renderer is provided
    let renderedTools;
    if (opts.toolRenderer) {
        renderedTools = preRenderCustomTools(entries, opts.toolRenderer);
        // Only include if we actually rendered something
        if (Object.keys(renderedTools).length === 0) {
            renderedTools = undefined;
        }
    }
    const sessionData = {
        header: sm.getHeader(),
        entries,
        leafId: sm.getLeafId(),
        systemPrompt: state === null || state === void 0 ? void 0 : state.systemPrompt,
        tools: (_a = state === null || state === void 0 ? void 0 : state.tools) === null || _a === void 0 ? void 0 : _a.map((t) => ({ name: t.name, description: t.description })),
        renderedTools,
    };
    const html = generateHtml(sessionData, opts.themeName);
    let outputPath = opts.outputPath;
    if (!outputPath) {
        const sessionBasename = (0, path_1.basename)(sessionFile, ".jsonl");
        outputPath = `${config_js_1.APP_NAME}-session-${sessionBasename}.html`;
    }
    (0, fs_1.writeFileSync)(outputPath, html, "utf8");
    return outputPath;
}
/**
 * Export session file to HTML (standalone, without AgentState).
 * Used by CLI for exporting arbitrary session files.
 */
async function exportFromFile(inputPath, options) {
    const opts = typeof options === "string" ? { outputPath: options } : options || {};
    if (!(0, fs_1.existsSync)(inputPath)) {
        throw new Error(`File not found: ${inputPath}`);
    }
    const sm = session_manager_js_1.SessionManager.open(inputPath);
    const sessionData = {
        header: sm.getHeader(),
        entries: sm.getEntries(),
        leafId: sm.getLeafId(),
        systemPrompt: undefined,
        tools: undefined,
    };
    const html = generateHtml(sessionData, opts.themeName);
    let outputPath = opts.outputPath;
    if (!outputPath) {
        const inputBasename = (0, path_1.basename)(inputPath, ".jsonl");
        outputPath = `${config_js_1.APP_NAME}-session-${inputBasename}.html`;
    }
    (0, fs_1.writeFileSync)(outputPath, html, "utf8");
    return outputPath;
}
