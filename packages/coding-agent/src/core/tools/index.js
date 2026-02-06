"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allTools = exports.readOnlyTools = exports.codingTools = exports.writeTool = exports.createWriteTool = exports.truncateTail = exports.truncateLine = exports.truncateHead = exports.formatSize = exports.DEFAULT_MAX_LINES = exports.DEFAULT_MAX_BYTES = exports.readTool = exports.createReadTool = exports.lsTool = exports.createLsTool = exports.grepTool = exports.createGrepTool = exports.findTool = exports.createFindTool = exports.editTool = exports.createEditTool = exports.createBashTool = exports.bashTool = void 0;
exports.createCodingTools = createCodingTools;
exports.createReadOnlyTools = createReadOnlyTools;
exports.createAllTools = createAllTools;
const bash_js_1 = require("./bash.js");
Object.defineProperty(exports, "bashTool", { enumerable: true, get: function () { return bash_js_1.bashTool; } });
Object.defineProperty(exports, "createBashTool", { enumerable: true, get: function () { return bash_js_1.createBashTool; } });
const edit_js_1 = require("./edit.js");
Object.defineProperty(exports, "createEditTool", { enumerable: true, get: function () { return edit_js_1.createEditTool; } });
Object.defineProperty(exports, "editTool", { enumerable: true, get: function () { return edit_js_1.editTool; } });
const find_js_1 = require("./find.js");
Object.defineProperty(exports, "createFindTool", { enumerable: true, get: function () { return find_js_1.createFindTool; } });
Object.defineProperty(exports, "findTool", { enumerable: true, get: function () { return find_js_1.findTool; } });
const grep_js_1 = require("./grep.js");
Object.defineProperty(exports, "createGrepTool", { enumerable: true, get: function () { return grep_js_1.createGrepTool; } });
Object.defineProperty(exports, "grepTool", { enumerable: true, get: function () { return grep_js_1.grepTool; } });
const ls_js_1 = require("./ls.js");
Object.defineProperty(exports, "createLsTool", { enumerable: true, get: function () { return ls_js_1.createLsTool; } });
Object.defineProperty(exports, "lsTool", { enumerable: true, get: function () { return ls_js_1.lsTool; } });
const read_js_1 = require("./read.js");
Object.defineProperty(exports, "createReadTool", { enumerable: true, get: function () { return read_js_1.createReadTool; } });
Object.defineProperty(exports, "readTool", { enumerable: true, get: function () { return read_js_1.readTool; } });
const truncate_js_1 = require("./truncate.js");
Object.defineProperty(exports, "DEFAULT_MAX_BYTES", { enumerable: true, get: function () { return truncate_js_1.DEFAULT_MAX_BYTES; } });
Object.defineProperty(exports, "DEFAULT_MAX_LINES", { enumerable: true, get: function () { return truncate_js_1.DEFAULT_MAX_LINES; } });
Object.defineProperty(exports, "formatSize", { enumerable: true, get: function () { return truncate_js_1.formatSize; } });
Object.defineProperty(exports, "truncateHead", { enumerable: true, get: function () { return truncate_js_1.truncateHead; } });
Object.defineProperty(exports, "truncateLine", { enumerable: true, get: function () { return truncate_js_1.truncateLine; } });
Object.defineProperty(exports, "truncateTail", { enumerable: true, get: function () { return truncate_js_1.truncateTail; } });
const write_js_1 = require("./write.js");
Object.defineProperty(exports, "createWriteTool", { enumerable: true, get: function () { return write_js_1.createWriteTool; } });
Object.defineProperty(exports, "writeTool", { enumerable: true, get: function () { return write_js_1.writeTool; } });
const bash_js_2 = require("./bash.js");
const edit_js_2 = require("./edit.js");
const find_js_2 = require("./find.js");
const grep_js_2 = require("./grep.js");
const ls_js_2 = require("./ls.js");
const read_js_2 = require("./read.js");
const write_js_2 = require("./write.js");
// Default tools for full access mode (using process.cwd())
exports.codingTools = [read_js_2.readTool, bash_js_2.bashTool, edit_js_2.editTool, write_js_2.writeTool];
// Read-only tools for exploration without modification (using process.cwd())
exports.readOnlyTools = [read_js_2.readTool, grep_js_2.grepTool, find_js_2.findTool, ls_js_2.lsTool];
// All available tools (using process.cwd())
exports.allTools = {
    read: read_js_2.readTool,
    bash: bash_js_2.bashTool,
    edit: edit_js_2.editTool,
    write: write_js_2.writeTool,
    grep: grep_js_2.grepTool,
    find: find_js_2.findTool,
    ls: ls_js_2.lsTool,
};
/**
 * Create coding tools configured for a specific working directory.
 */
function createCodingTools(cwd, options) {
    return [
        (0, read_js_2.createReadTool)(cwd, options === null || options === void 0 ? void 0 : options.read),
        (0, bash_js_2.createBashTool)(cwd, options === null || options === void 0 ? void 0 : options.bash),
        (0, edit_js_2.createEditTool)(cwd),
        (0, write_js_2.createWriteTool)(cwd),
    ];
}
/**
 * Create read-only tools configured for a specific working directory.
 */
function createReadOnlyTools(cwd, options) {
    return [(0, read_js_2.createReadTool)(cwd, options === null || options === void 0 ? void 0 : options.read), (0, grep_js_2.createGrepTool)(cwd), (0, find_js_2.createFindTool)(cwd), (0, ls_js_2.createLsTool)(cwd)];
}
/**
 * Create all tools configured for a specific working directory.
 */
function createAllTools(cwd, options) {
    return {
        read: (0, read_js_2.createReadTool)(cwd, options === null || options === void 0 ? void 0 : options.read),
        bash: (0, bash_js_2.createBashTool)(cwd, options === null || options === void 0 ? void 0 : options.bash),
        edit: (0, edit_js_2.createEditTool)(cwd),
        write: (0, write_js_2.createWriteTool)(cwd),
        grep: (0, grep_js_2.createGrepTool)(cwd),
        find: (0, find_js_2.createFindTool)(cwd),
        ls: (0, ls_js_2.createLsTool)(cwd),
    };
}
