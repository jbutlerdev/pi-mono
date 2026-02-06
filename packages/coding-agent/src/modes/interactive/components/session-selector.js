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
exports.SessionSelectorComponent = void 0;
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const os = __importStar(require("node:os"));
const pi_tui_1 = require("@mariozechner/pi-tui");
const keybindings_js_1 = require("../../../core/keybindings.js");
const theme_js_1 = require("../theme/theme.js");
const dynamic_border_js_1 = require("./dynamic-border.js");
const keybinding_hints_js_1 = require("./keybinding-hints.js");
const session_selector_search_js_1 = require("./session-selector-search.js");
function shortenPath(path) {
    const home = os.homedir();
    if (!path)
        return path;
    if (path.startsWith(home)) {
        return `~${path.slice(home.length)}`;
    }
    return path;
}
function formatSessionDate(date) {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1)
        return "now";
    if (diffMins < 60)
        return `${diffMins}m`;
    if (diffHours < 24)
        return `${diffHours}h`;
    if (diffDays < 7)
        return `${diffDays}d`;
    if (diffDays < 30)
        return `${Math.floor(diffDays / 7)}w`;
    if (diffDays < 365)
        return `${Math.floor(diffDays / 30)}mo`;
    return `${Math.floor(diffDays / 365)}y`;
}
class SessionSelectorHeader {
    scope;
    sortMode;
    nameFilter;
    keybindings;
    requestRender;
    loading = false;
    loadProgress = null;
    showPath = false;
    confirmingDeletePath = null;
    statusMessage = null;
    statusTimeout = null;
    showRenameHint = false;
    constructor(scope, sortMode, nameFilter, keybindings, requestRender) {
        this.scope = scope;
        this.sortMode = sortMode;
        this.nameFilter = nameFilter;
        this.keybindings = keybindings;
        this.requestRender = requestRender;
    }
    setScope(scope) {
        this.scope = scope;
    }
    setSortMode(sortMode) {
        this.sortMode = sortMode;
    }
    setNameFilter(nameFilter) {
        this.nameFilter = nameFilter;
    }
    setLoading(loading) {
        this.loading = loading;
        // Progress is scoped to the current load; clear whenever the loading state is set
        this.loadProgress = null;
    }
    setProgress(loaded, total) {
        this.loadProgress = { loaded, total };
    }
    setShowPath(showPath) {
        this.showPath = showPath;
    }
    setShowRenameHint(show) {
        this.showRenameHint = show;
    }
    setConfirmingDeletePath(path) {
        this.confirmingDeletePath = path;
    }
    clearStatusTimeout() {
        if (!this.statusTimeout)
            return;
        clearTimeout(this.statusTimeout);
        this.statusTimeout = null;
    }
    setStatusMessage(msg, autoHideMs) {
        this.clearStatusTimeout();
        this.statusMessage = msg;
        if (!msg || !autoHideMs)
            return;
        this.statusTimeout = setTimeout(() => {
            this.statusMessage = null;
            this.statusTimeout = null;
            this.requestRender();
        }, autoHideMs);
    }
    invalidate() { }
    render(width) {
        const title = this.scope === "current" ? "Resume Session (Current Folder)" : "Resume Session (All)";
        const leftText = theme_js_1.theme.bold(title);
        const sortLabel = this.sortMode === "threaded" ? "Threaded" : this.sortMode === "recent" ? "Recent" : "Fuzzy";
        const sortText = theme_js_1.theme.fg("muted", "Sort: ") + theme_js_1.theme.fg("accent", sortLabel);
        const nameLabel = this.nameFilter === "all" ? "All" : "Named";
        const nameText = theme_js_1.theme.fg("muted", "Name: ") + theme_js_1.theme.fg("accent", nameLabel);
        let scopeText;
        if (this.loading) {
            const progressText = this.loadProgress ? `${this.loadProgress.loaded}/${this.loadProgress.total}` : "...";
            scopeText = `${theme_js_1.theme.fg("muted", "○ Current Folder | ")}${theme_js_1.theme.fg("accent", `Loading ${progressText}`)}`;
        }
        else if (this.scope === "current") {
            scopeText = `${theme_js_1.theme.fg("accent", "◉ Current Folder")}${theme_js_1.theme.fg("muted", " | ○ All")}`;
        }
        else {
            scopeText = `${theme_js_1.theme.fg("muted", "○ Current Folder | ")}${theme_js_1.theme.fg("accent", "◉ All")}`;
        }
        const rightText = (0, pi_tui_1.truncateToWidth)(`${scopeText}  ${nameText}  ${sortText}`, width, "");
        const availableLeft = Math.max(0, width - (0, pi_tui_1.visibleWidth)(rightText) - 1);
        const left = (0, pi_tui_1.truncateToWidth)(leftText, availableLeft, "");
        const spacing = Math.max(0, width - (0, pi_tui_1.visibleWidth)(left) - (0, pi_tui_1.visibleWidth)(rightText));
        // Build hint lines - changes based on state (all branches truncate to width)
        let hintLine1;
        let hintLine2;
        if (this.confirmingDeletePath !== null) {
            const confirmHint = "Delete session? [Enter] confirm · [Esc/Ctrl+C] cancel";
            hintLine1 = theme_js_1.theme.fg("error", (0, pi_tui_1.truncateToWidth)(confirmHint, width, "…"));
            hintLine2 = "";
        }
        else if (this.statusMessage) {
            const color = this.statusMessage.type === "error" ? "error" : "accent";
            hintLine1 = theme_js_1.theme.fg(color, (0, pi_tui_1.truncateToWidth)(this.statusMessage.message, width, "…"));
            hintLine2 = "";
        }
        else {
            const pathState = this.showPath ? "(on)" : "(off)";
            const sep = theme_js_1.theme.fg("muted", " · ");
            const hint1 = (0, keybinding_hints_js_1.keyHint)("tab", "scope") + sep + theme_js_1.theme.fg("muted", 're:<pattern> regex · "phrase" exact');
            const hint2Parts = [
                (0, keybinding_hints_js_1.keyHint)("toggleSessionSort", "sort"),
                (0, keybinding_hints_js_1.appKeyHint)(this.keybindings, "toggleSessionNamedFilter", "named"),
                (0, keybinding_hints_js_1.keyHint)("deleteSession", "delete"),
                (0, keybinding_hints_js_1.keyHint)("toggleSessionPath", `path ${pathState}`),
            ];
            if (this.showRenameHint) {
                hint2Parts.push((0, keybinding_hints_js_1.keyHint)("renameSession", "rename"));
            }
            const hint2 = hint2Parts.join(sep);
            hintLine1 = (0, pi_tui_1.truncateToWidth)(hint1, width, "…");
            hintLine2 = (0, pi_tui_1.truncateToWidth)(hint2, width, "…");
        }
        return [`${left}${" ".repeat(spacing)}${rightText}`, hintLine1, hintLine2];
    }
}
/**
 * Build a tree structure from sessions based on parentSessionPath.
 * Returns root nodes sorted by modified date (descending).
 */
