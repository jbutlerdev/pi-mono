"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ShowImagesSelectorComponent = void 0;
const pi_tui_1 = require("@mariozechner/pi-tui");
const theme_js_1 = require("../theme/theme.js");
const dynamic_border_js_1 = require("./dynamic-border.js");
/**
 * Component that renders a show images selector with borders
 */
class ShowImagesSelectorComponent extends pi_tui_1.Container {
    selectList;
    constructor(currentValue, onSelect, onCancel) {
        super();
        const items = [
            { value: "yes", label: "Yes", description: "Show images inline in terminal" },
            { value: "no", label: "No", description: "Show text placeholder instead" },
        ];
        // Add top border
        this.addChild(new dynamic_border_js_1.DynamicBorder());
        // Create selector
        this.selectList = new pi_tui_1.SelectList(items, 5, (0, theme_js_1.getSelectListTheme)());
        // Preselect current value
        this.selectList.setSelectedIndex(currentValue ? 0 : 1);
        this.selectList.onSelect = (item) => {
            onSelect(item.value === "yes");
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
exports.ShowImagesSelectorComponent = ShowImagesSelectorComponent;
