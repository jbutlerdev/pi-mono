"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sleep = sleep;
/**
 * Sleep helper that respects abort signal.
 */
function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        if (signal === null || signal === void 0 ? void 0 : signal.aborted) {
            reject(new Error("Aborted"));
            return;
        }
        const timeout = setTimeout(() => {
            if (signal) {
                signal.removeEventListener("abort", onAbort);
            }
            resolve();
        }, ms);
        const onAbort = () => {
            clearTimeout(timeout);
            reject(new Error("Aborted"));
        };
        signal === null || signal === void 0 ? void 0 : signal.addEventListener("abort", onAbort, { once: true });
    });
}
