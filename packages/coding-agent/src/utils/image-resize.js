"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resizeImage = resizeImage;
exports.formatDimensionNote = formatDimensionNote;
const photon_js_1 = require("./photon.js");
// 4.5MB - provides headroom below Anthropic's 5MB limit
const DEFAULT_MAX_BYTES = 4.5 * 1024 * 1024;
const DEFAULT_OPTIONS = {
    maxWidth: 2000,
    maxHeight: 2000,
    maxBytes: DEFAULT_MAX_BYTES,
    jpegQuality: 80,
};
/** Helper to pick the smaller of two buffers */
function pickSmaller(a, b) {
    return a.buffer.length <= b.buffer.length ? a : b;
}
/**
 * Resize an image to fit within the specified max dimensions and file size.
 * Returns the original image if it already fits within the limits.
 *
 * Uses Photon (Rust/WASM) for image processing. If Photon is not available,
 * returns the original image unchanged.
 *
 * Strategy for staying under maxBytes:
 * 1. First resize to maxWidth/maxHeight
 * 2. Try both PNG and JPEG formats, pick the smaller one
 * 3. If still too large, try JPEG with decreasing quality
 * 4. If still too large, progressively reduce dimensions
 */
async function resizeImage(img, options) {
    var _a;
    var _b, _c;
    const opts = Object.assign(Object.assign({}, DEFAULT_OPTIONS), options);
    const inputBuffer = Buffer.from(img.data, "base64");
    const photon = await (0, photon_js_1.loadPhoton)();
    if (!photon) {
        // Photon not available, return original image
        return {
            data: img.data,
            mimeType: img.mimeType,
            originalWidth: 0,
            originalHeight: 0,
            width: 0,
            height: 0,
            wasResized: false,
        };
    }
    let image;
    try {
        image = photon.PhotonImage.new_from_byteslice(new Uint8Array(inputBuffer));
        const originalWidth = image.get_width();
        const originalHeight = image.get_height();
        const format = (_b = (_a = img.mimeType) === null || _a === void 0 ? void 0 : _a.split("/")[1]) !== null && _b !== void 0 ? _b : "png";
        // Check if already within all limits (dimensions AND size)
        const originalSize = inputBuffer.length;
        if (originalWidth <= opts.maxWidth && originalHeight <= opts.maxHeight && originalSize <= opts.maxBytes) {
            return {
                data: img.data,
                mimeType: (_c = img.mimeType) !== null && _c !== void 0 ? _c : `image/${format}`,
                originalWidth,
                originalHeight,
                width: originalWidth,
                height: originalHeight,
                wasResized: false,
            };
        }
        // Calculate initial dimensions respecting max limits
        let targetWidth = originalWidth;
        let targetHeight = originalHeight;
        if (targetWidth > opts.maxWidth) {
            targetHeight = Math.round((targetHeight * opts.maxWidth) / targetWidth);
            targetWidth = opts.maxWidth;
        }
        if (targetHeight > opts.maxHeight) {
            targetWidth = Math.round((targetWidth * opts.maxHeight) / targetHeight);
            targetHeight = opts.maxHeight;
        }
        // Helper to resize and encode in both formats, returning the smaller one
        function tryBothFormats(width, height, jpegQuality) {
            const resized = photon.resize(image, width, height, photon.SamplingFilter.Lanczos3);
            try {
                const pngBuffer = resized.get_bytes();
                const jpegBuffer = resized.get_bytes_jpeg(jpegQuality);
                return pickSmaller({ buffer: pngBuffer, mimeType: "image/png" }, { buffer: jpegBuffer, mimeType: "image/jpeg" });
            }
            finally {
                resized.free();
            }
        }
        // Try to produce an image under maxBytes
        const qualitySteps = [85, 70, 55, 40];
        const scaleSteps = [1.0, 0.75, 0.5, 0.35, 0.25];
        let best;
        let finalWidth = targetWidth;
        let finalHeight = targetHeight;
        // First attempt: resize to target dimensions, try both formats
        best = tryBothFormats(targetWidth, targetHeight, opts.jpegQuality);
        if (best.buffer.length <= opts.maxBytes) {
            return {
                data: Buffer.from(best.buffer).toString("base64"),
                mimeType: best.mimeType,
                originalWidth,
                originalHeight,
                width: finalWidth,
                height: finalHeight,
                wasResized: true,
            };
        }
        // Still too large - try JPEG with decreasing quality
        for (const quality of qualitySteps) {
            best = tryBothFormats(targetWidth, targetHeight, quality);
            if (best.buffer.length <= opts.maxBytes) {
                return {
                    data: Buffer.from(best.buffer).toString("base64"),
                    mimeType: best.mimeType,
                    originalWidth,
                    originalHeight,
                    width: finalWidth,
                    height: finalHeight,
                    wasResized: true,
                };
            }
        }
        // Still too large - reduce dimensions progressively
        for (const scale of scaleSteps) {
            finalWidth = Math.round(targetWidth * scale);
            finalHeight = Math.round(targetHeight * scale);
            if (finalWidth < 100 || finalHeight < 100) {
                break;
            }
            for (const quality of qualitySteps) {
                best = tryBothFormats(finalWidth, finalHeight, quality);
                if (best.buffer.length <= opts.maxBytes) {
                    return {
                        data: Buffer.from(best.buffer).toString("base64"),
                        mimeType: best.mimeType,
                        originalWidth,
                        originalHeight,
                        width: finalWidth,
                        height: finalHeight,
                        wasResized: true,
                    };
                }
            }
        }
        // Last resort: return smallest version we produced
        return {
            data: Buffer.from(best.buffer).toString("base64"),
            mimeType: best.mimeType,
            originalWidth,
            originalHeight,
            width: finalWidth,
            height: finalHeight,
            wasResized: true,
        };
    }
    catch (_d) {
        // Failed to load image
        return {
            data: img.data,
            mimeType: img.mimeType,
            originalWidth: 0,
            originalHeight: 0,
            width: 0,
            height: 0,
            wasResized: false,
        };
    }
    finally {
        if (image) {
            image.free();
        }
    }
}
/**
 * Format a dimension note for resized images.
 * This helps the model understand the coordinate mapping.
 */
function formatDimensionNote(result) {
    if (!result.wasResized) {
        return undefined;
    }
    const scale = result.originalWidth / result.width;
    return `[Image: original ${result.originalWidth}x${result.originalHeight}, displayed at ${result.width}x${result.height}. Multiply coordinates by ${scale.toFixed(2)} to map to original image.]`;
}
