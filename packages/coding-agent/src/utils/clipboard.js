"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.copyToClipboard = copyToClipboard;
const child_process_1 = require("child_process");
const os_1 = require("os");
const clipboard_image_js_1 = require("./clipboard-image.js");
function copyToClipboard(text) {
    // Always emit OSC 52 - works over SSH/mosh, harmless locally
    const encoded = Buffer.from(text).toString("base64");
    process.stdout.write(`\x1b]52;c;${encoded}\x07`);
    // Also try native tools (best effort for local sessions)
    const p = (0, os_1.platform)();
    const options = { input: text, timeout: 5000 };
    try {
        if (p === "darwin") {
            (0, child_process_1.execSync)("pbcopy", options);
        }
        else if (p === "win32") {
            (0, child_process_1.execSync)("clip", options);
        }
        else {
            // Linux. Try Termux, Wayland, or X11 clipboard tools.
            if (process.env.TERMUX_VERSION) {
                try {
                    (0, child_process_1.execSync)("termux-clipboard-set", options);
                    return;
                }
                catch (_a) {
                    // Fall back to Wayland or X11 tools.
                }
            }
            const isWayland = (0, clipboard_image_js_1.isWaylandSession)();
            if (isWayland) {
                try {
                    // Verify wl-copy exists (spawn errors are async and won't be caught)
                    (0, child_process_1.execSync)("which wl-copy", { stdio: "ignore" });
                    // wl-copy with execSync hangs due to fork behavior; use spawn instead
                    const proc = (0, child_process_1.spawn)("wl-copy", [], { stdio: ["pipe", "ignore", "ignore"] });
                    proc.stdin.on("error", () => {
                        // Ignore EPIPE errors if wl-copy exits early
                    });
                    proc.stdin.write(text);
                    proc.stdin.end();
                    proc.unref();
                }
                catch (_b) {
                    // Fall back to xclip/xsel (works on XWayland)
                    try {
                        (0, child_process_1.execSync)("xclip -selection clipboard", options);
                    }
                    catch (_c) {
                        (0, child_process_1.execSync)("xsel --clipboard --input", options);
                    }
                }
            }
            else {
                try {
                    (0, child_process_1.execSync)("xclip -selection clipboard", options);
                }
                catch (_d) {
                    (0, child_process_1.execSync)("xsel --clipboard --input", options);
                }
            }
        }
    }
    catch (_e) {
        // Ignore - OSC 52 already emitted as fallback
    }
}