function buildSessionTree(sessions) {
    const byPath = new Map();
    for (const session of sessions) {
        byPath.set(session.path, { session, children: [] });
    }
    const roots = [];
    for (const session of sessions) {
        const node = byPath.get(session.path);
        const parentPath = session.parentSessionPath;
        if (parentPath && byPath.has(parentPath)) {
            byPath.get(parentPath).children.push(node);
        }
        else {
            roots.push(node);
        }
    }
    // Sort children and roots by modified date (descending)
    const sortNodes = (nodes) => {
        nodes.sort((a, b) => b.session.modified.getTime() - a.session.modified.getTime());
        for (const node of nodes) {
            sortNodes(node.children);
        }
    };
    sortNodes(roots);
    return roots;
}
/**
 * Flatten tree into display list with tree structure metadata.
 */
function flattenSessionTree(roots) {
    const result = [];
    const walk = (node, depth, ancestorContinues, isLast) => {
        result.push({ session: node.session, depth, isLast, ancestorContinues });
        for (let i = 0; i < node.children.length; i++) {
            const childIsLast = i === node.children.length - 1;
            // Only show continuation line for non-root ancestors
            const continues = depth > 0 ? !isLast : false;
            walk(node.children[i], depth + 1, [...ancestorContinues, continues], childIsLast);
        }
    };
    for (let i = 0; i < roots.length; i++) {
        walk(roots[i], 0, [], i === roots.length - 1);
    }
    return result;
}
/**
 * Custom session list component with multi-line items and search
 */
