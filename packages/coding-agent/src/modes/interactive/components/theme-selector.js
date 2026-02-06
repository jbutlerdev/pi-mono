"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThemeSelectorComponent = void 0;
const pi_tui_1 = require("@mariozechner/pi-tui");
const theme_js_1 = require("../theme/theme.js");
const dynamic_border_js_1 = require("./dynamic-border.js");
/**
 * Component that renders a theme selector
 */
class ThemeSelectorComponent extends pi_tui_1.Container {
    selectList;
    onPreview;
    constructor(currentTheme, onSelect, onCancel, onPreview) {
        super();
        this.onPreview = onPreview;
        // Get available themes and create select items
        const themes = (0, theme_js_1.getAvailableThemes)();
        const themeItems = themes.map((name) => ({
            value: name,
            label: name,
            description: name === currentTheme ? "(current)" : undefined,
        }));
        // Add top border
        this.addChild(new dynamic_border_js_1.DynamicBorder());
        // Create selector
        this.selectList = new pi_tui_1.SelectList(themeItems, 10, (0, theme_js_1.getSelectListTheme)());
        // Preselect current theme
        const currentIndex = themes.indexOf(currentTheme);
        if (currentIndex !== -1) {
            this.selectList.setSelectedIndex(currentIndex);
        }
        this.selectList.onSelect = (item) => {
            onSelect(item.value);
        };
        this.selectList.onCancel = () => {
            onCancel();
        };
        this.selectList.onSelectionChange = (item) => {
            this.onPreview(item.value);
        };
        this.addChild(this.selectList);
        // Add bottom border
        this.addChild(new dynamic_border_js_1.DynamicBorder());
    }
    getSelectList() {
        return this.selectList;
    }
}
exports.ThemeSelectorComponent = ThemeSelectorComponent;
