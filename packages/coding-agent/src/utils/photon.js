"use strict";
/**
 * Photon image processing wrapper.
 *
 * This module provides a unified interface to @silvia-odwyer/photon-node that works in:
 * 1. Node.js (development, npm run build)
 * 2. Bun compiled binaries (standalone distribution)
 *
 * The challenge: photon-node's CJS entry uses fs.readFileSync(__dirname + '/photon_rs_bg.wasm')
 * which bakes the build machine's absolute path into Bun compiled binaries.
 *
 * Solution:
 * 1. Patch fs.readFileSync to redirect missing photon_rs_bg.wasm reads
 * 2. Copy photon_rs_bg.wasm next to the executable in build:binary
 */
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
exports.loadPhoton = loadPhoton;
const module_1 = require("module");
const path = __importStar(require("path"));
const url_1 = require("url");
const require = (0, module_1.createRequire)(import.meta.url);
const fs = require("fs");
const WASM_FILENAME = "photon_rs_bg.wasm";
// Lazy-loaded photon module
let photonModule = null;
let loadPromise = null;
function pathOrNull(file) {
    if (typeof file === "string") {
        return file;
    }
    if (file instanceof URL) {
        return (0, url_1.fileURLToPath)(file);
    }
    return null;
}
function getFallbackWasmPaths() {
    const execDir = path.dirname(process.execPath);
    return [
        path.join(execDir, WASM_FILENAME),
        path.join(execDir, "photon", WASM_FILENAME),
        path.join(process.cwd(), WASM_FILENAME),
    ];
}
function patchPhotonWasmRead() {
    const originalReadFileSync = fs.readFileSync.bind(fs);
    const fallbackPaths = getFallbackWasmPaths();
    const mutableFs = fs;
    const patchedReadFileSync = ((...args) => {
        const [file, options] = args;
        const resolvedPath = pathOrNull(file);
        if (resolvedPath === null || resolvedPath === void 0 ? void 0 : resolvedPath.endsWith(WASM_FILENAME)) {
            try {
                return originalReadFileSync(...args);
            }
            catch (error) {
                const err = error;
                if ((err === null || err === void 0 ? void 0 : err.code) && err.code !== "ENOENT") {
                    throw error;
                }
                for (const fallbackPath of fallbackPaths) {
                    if (!fs.existsSync(fallbackPath)) {
                        continue;
                    }
                    if (options === undefined) {
                        return originalReadFileSync(fallbackPath);
                    }
                    return originalReadFileSync(fallbackPath, options);
                }
                throw error;
            }
        }
        return originalReadFileSync(...args);
    });
    try {
        mutableFs.readFileSync = patchedReadFileSync;
    }
    catch (_a) {
        Object.defineProperty(fs, "readFileSync", {
            value: patchedReadFileSync,
            writable: true,
            configurable: true,
        });
    }
    return () => {
        try {
            mutableFs.readFileSync = originalReadFileSync;
        }
        catch (_a) {
            Object.defineProperty(fs, "readFileSync", {
                value: originalReadFileSync,
                writable: true,
                configurable: true,
            });
        }
    };
}
/**
 * Load the photon module asynchronously.
 * Returns cached module on subsequent calls.
 */
async function loadPhoton() {
    if (photonModule) {
        return photonModule;
    }
    if (loadPromise) {
        return loadPromise;
    }
    loadPromise = (async () => {
        const restoreReadFileSync = patchPhotonWasmRead();
        try {
            photonModule = await Promise.resolve().then(() => __importStar(require("@silvia-odwyer/photon-node")));
            return photonModule;
        }
        catch (_a) {
            photonModule = null;
            return photonModule;
        }
        finally {
            restoreReadFileSync();
        }
    })();
    return loadPromise;
}