class SessionList {
    getSelectedSessionPath() {
        const selected = this.filteredSessions[this.selectedIndex];
        return selected === null || selected === void 0 ? void 0 : selected.session.path;
    }
    allSessions = [];
    filteredSessions = [];
    selectedIndex = 0;
    searchInput;
    showCwd = false;
    sortMode = "threaded";
    nameFilter = "all";
    keybindings;
    showPath = false;
    confirmingDeletePath = null;
    currentSessionFilePath;
    onSelect;
    onCancel;
    onExit = () => { };
    onToggleScope;
    onToggleSort;
    onToggleNameFilter;
    onTogglePath;
    onDeleteConfirmationChange;
    onDeleteSession;
    onRenameSession;
    onError;
    maxVisible = 10; // Max sessions visible (one line each)
    // Focusable implementation - propagate to searchInput for IME cursor positioning
    _focused = false;
    get focused() {
        return this._focused;
    }
    set focused(value) {
        this._focused = value;
        this.searchInput.focused = value;
    }
    constructor(sessions, showCwd, sortMode, nameFilter, keybindings, currentSessionFilePath) {
        this.allSessions = sessions;
        this.filteredSessions = [];
        this.searchInput = new pi_tui_1.Input();
        this.showCwd = showCwd;
        this.sortMode = sortMode;
        this.nameFilter = nameFilter;
        this.keybindings = keybindings;
        this.currentSessionFilePath = currentSessionFilePath;
        this.filterSessions("");
        // Handle Enter in search input - select current item
        this.searchInput.onSubmit = () => {
            if (this.filteredSessions[this.selectedIndex]) {
                const selected = this.filteredSessions[this.selectedIndex];
                if (this.onSelect) {
                    this.onSelect(selected.session.path);
                }
            }
        };
    }
    setSortMode(sortMode) {
        this.sortMode = sortMode;
        this.filterSessions(this.searchInput.getValue());
    }
    setNameFilter(nameFilter) {
        this.nameFilter = nameFilter;
        this.filterSessions(this.searchInput.getValue());
    }
    setSessions(sessions, showCwd) {
        this.allSessions = sessions;
        this.showCwd = showCwd;
        this.filterSessions(this.searchInput.getValue());
    }
    filterSessions(query) {
        const trimmed = query.trim();
        const nameFiltered = this.nameFilter === "all" ? this.allSessions : this.allSessions.filter((session) => (0, session_selector_search_js_1.hasSessionName)(session));
        if (this.sortMode === "threaded" && !trimmed) {
            // Threaded mode without search: show tree structure
            const roots = buildSessionTree(nameFiltered);
            this.filteredSessions = flattenSessionTree(roots);
        }
        else {
            // Other modes or with search: flat list
            const filtered = (0, session_selector_search_js_1.filterAndSortSessions)(nameFiltered, query, this.sortMode, "all");
            this.filteredSessions = filtered.map((session) => ({
                session,
                depth: 0,
                isLast: true,
                ancestorContinues: [],
            }));
        }
        this.selectedIndex = Math.min(this.selectedIndex, Math.max(0, this.filteredSessions.length - 1));
    }
    setConfirmingDeletePath(path) {
        var _a;
        this.confirmingDeletePath = path;
        (_a = this.onDeleteConfirmationChange) === null || _a === void 0 ? void 0 : _a.call(this, path);
    }
    startDeleteConfirmationForSelectedSession() {
        var _a;
        const selected = this.filteredSessions[this.selectedIndex];
        if (!selected)
            return;
        // Prevent deleting current session
        if (this.currentSessionFilePath && selected.session.path === this.currentSessionFilePath) {
            (_a = this.onError) === null || _a === void 0 ? void 0 : _a.call(this, "Cannot delete the currently active session");
            return;
        }
        this.setConfirmingDeletePath(selected.session.path);
    }
    invalidate() { }
    render(width) {
        var _a;
        const lines = [];
        // Render search input
        lines.push(...this.searchInput.render(width));
        lines.push(""); // Blank line after search
        if (this.filteredSessions.length === 0) {
            let emptyMessage;
            if (this.nameFilter === "named") {
                const toggleKey = (0, keybinding_hints_js_1.appKey)(this.keybindings, "toggleSessionNamedFilter");
                if (this.showCwd) {
                    emptyMessage = `  No named sessions found. Press ${toggleKey} to show all.`;
                }
                else {
                    emptyMessage = `  No named sessions in current folder. Press ${toggleKey} to show all, or Tab to view all.`;
                }
            }
            else if (this.showCwd) {
                // "All" scope - no sessions anywhere that match filter
                emptyMessage = "  No sessions found";
            }
            else {
                // "Current folder" scope - hint to try "all"
                emptyMessage = "  No sessions in current folder. Press Tab to view all.";
            }
            lines.push(theme_js_1.theme.fg("muted", (0, pi_tui_1.truncateToWidth)(emptyMessage, width, "…")));
            return lines;
        }
        // Calculate visible range with scrolling
        const startIndex = Math.max(0, Math.min(this.selectedIndex - Math.floor(this.maxVisible / 2), this.filteredSessions.length - this.maxVisible));
        const endIndex = Math.min(startIndex + this.maxVisible, this.filteredSessions.length);
        // Render visible sessions (one line each with tree structure)
        for (let i = startIndex; i < endIndex; i++) {
            const node = this.filteredSessions[i];
            const session = node.session;
            const isSelected = i === this.selectedIndex;
            const isConfirmingDelete = session.path === this.confirmingDeletePath;
            const isCurrent = this.currentSessionFilePath === session.path;
            // Build tree prefix
            const prefix = this.buildTreePrefix(node);
            // Session display text (name or first message)
            const hasName = !!session.name;
            const displayText = (_a = session.name) !== null && _a !== void 0 ? _a : session.firstMessage;
            const normalizedMessage = displayText.replace(/\n/g, " ").trim();
            // Right side: message count and age
            const age = formatSessionDate(session.modified);
            const msgCount = String(session.messageCount);
            let rightPart = `${msgCount} ${age}`;
            if (this.showCwd && session.cwd) {
                rightPart = `${shortenPath(session.cwd)} ${rightPart}`;
            }
            if (this.showPath) {
                rightPart = `${shortenPath(session.path)} ${rightPart}`;
            }
            // Cursor
            const cursor = isSelected ? theme_js_1.theme.fg("accent", "› ") : "  ";
            // Calculate available width for message
            const prefixWidth = (0, pi_tui_1.visibleWidth)(prefix);
            const rightWidth = (0, pi_tui_1.visibleWidth)(rightPart) + 2; // +2 for spacing
            const availableForMsg = width - 2 - prefixWidth - rightWidth; // -2 for cursor
            const truncatedMsg = (0, pi_tui_1.truncateToWidth)(normalizedMessage, Math.max(10, availableForMsg), "…");
            // Style message
            let messageColor = null;
            if (isConfirmingDelete) {
                messageColor = "error";
            }
            else if (isCurrent) {
                messageColor = "accent";
            }
            else if (hasName) {
                messageColor = "warning";
            }
            let styledMsg = messageColor ? theme_js_1.theme.fg(messageColor, truncatedMsg) : truncatedMsg;
            if (isSelected) {
                styledMsg = theme_js_1.theme.bold(styledMsg);
            }
            // Build line
            const leftPart = cursor + theme_js_1.theme.fg("dim", prefix) + styledMsg;
            const leftWidth = (0, pi_tui_1.visibleWidth)(leftPart);
            const spacing = Math.max(1, width - leftWidth - (0, pi_tui_1.visibleWidth)(rightPart));
            const styledRight = theme_js_1.theme.fg(isConfirmingDelete ? "error" : "dim", rightPart);
            let line = leftPart + " ".repeat(spacing) + styledRight;
            if (isSelected) {
                line = theme_js_1.theme.bg("selectedBg", line);
            }
            lines.push((0, pi_tui_1.truncateToWidth)(line, width));
        }
        // Add scroll indicator if needed
        if (startIndex > 0 || endIndex < this.filteredSessions.length) {
            const scrollText = `  (${this.selectedIndex + 1}/${this.filteredSessions.length})`;
            const scrollInfo = theme_js_1.theme.fg("muted", (0, pi_tui_1.truncateToWidth)(scrollText, width, ""));
            lines.push(scrollInfo);
        }
        return lines;
    }
    buildTreePrefix(node) {
        if (node.depth === 0) {
            return "";
        }
        const parts = node.ancestorContinues.map((continues) => (continues ? "│  " : "   "));
        const branch = node.isLast ? "└─ " : "├─ ";
        return parts.join("") + branch;
    }
    handleInput(keyData) {
        var _a, _b, _c, _d, _e;
        const kb = (0, pi_tui_1.getEditorKeybindings)();
        // Handle delete confirmation state first - intercept all keys
        if (this.confirmingDeletePath !== null) {
            if (kb.matches(keyData, "selectConfirm")) {
                const pathToDelete = this.confirmingDeletePath;
                this.setConfirmingDeletePath(null);
                void ((_a = this.onDeleteSession) === null || _a === void 0 ? void 0 : _a.call(this, pathToDelete));
                return;
            }
            // Allow both Escape and Ctrl+C to cancel (consistent with pi UX)
            if (kb.matches(keyData, "selectCancel") || (0, pi_tui_1.matchesKey)(keyData, "ctrl+c")) {
                this.setConfirmingDeletePath(null);
                return;
            }
            // Ignore all other keys while confirming
            return;
        }
        if (kb.matches(keyData, "tab")) {
            if (this.onToggleScope) {
                this.onToggleScope();
            }
            return;
        }
        if (kb.matches(keyData, "toggleSessionSort")) {
            (_b = this.onToggleSort) === null || _b === void 0 ? void 0 : _b.call(this);
            return;
        }
        if (this.keybindings.matches(keyData, "toggleSessionNamedFilter")) {
            (_c = this.onToggleNameFilter) === null || _c === void 0 ? void 0 : _c.call(this);
            return;
        }
        // Ctrl+P: toggle path display
        if (kb.matches(keyData, "toggleSessionPath")) {
            this.showPath = !this.showPath;
            (_d = this.onTogglePath) === null || _d === void 0 ? void 0 : _d.call(this, this.showPath);
            return;
        }
        // Ctrl+D: initiate delete confirmation (useful on terminals that don't distinguish Ctrl+Backspace from Backspace)
        if (kb.matches(keyData, "deleteSession")) {
            this.startDeleteConfirmationForSelectedSession();
            return;
        }
        // Ctrl+R: rename selected session
        if ((0, pi_tui_1.matchesKey)(keyData, "ctrl+r")) {
            const selected = this.filteredSessions[this.selectedIndex];
            if (selected) {
                (_e = this.onRenameSession) === null || _e === void 0 ? void 0 : _e.call(this, selected.session.path);
            }
            return;
        }
        // Ctrl+Backspace: non-invasive convenience alias for delete
        // Only triggers deletion when the query is empty; otherwise it is forwarded to the input
        if (kb.matches(keyData, "deleteSessionNoninvasive")) {
            if (this.searchInput.getValue().length > 0) {
                this.searchInput.handleInput(keyData);
                this.filterSessions(this.searchInput.getValue());
                return;
            }
            this.startDeleteConfirmationForSelectedSession();
            return;
        }
        // Up arrow
        if (kb.matches(keyData, "selectUp")) {
            this.selectedIndex = Math.max(0, this.selectedIndex - 1);
        }
        // Down arrow
        else if (kb.matches(keyData, "selectDown")) {
            this.selectedIndex = Math.min(this.filteredSessions.length - 1, this.selectedIndex + 1);
        }
        // Page up - jump up by maxVisible items
        else if (kb.matches(keyData, "selectPageUp")) {
            this.selectedIndex = Math.max(0, this.selectedIndex - this.maxVisible);
        }
        // Page down - jump down by maxVisible items
        else if (kb.matches(keyData, "selectPageDown")) {
            this.selectedIndex = Math.min(this.filteredSessions.length - 1, this.selectedIndex + this.maxVisible);
        }
        // Enter
        else if (kb.matches(keyData, "selectConfirm")) {
            const selected = this.filteredSessions[this.selectedIndex];
            if (selected && this.onSelect) {
                this.onSelect(selected.session.path);
            }
        }
        // Escape - cancel
        else if (kb.matches(keyData, "selectCancel")) {
            if (this.onCancel) {
                this.onCancel();
            }
        }
        // Pass everything else to search input
        else {
            this.searchInput.handleInput(keyData);
            this.filterSessions(this.searchInput.getValue());
        }
    }
}
/**
 * Delete a session file, trying the `trash` CLI first, then falling back to unlink
 */
