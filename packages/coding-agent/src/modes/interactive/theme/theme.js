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
exports.theme = exports.Theme = void 0;
exports.getAvailableThemes = getAvailableThemes;
exports.getAvailableThemesWithPaths = getAvailableThemesWithPaths;
exports.loadThemeFromPath = loadThemeFromPath;
exports.getThemeByName = getThemeByName;
exports.setRegisteredThemes = setRegisteredThemes;
exports.initTheme = initTheme;
exports.setTheme = setTheme;
exports.setThemeInstance = setThemeInstance;
exports.onThemeChange = onThemeChange;
exports.stopThemeWatcher = stopThemeWatcher;
exports.getResolvedThemeColors = getResolvedThemeColors;
exports.isLightTheme = isLightTheme;
exports.getThemeExportColors = getThemeExportColors;
exports.highlightCode = highlightCode;
exports.getLanguageFromPath = getLanguageFromPath;
exports.getMarkdownTheme = getMarkdownTheme;
exports.getSelectListTheme = getSelectListTheme;
exports.getEditorTheme = getEditorTheme;
exports.getSettingsListTheme = getSettingsListTheme;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const typebox_1 = require("@sinclair/typebox");
const compiler_1 = require("@sinclair/typebox/compiler");
const chalk_1 = __importDefault(require("chalk"));
const cli_highlight_1 = require("cli-highlight");
const config_js_1 = require("../../../config.js");
// ============================================================================
// Types & Schema
// ============================================================================
const ColorValueSchema = typebox_1.Type.Union([
    typebox_1.Type.String(), // hex "#ff0000", var ref "primary", or empty ""
    typebox_1.Type.Integer({ minimum: 0, maximum: 255 }), // 256-color index
]);
const ThemeJsonSchema = typebox_1.Type.Object({
    $schema: typebox_1.Type.Optional(typebox_1.Type.String()),
    name: typebox_1.Type.String(),
    vars: typebox_1.Type.Optional(typebox_1.Type.Record(typebox_1.Type.String(), ColorValueSchema)),
    colors: typebox_1.Type.Object({
        // Core UI (10 colors)
        accent: ColorValueSchema,
        border: ColorValueSchema,
        borderAccent: ColorValueSchema,
        borderMuted: ColorValueSchema,
        success: ColorValueSchema,
        error: ColorValueSchema,
        warning: ColorValueSchema,
        muted: ColorValueSchema,
        dim: ColorValueSchema,
        text: ColorValueSchema,
        thinkingText: ColorValueSchema,
        // Backgrounds & Content Text (11 colors)
        selectedBg: ColorValueSchema,
        userMessageBg: ColorValueSchema,
        userMessageText: ColorValueSchema,
        customMessageBg: ColorValueSchema,
        customMessageText: ColorValueSchema,
        customMessageLabel: ColorValueSchema,
        toolPendingBg: ColorValueSchema,
        toolSuccessBg: ColorValueSchema,
        toolErrorBg: ColorValueSchema,
        toolTitle: ColorValueSchema,
        toolOutput: ColorValueSchema,
        // Markdown (10 colors)
        mdHeading: ColorValueSchema,
        mdLink: ColorValueSchema,
        mdLinkUrl: ColorValueSchema,
        mdCode: ColorValueSchema,
        mdCodeBlock: ColorValueSchema,
        mdCodeBlockBorder: ColorValueSchema,
        mdQuote: ColorValueSchema,
        mdQuoteBorder: ColorValueSchema,
        mdHr: ColorValueSchema,
        mdListBullet: ColorValueSchema,
        // Tool Diffs (3 colors)
        toolDiffAdded: ColorValueSchema,
        toolDiffRemoved: ColorValueSchema,
        toolDiffContext: ColorValueSchema,
        // Syntax Highlighting (9 colors)
        syntaxComment: ColorValueSchema,
        syntaxKeyword: ColorValueSchema,
        syntaxFunction: ColorValueSchema,
        syntaxVariable: ColorValueSchema,
        syntaxString: ColorValueSchema,
        syntaxNumber: ColorValueSchema,
        syntaxType: ColorValueSchema,
        syntaxOperator: ColorValueSchema,
        syntaxPunctuation: ColorValueSchema,
        // Thinking Level Borders (6 colors)
        thinkingOff: ColorValueSchema,
        thinkingMinimal: ColorValueSchema,
        thinkingLow: ColorValueSchema,
        thinkingMedium: ColorValueSchema,
        thinkingHigh: ColorValueSchema,
        thinkingXhigh: ColorValueSchema,
        // Bash Mode (1 color)
        bashMode: ColorValueSchema,
    }),
    export: typebox_1.Type.Optional(typebox_1.Type.Object({
        pageBg: typebox_1.Type.Optional(ColorValueSchema),
        cardBg: typebox_1.Type.Optional(ColorValueSchema),
        infoBg: typebox_1.Type.Optional(ColorValueSchema),
    })),
});
const validateThemeJson = compiler_1.TypeCompiler.Compile(ThemeJsonSchema);
// ============================================================================
// Color Utilities
// ============================================================================
function detectColorMode() {
    const colorterm = process.env.COLORTERM;
    if (colorterm === "truecolor" || colorterm === "24bit") {
        return "truecolor";
    }
    // Windows Terminal supports truecolor
    if (process.env.WT_SESSION) {
        return "truecolor";
    }
    const term = process.env.TERM || "";
    // Fall back to 256color for truly limited terminals
    if (term === "dumb" || term === "" || term === "linux") {
        return "256color";
    }
    // Terminal.app also doesn't support truecolor
    if (process.env.TERM_PROGRAM === "Apple_Terminal") {
        return "256color";
    }
    // Assume truecolor for everything else - virtually all modern terminals support it
    return "truecolor";
}
function hexToRgb(hex) {
    const cleaned = hex.replace("#", "");
    if (cleaned.length !== 6) {
        throw new Error(`Invalid hex color: ${hex}`);
    }
    const r = parseInt(cleaned.substring(0, 2), 16);
    const g = parseInt(cleaned.substring(2, 4), 16);
    const b = parseInt(cleaned.substring(4, 6), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
        throw new Error(`Invalid hex color: ${hex}`);
    }
    return { r, g, b };
}
// The 6x6x6 color cube channel values (indices 0-5)
const CUBE_VALUES = [0, 95, 135, 175, 215, 255];
// Grayscale ramp values (indices 232-255, 24 grays from 8 to 238)
const GRAY_VALUES = Array.from({ length: 24 }, (_, i) => 8 + i * 10);
function findClosestCubeIndex(value) {
    let minDist = Infinity;
    let minIdx = 0;
    for (let i = 0; i < CUBE_VALUES.length; i++) {
        const dist = Math.abs(value - CUBE_VALUES[i]);
        if (dist < minDist) {
            minDist = dist;
            minIdx = i;
        }
    }
    return minIdx;
}
function findClosestGrayIndex(gray) {
    let minDist = Infinity;
    let minIdx = 0;
    for (let i = 0; i < GRAY_VALUES.length; i++) {
        const dist = Math.abs(gray - GRAY_VALUES[i]);
        if (dist < minDist) {
            minDist = dist;
            minIdx = i;
        }
    }
    return minIdx;
}
function colorDistance(r1, g1, b1, r2, g2, b2) {
    // Weighted Euclidean distance (human eye is more sensitive to green)
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114;
}
function rgbTo256(r, g, b) {
    // Find closest color in the 6x6x6 cube
    const rIdx = findClosestCubeIndex(r);
    const gIdx = findClosestCubeIndex(g);
    const bIdx = findClosestCubeIndex(b);
    const cubeR = CUBE_VALUES[rIdx];
    const cubeG = CUBE_VALUES[gIdx];
    const cubeB = CUBE_VALUES[bIdx];
    const cubeIndex = 16 + 36 * rIdx + 6 * gIdx + bIdx;
    const cubeDist = colorDistance(r, g, b, cubeR, cubeG, cubeB);
    // Find closest grayscale
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    const grayIdx = findClosestGrayIndex(gray);
    const grayValue = GRAY_VALUES[grayIdx];
    const grayIndex = 232 + grayIdx;
    const grayDist = colorDistance(r, g, b, grayValue, grayValue, grayValue);
    // Check if color has noticeable saturation (hue matters)
    // If max-min spread is significant, prefer cube to preserve tint
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const spread = maxC - minC;
    // Only consider grayscale if color is nearly neutral (spread < 10)
    // AND grayscale is actually closer
    if (spread < 10 && grayDist < cubeDist) {
        return grayIndex;
    }
    return cubeIndex;
}
function hexTo256(hex) {
    const { r, g, b } = hexToRgb(hex);
    return rgbTo256(r, g, b);
}
function fgAnsi(color, mode) {
    if (color === "")
        return "\x1b[39m";
    if (typeof color === "number")
        return `\x1b[38;5;${color}m`;
    if (color.startsWith("#")) {
        if (mode === "truecolor") {
            const { r, g, b } = hexToRgb(color);
            return `\x1b[38;2;${r};${g};${b}m`;
        }
        else {
            const index = hexTo256(color);
            return `\x1b[38;5;${index}m`;
        }
    }
    throw new Error(`Invalid color value: ${color}`);
}
function bgAnsi(color, mode) {
    if (color === "")
        return "\x1b[49m";
    if (typeof color === "number")
        return `\x1b[48;5;${color}m`;
    if (color.startsWith("#")) {
        if (mode === "truecolor") {
            const { r, g, b } = hexToRgb(color);
            return `\x1b[48;2;${r};${g};${b}m`;
        }
        else {
            const index = hexTo256(color);
            return `\x1b[48;5;${index}m`;
        }
    }
    throw new Error(`Invalid color value: ${color}`);
}
function resolveVarRefs(value, vars, visited = new Set()) {
    if (typeof value === "number" || value === "" || value.startsWith("#")) {
        return value;
    }
    if (visited.has(value)) {
        throw new Error(`Circular variable reference detected: ${value}`);
    }
    if (!(value in vars)) {
        throw new Error(`Variable reference not found: ${value}`);
    }
    visited.add(value);
    return resolveVarRefs(vars[value], vars, visited);
}
function resolveThemeColors(colors, vars = {}) {
    const resolved = {};
    for (const [key, value] of Object.entries(colors)) {
        resolved[key] = resolveVarRefs(value, vars);
    }
    return resolved;
}
// ============================================================================
// Theme Class
// ============================================================================
class Theme {
    name;
    sourcePath;
    fgColors;
    bgColors;
    mode;
    constructor(fgColors, bgColors, mode, options = {}) {
        this.name = options.name;
        this.sourcePath = options.sourcePath;
        this.mode = mode;
        this.fgColors = new Map();
        for (const [key, value] of Object.entries(fgColors)) {
            this.fgColors.set(key, fgAnsi(value, mode));
        }
        this.bgColors = new Map();
        for (const [key, value] of Object.entries(bgColors)) {
            this.bgColors.set(key, bgAnsi(value, mode));
        }
    }
    fg(color, text) {
        const ansi = this.fgColors.get(color);
        if (!ansi)
            throw new Error(`Unknown theme color: ${color}`);
        return `${ansi}${text}\x1b[39m`; // Reset only foreground color
    }
    bg(color, text) {
        const ansi = this.bgColors.get(color);
        if (!ansi)
            throw new Error(`Unknown theme background color: ${color}`);
        return `${ansi}${text}\x1b[49m`; // Reset only background color
    }
    bold(text) {
        return chalk_1.default.bold(text);
    }
    italic(text) {
        return chalk_1.default.italic(text);
    }
    underline(text) {
        return chalk_1.default.underline(text);
    }
    inverse(text) {
        return chalk_1.default.inverse(text);
    }
    strikethrough(text) {
        return chalk_1.default.strikethrough(text);
    }
    getFgAnsi(color) {
        const ansi = this.fgColors.get(color);
        if (!ansi)
            throw new Error(`Unknown theme color: ${color}`);
        return ansi;
    }
    getBgAnsi(color) {
        const ansi = this.bgColors.get(color);
        if (!ansi)
            throw new Error(`Unknown theme background color: ${color}`);
        return ansi;
    }
    getColorMode() {
        return this.mode;
    }
    getThinkingBorderColor(level) {
        // Map thinking levels to dedicated theme colors
        switch (level) {
            case "off":
                return (str) => this.fg("thinkingOff", str);
            case "minimal":
                return (str) => this.fg("thinkingMinimal", str);
            case "low":
                return (str) => this.fg("thinkingLow", str);
            case "medium":
                return (str) => this.fg("thinkingMedium", str);
            case "high":
                return (str) => this.fg("thinkingHigh", str);
            case "xhigh":
                return (str) => this.fg("thinkingXhigh", str);
            default:
                return (str) => this.fg("thinkingOff", str);
        }
    }
    getBashModeBorderColor() {
        return (str) => this.fg("bashMode", str);
    }
}
exports.Theme = Theme;
// ============================================================================
// Theme Loading
// ============================================================================
let BUILTIN_THEMES;
function getBuiltinThemes() {
    if (!BUILTIN_THEMES) {
        const themesDir = (0, config_js_1.getThemesDir)();
        const darkPath = path.join(themesDir, "dark.json");
        const lightPath = path.join(themesDir, "light.json");
        BUILTIN_THEMES = {
            dark: JSON.parse(fs.readFileSync(darkPath, "utf-8")),
            light: JSON.parse(fs.readFileSync(lightPath, "utf-8")),
        };
    }
    return BUILTIN_THEMES;
}
function getAvailableThemes() {
    const themes = new Set(Object.keys(getBuiltinThemes()));
    const customThemesDir = (0, config_js_1.getCustomThemesDir)();
    if (fs.existsSync(customThemesDir)) {
        const files = fs.readdirSync(customThemesDir);
        for (const file of files) {
            if (file.endsWith(".json")) {
                themes.add(file.slice(0, -5));
            }
        }
    }
    for (const name of registeredThemes.keys()) {
        themes.add(name);
    }
    return Array.from(themes).sort();
}
function getAvailableThemesWithPaths() {
    const themesDir = (0, config_js_1.getThemesDir)();
    const customThemesDir = (0, config_js_1.getCustomThemesDir)();
    const result = [];
    // Built-in themes
    for (const name of Object.keys(getBuiltinThemes())) {
        result.push({ name, path: path.join(themesDir, `${name}.json`) });
    }
    // Custom themes
    if (fs.existsSync(customThemesDir)) {
        for (const file of fs.readdirSync(customThemesDir)) {
            if (file.endsWith(".json")) {
                const name = file.slice(0, -5);
                if (!result.some((t) => t.name === name)) {
                    result.push({ name, path: path.join(customThemesDir, file) });
                }
            }
        }
    }
    for (const [name, theme] of registeredThemes.entries()) {
        if (!result.some((t) => t.name === name)) {
            result.push({ name, path: theme.sourcePath });
        }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
}
function parseThemeJson(label, json) {
    if (!validateThemeJson.Check(json)) {
        const errors = Array.from(validateThemeJson.Errors(json));
        const missingColors = [];
        const otherErrors = [];
        for (const e of errors) {
            // Check for missing required color properties
            const match = e.path.match(/^\/colors\/(\w+)$/);
            if (match && e.message.includes("Required")) {
                missingColors.push(match[1]);
            }
            else {
                otherErrors.push(`  - ${e.path}: ${e.message}`);
            }
        }
        let errorMessage = `Invalid theme "${label}":\n`;
        if (missingColors.length > 0) {
            errorMessage += "\nMissing required color tokens:\n";
            errorMessage += missingColors.map((c) => `  - ${c}`).join("\n");
            errorMessage += '\n\nPlease add these colors to your theme\'s "colors" object.';
            errorMessage += "\nSee the built-in themes (dark.json, light.json) for reference values.";
        }
        if (otherErrors.length > 0) {
            errorMessage += `\n\nOther errors:\n${otherErrors.join("\n")}`;
        }
        throw new Error(errorMessage);
    }
    return json;
}
function parseThemeJsonContent(label, content) {
    let json;
    try {
        json = JSON.parse(content);
    }
    catch (error) {
        throw new Error(`Failed to parse theme ${label}: ${error}`);
    }
    return parseThemeJson(label, json);
}
function loadThemeJson(name) {
    const builtinThemes = getBuiltinThemes();
    if (name in builtinThemes) {
        return builtinThemes[name];
    }
    const registeredTheme = registeredThemes.get(name);
    if (registeredTheme === null || registeredTheme === void 0 ? void 0 : registeredTheme.sourcePath) {
        const content = fs.readFileSync(registeredTheme.sourcePath, "utf-8");
        return parseThemeJsonContent(registeredTheme.sourcePath, content);
    }
    if (registeredTheme) {
        throw new Error(`Theme "${name}" does not have a source path for export`);
    }
    const customThemesDir = (0, config_js_1.getCustomThemesDir)();
    const themePath = path.join(customThemesDir, `${name}.json`);
    if (!fs.existsSync(themePath)) {
        throw new Error(`Theme not found: ${name}`);
    }
    const content = fs.readFileSync(themePath, "utf-8");
    return parseThemeJsonContent(name, content);
}
function createTheme(themeJson, mode, sourcePath) {
    const colorMode = mode !== null && mode !== void 0 ? mode : detectColorMode();
    const resolvedColors = resolveThemeColors(themeJson.colors, themeJson.vars);
    const fgColors = {};
    const bgColors = {};
    const bgColorKeys = new Set([
        "selectedBg",
        "userMessageBg",
        "customMessageBg",
        "toolPendingBg",
        "toolSuccessBg",
        "toolErrorBg",
    ]);
    for (const [key, value] of Object.entries(resolvedColors)) {
        if (bgColorKeys.has(key)) {
            bgColors[key] = value;
        }
        else {
            fgColors[key] = value;
        }
    }
    return new Theme(fgColors, bgColors, colorMode, {
        name: themeJson.name,
        sourcePath,
    });
}
function loadThemeFromPath(themePath, mode) {
    const content = fs.readFileSync(themePath, "utf-8");
    const themeJson = parseThemeJsonContent(themePath, content);
    return createTheme(themeJson, mode, themePath);
}
function loadTheme(name, mode) {
    const registeredTheme = registeredThemes.get(name);
    if (registeredTheme) {
        return registeredTheme;
    }
    const themeJson = loadThemeJson(name);
    return createTheme(themeJson, mode);
}
function getThemeByName(name) {
    try {
        return loadTheme(name);
    }
    catch (_a) {
        return undefined;
    }
}
function detectTerminalBackground() {
    const colorfgbg = process.env.COLORFGBG || "";
    if (colorfgbg) {
        const parts = colorfgbg.split(";");
        if (parts.length >= 2) {
            const bg = parseInt(parts[1], 10);
            if (!Number.isNaN(bg)) {
                const result = bg < 8 ? "dark" : "light";
                return result;
            }
        }
    }
    return "dark";
}
function getDefaultTheme() {
    return detectTerminalBackground();
}
// ============================================================================
// Global Theme Instance
// ============================================================================
// Use globalThis to share theme across module loaders (tsx + jiti in dev mode)
const THEME_KEY = Symbol.for("@mariozechner/pi-coding-agent:theme");
// Export theme as a getter that reads from globalThis
// This ensures all module instances (tsx, jiti) see the same theme
exports.theme = new Proxy({}, {
    get(_target, prop) {
        const t = globalThis[THEME_KEY];
        if (!t)
            throw new Error("Theme not initialized. Call initTheme() first.");
        return t[prop];
    },
});
function setGlobalTheme(t) {
    globalThis[THEME_KEY] = t;
}
let currentThemeName;
let themeWatcher;
let onThemeChangeCallback;
const registeredThemes = new Map();
function setRegisteredThemes(themes) {
    registeredThemes.clear();
    for (const theme of themes) {
        if (theme.name) {
            registeredThemes.set(theme.name, theme);
        }
    }
}
function initTheme(themeName, enableWatcher = false) {
    const name = themeName !== null && themeName !== void 0 ? themeName : getDefaultTheme();
    currentThemeName = name;
    try {
        setGlobalTheme(loadTheme(name));
        if (enableWatcher) {
            startThemeWatcher();
        }
    }
    catch (_error) {
        // Theme is invalid - fall back to dark theme silently
        currentThemeName = "dark";
        setGlobalTheme(loadTheme("dark"));
        // Don't start watcher for fallback theme
    }
}
function setTheme(name, enableWatcher = false) {
    currentThemeName = name;
    try {
        setGlobalTheme(loadTheme(name));
        if (enableWatcher) {
            startThemeWatcher();
        }
        if (onThemeChangeCallback) {
            onThemeChangeCallback();
        }
        return { success: true };
    }
    catch (error) {
        // Theme is invalid - fall back to dark theme
        currentThemeName = "dark";
        setGlobalTheme(loadTheme("dark"));
        // Don't start watcher for fallback theme
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
function setThemeInstance(themeInstance) {
    setGlobalTheme(themeInstance);
    currentThemeName = "<in-memory>";
    stopThemeWatcher(); // Can't watch a direct instance
    if (onThemeChangeCallback) {
        onThemeChangeCallback();
    }
}
function onThemeChange(callback) {
    onThemeChangeCallback = callback;
}
function startThemeWatcher() {
    // Stop existing watcher if any
    if (themeWatcher) {
        themeWatcher.close();
        themeWatcher = undefined;
    }
    // Only watch if it's a custom theme (not built-in)
    if (!currentThemeName || currentThemeName === "dark" || currentThemeName === "light") {
        return;
    }
    const customThemesDir = (0, config_js_1.getCustomThemesDir)();
    const themeFile = path.join(customThemesDir, `${currentThemeName}.json`);
    // Only watch if the file exists
    if (!fs.existsSync(themeFile)) {
        return;
    }
    try {
        themeWatcher = fs.watch(themeFile, (eventType) => {
            if (eventType === "change") {
                // Debounce rapid changes
                setTimeout(() => {
                    try {
                        // Reload the theme
                        setGlobalTheme(loadTheme(currentThemeName));
                        // Notify callback (to invalidate UI)
                        if (onThemeChangeCallback) {
                            onThemeChangeCallback();
                        }
                    }
                    catch (_error) {
                        // Ignore errors (file might be in invalid state while being edited)
                    }
                }, 100);
            }
            else if (eventType === "rename") {
                // File was deleted or renamed - fall back to default theme
                setTimeout(() => {
                    if (!fs.existsSync(themeFile)) {
                        currentThemeName = "dark";
                        setGlobalTheme(loadTheme("dark"));
                        if (themeWatcher) {
                            themeWatcher.close();
                            themeWatcher = undefined;
                        }
                        if (onThemeChangeCallback) {
                            onThemeChangeCallback();
                        }
                    }
                }, 100);
            }
        });
    }
    catch (_error) {
        // Ignore errors starting watcher
    }
}
function stopThemeWatcher() {
    if (themeWatcher) {
        themeWatcher.close();
        themeWatcher = undefined;
    }
}
// ============================================================================
// HTML Export Helpers
// ============================================================================
/**
 * Convert a 256-color index to hex string.
 * Indices 0-15: basic colors (approximate)
 * Indices 16-231: 6x6x6 color cube
 * Indices 232-255: grayscale ramp
 */
function ansi256ToHex(index) {
    // Basic colors (0-15) - approximate common terminal values
    const basicColors = [
        "#000000",
        "#800000",
        "#008000",
        "#808000",
        "#000080",
        "#800080",
        "#008080",
        "#c0c0c0",
        "#808080",
        "#ff0000",
        "#00ff00",
        "#ffff00",
        "#0000ff",
        "#ff00ff",
        "#00ffff",
        "#ffffff",
    ];
    if (index < 16) {
        return basicColors[index];
    }
    // Color cube (16-231): 6x6x6 = 216 colors
    if (index < 232) {
        const cubeIndex = index - 16;
        const r = Math.floor(cubeIndex / 36);
        const g = Math.floor((cubeIndex % 36) / 6);
        const b = cubeIndex % 6;
        const toHex = (n) => (n === 0 ? 0 : 55 + n * 40).toString(16).padStart(2, "0");
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
    // Grayscale (232-255): 24 shades
    const gray = 8 + (index - 232) * 10;
    const grayHex = gray.toString(16).padStart(2, "0");
    return `#${grayHex}${grayHex}${grayHex}`;
}
/**
 * Get resolved theme colors as CSS-compatible hex strings.
 * Used by HTML export to generate CSS custom properties.
 */
function getResolvedThemeColors(themeName) {
    var _a;
    const name = (_a = themeName !== null && themeName !== void 0 ? themeName : currentThemeName) !== null && _a !== void 0 ? _a : getDefaultTheme();
    const isLight = name === "light";
    const themeJson = loadThemeJson(name);
    const resolved = resolveThemeColors(themeJson.colors, themeJson.vars);
    // Default text color for empty values (terminal uses default fg color)
    const defaultText = isLight ? "#000000" : "#e5e5e7";
    const cssColors = {};
    for (const [key, value] of Object.entries(resolved)) {
        if (typeof value === "number") {
            cssColors[key] = ansi256ToHex(value);
        }
        else if (value === "") {
            // Empty means default terminal color - use sensible fallback for HTML
            cssColors[key] = defaultText;
        }
        else {
            cssColors[key] = value;
        }
    }
    return cssColors;
}
/**
 * Check if a theme is a "light" theme (for CSS that needs light/dark variants).
 */
function isLightTheme(themeName) {
    // Currently just check the name - could be extended to analyze colors
    return themeName === "light";
}
/**
 * Get explicit export colors from theme JSON, if specified.
 * Returns undefined for each color that isn't explicitly set.
 */
function getThemeExportColors(themeName) {
    var _a, _b;
    const name = (_a = themeName !== null && themeName !== void 0 ? themeName : currentThemeName) !== null && _a !== void 0 ? _a : getDefaultTheme();
    try {
        const themeJson = loadThemeJson(name);
        const exportSection = themeJson.export;
        if (!exportSection)
            return {};
        const vars = (_b = themeJson.vars) !== null && _b !== void 0 ? _b : {};
        const resolve = (value) => {
            if (value === undefined)
                return undefined;
            if (typeof value === "number")
                return ansi256ToHex(value);
            if (value.startsWith("$")) {
                const resolved = vars[value];
                if (resolved === undefined)
                    return undefined;
                if (typeof resolved === "number")
                    return ansi256ToHex(resolved);
                return resolved;
            }
            return value;
        };
        return {
            pageBg: resolve(exportSection.pageBg),
            cardBg: resolve(exportSection.cardBg),
            infoBg: resolve(exportSection.infoBg),
        };
    }
    catch (_c) {
        return {};
    }
}
let cachedHighlightThemeFor;
let cachedCliHighlightTheme;
function buildCliHighlightTheme(t) {
    return {
        keyword: (s) => t.fg("syntaxKeyword", s),
        built_in: (s) => t.fg("syntaxType", s),
        literal: (s) => t.fg("syntaxNumber", s),
        number: (s) => t.fg("syntaxNumber", s),
        string: (s) => t.fg("syntaxString", s),
        comment: (s) => t.fg("syntaxComment", s),
        function: (s) => t.fg("syntaxFunction", s),
        title: (s) => t.fg("syntaxFunction", s),
        class: (s) => t.fg("syntaxType", s),
        type: (s) => t.fg("syntaxType", s),
        attr: (s) => t.fg("syntaxVariable", s),
        variable: (s) => t.fg("syntaxVariable", s),
        params: (s) => t.fg("syntaxVariable", s),
        operator: (s) => t.fg("syntaxOperator", s),
        punctuation: (s) => t.fg("syntaxPunctuation", s),
    };
}
function getCliHighlightTheme(t) {
    if (cachedHighlightThemeFor !== t || !cachedCliHighlightTheme) {
        cachedHighlightThemeFor = t;
        cachedCliHighlightTheme = buildCliHighlightTheme(t);
    }
    return cachedCliHighlightTheme;
}
/**
 * Highlight code with syntax coloring based on file extension or language.
 * Returns array of highlighted lines.
 */
function highlightCode(code, lang) {
    // Validate language before highlighting to avoid stderr spam from cli-highlight
    const validLang = lang && (0, cli_highlight_1.supportsLanguage)(lang) ? lang : undefined;
    const opts = {
        language: validLang,
        ignoreIllegals: true,
        theme: getCliHighlightTheme(exports.theme),
    };
    try {
        return (0, cli_highlight_1.highlight)(code, opts).split("\n");
    }
    catch (_a) {
        return code.split("\n");
    }
}
/**
 * Get language identifier from file path extension.
 */
function getLanguageFromPath(filePath) {
    var _a;
    const ext = (_a = filePath.split(".").pop()) === null || _a === void 0 ? void 0 : _a.toLowerCase();
    if (!ext)
        return undefined;
    const extToLang = {
        ts: "typescript",
        tsx: "typescript",
        js: "javascript",
        jsx: "javascript",
        mjs: "javascript",
        cjs: "javascript",
        py: "python",
        rb: "ruby",
        rs: "rust",
        go: "go",
        java: "java",
        kt: "kotlin",
        swift: "swift",
        c: "c",
        h: "c",
        cpp: "cpp",
        cc: "cpp",
        cxx: "cpp",
        hpp: "cpp",
        cs: "csharp",
        php: "php",
        sh: "bash",
        bash: "bash",
        zsh: "bash",
        fish: "fish",
        ps1: "powershell",
        sql: "sql",
        html: "html",
        htm: "html",
        css: "css",
        scss: "scss",
        sass: "sass",
        less: "less",
        json: "json",
        yaml: "yaml",
        yml: "yaml",
        toml: "toml",
        xml: "xml",
        md: "markdown",
        markdown: "markdown",
        dockerfile: "dockerfile",
        makefile: "makefile",
        cmake: "cmake",
        lua: "lua",
        perl: "perl",
        r: "r",
        scala: "scala",
        clj: "clojure",
        ex: "elixir",
        exs: "elixir",
        erl: "erlang",
        hs: "haskell",
        ml: "ocaml",
        vim: "vim",
        graphql: "graphql",
        proto: "protobuf",
        tf: "hcl",
        hcl: "hcl",
    };
    return extToLang[ext];
}
function getMarkdownTheme() {
    return {
        heading: (text) => exports.theme.fg("mdHeading", text),
        link: (text) => exports.theme.fg("mdLink", text),
        linkUrl: (text) => exports.theme.fg("mdLinkUrl", text),
        code: (text) => exports.theme.fg("mdCode", text),
        codeBlock: (text) => exports.theme.fg("mdCodeBlock", text),
        codeBlockBorder: (text) => exports.theme.fg("mdCodeBlockBorder", text),
        quote: (text) => exports.theme.fg("mdQuote", text),
        quoteBorder: (text) => exports.theme.fg("mdQuoteBorder", text),
        hr: (text) => exports.theme.fg("mdHr", text),
        listBullet: (text) => exports.theme.fg("mdListBullet", text),
        bold: (text) => exports.theme.bold(text),
        italic: (text) => exports.theme.italic(text),
        underline: (text) => exports.theme.underline(text),
        strikethrough: (text) => chalk_1.default.strikethrough(text),
        highlightCode: (code, lang) => {
            // Validate language before highlighting to avoid stderr spam from cli-highlight
            const validLang = lang && (0, cli_highlight_1.supportsLanguage)(lang) ? lang : undefined;
            const opts = {
                language: validLang,
                ignoreIllegals: true,
                theme: getCliHighlightTheme(exports.theme),
            };
            try {
                return (0, cli_highlight_1.highlight)(code, opts).split("\n");
            }
            catch (_a) {
                return code.split("\n").map((line) => exports.theme.fg("mdCodeBlock", line));
            }
        },
    };
}
function getSelectListTheme() {
    return {
        selectedPrefix: (text) => exports.theme.fg("accent", text),
        selectedText: (text) => exports.theme.fg("accent", text),
        description: (text) => exports.theme.fg("muted", text),
        scrollInfo: (text) => exports.theme.fg("muted", text),
        noMatch: (text) => exports.theme.fg("muted", text),
    };
}
function getEditorTheme() {
    return {
        borderColor: (text) => exports.theme.fg("borderMuted", text),
        selectList: getSelectListTheme(),
    };
}
function getSettingsListTheme() {
    return {
        label: (text, selected) => (selected ? exports.theme.fg("accent", text) : text),
        value: (text, selected) => (selected ? exports.theme.fg("accent", text) : exports.theme.fg("muted", text)),
        description: (text) => exports.theme.fg("dim", text),
        cursor: exports.theme.fg("accent", "→ "),
        hint: (text) => exports.theme.fg("dim", text),
    };
}
