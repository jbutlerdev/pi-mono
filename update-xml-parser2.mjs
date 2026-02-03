#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';

const filePath = './packages/ai/src/utils/xml-tool-calls.ts';
let content = readFileSync(filePath, 'utf-8');

// Update to handle <tool_call name="tool">...</tool_call> format
const oldFunctionStart = 'function parseToolCallsFromText(text: string): ParsedToolCall[] {';
const newFunctionStart = 'function parseToolCallsFromText(text: string): ParsedToolCall[] {';

if (!content.includes(newFunctionStart)) {
  console.log('⚠ parseToolCallsFromText function not found or already updated');
  process.exit(0);
}

// Find current regex pattern
const currentRegex = `  const toolCallRegex = /<(tool_call|function_call|invoke|call|execute)\\\\s+name="([^"]+)"\\\\s*>([\\\\s\\\\S]*?)<\\\\\\/\\\\1>/g;`;

// New simpler regex for <tool_call name="tool">...</tool_call>
const newRegex = `  const toolCallRegex = /<(tool_call)\\\\s+name="([^"]+)"\\\\s*>([\\\\s\\\\S]*?)<\\\\/\\\\1>/g;`;

// Replace old regex
content = content.replace(currentRegex, newRegex);

// Update extraction logic for simpler case
const oldExtraction = `  while ((match = toolCallRegex.exec(text)) !== null) {
    const [, fullMatch, content] = match;
    // Parse the content
    let args = {};
    try {
      args = JSON.parse(content.trim());
    } catch {
      args = parseKeyValueContent(content.trim());
    }
    
    results.push({
      name: match[2],
      arguments: args,
      rawText: fullMatch,
    });
  }
  
  return results;`;

const newExtraction = `  const results: ParsedToolCall[] = [];
  const toolCallRegex = /<(tool_call)\\\\s+name="([^"]+)"\\\\s*>([\\\\s\\\\S]*?)<\\\\/\\\\1>/g;
  let match;
  
  while ((match = toolCallRegex.exec(text)) !== null) {
    const [, tagType, name, innerContent] = match;
    let args = {};
    
    try {
      args = JSON.parse(innerContent.trim());
    } catch {
      args = parseKeyValueContent(innerContent.trim());
    }
    
    results.push({
      name: match[2],
      arguments: args,
      rawText: match[0],
    });
  }
  
  return results;`;

if (content.includes(oldExtraction.substring(0, 200))) {
  content = content.replace(
    oldExtraction,
    newExtraction
  );
  console.log('✓ Updated parseToolCallsFromText for <tool_call> format');
}

writeFileSync(filePath, content, 'utf-8');
console.log('✓ Successfully updated xml-tool-calls.ts to handle <tool_call> format');
