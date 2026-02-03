#!/usr/bin/env node
/**
 * Add XML tag stripping to convertToLlm in messages.ts
 */

import { readFileSync, writeFileSync } from 'fs';

const filePath = './packages/coding-agent/src/core/messages.ts';
let content = readFileSync(filePath, 'utf-8');

// Check if XML stripping is already added
if (content.includes('extractXmlToolCalls')) {
  console.log('✓ XML stripping already added to convertToLlm');
  process.exit(0);
}

// Add import at the top
const oldImport = `import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ImageContent, Message, TextContent } from "@mariozechner/pi-ai";`;

const newImport = `import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ImageContent, Message, TextContent } from "@mariozechner/pi-ai";
import { extractXmlToolCalls } from "@mariozechner/pi-ai";`;

if (!content.includes(newImport)) {
  content = content.replace(oldImport, newImport);
  console.log('✓ Added extractXmlToolCalls import');
}

// Find and modify the "user" case in convertToLlm
const oldUserCase = `case "user":
				case "assistant":
				case "toolResult":
					return m;`;

const newUserCase = `case "user":
				case "assistant":
				case "toolResult":
					// Strip XML tool call tags from user messages before sending to LLM
					// This prevents models from seeing their own XML output in history
					if (m.role === "user" && typeof m.content === "string") {
						const { text: cleanedText, toolCalls } = extractXmlToolCalls(m.content);
						if (toolCalls.length > 0) {
							// XML tool calls found - return cleaned text without tags
							return { ...m, content: cleanedText };
						}
					}
					// Strip XML tool call tags from assistant messages too
					if (m.role === "assistant") {
						let modified = false;
						const cleanedContent = m.content.map((block) => {
							if (block.type !== "text") return block;
							const { text: cleanedText, toolCalls } = extractXmlToolCalls(block.text);
							if (toolCalls.length > 0) {
								modified = true;
								return { ...block, text: cleanedText };
							}
							return block;
						});
						if (modified) {
							return { ...m, content: cleanedContent };
						}
					}
					return m;`;

if (content.includes(newUserCase)) {
  console.log('✓ XML stripping already added to user/assistant cases');
  process.exit(0);
}

if (!content.includes(oldUserCase)) {
  console.log('⚠ Could not find user/assistant case to modify');
  process.exit(1);
}

content = content.replace(oldUserCase, newUserCase);
console.log('✓ Added XML tool call tag stripping to convertToLlm');

// Write back
writeFileSync(filePath, content, 'utf-8');
console.log('✓ Successfully updated messages.ts');
