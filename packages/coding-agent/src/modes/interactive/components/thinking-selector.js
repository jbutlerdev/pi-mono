"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThinkingSelectorComponent = void 0;
const pi_tui_1 = require("@mariozechner/pi-tui");
const theme_js_1 = require("../theme/theme.js");
const dynamic_border_js_1 = require("./dynamic-border.js");
const LEVEL_DESCRIPTIONS = {
    off: "No reasoning",
    minimal: "Very brief reasoning (~1k tokens)",
    low: "Light reasoning (~2k tokens)",
    medium: "Moderate reasoning (~8k tokens)",
    high: "Deep reasoning (~16k tokens)",
    xhigh: "Maximum reasoning (~32k tokens)",
};
/**
 * Component that renders a thinking level selector with borders
 */
class ThinkingSelectorComponent extends pi_tui_1.Container {
    selectList;
    constructor(currentLevel, availableLevels, onSelect, onCancel) {
        super();
        const thinkingLevels = availableLevels.map((level) => ({
            value: level,
            label: level,
            description: LEVEL_DESCRIPTIONS[level],
        }));
        // Add top border
        this.addChild(new dynamic_border_js_1.DynamicBorder());
        // Create selector
        this.selectList = new pi_tui_1.SelectList(thinkingLevels, thinkingLevels.length, (0, theme_js_1.getSelectListTheme)());
        // Preselect current level
        const currentIndex = thinkingLevels.findIndex((item) => item.value === currentLevel);
        if (currentIndex !== -1) {
            this.selectList.setSelectedIndex(currentIndex);
        }
        this.selectList.onSelect = (item) => {
            onSelect(item.value);
        };
        this.selectList.onCancel = () => {
            onCancel();
        };
        this.addChild(this.selectList);
        // Add bottom border
        this.addChild(new dynamic_border_js_1.DynamicBorder());
    }
    getSelectList() {
        return this.selectList;
    }
}
exports.ThinkingSelectorComponent = ThinkingSelectorComponent;
