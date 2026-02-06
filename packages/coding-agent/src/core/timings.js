"use strict";
/**
 * Central timing instrumentation for startup profiling.
 * Enable with PI_TIMING=1 environment variable.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.time = time;
exports.printTimings = printTimings;
const ENABLED = process.env.PI_TIMING === "1";
const timings = [];
let lastTime = Date.now();
function time(label) {
    if (!ENABLED)
        return;
    const now = Date.now();
    timings.push({ label, ms: now - lastTime });
    lastTime = now;
}
function printTimings() {
    if (!ENABLED || timings.length === 0)
        return;
    console.error("\n--- Startup Timings ---");
    for (const t of timings) {
        console.error(`  ${t.label}: ${t.ms}ms`);
    }
    console.error(`  TOTAL: ${timings.reduce((a, b) => a + b.ms, 0)}ms`);
    console.error("------------------------\n");
}
