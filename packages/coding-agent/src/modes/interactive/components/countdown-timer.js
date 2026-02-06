"use strict";
/**
 * Reusable countdown timer for dialog components.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CountdownTimer = void 0;
class CountdownTimer {
    tui;
    onTick;
    onExpire;
    intervalId;
    remainingSeconds;
    constructor(timeoutMs, tui, onTick, onExpire) {
        this.tui = tui;
        this.onTick = onTick;
        this.onExpire = onExpire;
        this.remainingSeconds = Math.ceil(timeoutMs / 1000);
        this.onTick(this.remainingSeconds);
        this.intervalId = setInterval(() => {
            var _a;
            this.remainingSeconds--;
            this.onTick(this.remainingSeconds);
            (_a = this.tui) === null || _a === void 0 ? void 0 : _a.requestRender();
            if (this.remainingSeconds <= 0) {
                this.dispose();
                this.onExpire();
            }
        }, 1000);
    }
    dispose() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = undefined;
        }
    }
}
exports.CountdownTimer = CountdownTimer;
