"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertToPng = convertToPng;
const photon_js_1 = require("./photon.js");
/**
 * Convert image to PNG format for terminal display.
 * Kitty graphics protocol requires PNG format (f=100).
 */
async function convertToPng(base64Data, mimeType) {
    // Already PNG, no conversion needed
    if (mimeType === "image/png") {
        return { data: base64Data, mimeType };
    }
    const photon = await (0, photon_js_1.loadPhoton)();
    if (!photon) {
        // Photon not available, can't convert
        return null;
    }
    try {
        const bytes = new Uint8Array(Buffer.from(base64Data, "base64"));
        const image = photon.PhotonImage.new_from_byteslice(bytes);
        try {
            const pngBuffer = image.get_bytes();
            return {
                data: Buffer.from(pngBuffer).toString("base64"),
                mimeType: "image/png",
            };
        }
        finally {
            image.free();
        }
    }
    catch (_a) {
        // Conversion failed
        return null;
    }
}
