/**
 * Wrapper Example - Programmatic Usage
 *
 * This example demonstrates how to use the pi-wrapper programmatically
 * to run tasks with automatic completion verification.
 */

import { runWrapperWithVerification } from "@mariozechner/pi-coding-agent/wrapper";

// Basic usage with environment variable for API key
await runWrapperWithVerification({
	prompt: "List all TypeScript files in the current directory",
	verbose: true,
});

console.log("\n---\n");

// With custom model and retry limit
await runWrapperWithVerification({
	prompt: "Review the code for potential improvements",
	model: "claude-sonnet-4-20250514",
	maxRetries: 5,
	verbose: true,
});

console.log("\n---\n");

// With explicit API key
await runWrapperWithVerification({
	prompt: "Create a simple TypeScript utility function",
	apiKey: process.env.ANTHROPIC_API_KEY,
	maxRetries: 2,
});
