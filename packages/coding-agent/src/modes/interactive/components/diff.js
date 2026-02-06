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
exports.renderDiff = renderDiff;
const Diff = __importStar(require("diff"));
const theme_js_1 = require("../theme/theme.js");
/**
 * Parse diff line to extract prefix, line number, and content.
 * Format: "+123 content" or "-123 content" or " 123 content" or "     ..."
 */
function parseDiffLine(line) {
    const match = line.match(/^([+-\s])(\s*\d*)\s(.*)$/);
    if (!match)
        return null;
    return { prefix: match[1], lineNum: match[2], content: match[3] };
}
/**
 * Replace tabs with spaces for consistent rendering.
 */
function replaceTabs(text) {
    return text.replace(/\t/g, "   ");
}
/**
 * Compute word-level diff and render with inverse on changed parts.
 * Uses diffWords which groups whitespace with adjacent words for cleaner highlighting.
 * Strips leading whitespace from inverse to avoid highlighting indentation.
 */
function renderIntraLineDiff(oldContent, newContent) {
    var _a, _b;
    const wordDiff = Diff.diffWords(oldContent, newContent);
    let removedLine = "";
    let addedLine = "";
    let isFirstRemoved = true;
    let isFirstAdded = true;
    for (const part of wordDiff) {
        if (part.removed) {
            let value = part.value;
            // Strip leading whitespace from the first removed part
            if (isFirstRemoved) {
                const leadingWs = ((_a = value.match(/^(\s*)/)) === null || _a === void 0 ? void 0 : _a[1]) || "";
                value = value.slice(leadingWs.length);
                removedLine += leadingWs;
                isFirstRemoved = false;
            }
            if (value) {
                removedLine += theme_js_1.theme.inverse(value);
            }
        }
        else if (part.added) {
            let value = part.value;
            // Strip leading whitespace from the first added part
            if (isFirstAdded) {
                const leadingWs = ((_b = value.match(/^(\s*)/)) === null || _b === void 0 ? void 0 : _b[1]) || "";
                value = value.slice(leadingWs.length);
                addedLine += leadingWs;
                isFirstAdded = false;
            }
            if (value) {
                addedLine += theme_js_1.theme.inverse(value);
            }
        }
        else {
            removedLine += part.value;
            addedLine += part.value;
        }
    }
    return { removedLine, addedLine };
}
/**
 * Render a diff string with colored lines and intra-line change highlighting.
 * - Context lines: dim/gray
 * - Removed lines: red, with inverse on changed tokens
 * - Added lines: green, with inverse on changed tokens
 */
function renderDiff(diffText, _options = {}) {
    const lines = diffText.split("\n");
    const result = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const parsed = parseDiffLine(line);
        if (!parsed) {
            result.push(theme_js_1.theme.fg("toolDiffContext", line));
            i++;
            continue;
        }
        if (parsed.prefix === "-") {
            // Collect consecutive removed lines
            const removedLines = [];
            while (i < lines.length) {
                const p = parseDiffLine(lines[i]);
                if (!p || p.prefix !== "-")
                    break;
                removedLines.push({ lineNum: p.lineNum, content: p.content });
                i++;
            }
            // Collect consecutive added lines
            const addedLines = [];
            while (i < lines.length) {
                const p = parseDiffLine(lines[i]);
                if (!p || p.prefix !== "+")
                    break;
                addedLines.push({ lineNum: p.lineNum, content: p.content });
                i++;
            }
            // Only do intra-line diffing when there's exactly one removed and one added line
            // (indicating a single line modification). Otherwise, show lines as-is.
            if (removedLines.length === 1 && addedLines.length === 1) {
                const removed = removedLines[0];
                const added = addedLines[0];
                const { removedLine, addedLine } = renderIntraLineDiff(replaceTabs(removed.content), replaceTabs(added.content));
                result.push(theme_js_1.theme.fg("toolDiffRemoved", `-${removed.lineNum} ${removedLine}`));
                result.push(theme_js_1.theme.fg("toolDiffAdded", `+${added.lineNum} ${addedLine}`));
            }
            else {
                // Show all removed lines first, then all added lines
                for (const removed of removedLines) {
                    result.push(theme_js_1.theme.fg("toolDiffRemoved", `-${removed.lineNum} ${replaceTabs(removed.content)}`));
                }
                for (const added of addedLines) {
                    result.push(theme_js_1.theme.fg("toolDiffAdded", `+${added.lineNum} ${replaceTabs(added.content)}`));
                }
            }
        }
        else if (parsed.prefix === "+") {
            // Standalone added line
            result.push(theme_js_1.theme.fg("toolDiffAdded", `+${parsed.lineNum} ${replaceTabs(parsed.content)}`));
            i++;
        }
        else {
            // Context line
            result.push(theme_js_1.theme.fg("toolDiffContext", ` ${parsed.lineNum} ${replaceTabs(parsed.content)}`));
            i++;
        }
    }
    return result.join("\n");
}
