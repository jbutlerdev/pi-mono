"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clipboard = void 0;
const module_1 = require("module");
const require = (0, module_1.createRequire)(import.meta.url);
let clipboard = null;
exports.clipboard = clipboard;
const hasDisplay = process.platform !== "linux" || Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
if (!process.env.TERMUX_VERSION && hasDisplay) {
    try {
        exports.clipboard = clipboard = require("@mariozechner/clipboard");
    }
    catch (_a) {
        exports.clipboard = clipboard = null;
    }
}
