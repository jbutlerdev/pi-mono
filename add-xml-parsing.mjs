#!/usr/bin/env node
/**
 * Script to add XML tool call parsing to agent-loop.ts
 */

import { readFileSync, writeFileSync } from 'fs';

const filePath = './packages/agent/src/agent-loop.ts';
let content = readFileSync(filePath, 'utf-8');

// 1. Add imports
const oldImports = `import {
\ttype AssistantMessage,
\ttype Context,
\tEventStream,
\tstreamSimple,
\ttype ToolResultMessage,
\tvalidateToolArguments,
} from "@mariozechner/pi-ai";`;

const newImports = `import {
\ttype AssistantMessage,
\ttype Context,
\tEventStream,
\tstreamSimple,
\ttype ToolResultMessage,
\tvalidateToolArguments,
\tcreateXmlToolCallParser,
\ttype XmlToolCallParser,
\ttype ParsedToolCall,
} from "@mariozechner/pi-ai";`;

if (!content.includes('createXmlToolCallParser')) {
  content = content.replace(oldImports, newImports);
  console.log('✓ Added XML parser imports');
} else {
  console.log('✓ Imports already added');
}

// 2. Add XML parser state to streamAssistantResponse function
// Find the function and add xmlParser variable
const streamResponseMatch = content.match(
  /(async function streamAssistantResponse\([^)]+\): Promise<AssistantMessage> \{[\s\S]*?)(const response = await streamFunction)/s
);

if (streamResponseMatch) {
  const before = streamResponseMatch[1];
  const after = streamResponseMatch[2];
  const newCode = `${before}\tconst xmlParser: XmlToolCallParser = createXmlToolCallParser();\n\n\t${after}`;
  
  if (!content.includes('const xmlParser: XmlToolCallParser')) {
    content = content.replace(before + after, newCode);
    console.log('✓ Added xmlParser variable');
  } else {
    console.log('✓ xmlParser variable already added');
  }
}

// 3. Modify text_delta handling to parse XML tool calls
// Find the text_delta case and add XML parsing
const textDeltaPattern = /(\tcase "text_delta": \{[\s\S]*?)([\s\S]*?)(\t\tcase "toolcall_start":)/;

const textDeltaMatch = content.match(textDeltaPattern);
if (textDeltaMatch) {
  const before = textDeltaMatch[1];
  const oldCode = textDeltaMatch[2];
  const after = textDeltaMatch[3];
  
  if (!oldCode.includes('xmlParser')) {
    const newCode = `${before}\t\t\t// Check for XML tool calls in text\n\t\t\tif (event.partial?.content[event.contentIndex]?.type === "text") {\n\t\t\t\tconst textBlock = event.partial.content[event.contentIndex];\n\t\t\t\tif (textBlock && "text" in textBlock) {\n\t\t\t\t\tconst xmlToolCalls = xmlParser.feed(textBlock.text);\n\t\t\t\t\tfor (const xmlTc of xmlToolCalls) {\n\t\t\t\t\t\t// Convert XML tool call to standard format\n\t\t\t\t\t\tconst toolCall: any = {\n\t\t\t\t\t\t\ttype: "toolCall",\n\t\t\t\t\t\t\tid: \`\${xmlTc.name}_\${Date.now()}_\${Math.random().toString(36).slice(2, 9)}\`,\n\t\t\t\t\t\t\tname: xmlTc.name,\n\t\t\t\t\t\t\targuments: xmlTc.arguments,\n\t\t\t\t\t\t};\n\t\t\t\t\t\t\n\t\t\t\t\t\t// Add to message content\n\t\t\t\t\t\tif (!partialMessage.content.find((b: any) => b.id === toolCall.id)) {\n\t\t\t\t\t\t\tpartialMessage.content.push(toolCall);\n\t\t\t\t\t\t\t// Emit tool call events\n\t\t\t\t\t\t\tstream.push({ type: "toolcall_start", contentIndex: partialMessage.content.length - 1, partial: partialMessage });\n\t\t\t\t\t\t\tstream.push({ type: "toolcall_delta", contentIndex: partialMessage.content.length - 1, delta: JSON.stringify(toolCall.arguments), partial: partialMessage });\n\t\t\t\t\t\t\tstream.push({ type: "toolcall_end", contentIndex: partialMessage.content.length - 1, toolCall, partial: partialMessage });\n\t\t\t\t\t\t}\n\t\t\t\t}\n\t\t\t}\n\t\t\t}\n\t\t}\n\n\t\t\t${oldCode}\n\t\t${after}`;
    
    content = content.replace(before + oldCode + after, newCode);
    console.log('✓ Added XML tool call parsing to text_delta case');
  } else {
    console.log('✓ XML parsing already added to text_delta case');
  }
}

// Write back
writeFileSync(filePath, content, 'utf-8');
console.log('\\n✓ Successfully updated agent-loop.ts');
