#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';

const filePath = './packages/ai/src/utils/xml-tool-calls.ts';
let content = readFileSync(filePath, 'utf-8');

// Update regex to handle <tool_calls><invoke>...</invoke></tool_calls> format
// The current parser looks for self-closing tags only

// Find the parseToolCallsFromText function
const oldFunctionStart = 'function parseToolCallsFromText(text: string): ParsedToolCall[] {';
const newFunctionStart = 'function parseToolCallsFromText(text: string): ParsedToolCall[] {';

if (!content.includes(newFunctionStart)) {
  console.log('⚠ parseToolCallsFromText function not found or already updated');
  process.exit(0);
}

// Update the regex to handle <tool_calls><invoke>...</invoke></tool_calls>
const oldRegex = `  const toolCallRegex = /<(tool_call|function_call|invoke|call|execute)\\\\s+name="([^"]+)"\\\\s*>([\\\\s\\\\S]*?)<\\\\\\/\\\\1>/g;`;

const newRegex = `  const toolCallRegex = /<(tool_calls|function_calls|tools|actions)\\\\s*><\\/s*(?:<invoke|call|execute|tool_call|function_call)\\\\s+name="([^"]+)"\\\\s*>.*?<\\/s*(?:<invoke|call|execute|tool_call|function_call)\\\\s*>[^<]*<\\/s*(?:<invoke|call|execute|tool_call|function_call)\\\\s*>[^<]*<\\/s*(?:<invoke|call|execute|tool_call|function_call)\\\\s*)>`;

// Replace the old regex with new regex
content = content.replace(oldRegex, newRegex);

// Now update the extraction logic
const oldExtraction = `  while ((match = toolCallRegex.exec(text)) !== null) {
    const [, fullMatch, content] = match;`;

const newExtraction = `  const containerMatch = /<(tool_calls|function_calls|tools|actions)\\s*>([^<]*?)<\\/\\1>/s.exec(text);
  const results: ParsedToolCall[] = [];
  
  if (containerMatch) {
    const containerText = containerMatch[0];
    
    // Extract individual tool calls from the container
    const innerRegex = /<(invoke|call|execute|tool_call|function_call)\\s+name="([^"]+)"\\s*>([^<]*?)<\\/\\1>/g;
    let match;
    
    while ((match = innerRegex.exec(containerText)) !== null) {
      const [, tagType, name, innerContent] = match;
      let args = {};
      
      try {
        args = JSON.parse(innerContent.trim());
      } catch {
        args = parseKeyValueContent(innerContent.trim());
      }
      
      results.push({
        name,
        arguments: args,
        rawText: match[0],
      });
      
      // Remove the processed tool call from container text
      containerText = containerText.replace(match[0], '');
    }
  }
  
  return results;`;

// Find and replace the old extraction logic
if (content.includes(oldExtraction.substring(0, 150))) {
  content = content.replace(
    oldExtraction,
    newExtraction
  );
  console.log('✓ Updated parseToolCallsFromText to handle <tool_calls> container format');
}

writeFileSync(filePath, content, 'utf-8');
console.log('✓ Successfully updated xml-tool-calls.ts to handle <tool_calls> container tags');
