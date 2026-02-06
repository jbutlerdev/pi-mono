"use strict";
/**
 * Multi-line editor component for extensions.
 * Supports Ctrl+G for external editor.
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
exports.ExtensionEditorComponent = void 0;
const node_child_process_1 = require("node:child_process");
const fs = __importStar(require("node:fs"));
const os = __importStar(require("node:os"));
const path = __importStar(require("node:path"));
const pi_tui_1 = require("@mariozechner/pi-tui");
const theme_js_1 = require("../theme/theme.js");
const dynamic_border_js_1 = require("./dynamic-border.js");
const keybinding_hints_js_1 = require("./keybinding-hints.js");
class ExtensionEditorComponent extends pi_tui_1.Container {
    editor;
    onSubmitCallback;
    onCancelCallback;
    tui;
    keybindings;
    constructor(tui, keybindings, title, prefill, onSubmit, onCancel, options) {
        super();
        this.tui = tui;
        this.keybindings = keybindings;
        this.onSubmitCallback = onSubmit;
        this.onCancelCallback = onCancel;
        // Add top border
        this.addChild(new dynamic_border_js_1.DynamicBorder());
        this.addChild(new pi_tui_1.Spacer(1));
        // Add title
        this.addChild(new pi_tui_1.Text(theme_js_1.theme.fg("accent", title), 1, 0));
        this.addChild(new pi_tui_1.Spacer(1));
        // Create editor
        this.editor = new pi_tui_1.Editor(tui, (0, theme_js_1.getEditorTheme)(), options);
        if (prefill) {
            this.editor.setText(prefill);
        }
        // Wire up Enter to submit (Shift+Enter for newlines, like the main editor)
        this.editor.onSubmit = (text) => {
            this.onSubmitCallback(text);
        };
        this.addChild(this.editor);
        this.addChild(new pi_tui_1.Spacer(1));
        // Add hint
        const hasExternalEditor = !!(process.env.VISUAL || process.env.EDITOR);
        const hint = (0, keybinding_hints_js_1.keyHint)("selectConfirm", "submit") +
            "  " +
            (0, keybinding_hints_js_1.keyHint)("newLine", "newline") +
            "  " +
            (0, keybinding_hints_js_1.keyHint)("selectCancel", "cancel") +
            (hasExternalEditor ? `  ${(0, keybinding_hints_js_1.appKeyHint)(this.keybindings, "externalEditor", "external editor")}` : "");
        this.addChild(new pi_tui_1.Text(hint, 1, 0));
        this.addChild(new pi_tui_1.Spacer(1));
        // Add bottom border
        this.addChild(new dynamic_border_js_1.DynamicBorder());
    }
    handleInput(keyData) {
        const kb = (0, pi_tui_1.getEditorKeybindings)();
        // Escape or Ctrl+C to cancel
        if (kb.matches(keyData, "selectCancel")) {
            this.onCancelCallback();
            return;
        }
        // External editor (app keybinding)
        if (this.keybindings.matches(keyData, "externalEditor")) {
            this.openExternalEditor();
            return;
        }
        // Forward to editor
        this.editor.handleInput(keyData);
    }
    openExternalEditor() {
        const editorCmd = process.env.VISUAL || process.env.EDITOR;
        if (!editorCmd) {
            return;
        }
        const currentText = this.editor.getText();
        const tmpFile = path.join(os.tmpdir(), `pi-extension-editor-${Date.now()}.md`);
        try {
            fs.writeFileSync(tmpFile, currentText, "utf-8");
            this.tui.stop();
            const [editor, ...editorArgs] = editorCmd.split(" ");
            const result = (0, node_child_process_1.spawnSync)(editor, [...editorArgs, tmpFile], {
                stdio: "inherit",
            });
            if (result.status === 0) {
                const newContent = fs.readFileSync(tmpFile, "utf-8").replace(/\n$/, "");
                this.editor.setText(newContent);
            }
        }
        finally {
            try {
                fs.unlinkSync(tmpFile);
            }
            catch (_a) {
                // Ignore cleanup errors
            }
            this.tui.start();
            // Force full re-render since external editor uses alternate screen
            this.tui.requestRender(true);
        }
    }
}
exports.ExtensionEditorComponent = ExtensionEditorComponent;
