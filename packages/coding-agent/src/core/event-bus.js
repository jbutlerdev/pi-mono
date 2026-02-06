"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEventBus = createEventBus;
const node_events_1 = require("node:events");
function createEventBus() {
    const emitter = new node_events_1.EventEmitter();
    return {
        emit: (channel, data) => {
            emitter.emit(channel, data);
        },
        on: (channel, handler) => {
            const safeHandler = async (data) => {
                try {
                    await handler(data);
                }
                catch (err) {
                    console.error(`Event handler error (${channel}):`, err);
                }
            };
            emitter.on(channel, safeHandler);
            return () => emitter.off(channel, safeHandler);
        },
        clear: () => {
            emitter.removeAllListeners();
        },
    };
}
