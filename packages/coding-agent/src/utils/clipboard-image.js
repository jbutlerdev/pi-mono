"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWaylandSession = isWaylandSession;
exports.extensionForImageMimeType = extensionForImageMimeType;
exports.readClipboardImage = readClipboardImage;
const child_process_1 = require("child_process");
const clipboard_native_js_1 = require("./clipboard-native.js");
const photon_js_1 = require("./photon.js");
const SUPPORTED_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const DEFAULT_LIST_TIMEOUT_MS = 1000;
const DEFAULT_READ_TIMEOUT_MS = 3000;
const DEFAULT_MAX_BUFFER_BYTES = 50 * 1024 * 1024;
function isWaylandSession(env = process.env) {
    return Boolean(env.WAYLAND_DISPLAY) || env.XDG_SESSION_TYPE === "wayland";
}
function baseMimeType(mimeType) {
    var _a;
    var _b;
    return (_b = (_a = mimeType.split(";")[0]) === null || _a === void 0 ? void 0 : _a.trim().toLowerCase()) !== null && _b !== void 0 ? _b : mimeType.toLowerCase();
}
function extensionForImageMimeType(mimeType) {
    switch (baseMimeType(mimeType)) {
        case "image/png":
            return "png";
        case "image/jpeg":
            return "jpg";
        case "image/webp":
            return "webp";
        case "image/gif":
            return "gif";
        default:
            return null;
    }
}
function selectPreferredImageMimeType(mimeTypes) {
    var _a;
    const normalized = mimeTypes
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) => ({ raw: t, base: baseMimeType(t) }));
    for (const preferred of SUPPORTED_IMAGE_MIME_TYPES) {
        const match = normalized.find((t) => t.base === preferred);
        if (match) {
            return match.raw;
        }
    }
    const anyImage = normalized.find((t) => t.base.startsWith("image/"));
    return (_a = anyImage === null || anyImage === void 0 ? void 0 : anyImage.raw) !== null && _a !== void 0 ? _a : null;
}
function isSupportedImageMimeType(mimeType) {
    const base = baseMimeType(mimeType);
    return SUPPORTED_IMAGE_MIME_TYPES.some((t) => t === base);
}
/**
 * Convert unsupported image formats to PNG using Photon.
 * Returns null if conversion is unavailable or fails.
 */
async function convertToPng(bytes) {
    const photon = await (0, photon_js_1.loadPhoton)();
    if (!photon) {
        return null;
    }
    try {
        const image = photon.PhotonImage.new_from_byteslice(bytes);
        try {
            return image.get_bytes();
        }
        finally {
            image.free();
        }
    }
    catch (_a) {
        return null;
    }
}
function runCommand(command, args, options) {
    var _a, _b, _c;
    const timeoutMs = (_a = options === null || options === void 0 ? void 0 : options.timeoutMs) !== null && _a !== void 0 ? _a : DEFAULT_READ_TIMEOUT_MS;
    const maxBufferBytes = (_b = options === null || options === void 0 ? void 0 : options.maxBufferBytes) !== null && _b !== void 0 ? _b : DEFAULT_MAX_BUFFER_BYTES;
    const result = (0, child_process_1.spawnSync)(command, args, {
        timeout: timeoutMs,
        maxBuffer: maxBufferBytes,
    });
    if (result.error) {
        return { ok: false, stdout: Buffer.alloc(0) };
    }
    if (result.status !== 0) {
        return { ok: false, stdout: Buffer.alloc(0) };
    }
    const stdout = Buffer.isBuffer(result.stdout)
        ? result.stdout
        : Buffer.from((_c = result.stdout) !== null && _c !== void 0 ? _c : "", typeof result.stdout === "string" ? "utf-8" : undefined);
    return { ok: true, stdout };
}
function readClipboardImageViaWlPaste() {
    const list = runCommand("wl-paste", ["--list-types"], { timeoutMs: DEFAULT_LIST_TIMEOUT_MS });
    if (!list.ok) {
        return null;
    }
    const types = list.stdout
        .toString("utf-8")
        .split(/\r?\n/)
        .map((t) => t.trim())
        .filter(Boolean);
    const selectedType = selectPreferredImageMimeType(types);
    if (!selectedType) {
        return null;
    }
    const data = runCommand("wl-paste", ["--type", selectedType, "--no-newline"]);
    if (!data.ok || data.stdout.length === 0) {
        return null;
    }
    return { bytes: data.stdout, mimeType: baseMimeType(selectedType) };
}
function readClipboardImageViaXclip() {
    const targets = runCommand("xclip", ["-selection", "clipboard", "-t", "TARGETS", "-o"], {
        timeoutMs: DEFAULT_LIST_TIMEOUT_MS,
    });
    let candidateTypes = [];
    if (targets.ok) {
        candidateTypes = targets.stdout
            .toString("utf-8")
            .split(/\r?\n/)
            .map((t) => t.trim())
            .filter(Boolean);
    }
    const preferred = candidateTypes.length > 0 ? selectPreferredImageMimeType(candidateTypes) : null;
    const tryTypes = preferred ? [preferred, ...SUPPORTED_IMAGE_MIME_TYPES] : [...SUPPORTED_IMAGE_MIME_TYPES];
    for (const mimeType of tryTypes) {
        const data = runCommand("xclip", ["-selection", "clipboard", "-t", mimeType, "-o"]);
        if (data.ok && data.stdout.length > 0) {
            return { bytes: data.stdout, mimeType: baseMimeType(mimeType) };
        }
    }
    return null;
}
async function readClipboardImage(options) {
    var _a, _b, _c;
    const env = (_a = options === null || options === void 0 ? void 0 : options.env) !== null && _a !== void 0 ? _a : process.env;
    const platform = (_b = options === null || options === void 0 ? void 0 : options.platform) !== null && _b !== void 0 ? _b : process.platform;
    if (env.TERMUX_VERSION) {
        return null;
    }
    let image = null;
    if (platform === "linux" && isWaylandSession(env)) {
        image = (_c = readClipboardImageViaWlPaste()) !== null && _c !== void 0 ? _c : readClipboardImageViaXclip();
    }
    else {
        if (!clipboard_native_js_1.clipboard || !clipboard_native_js_1.clipboard.hasImage()) {
            return null;
        }
        const imageData = await clipboard_native_js_1.clipboard.getImageBinary();
        if (!imageData || imageData.length === 0) {
            return null;
        }
        const bytes = imageData instanceof Uint8Array ? imageData : Uint8Array.from(imageData);
        image = { bytes, mimeType: "image/png" };
    }
    if (!image) {
        return null;
    }
    // Convert unsupported formats (e.g., BMP from WSLg) to PNG
    if (!isSupportedImageMimeType(image.mimeType)) {
        const pngBytes = await convertToPng(image.bytes);
        if (!pngBytes) {
            return null;
        }
        return { bytes: pngBytes, mimeType: "image/png" };
    }
    return image;
}
