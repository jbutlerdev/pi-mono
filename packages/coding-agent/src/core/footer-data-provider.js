"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FooterDataProvider = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
/**
 * Find the git HEAD path by walking up from cwd.
 * Handles both regular git repos (.git is a directory) and worktrees (.git is a file).
 */
function findGitHeadPath() {
    let dir = process.cwd();
    while (true) {
        const gitPath = (0, path_1.join)(dir, ".git");
        if ((0, fs_1.existsSync)(gitPath)) {
            try {
                const stat = (0, fs_1.statSync)(gitPath);
                if (stat.isFile()) {
                    const content = (0, fs_1.readFileSync)(gitPath, "utf8").trim();
                    if (content.startsWith("gitdir: ")) {
                        const gitDir = content.slice(8);
                        const headPath = (0, path_1.resolve)(dir, gitDir, "HEAD");
                        if ((0, fs_1.existsSync)(headPath))
                            return headPath;
                    }
                }
                else if (stat.isDirectory()) {
                    const headPath = (0, path_1.join)(gitPath, "HEAD");
                    if ((0, fs_1.existsSync)(headPath))
                        return headPath;
                }
            }
            catch (_a) {
                return null;
            }
        }
        const parent = (0, path_1.dirname)(dir);
        if (parent === dir)
            return null;
        dir = parent;
    }
}
/**
 * Provides git branch and extension statuses - data not otherwise accessible to extensions.
 * Token stats, model info available via ctx.sessionManager and ctx.model.
 */
class FooterDataProvider {
    extensionStatuses = new Map();
    cachedBranch = undefined;
    gitWatcher = null;
    branchChangeCallbacks = new Set();
    availableProviderCount = 0;
    constructor() {
        this.setupGitWatcher();
    }
    /** Current git branch, null if not in repo, "detached" if detached HEAD */
    getGitBranch() {
        if (this.cachedBranch !== undefined)
            return this.cachedBranch;
        try {
            const gitHeadPath = findGitHeadPath();
            if (!gitHeadPath) {
                this.cachedBranch = null;
                return null;
            }
            const content = (0, fs_1.readFileSync)(gitHeadPath, "utf8").trim();
            this.cachedBranch = content.startsWith("ref: refs/heads/") ? content.slice(16) : "detached";
        }
        catch (_a) {
            this.cachedBranch = null;
        }
        return this.cachedBranch;
    }
    /** Extension status texts set via ctx.ui.setStatus() */
    getExtensionStatuses() {
        return this.extensionStatuses;
    }
    /** Subscribe to git branch changes. Returns unsubscribe function. */
    onBranchChange(callback) {
        this.branchChangeCallbacks.add(callback);
        return () => this.branchChangeCallbacks.delete(callback);
    }
    /** Internal: set extension status */
    setExtensionStatus(key, text) {
        if (text === undefined) {
            this.extensionStatuses.delete(key);
        }
        else {
            this.extensionStatuses.set(key, text);
        }
    }
    /** Internal: clear extension statuses */
    clearExtensionStatuses() {
        this.extensionStatuses.clear();
    }
    /** Number of unique providers with available models (for footer display) */
    getAvailableProviderCount() {
        return this.availableProviderCount;
    }
    /** Internal: update available provider count */
    setAvailableProviderCount(count) {
        this.availableProviderCount = count;
    }
    /** Internal: cleanup */
    dispose() {
        if (this.gitWatcher) {
            this.gitWatcher.close();
            this.gitWatcher = null;
        }
        this.branchChangeCallbacks.clear();
    }
    setupGitWatcher() {
        if (this.gitWatcher) {
            this.gitWatcher.close();
            this.gitWatcher = null;
        }
        const gitHeadPath = findGitHeadPath();
        if (!gitHeadPath)
            return;
        // Watch the directory containing HEAD, not HEAD itself.
        // Git uses atomic writes (write temp, rename over HEAD), which changes the inode.
        // fs.watch on a file stops working after the inode changes.
        const gitDir = (0, path_1.dirname)(gitHeadPath);
        try {
            this.gitWatcher = (0, fs_1.watch)(gitDir, (_eventType, filename) => {
                if (filename === "HEAD") {
                    this.cachedBranch = undefined;
                    for (const cb of this.branchChangeCallbacks)
                        cb();
                }
            });
        }
        catch (_a) {
            // Silently fail if we can't watch
        }
    }
}
exports.FooterDataProvider = FooterDataProvider;
