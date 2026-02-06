"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KeybindingsManager = exports.DEFAULT_KEYBINDINGS = exports.DEFAULT_APP_KEYBINDINGS = void 0;
const pi_tui_1 = require("@mariozechner/pi-tui");
const fs_1 = require("fs");
const path_1 = require("path");
const config_js_1 = require("../config.js");
/**
 * Default application keybindings.
 */
exports.DEFAULT_APP_KEYBINDINGS = {
    interrupt: "escape",
    clear: "ctrl+c",
    exit: "ctrl+d",
    suspend: "ctrl+z",
    cycleThinkingLevel: "shift+tab",
    cycleModelForward: "ctrl+p",
    cycleModelBackward: "shift+ctrl+p",
    selectModel: "ctrl+l",
    expandTools: "ctrl+o",
    toggleThinking: "ctrl+t",
    toggleSessionNamedFilter: "ctrl+n",
    externalEditor: "ctrl+g",
    followUp: "alt+enter",
    dequeue: "alt+up",
    pasteImage: "ctrl+v",
    newSession: [],
    tree: [],
    fork: [],
    resume: [],
};
/**
 * All default keybindings (app + editor).
 */
exports.DEFAULT_KEYBINDINGS = Object.assign(Object.assign({}, pi_tui_1.DEFAULT_EDITOR_KEYBINDINGS), exports.DEFAULT_APP_KEYBINDINGS);
// App actions list for type checking
const APP_ACTIONS = [
    "interrupt",
    "clear",
    "exit",
    "suspend",
    "cycleThinkingLevel",
    "cycleModelForward",
    "cycleModelBackward",
    "selectModel",
    "expandTools",
    "toggleThinking",
    "toggleSessionNamedFilter",
    "externalEditor",
    "followUp",
    "dequeue",
    "pasteImage",
    "newSession",
    "tree",
    "fork",
    "resume",
];
function isAppAction(action) {
    return APP_ACTIONS.includes(action);
}
/**
 * Manages all keybindings (app + editor).
 */
class KeybindingsManager {
    config;
    appActionToKeys;
    constructor(config) {
        this.config = config;
        this.appActionToKeys = new Map();
        this.buildMaps();
    }
    /**
     * Create from config file and set up editor keybindings.
     */
    static create(agentDir = (0, config_js_1.getAgentDir)()) {
        const configPath = (0, path_1.join)(agentDir, "keybindings.json");
        const config = KeybindingsManager.loadFromFile(configPath);
        const manager = new KeybindingsManager(config);
        // Set up editor keybindings globally
        // Include both editor actions and expandTools (shared between app and editor)
        const editorConfig = {};
        for (const [action, keys] of Object.entries(config)) {
            if (!isAppAction(action) || action === "expandTools") {
                editorConfig[action] = keys;
            }
        }
        (0, pi_tui_1.setEditorKeybindings)(new pi_tui_1.EditorKeybindingsManager(editorConfig));
        return manager;
    }
    /**
     * Create in-memory.
     */
    static inMemory(config = {}) {
        return new KeybindingsManager(config);
    }
    static loadFromFile(path) {
        if (!(0, fs_1.existsSync)(path))
            return {};
        try {
            return JSON.parse((0, fs_1.readFileSync)(path, "utf-8"));
        }
        catch (_a) {
            return {};
        }
    }
    buildMaps() {
        this.appActionToKeys.clear();
        // Set defaults for app actions
        for (const [action, keys] of Object.entries(exports.DEFAULT_APP_KEYBINDINGS)) {
            const keyArray = Array.isArray(keys) ? keys : [keys];
            this.appActionToKeys.set(action, [...keyArray]);
        }
        // Override with user config (app actions only)
        for (const [action, keys] of Object.entries(this.config)) {
            if (keys === undefined || !isAppAction(action))
                continue;
            const keyArray = Array.isArray(keys) ? keys : [keys];
            this.appActionToKeys.set(action, keyArray);
        }
    }
    /**
     * Check if input matches an app action.
     */
    matches(data, action) {
        const keys = this.appActionToKeys.get(action);
        if (!keys)
            return false;
        for (const key of keys) {
            if ((0, pi_tui_1.matchesKey)(data, key))
                return true;
        }
        return false;
    }
    /**
     * Get keys bound to an app action.
     */
    getKeys(action) {
        var _a;
        return (_a = this.appActionToKeys.get(action)) !== null && _a !== void 0 ? _a : [];
    }
    /**
     * Get the full effective config.
     */
    getEffectiveConfig() {
        const result = Object.assign({}, exports.DEFAULT_KEYBINDINGS);
        for (const [action, keys] of Object.entries(this.config)) {
            if (keys !== undefined) {
                result[action] = keys;
            }
        }
        return result;
    }
}
exports.KeybindingsManager = KeybindingsManager;
