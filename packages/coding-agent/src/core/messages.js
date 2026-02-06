"use strict";
/**
 * Custom message types and transformers for the coding agent.
 *
 * Extends the base AgentMessage type with coding-agent specific message types,
 * and provides a transformer to convert them to LLM-compatible messages.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BRANCH_SUMMARY_SUFFIX = exports.BRANCH_SUMMARY_PREFIX = exports.COMPACTION_SUMMARY_SUFFIX = exports.COMPACTION_SUMMARY_PREFIX = void 0;
exports.bashExecutionToText = bashExecutionToText;
exports.createBranchSummaryMessage = createBranchSummaryMessage;
exports.createCompactionSummaryMessage = createCompactionSummaryMessage;
exports.createCustomMessage = createCustomMessage;
exports.convertToLlm = convertToLlm;
const pi_ai_1 = require("@mariozechner/pi-ai");
exports.COMPACTION_SUMMARY_PREFIX = `The conversation history before this point was compacted into the following summary:

<summary>
`;
exports.COMPACTION_SUMMARY_SUFFIX = `
</summary>`;
exports.BRANCH_SUMMARY_PREFIX = `The following is a summary of a branch that this conversation came back from:

<summary>
`;
exports.BRANCH_SUMMARY_SUFFIX = `</summary>`;
/**
 * Convert a BashExecutionMessage to user message text for LLM context.
 */
function bashExecutionToText(msg) {
    let text = `Ran \`${msg.command}\`\n`;
    if (msg.output) {
        text += `\`\`\`\n${msg.output}\n\`\`\``;
    }
    else {
        text += "(no output)";
    }
    if (msg.cancelled) {
        text += "\n\n(command cancelled)";
    }
    else if (msg.exitCode !== null && msg.exitCode !== undefined && msg.exitCode !== 0) {
        text += `\n\nCommand exited with code ${msg.exitCode}`;
    }
    if (msg.truncated && msg.fullOutputPath) {
        text += `\n\n[Output truncated. Full output: ${msg.fullOutputPath}]`;
    }
    return text;
}
function createBranchSummaryMessage(summary, fromId, timestamp) {
    return {
        role: "branchSummary",
        summary,
        fromId,
        timestamp: new Date(timestamp).getTime(),
    };
}
function createCompactionSummaryMessage(summary, tokensBefore, timestamp) {
    return {
        role: "compactionSummary",
        summary: summary,
        tokensBefore,
        timestamp: new Date(timestamp).getTime(),
    };
}
/** Convert CustomMessageEntry to AgentMessage format */
function createCustomMessage(customType, content, display, details, timestamp) {
    return {
        role: "custom",
        customType,
        content,
        display,
        details,
        timestamp: new Date(timestamp).getTime(),
    };
}
/**
 * Transform AgentMessages (including custom types) to LLM-compatible Messages.
 *
 * This is used by:
 * - Agent's transormToLlm option (for prompt calls and queued messages)
 * - Compaction's generateSummary (for summarization)
 * - Custom extensions and tools
 */
function convertToLlm(messages) {
    return messages
        .map((m) => {
        switch (m.role) {
            case "bashExecution":
                // Skip messages excluded from context (!! prefix)
                if (m.excludeFromContext) {
                    return undefined;
                }
                return {
                    role: "user",
                    content: [{ type: "text", text: bashExecutionToText(m) }],
                    timestamp: m.timestamp,
                };
            case "custom": {
                const content = typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content;
                return {
                    role: "user",
                    content,
                    timestamp: m.timestamp,
                };
            }
            case "branchSummary":
                return {
                    role: "user",
                    content: [{ type: "text", text: exports.BRANCH_SUMMARY_PREFIX + m.summary + exports.BRANCH_SUMMARY_SUFFIX }],
                    timestamp: m.timestamp,
                };
            case "compactionSummary":
                return {
                    role: "user",
                    content: [
                        { type: "text", text: exports.COMPACTION_SUMMARY_PREFIX + m.summary + exports.COMPACTION_SUMMARY_SUFFIX },
                    ],
                    timestamp: m.timestamp,
                };
            case "user":
            case "assistant":
            case "toolResult":
                // Strip XML tool call tags from user messages before sending to LLM
                // This prevents models from seeing their own XML output in history
                if (m.role === "user" && typeof m.content === "string") {
                    const { text: cleanedText, toolCalls } = (0, pi_ai_1.extractXmlToolCalls)(m.content);
                    if (toolCalls.length > 0) {
                        // XML tool calls found - return cleaned text without tags
                        return Object.assign(Object.assign({}, m), { content: cleanedText });
                    }
                }
                // Strip XML tool call tags from assistant messages too
                if (m.role === "assistant") {
                    let modified = false;
                    const cleanedContent = m.content.map((block) => {
                        if (block.type !== "text")
                            return block;
                        const { text: cleanedText, toolCalls } = (0, pi_ai_1.extractXmlToolCalls)(block.text);
                        if (toolCalls.length > 0) {
                            modified = true;
                            return Object.assign(Object.assign({}, block), { text: cleanedText });
                        }
                        return block;
                    });
                    if (modified) {
                        return Object.assign(Object.assign({}, m), { content: cleanedContent });
                    }
                }
                return m;
            default:
                // biome-ignore lint/correctness/noSwitchDeclarations: fine
                const _exhaustiveCheck = m;
                return undefined;
        }
    })
        .filter((m) => m !== undefined);
}
