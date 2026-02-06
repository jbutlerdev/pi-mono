"use strict";
/**
 * Extension system for lifecycle events and custom tools.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapToolWithExtensions = exports.wrapToolsWithExtensions = exports.wrapRegisteredTools = exports.wrapRegisteredTool = exports.isWriteToolResult = exports.isToolCallEventType = exports.isReadToolResult = exports.isLsToolResult = exports.isGrepToolResult = exports.isFindToolResult = exports.isEditToolResult = exports.isBashToolResult = exports.ExtensionRunner = exports.loadExtensions = exports.loadExtensionFromFactory = exports.discoverAndLoadExtensions = exports.createExtensionRuntime = void 0;
const loader_js_1 = require("./loader.js");
Object.defineProperty(exports, "createExtensionRuntime", { enumerable: true, get: function () { return loader_js_1.createExtensionRuntime; } });
Object.defineProperty(exports, "discoverAndLoadExtensions", { enumerable: true, get: function () { return loader_js_1.discoverAndLoadExtensions; } });
Object.defineProperty(exports, "loadExtensionFromFactory", { enumerable: true, get: function () { return loader_js_1.loadExtensionFromFactory; } });
Object.defineProperty(exports, "loadExtensions", { enumerable: true, get: function () { return loader_js_1.loadExtensions; } });
const runner_js_1 = require("./runner.js");
Object.defineProperty(exports, "ExtensionRunner", { enumerable: true, get: function () { return runner_js_1.ExtensionRunner; } });
// Type guards
const types_js_1 = require("./types.js");
Object.defineProperty(exports, "isBashToolResult", { enumerable: true, get: function () { return types_js_1.isBashToolResult; } });
Object.defineProperty(exports, "isEditToolResult", { enumerable: true, get: function () { return types_js_1.isEditToolResult; } });
Object.defineProperty(exports, "isFindToolResult", { enumerable: true, get: function () { return types_js_1.isFindToolResult; } });
Object.defineProperty(exports, "isGrepToolResult", { enumerable: true, get: function () { return types_js_1.isGrepToolResult; } });
Object.defineProperty(exports, "isLsToolResult", { enumerable: true, get: function () { return types_js_1.isLsToolResult; } });
Object.defineProperty(exports, "isReadToolResult", { enumerable: true, get: function () { return types_js_1.isReadToolResult; } });
Object.defineProperty(exports, "isToolCallEventType", { enumerable: true, get: function () { return types_js_1.isToolCallEventType; } });
Object.defineProperty(exports, "isWriteToolResult", { enumerable: true, get: function () { return types_js_1.isWriteToolResult; } });
const wrapper_js_1 = require("./wrapper.js");
Object.defineProperty(exports, "wrapRegisteredTool", { enumerable: true, get: function () { return wrapper_js_1.wrapRegisteredTool; } });
Object.defineProperty(exports, "wrapRegisteredTools", { enumerable: true, get: function () { return wrapper_js_1.wrapRegisteredTools; } });
Object.defineProperty(exports, "wrapToolsWithExtensions", { enumerable: true, get: function () { return wrapper_js_1.wrapToolsWithExtensions; } });
Object.defineProperty(exports, "wrapToolWithExtensions", { enumerable: true, get: function () { return wrapper_js_1.wrapToolWithExtensions; } });