async function deleteSessionFile(sessionPath) {
    // Try `trash` first (if installed)
    const trashArgs = sessionPath.startsWith("-") ? ["--", sessionPath] : [sessionPath];
    const trashResult = (0, node_child_process_1.spawnSync)("trash", trashArgs, { encoding: "utf-8" });
    const getTrashErrorHint = () => {
        var _a;
        var _b;
        const parts = [];
        if (trashResult.error) {
            parts.push(trashResult.error.message);
        }
        const stderr = (_a = trashResult.stderr) === null || _a === void 0 ? void 0 : _a.trim();
        if (stderr) {
            parts.push((_b = stderr.split("\n")[0]) !== null && _b !== void 0 ? _b : stderr);
        }
        if (parts.length === 0)
            return null;
        return `trash: ${parts.join(" · ").slice(0, 200)}`;
    };
    // If trash reports success, or the file is gone afterwards, treat it as successful
    if (trashResult.status === 0 || !(0, node_fs_1.existsSync)(sessionPath)) {
        return { ok: true, method: "trash" };
    }
    // Fallback to permanent deletion
    try {
        await (0, promises_1.unlink)(sessionPath);
        return { ok: true, method: "unlink" };
    }
    catch (err) {
        const unlinkError = err instanceof Error ? err.message : String(err);
        const trashErrorHint = getTrashErrorHint();
        const error = trashErrorHint ? `${unlinkError} (${trashErrorHint})` : unlinkError;
        return { ok: false, method: "unlink", error };
    }
}
/**
 * Component that renders a session selector
 */
