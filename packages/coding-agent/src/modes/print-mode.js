"use strict";
/**
 * Print mode (single-shot): Send prompts, output result, exit.
 *
 * Used for:
 * - `pi -p "prompt"` - text output
 * - `pi --mode json "prompt"` - JSON event stream
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
exports.runPrintMode = runPrintMode;
exports.runPrintModeWithCheck = runPrintModeWithCheck;
const session_manager_js_1 = require("../core/session-manager.js");
/**
 * Run in print (single-shot) mode.
 * Sends prompts to the agent and outputs the result.
 */
async function runPrintMode(session, options) {
    const { mode, messages = [], initialMessage, initialImages } = options;
    if (mode === "json") {
        const header = session.sessionManager.getHeader();
        if (header) {
            console.log(JSON.stringify(header));
        }
    }
    // Set up extensions for print mode (no UI)
    await session.bindExtensions({
        commandContextActions: {
            waitForIdle: () => session.agent.waitForIdle(),
            newSession: async (options) => {
                const success = await session.newSession({ parentSession: options === null || options === void 0 ? void 0 : options.parentSession });
                if (success && (options === null || options === void 0 ? void 0 : options.setup)) {
                    await options.setup(session.sessionManager);
                }
                return { cancelled: !success };
            },
            fork: async (entryId) => {
                const result = await session.fork(entryId);
                return { cancelled: result.cancelled };
            },
            navigateTree: async (targetId, options) => {
                const result = await session.navigateTree(targetId, {
                    summarize: options === null || options === void 0 ? void 0 : options.summarize,
                    customInstructions: options === null || options === void 0 ? void 0 : options.customInstructions,
                    replaceInstructions: options === null || options === void 0 ? void 0 : options.replaceInstructions,
                    label: options === null || options === void 0 ? void 0 : options.label,
                });
                return { cancelled: result.cancelled };
            },
            switchSession: async (sessionPath) => {
                const success = await session.switchSession(sessionPath);
                return { cancelled: !success };
            },
        },
        onError: (err) => {
            console.error(`Extension error (${err.extensionPath}): ${err.error}`);
        },
    });
    // Always subscribe to enable session persistence via _handleAgentEvent
    session.subscribe((event) => {
        // In JSON mode, output all events
        if (mode === "json") {
            console.log(JSON.stringify(event));
        }
    });
    // Send initial message with attachments
    if (initialMessage) {
        await session.prompt(initialMessage, { images: initialImages });
    }
    // Send remaining messages
    for (const message of messages) {
        await session.prompt(message);
    }
    // In text mode, output final response
    if (mode === "text") {
        const state = session.state;
        const lastMessage = state.messages[state.messages.length - 1];
        if ((lastMessage === null || lastMessage === void 0 ? void 0 : lastMessage.role) === "assistant") {
            const assistantMsg = lastMessage;
            // Check for error/aborted
            if (assistantMsg.stopReason === "error" || assistantMsg.stopReason === "aborted") {
                console.error(assistantMsg.errorMessage || `Request ${assistantMsg.stopReason}`);
                process.exit(1);
            }
            // Output text content
            for (const content of assistantMsg.content) {
                if (content.type === "text") {
                    console.log(content.text);
                }
            }
        }
    }
    // Ensure stdout is fully flushed before returning
    // This prevents race conditions where the process exits before all output is written
    await new Promise((resolve, reject) => {
        process.stdout.write("", (err) => {
            if (err)
                reject(err);
            else
                resolve();
        });
    });
}
/**
 * Extract text content from an assistant message
 */
function extractAssistantText(message) {
    if ((message === null || message === void 0 ? void 0 : message.role) !== "assistant") {
        return "";
    }
    if (Array.isArray(message.content)) {
        return message.content
            .filter((c) => c.type === "text")
            .map((c) => c.text)
            .join("\n");
    }
    if (typeof message.content === "string") {
        return message.content;
    }
    return "";
}
/**
 * Check if the last message fully answers the original prompt
 */
async function checkCompletion(originalPrompt, lastAssistantMessage, authStorage, modelRegistry, model, thinkingLevel) {
    const checkPrompt = `
Evaluate the following assistant response and determine if it fully answers the user's original prompt.

Original user prompt:
"""
${originalPrompt}
"""

Assistant's response:
"""
${lastAssistantMessage}
"""

Evaluate the response carefully. Consider:
1. Does the response directly address all parts of the original prompt?
2. Are there any obvious omissions or incomplete work?
3. Did the assistant make claims about completing work that isn't actually shown?
4. Is the response evasive or overly general without substance?

Respond with ONLY a JSON object (no other text):
{
  "complete": true/false,
  "reason": "brief explanation of your decision"
}

Be precise - if the response is incomplete or doesn't fully address the prompt, mark it as incomplete.
`;
    try {
        // Create a separate session for verification with same config
        const { session: verificationSession } = await Promise.resolve().then(() => __importStar(require("../core/sdk.js"))).then((m) => m.createAgentSession({
            sessionManager: session_manager_js_1.SessionManager.inMemory(),
            authStorage,
            modelRegistry,
            model,
            thinkingLevel,
            resourceLoader: undefined, // No discovery needed
            settingsManager: undefined, // Use defaults
        }));
        // Override system prompt for verification
        verificationSession.agent.state.systemPrompt =
            "You are a completion verification assistant. Respond with JSON only.";
        // Send the check prompt
        await verificationSession.prompt(checkPrompt);
        await verificationSession.agent.waitForIdle();
        // Get the last message
        const state = verificationSession.state;
        const lastMessage = state.messages[state.messages.length - 1];
        if (!lastMessage) {
            return { complete: true, reason: "No response, assuming complete" };
        }
        // Extract text from response - it should be an assistant message
        let fullResponse = "";
        if (lastMessage.role === "assistant") {
            const msg = lastMessage;
            if (Array.isArray(msg.content)) {
                fullResponse = msg.content
                    .filter((c) => c.type === "text")
                    .map((c) => c.text)
                    .join("");
            }
            else if (typeof msg.content === "string") {
                fullResponse = msg.content;
            }
        }
        // Parse JSON response
        const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            return result;
        }
        // If no JSON found, try to infer from text
        const lowerResponse = fullResponse.toLowerCase();
        const complete = !lowerResponse.includes("incomplete") &&
            !lowerResponse.includes("does not") &&
            !lowerResponse.includes("failed to") &&
            !lowerResponse.includes("not fully");
        return {
            complete,
            reason: fullResponse.slice(0, 200),
        };
    }
    catch (error) {
        process.stderr.write(`Error checking completion: ${error instanceof Error ? error.message : String(error)}\n`);
        // On error, assume complete to avoid infinite loops
        return { complete: true, reason: "Check failed, assuming complete" };
    }
    finally {
        // Clean up verification session
        // verificationSession?.dispose?.();
    }
}
/**
 * Run in print mode with completion verification
 */
