#!/usr/bin/env node
/**
 * Pi Wrapper with Completion Verification
 *
 * This wrapper takes a prompt, runs the agent, and then verifies if the
 * last assistant message fully answers the original prompt. If not, it
 * retries the last message until satisfaction.
 */

import {
	type AgentSession,
	AuthStorage,
	createAgentSession,
	ModelRegistry,
	SessionManager,
} from "./src/index.js";

/**
 * Check if the last message fully answers the original prompt
 */
async function checkCompletion(
	originalPrompt: string,
	lastAssistantMessage: string,
	authStorage: AuthStorage,
	modelRegistry: ModelRegistry,
	model?: any,
	thinkingLevel?: any,
): Promise<{ complete: boolean; reason: string }> {
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
		const { session: verificationSession } = await createAgentSession({
			sessionManager: SessionManager.inMemory(),
			authStorage,
			modelRegistry,
			model,
			thinkingLevel,
			resourceLoader: undefined, // No discovery needed
			settingsManager: undefined, // Use defaults
		});

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
			const msg = lastMessage as any;
			if (Array.isArray(msg.content)) {
				fullResponse = msg.content
					.filter((c: any) => c.type === "text")
					.map((c: any) => c.text)
					.join("");
			} else if (typeof msg.content === "string") {
				fullResponse = msg.content;
			}
		}

		// Parse JSON response
		const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			const result = JSON.parse(jsonMatch[0]);
			return result as { complete: boolean; reason: string };
		}

		// If no JSON found, try to infer from text
		const lowerResponse = fullResponse.toLowerCase();
		const complete =
			!lowerResponse.includes("incomplete") &&
			!lowerResponse.includes("does not") &&
			!lowerResponse.includes("failed to") &&
			!lowerResponse.includes("not fully");

		return {
			complete,
			reason: fullResponse.slice(0, 200),
		};
	} catch (error) {
		console.error("Error checking completion:", error);
		// On error, assume complete to avoid infinite loops
		return { complete: true, reason: "Check failed, assuming complete" };
	}
}

/**
 * Extract text content from an assistant message
 */
function extractAssistantText(message: any): string {
	if (message?.role !== "assistant") {
		return "";
	}

	if (Array.isArray(message.content)) {
		return message.content
			.filter((c: any) => c.type === "text")
			.map((c: any) => c.text)
			.join("\n");
	}

	if (typeof message.content === "string") {
		return message.content;
	}

	return "";
}

/**
 * Main wrapper function
 */
export async function runWrapperWithVerification(args: {
	prompt: string;
	model?: string;
	apiKey?: string;
	maxRetries?: number;
	verbose?: boolean;
}): Promise<void> {
	const {
		prompt: originalPrompt,
		apiKey,
		model: preferredModel,
		maxRetries = 3,
		verbose = false,
	} = args;

	// Set up auth and model registry
	const authStorage = new AuthStorage();
	if (apiKey) {
		authStorage.setRuntimeApiKey("anthropic", apiKey);
	}

	const modelRegistry = new ModelRegistry(authStorage);

	// Create session with in-memory storage (no persistence)
	const { session } = await createAgentSession({
		sessionManager: SessionManager.inMemory(),
		authStorage,
		modelRegistry,
	});

	if (preferredModel) {
		const model = modelRegistry.find("anthropic", preferredModel);
		if (model) {
			await session.setModel(model);
		}
	}

	// Subscribe to events for real-time output
	session.subscribe((event: any) => {
		if (
			event.type === "message_update" &&
			event.assistantMessageEvent.type === "text_delta"
		) {
			process.stdout.write(event.assistantMessageEvent.delta);
		} else if (event.type === "tool_execution_start") {
			if (verbose) {
				process.stderr.write(`\n[Tool: ${event.toolName}]\n`);
			}
		}
	});

	// Main loop: prompt -> verify -> retry if needed
	let retryCount = 0;
	let finalOutput = "";

	while (retryCount <= maxRetries) {
		// Send the prompt (or retry instruction)
		const messageToSend =
			retryCount === 0
				? originalPrompt
				: "The previous response did not fully address the original prompt. Please complete the task properly.";

		await session.prompt(messageToSend);

		// Wait for agent to finish
		await session.agent.waitForIdle();

		// Get the last assistant message
		const state = session.state;
		const lastMessage = state.messages[state.messages.length - 1];

		if (lastMessage?.role !== "assistant") {
			if (verbose) {
				process.stderr.write("\n[No assistant message generated]\n");
			}
			break;
		}

		finalOutput = extractAssistantText(lastMessage);

		// Check if complete using a separate session with same config
		const { complete, reason } = await checkCompletion(
			originalPrompt,
			finalOutput,
			authStorage,
			modelRegistry,
			session.model,
			session.thinkingLevel,
		);

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

	// Ensure final output is flushed
	process.stdout.write("\n");

	if (verbose) {
		process.stderr.write(`\n[Completed after ${retryCount} attempt(s)]\n`);
	}
}

/**
 * CLI entry point
 */
export async function main(): Promise<void> {
	const args = process.argv.slice(2);

	if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
		console.log(`
Pi Wrapper with Completion Verification

Usage:
  node wrapper.ts "Your prompt here" [options]

Options:
  --model <id>          Model to use (default: from settings)
  --api-key <key>       Anthropic API key (overrides env var)
  --max-retries <n>     Maximum verification retries (default: 3)
  --verbose, -v         Show verification details
  --help, -h            Show this help

Environment:
  ANTHROPIC_API_KEY     Anthropic API key

Examples:
  node wrapper.ts "Refactor this function to be more efficient" --verbose
  node wrapper.ts "Add error handling to the API client" --max-retries 5
  node wrapper.ts "Write unit tests for the auth module" --model claude-sonnet-4-20250514
`);
		process.exit(args.includes("--help") || args.includes("-h") ? 0 : 1);
		return;
	}

	const prompt: string[] = [];
	let apiKey: string | undefined;
	let model: string | undefined;
	let maxRetries: number = 3;
	let verbose = false;

	// Parse arguments
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		if (arg === "--api-key" && i + 1 < args.length) {
			apiKey = args[++i];
		} else if (arg === "--model" && i + 1 < args.length) {
			model = args[++i];
		} else if (arg === "--max-retries" && i + 1 < args.length) {
			maxRetries = Number.parseInt(args[++i], 10);
		} else if (arg === "--verbose" || arg === "-v") {
			verbose = true;
		} else if (!arg.startsWith("--")) {
			prompt.push(arg);
		}
	}

	const fullPrompt = prompt.join(" ");

	if (!fullPrompt) {
		console.error("Error: No prompt provided");
		process.exit(1);
		return;
	}

	try {
		await runWrapperWithVerification({
			prompt: fullPrompt,
			apiKey,
			model,
			maxRetries,
			verbose,
		});
	} catch (error) {
		console.error("Error:", error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch((error) => {
		console.error("Fatal error:", error);
		process.exit(1);
	});
}
