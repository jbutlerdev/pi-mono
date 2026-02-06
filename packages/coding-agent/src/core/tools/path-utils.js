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
Object.defineProperty(exports, "__esModule", { value: true });
exports.expandPath = expandPath;
exports.resolveToCwd = resolveToCwd;
exports.resolveReadPath = resolveReadPath;
const node_fs_1 = require("node:fs");
const os = __importStar(require("node:os"));
const node_path_1 = require("node:path");
const UNICODE_SPACES = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;
const NARROW_NO_BREAK_SPACE = "\u202F";
function normalizeUnicodeSpaces(str) {
    return str.replace(UNICODE_SPACES, " ");
}
function tryMacOSScreenshotPath(filePath) {
    return filePath.replace(/ (AM|PM)\./g, `${NARROW_NO_BREAK_SPACE}$1.`);
}
function tryNFDVariant(filePath) {
    // macOS stores filenames in NFD (decomposed) form, try converting user input to NFD
    return filePath.normalize("NFD");
}
function tryCurlyQuoteVariant(filePath) {
    // macOS uses U+2019 (right single quotation mark) in screenshot names like "Capture d'écran"
    // Users typically type U+0027 (straight apostrophe)
    return filePath.replace(/'/g, "\u2019");
}
function fileExists(filePath) {
    try {
        (0, node_fs_1.accessSync)(filePath, node_fs_1.constants.F_OK);
        return true;
    }
    catch (_a) {
        return false;
    }
}
function normalizeAtPrefix(filePath) {
    return filePath.startsWith("@") ? filePath.slice(1) : filePath;
}
function expandPath(filePath) {
    const normalized = normalizeUnicodeSpaces(normalizeAtPrefix(filePath));
    if (normalized === "~") {
        return os.homedir();
    }
    if (normalized.startsWith("~/")) {
        return os.homedir() + normalized.slice(1);
    }
    return normalized;
}
/**
 * Resolve a path relative to the given cwd.
 * Handles ~ expansion and absolute paths.
 */
function resolveToCwd(filePath, cwd) {
    const expanded = expandPath(filePath);
    if ((0, node_path_1.isAbsolute)(expanded)) {
        return expanded;
    }
    return (0, node_path_1.resolve)(cwd, expanded);
}
function resolveReadPath(filePath, cwd) {
    const resolved = resolveToCwd(filePath, cwd);
    if (fileExists(resolved)) {
        return resolved;
    }
    // Try macOS AM/PM variant (narrow no-break space before AM/PM)
    const amPmVariant = tryMacOSScreenshotPath(resolved);
    if (amPmVariant !== resolved && fileExists(amPmVariant)) {
        return amPmVariant;
    }
    // Try NFD variant (macOS stores filenames in NFD form)
    const nfdVariant = tryNFDVariant(resolved);
    if (nfdVariant !== resolved && fileExists(nfdVariant)) {
        return nfdVariant;
    }
    // Try curly quote variant (macOS uses U+2019 in screenshot names)
    const curlyVariant = tryCurlyQuoteVariant(resolved);
    if (curlyVariant !== resolved && fileExists(curlyVariant)) {
        return curlyVariant;
    }
    // Try combined NFD + curly quote (for French macOS screenshots like "Capture d'écran")
    const nfdCurlyVariant = tryCurlyQuoteVariant(nfdVariant);
    if (nfdCurlyVariant !== resolved && fileExists(nfdCurlyVariant)) {
        return nfdCurlyVariant;
    }
    return resolved;
}