async function runPrintModeWithCheck(session, options, authStorage, modelRegistry) {
    const { mode, messages = [], initialMessage, maxRetries = 3, verbose = false, stream = true } = options;
    if (mode === "json") {
        const header = session.sessionManager.getHeader();
        if (header) {
            console.log(JSON.stringify(header));
        }
    }
    // Set up extensions for print mode (no UI)
    await session.bindExtensions({
        commandContextActions: {
            waitForIdle: () => session.agent.waitForIdle(),
            newSession: async (options) => {
                const success = await session.newSession({ parentSession: options === null || options === void 0 ? void 0 : options.parentSession });
                if (success && (options === null || options === void 0 ? void 0 : options.setup)) {
                    await options.setup(session.sessionManager);
                }
                return { cancelled: !success };
            },
            fork: async (entryId) => {
                const result = await session.fork(entryId);
                return { cancelled: result.cancelled };
            },
            navigateTree: async (targetId, options) => {
                const result = await session.navigateTree(targetId, {
                    summarize: options === null || options === void 0 ? void 0 : options.summarize,
                    customInstructions: options === null || options === void 0 ? void 0 : options.customInstructions,
                    replaceInstructions: options === null || options === void 0 ? void 0 : options.replaceInstructions,
                    label: options === null || options === void 0 ? void 0 : options.label,
                });
                return { cancelled: result.cancelled };
            },
            switchSession: async (sessionPath) => {
                const success = await session.switchSession(sessionPath);
                return { cancelled: !success };
            },
        },
        onError: (err) => {
            console.error(`Extension error (${err.extensionPath}): ${err.error}`);
        },
    });
    // Always subscribe to enable session persistence via _handleAgentEvent
    session.subscribe((event) => {
        // In JSON mode, output all events
        if (mode === "json") {
            console.log(JSON.stringify(event));
        }
    });
    // Store original prompt for comparison
    const originalPrompt = initialMessage || messages[0] || "";
    // Main loop: prompt -> verify -> retry if needed
    let retryCount = 0;
    let finalOutput = "";
    // Track whether we've already output the final message to prevent duplicates
    let hasOutputFinal = false;
    while (retryCount <= maxRetries) {
        // Send the prompt (or retry instruction)
        const messageToSend = retryCount === 0
            ? initialMessage || messages[0] || ""
            : "The previous response did not fully address the original prompt. Please complete the task properly.";
        if (messageToSend) {
            // Subscribe to stream output only if streaming is enabled
            let unsubscribe;
            if (stream) {
                unsubscribe = session.subscribe((event) => {
                    if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
                        process.stdout.write(event.assistantMessageEvent.delta);
                    }
                    else if (event.type === "tool_execution_start" && verbose) {
                        process.stderr.write(`\n[Tool: ${event.toolName}]\n`);
                    }
                });
            }
            await session.prompt(messageToSend);
            await session.agent.waitForIdle();
            // Unsubscribe to avoid duplicate output on retries
            unsubscribe === null || unsubscribe === void 0 ? void 0 : unsubscribe();
        }
        // Get the last assistant message
        const state = session.state;
        const lastMessage = state.messages[state.messages.length - 1];
        if (!lastMessage || (lastMessage === null || lastMessage === void 0 ? void 0 : lastMessage.role) !== "assistant") {
            if (verbose) {
                process.stderr.write("\n[No assistant message generated]\n");
            }
            break;
        }
        finalOutput = extractAssistantText(lastMessage);
        // Check if complete using a separate session with same config
        const { complete, reason } = await checkCompletion(originalPrompt, finalOutput, authStorage, modelRegistry, session.model, session.thinkingLevel);
        if (verbose) {
            process.stderr.write(`\n[Completion check: ${complete ? "✓" : "✗"} - ${reason}]\n`);
        }
        if (complete) {
            break;
        }
        if (retryCount < maxRetries) {
            if (verbose) {
                process.stderr.write(`\n[Retrying... (${retryCount + 1}/${maxRetries})]\n`);
            }
        }
        retryCount++;
    }
    // Output final message if not streaming (streaming already outputs live)
    if (!stream && finalOutput && !hasOutputFinal) {
        console.log(finalOutput);
        hasOutputFinal = true;
    }
    else if (stream) {
        // Ensure final output is flushed when streaming
        process.stdout.write("\n");
    }
    if (verbose) {
        process.stderr.write(`\n[Completed after ${retryCount} attempt(s)]\n`);
    }
}