class SessionSelectorComponent extends pi_tui_1.Container {
    handleInput(data) {
        if (this.mode === "rename") {
            const kb = (0, pi_tui_1.getEditorKeybindings)();
            if (kb.matches(data, "selectCancel") || (0, pi_tui_1.matchesKey)(data, "ctrl+c")) {
                this.exitRenameMode();
                return;
            }
            this.renameInput.handleInput(data);
            return;
        }
        this.sessionList.handleInput(data);
    }
    canRename = true;
    sessionList;
    header;
    keybindings;
    scope = "current";
    sortMode = "threaded";
    nameFilter = "all";
    currentSessions = null;
    allSessions = null;
    currentSessionsLoader;
    allSessionsLoader;
    onCancel;
    requestRender;
    renameSession;
    currentLoading = false;
    allLoading = false;
    allLoadSeq = 0;
    mode = "list";
    renameInput = new pi_tui_1.Input();
    renameTargetPath = null;
    // Focusable implementation - propagate to sessionList for IME cursor positioning
    _focused = false;
    get focused() {
        return this._focused;
    }
    set focused(value) {
        this._focused = value;
        this.sessionList.focused = value;
        this.renameInput.focused = value;
        if (value && this.mode === "rename") {
            this.renameInput.focused = true;
        }
    }
    buildBaseLayout(content, options) {
        var _a;
        this.clear();
        this.addChild(new pi_tui_1.Spacer(1));
        this.addChild(new dynamic_border_js_1.DynamicBorder((s) => theme_js_1.theme.fg("accent", s)));
        this.addChild(new pi_tui_1.Spacer(1));
        if ((_a = options === null || options === void 0 ? void 0 : options.showHeader) !== null && _a !== void 0 ? _a : true) {
            this.addChild(this.header);
            this.addChild(new pi_tui_1.Spacer(1));
        }
        this.addChild(content);
        this.addChild(new pi_tui_1.Spacer(1));
        this.addChild(new dynamic_border_js_1.DynamicBorder((s) => theme_js_1.theme.fg("accent", s)));
    }
    constructor(currentSessionsLoader, allSessionsLoader, onSelect, onCancel, onExit, requestRender, options, currentSessionFilePath) {
        var _a, _b;
        super();
        this.keybindings = (_a = options === null || options === void 0 ? void 0 : options.keybindings) !== null && _a !== void 0 ? _a : keybindings_js_1.KeybindingsManager.create();
        this.currentSessionsLoader = currentSessionsLoader;
        this.allSessionsLoader = allSessionsLoader;
        this.onCancel = onCancel;
        this.requestRender = requestRender;
        this.header = new SessionSelectorHeader(this.scope, this.sortMode, this.nameFilter, this.keybindings, this.requestRender);
        const renameSession = options === null || options === void 0 ? void 0 : options.renameSession;
        this.renameSession = renameSession;
        this.canRename = !!renameSession;
        this.header.setShowRenameHint((_b = options === null || options === void 0 ? void 0 : options.showRenameHint) !== null && _b !== void 0 ? _b : this.canRename);
        // Create session list (starts empty, will be populated after load)
        this.sessionList = new SessionList([], false, this.sortMode, this.nameFilter, this.keybindings, currentSessionFilePath);
        this.buildBaseLayout(this.sessionList);
        this.renameInput.onSubmit = (value) => {
            void this.confirmRename(value);
        };
        // Ensure header status timeouts are cleared when leaving the selector
        const clearStatusMessage = () => this.header.setStatusMessage(null);
        this.sessionList.onSelect = (sessionPath) => {
            clearStatusMessage();
            onSelect(sessionPath);
        };
        this.sessionList.onCancel = () => {
            clearStatusMessage();
            onCancel();
        };
        this.sessionList.onExit = () => {
            clearStatusMessage();
            onExit();
        };
        this.sessionList.onToggleScope = () => this.toggleScope();
        this.sessionList.onToggleSort = () => this.toggleSortMode();
        this.sessionList.onToggleNameFilter = () => this.toggleNameFilter();
        this.sessionList.onRenameSession = (sessionPath) => {
            var _a, _b;
            if (!renameSession)
                return;
            if (this.scope === "current" && this.currentLoading)
                return;
            if (this.scope === "all" && this.allLoading)
                return;
            const sessions = this.scope === "all" ? ((_a = this.allSessions) !== null && _a !== void 0 ? _a : []) : ((_b = this.currentSessions) !== null && _b !== void 0 ? _b : []);
            const session = sessions.find((s) => s.path === sessionPath);
            this.enterRenameMode(sessionPath, session === null || session === void 0 ? void 0 : session.name);
        };
        // Sync list events to header
        this.sessionList.onTogglePath = (showPath) => {
            this.header.setShowPath(showPath);
            this.requestRender();
        };
        this.sessionList.onDeleteConfirmationChange = (path) => {
            this.header.setConfirmingDeletePath(path);
            this.requestRender();
        };
        this.sessionList.onError = (msg) => {
            this.header.setStatusMessage({ type: "error", message: msg }, 3000);
            this.requestRender();
        };
        // Handle session deletion
        this.sessionList.onDeleteSession = async (sessionPath) => {
            var _a, _b, _c;
            const result = await deleteSessionFile(sessionPath);
            if (result.ok) {
                if (this.currentSessions) {
                    this.currentSessions = this.currentSessions.filter((s) => s.path !== sessionPath);
                }
                if (this.allSessions) {
                    this.allSessions = this.allSessions.filter((s) => s.path !== sessionPath);
                }
                const sessions = this.scope === "all" ? ((_a = this.allSessions) !== null && _a !== void 0 ? _a : []) : ((_b = this.currentSessions) !== null && _b !== void 0 ? _b : []);
                const showCwd = this.scope === "all";
                this.sessionList.setSessions(sessions, showCwd);
                const msg = result.method === "trash" ? "Session moved to trash" : "Session deleted";
                this.header.setStatusMessage({ type: "info", message: msg }, 2000);
                await this.refreshSessionsAfterMutation();
            }
            else {
                const errorMessage = (_c = result.error) !== null && _c !== void 0 ? _c : "Unknown error";
                this.header.setStatusMessage({ type: "error", message: `Failed to delete: ${errorMessage}` }, 3000);
            }
            this.requestRender();
        };
        // Start loading current sessions immediately
        this.loadCurrentSessions();
    }
    loadCurrentSessions() {
        void this.loadScope("current", "initial");
    }
    enterRenameMode(sessionPath, currentName) {
        this.mode = "rename";
        this.renameTargetPath = sessionPath;
        this.renameInput.setValue(currentName !== null && currentName !== void 0 ? currentName : "");
        this.renameInput.focused = true;
        const panel = new pi_tui_1.Container();
        panel.addChild(new pi_tui_1.Text(theme_js_1.theme.bold("Rename Session"), 1, 0));
        panel.addChild(new pi_tui_1.Spacer(1));
        panel.addChild(this.renameInput);
        panel.addChild(new pi_tui_1.Spacer(1));
        panel.addChild(new pi_tui_1.Text(theme_js_1.theme.fg("muted", "Enter to save · Esc/Ctrl+C to cancel"), 1, 0));
        this.buildBaseLayout(panel, { showHeader: false });
        this.requestRender();
    }
    exitRenameMode() {
        this.mode = "list";
        this.renameTargetPath = null;
        this.buildBaseLayout(this.sessionList);
        this.requestRender();
    }
    async confirmRename(value) {
        const next = value.trim();
        if (!next)
            return;
        const target = this.renameTargetPath;
        if (!target) {
            this.exitRenameMode();
            return;
        }
        // Find current name for callback
        const renameSession = this.renameSession;
        if (!renameSession) {
            this.exitRenameMode();
            return;
        }
        try {
            await renameSession(target, next);
            await this.refreshSessionsAfterMutation();
        }
        finally {
            this.exitRenameMode();
        }
    }
    async loadScope(scope, reason) {
        var _a;
        var _b;
        const showCwd = scope === "all";
        // Mark loading
        if (scope === "current") {
            this.currentLoading = true;
        }
        else {
            this.allLoading = true;
        }
        const seq = scope === "all" ? ++this.allLoadSeq : undefined;
        this.header.setScope(scope);
        this.header.setLoading(true);
        this.requestRender();
        const onProgress = (loaded, total) => {
            if (scope !== this.scope)
                return;
            if (seq !== undefined && seq !== this.allLoadSeq)
                return;
            this.header.setProgress(loaded, total);
            this.requestRender();
        };
        try {
            const sessions = await (scope === "current"
                ? this.currentSessionsLoader(onProgress)
                : this.allSessionsLoader(onProgress));
            if (scope === "current") {
                this.currentSessions = sessions;
                this.currentLoading = false;
            }
            else {
                this.allSessions = sessions;
                this.allLoading = false;
            }
            if (scope !== this.scope)
                return;
            if (seq !== undefined && seq !== this.allLoadSeq)
                return;
            this.header.setLoading(false);
            this.sessionList.setSessions(sessions, showCwd);
            this.requestRender();
            if (scope === "all" && sessions.length === 0 && ((_b = (_a = this.currentSessions) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) === 0) {
                this.onCancel();
            }
        }
        catch (err) {
            if (scope === "current") {
                this.currentLoading = false;
            }
            else {
                this.allLoading = false;
            }
            if (scope !== this.scope)
                return;
            if (seq !== undefined && seq !== this.allLoadSeq)
                return;
            const message = err instanceof Error ? err.message : String(err);
            this.header.setLoading(false);
            this.header.setStatusMessage({ type: "error", message: `Failed to load sessions: ${message}` }, 4000);
            if (reason === "initial") {
                this.sessionList.setSessions([], showCwd);
            }
            this.requestRender();
        }
    }
    toggleSortMode() {
        // Cycle: threaded -> recent -> relevance -> threaded
        this.sortMode = this.sortMode === "threaded" ? "recent" : this.sortMode === "recent" ? "relevance" : "threaded";
        this.header.setSortMode(this.sortMode);
        this.sessionList.setSortMode(this.sortMode);
        this.requestRender();
    }
    toggleNameFilter() {
        this.nameFilter = this.nameFilter === "all" ? "named" : "all";
        this.header.setNameFilter(this.nameFilter);
        this.sessionList.setNameFilter(this.nameFilter);
        this.requestRender();
    }
    async refreshSessionsAfterMutation() {
        await this.loadScope(this.scope, "refresh");
    }
    toggleScope() {
        var _a;
        if (this.scope === "current") {
            this.scope = "all";
            this.header.setScope(this.scope);
            if (this.allSessions !== null) {
                this.header.setLoading(false);
                this.sessionList.setSessions(this.allSessions, true);
                this.requestRender();
                return;
            }
            if (!this.allLoading) {
                void this.loadScope("all", "toggle");
            }
            return;
        }
        this.scope = "current";
        this.header.setScope(this.scope);
        this.header.setLoading(this.currentLoading);
        this.sessionList.setSessions((_a = this.currentSessions) !== null && _a !== void 0 ? _a : [], false);
        this.requestRender();
    }
    getSessionList() {
        return this.sessionList;
    }
}
exports.SessionSelectorComponent = SessionSelectorComponent;
