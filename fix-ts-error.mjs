#!/usr/bin/env node
/**
 * Fix TypeScript error in agent-loop.ts
 */

import { readFileSync, writeFileSync } from 'fs';

const filePath = './packages/agent/src/agent-loop.ts';
let content = readFileSync(filePath, 'utf-8');

// Fix: change type: "toolCall" to type: "toolCall" as const
const oldCode = `								const toolCall = {
									type: "toolCall",
									id: \`\${xmlTc.name}_\${Date.now()}_\${Math.random().toString(36).slice(2, 9)}\`,
									name: xmlTc.name,
									arguments: xmlTc.arguments,
								};`;

const newCode = `								const toolCall = {
									type: "toolCall" as const,
									id: \`\${xmlTc.name}_\${Date.now()}_\${Math.random().toString(36).slice(2, 9)}\`,
									name: xmlTc.name,
									arguments: xmlTc.arguments,
								};`;

if (content.includes('type: "toolCall" as const')) {
  console.log('✓ TypeScript error already fixed');
  process.exit(0);
}

content = content.replace(oldCode, newCode);
writeFileSync(filePath, content, 'utf-8');
console.log('✓ Fixed TypeScript error in agent-loop.ts');
