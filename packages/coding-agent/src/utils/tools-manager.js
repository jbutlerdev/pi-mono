"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getToolPath = getToolPath;
exports.ensureTool = ensureTool;
const chalk_1 = __importDefault(require("chalk"));
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const os_1 = require("os");
const path_1 = require("path");
const stream_1 = require("stream");
const promises_1 = require("stream/promises");
const config_js_1 = require("../config.js");
const TOOLS_DIR = (0, config_js_1.getBinDir)();
const TOOLS = {
    fd: {
        name: "fd",
        repo: "sharkdp/fd",
        binaryName: "fd",
        tagPrefix: "v",
        getAssetName: (version, plat, architecture) => {
            if (plat === "darwin") {
                const archStr = architecture === "arm64" ? "aarch64" : "x86_64";
                return `fd-v${version}-${archStr}-apple-darwin.tar.gz`;
            }
            else if (plat === "linux") {
                const archStr = architecture === "arm64" ? "aarch64" : "x86_64";
                return `fd-v${version}-${archStr}-unknown-linux-gnu.tar.gz`;
            }
            else if (plat === "win32") {
                const archStr = architecture === "arm64" ? "aarch64" : "x86_64";
                return `fd-v${version}-${archStr}-pc-windows-msvc.zip`;
            }
            return null;
        },
    },
    rg: {
        name: "ripgrep",
        repo: "BurntSushi/ripgrep",
        binaryName: "rg",
        tagPrefix: "",
        getAssetName: (version, plat, architecture) => {
            if (plat === "darwin") {
                const archStr = architecture === "arm64" ? "aarch64" : "x86_64";
                return `ripgrep-${version}-${archStr}-apple-darwin.tar.gz`;
            }
            else if (plat === "linux") {
                if (architecture === "arm64") {
                    return `ripgrep-${version}-aarch64-unknown-linux-gnu.tar.gz`;
                }
                return `ripgrep-${version}-x86_64-unknown-linux-musl.tar.gz`;
            }
            else if (plat === "win32") {
                const archStr = architecture === "arm64" ? "aarch64" : "x86_64";
                return `ripgrep-${version}-${archStr}-pc-windows-msvc.zip`;
            }
            return null;
        },
    },
};
// Check if a command exists in PATH by trying to run it
function commandExists(cmd) {
    try {
        const result = (0, child_process_1.spawnSync)(cmd, ["--version"], { stdio: "pipe" });
        // Check for ENOENT error (command not found)
        return result.error === undefined || result.error === null;
    }
    catch (_a) {
        return false;
    }
}
// Get the path to a tool (system-wide or in our tools dir)
function getToolPath(tool) {
    const config = TOOLS[tool];
    if (!config)
        return null;
    // Check our tools directory first
    const localPath = (0, path_1.join)(TOOLS_DIR, config.binaryName + ((0, os_1.platform)() === "win32" ? ".exe" : ""));
    if ((0, fs_1.existsSync)(localPath)) {
        return localPath;
    }
    // Check system PATH - if found, just return the command name (it's in PATH)
    if (commandExists(config.binaryName)) {
        return config.binaryName;
    }
    return null;
}
// Fetch latest release version from GitHub
async function getLatestVersion(repo) {
    const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
        headers: { "User-Agent": `${config_js_1.APP_NAME}-coding-agent` },
    });
    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
    }
    const data = (await response.json());
    return data.tag_name.replace(/^v/, "");
}
// Download a file from URL
async function downloadFile(url, dest) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to download: ${response.status}`);
    }
    if (!response.body) {
        throw new Error("No response body");
    }
    const fileStream = (0, fs_1.createWriteStream)(dest);
    await (0, promises_1.finished)(stream_1.Readable.fromWeb(response.body).pipe(fileStream));
}
// Download and install a tool
async function downloadTool(tool) {
    const config = TOOLS[tool];
    if (!config)
        throw new Error(`Unknown tool: ${tool}`);
    const plat = (0, os_1.platform)();
    const architecture = (0, os_1.arch)();
    // Get latest version
    const version = await getLatestVersion(config.repo);
    // Get asset name for this platform
    const assetName = config.getAssetName(version, plat, architecture);
    if (!assetName) {
        throw new Error(`Unsupported platform: ${plat}/${architecture}`);
    }
    // Create tools directory
    (0, fs_1.mkdirSync)(TOOLS_DIR, { recursive: true });
    const downloadUrl = `https://github.com/${config.repo}/releases/download/${config.tagPrefix}${version}/${assetName}`;
    const archivePath = (0, path_1.join)(TOOLS_DIR, assetName);
    const binaryExt = plat === "win32" ? ".exe" : "";
    const binaryPath = (0, path_1.join)(TOOLS_DIR, config.binaryName + binaryExt);
    // Download
    await downloadFile(downloadUrl, archivePath);
    // Extract
    const extractDir = (0, path_1.join)(TOOLS_DIR, "extract_tmp");
    (0, fs_1.mkdirSync)(extractDir, { recursive: true });
    try {
        if (assetName.endsWith(".tar.gz")) {
            (0, child_process_1.spawnSync)("tar", ["xzf", archivePath, "-C", extractDir], { stdio: "pipe" });
        }
        else if (assetName.endsWith(".zip")) {
            (0, child_process_1.spawnSync)("unzip", ["-o", archivePath, "-d", extractDir], { stdio: "pipe" });
        }
        // Find the binary in extracted files
        const extractedDir = (0, path_1.join)(extractDir, assetName.replace(/\.(tar\.gz|zip)$/, ""));
        const extractedBinary = (0, path_1.join)(extractedDir, config.binaryName + binaryExt);
        if ((0, fs_1.existsSync)(extractedBinary)) {
            (0, fs_1.renameSync)(extractedBinary, binaryPath);
        }
        else {
            throw new Error(`Binary not found in archive: ${extractedBinary}`);
        }
        // Make executable (Unix only)
        if (plat !== "win32") {
            (0, fs_1.chmodSync)(binaryPath, 0o755);
        }
    }
    finally {
        // Cleanup
        (0, fs_1.rmSync)(archivePath, { force: true });
        (0, fs_1.rmSync)(extractDir, { recursive: true, force: true });
    }
    return binaryPath;
}
// Termux package names for tools
const TERMUX_PACKAGES = {
    fd: "fd-find",
    rg: "ripgrep",
};
// Ensure a tool is available, downloading if necessary
// Returns the path to the tool, or null if unavailable
async function ensureTool(tool, silent = false) {
    var _a;
    const existingPath = getToolPath(tool);
    if (existingPath) {
        return existingPath;
    }
    const config = TOOLS[tool];
    if (!config)
        return undefined;
    // On Android/Termux, Linux binaries don't work due to Bionic libc incompatibility.
    // Users must install via pkg.
    if ((0, os_1.platform)() === "android") {
        const pkgName = (_a = TERMUX_PACKAGES[tool]) !== null && _a !== void 0 ? _a : tool;
        if (!silent) {
            console.log(chalk_1.default.yellow(`${config.name} not found. Install with: pkg install ${pkgName}`));
        }
        return undefined;
    }
    // Tool not found - download it
    if (!silent) {
        console.log(chalk_1.default.dim(`${config.name} not found. Downloading...`));
    }
    try {
        const path = await downloadTool(tool);
        if (!silent) {
            console.log(chalk_1.default.dim(`${config.name} installed to ${path}`));
        }
        return path;
    }
    catch (e) {
        if (!silent) {
            console.log(chalk_1.default.yellow(`Failed to download ${config.name}: ${e instanceof Error ? e.message : e}`));
        }
        return undefined;
    }
}
