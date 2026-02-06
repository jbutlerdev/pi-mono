"use strict";
/**
 * Tool wrappers for extensions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapRegisteredTool = wrapRegisteredTool;
exports.wrapRegisteredTools = wrapRegisteredTools;
exports.wrapToolWithExtensions = wrapToolWithExtensions;
exports.wrapToolsWithExtensions = wrapToolsWithExtensions;
/**
 * Wrap a RegisteredTool into an AgentTool.
 * Uses the runner's createContext() for consistent context across tools and event handlers.
 */
function wrapRegisteredTool(registeredTool, runner) {
    const { definition } = registeredTool;
    return {
        name: definition.name,
        label: definition.label,
        description: definition.description,
        parameters: definition.parameters,
        execute: (toolCallId, params, signal, onUpdate) => definition.execute(toolCallId, params, signal, onUpdate, runner.createContext()),
    };
}
/**
 * Wrap all registered tools into AgentTools.
 * Uses the runner's createContext() for consistent context across tools and event handlers.
 */
function wrapRegisteredTools(registeredTools, runner) {
    return registeredTools.map((rt) => wrapRegisteredTool(rt, runner));
}
/**
 * Wrap a tool with extension callbacks for interception.
 * - Emits tool_call event before execution (can block)
 * - Emits tool_result event after execution (can modify result)
 */
function wrapToolWithExtensions(tool, runner) {
    return Object.assign(Object.assign({}, tool), { execute: async (toolCallId, params, signal, onUpdate) => {
            var _a, _b;
            // Emit tool_call event - extensions can block execution
            if (runner.hasHandlers("tool_call")) {
                try {
                    const callResult = (await runner.emitToolCall({
                        type: "tool_call",
                        toolName: tool.name,
                        toolCallId,
                        input: params,
                    }));
                    if (callResult === null || callResult === void 0 ? void 0 : callResult.block) {
                        const reason = callResult.reason || "Tool execution was blocked by an extension";
                        throw new Error(reason);
                    }
                }
                catch (err) {
                    if (err instanceof Error) {
                        throw err;
                    }
                    throw new Error(`Extension failed, blocking execution: ${String(err)}`);
                }
            }
            // Execute the actual tool
            try {
                const result = await tool.execute(toolCallId, params, signal, onUpdate);
                // Emit tool_result event - extensions can modify the result
                if (runner.hasHandlers("tool_result")) {
                    const resultResult = await runner.emitToolResult({
                        type: "tool_result",
                        toolName: tool.name,
                        toolCallId,
                        input: params,
                        content: result.content,
                        details: result.details,
                        isError: false,
                    });
                    if (resultResult) {
                        return {
                            content: (_a = resultResult.content) !== null && _a !== void 0 ? _a : result.content,
                            details: ((_b = resultResult.details) !== null && _b !== void 0 ? _b : result.details),
                        };
                    }
                }
                return result;
            }
            catch (err) {
                // Emit tool_result event for errors
                if (runner.hasHandlers("tool_result")) {
                    await runner.emitToolResult({
                        type: "tool_result",
                        toolName: tool.name,
                        toolCallId,
                        input: params,
                        content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
                        details: undefined,
                        isError: true,
                    });
                }
                throw err;
            }
        } });
}
/**
 * Wrap all tools with extension callbacks.
 */
function wrapToolsWithExtensions(tools, runner) {
    return tools.map((tool) => wrapToolWithExtensions(tool, runner));
}
