#!/usr/bin/env node
/**
 * Add XML tool call parsing to text_delta case in agent-loop.ts
 */

import { readFileSync, writeFileSync } from 'fs';

const filePath = './packages/agent/src/agent-loop.ts';
let content = readFileSync(filePath, 'utf-8');

// Find the text_delta case section and replace it
const oldTextDeltaCode = `			case "text_delta":
			case "text_end":
			case "thinking_start":
			case "thinking_delta":
			case "thinking_end":
			case "toolcall_start":
			case "toolcall_delta":
			case "toolcall_end":
				if (partialMessage) {
					partialMessage = event.partial;
					context.messages[context.messages.length - 1] = partialMessage;
					stream.push({
						type: "message_update",
						assistantMessageEvent: event,
						message: { ...partialMessage },
					});
				}
				break;`;

const newTextDeltaCode = `			case "text_delta":
			case "text_end":
			case "thinking_start":
			case "thinking_delta":
			case "thinking_end":
			case "toolcall_start":
			case "toolcall_delta":
			case "toolcall_end":
				if (partialMessage) {
					partialMessage = event.partial;
					
					// Check for XML tool calls in text blocks
					if (event.type === "text_delta" && event.contentIndex !== undefined) {
						const contentBlock = partialMessage.content[event.contentIndex];
						if (contentBlock && contentBlock.type === "text") {
							const xmlToolCalls = xmlParser.feed(contentBlock.text);
							
							for (const xmlTc of xmlToolCalls) {
								// Convert XML tool call to standard format
								const toolCall = {
									type: "toolCall",
									id: \`\${xmlTc.name}_\${Date.now()}_\${Math.random().toString(36).slice(2, 9)}\`,
									name: xmlTc.name,
									arguments: xmlTc.arguments,
								};
								
								// Add to message content if not already present
								if (!partialMessage.content.find((b: any) => b.id === toolCall.id)) {
									partialMessage.content.push(toolCall);
								}
							}
						}
					}
					
					context.messages[context.messages.length - 1] = partialMessage;
					stream.push({
						type: "message_update",
						assistantMessageEvent: event,
						message: { ...partialMessage },
					});
				}
				break;`;

if (content.includes('xmlParser.feed')) {
  console.log('✓ XML parsing already added to text_delta case');
  process.exit(0);
}

if (!content.includes(oldTextDeltaCode)) {
  console.log('⚠ Could not find exact text_delta code to replace');
  console.log('Trying alternative approach...');
  process.exit(1);
}

// Replace the text_delta section
content = content.replace(oldTextDeltaCode, newTextDeltaCode);

// Write back
writeFileSync(filePath, content, 'utf-8');

console.log('✓ Successfully added XML tool call parsing to text_delta case');
