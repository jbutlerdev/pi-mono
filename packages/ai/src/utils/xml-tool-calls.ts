/**
 * XML tool call parser for models that return tool calls in XML format.
 *
 * Supported XML formats:
 * 1. Anthropic-style: <tool_calls><invoke name="tool_name">{"args":"..."}</invoke></tool_calls>
 * 2. Function-style: <function_calls><invoke name="tool_name">...</invoke></function_calls>
 * 3. Generic with name attribute: <tool_call name="tool_name">...</tool_call>
 * 4. Inline name with arg_key/arg_value: <tool_call>name<arg_key>key</arg_key><arg_value>value</arg_value></tool_call>
 *
 * The parser handles streaming text and extracts tool calls as they complete.
 */

export interface ParsedToolCall {
	name: string;
	arguments: Record<string, unknown>;
	rawText: string;
}

export interface XmlToolCallParser {
	/**
	 * Feed text delta to the parser.
	 * Returns any completed tool calls found.
	 */
	feed(delta: string): ParsedToolCall[];
	/**
	 * Get any partial/incomplete tool call text buffer.
	 */
	getPartial(): string;
	/**
	 * Reset the parser state.
	 */
	reset(): void;
	/**
	 * Check if we're currently inside a tool call tag.
	 */
	isInToolCall(): boolean;
}

/**
 * Create a new XML tool call parser.
 */
export function createXmlToolCallParser(): XmlToolCallParser {
	let buffer = "";
	let inToolCall = false;

	function reset(): void {
		buffer = "";
		inToolCall = false;
	}

	function isInToolCall(): boolean {
		// Check if we're inside an unclosed tool call tag
		const openTag = /<(tool_call|function_call|invoke|call|execute)(?:\s|>)/i;
		const hasOpen = openTag.test(buffer);
		if (!hasOpen) return inToolCall;

		// Check for corresponding close tag
		const closeTagPattern = /<\/(tool_call|function_call|invoke|call|execute)>/gi;
		const openTagPattern = /<(tool_call|function_call|invoke|call|execute)(?:\s|>)/gi;

		const openMatches = buffer.match(openTagPattern) || [];
		const closeMatches = buffer.match(closeTagPattern) || [];

		return openMatches.length > closeMatches.length;
	}

	function parseToolCallsFromText(text: string): ParsedToolCall[] {
		const results: ParsedToolCall[] = [];

		// Pattern 1: name attribute format
		// <tool_call name="bash">{"command": "ls"}</tool_call>
		const nameAttrRegex = /<(tool_call|function_call|invoke|call|execute)\s+name="([^"]+)"\s*>([\s\S]*?)<\/\1>/gi;

		for (const match of text.matchAll(nameAttrRegex)) {
			const [fullMatch, , name, content] = match;
			let args: Record<string, unknown> = {};

			try {
				args = JSON.parse(content.trim());
			} catch {
				args = parseKeyValueContent(content.trim());
			}

			results.push({
				name,
				arguments: args,
				rawText: fullMatch,
			});
		}

		// Pattern 2: inline name with arg_key/arg_value format
		// <tool_call>name<arg_key>key</arg_key><arg_value>value</arg_value></tool_call>
		const inlineNameRegex =
			/<(tool_call|function_call|invoke|call|execute)>(\w+)((?:<arg_key>[\s\S]*?<\/arg_key><arg_value>[\s\S]*?<\/arg_value>)+)<\/\1>/gi;

		for (const match of text.matchAll(inlineNameRegex)) {
			const [fullMatch, , name, argsContent] = match;

			// Check if this match overlaps with an already parsed tool call
			const alreadyParsed = results.some((r) => r.rawText === fullMatch);
			if (alreadyParsed) continue;

			const args = parseArgKeyValuePairs(argsContent);

			results.push({
				name,
				arguments: args,
				rawText: fullMatch,
			});
		}

		// Pattern 3: wrapped in container like <tool_calls> or <function_calls>
		// But the inner invoke tags should already be caught by pattern 1

		return results;
	}

	function feed(delta: string): ParsedToolCall[] {
		buffer += delta;
		inToolCall = isInToolCall();
		const completed = parseToolCallsFromText(buffer);

		// Remove parsed tool calls from buffer
		for (const tc of completed) {
			buffer = buffer.replace(tc.rawText, "");
		}

		return completed;
	}

	function getPartial(): string {
		return buffer;
	}

	return {
		feed,
		getPartial,
		reset,
		isInToolCall,
	};
}

/**
 * Parse <arg_key>key</arg_key><arg_value>value</arg_value> pairs.
 */
function parseArgKeyValuePairs(content: string): Record<string, unknown> {
	const args: Record<string, unknown> = {};
	const pairRegex = /<arg_key>([\s\S]*?)<\/arg_key><arg_value>([\s\S]*?)<\/arg_value>/gi;

	for (const match of content.matchAll(pairRegex)) {
		const key = match[1].trim();
		const value = match[2].trim();
		args[key] = value;
	}

	return args;
}

/**
 * Parse key-value content from non-JSON formatted tool call arguments.
 * Supports formats like:
 * - arg1=value1 arg2=value2
 * - arg1: "value1", arg2: "value2"
 * - command="ls -la" timeout=30
 */
function parseKeyValueContent(content: string): Record<string, unknown> {
	const args: Record<string, unknown> = {};
	const trimmed = content.trim();

	// Check for arg_key/arg_value format first
	if (/<arg_key>/.test(trimmed)) {
		return parseArgKeyValuePairs(trimmed);
	}

	// Try key=value format
	const kvMatches = trimmed.matchAll(/(\w+)=("[^"]*"|'[^']*'|\S+)/g);
	for (const match of kvMatches) {
		const key = match[1];
		let value = match[2];
		// Remove quotes if present
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}
		args[key] = value;
	}

	// Try key: value format
	if (Object.keys(args).length === 0) {
		const colonMatches = trimmed.matchAll(/(\w+):\s*("[^"]*"|'[^']*'|[^,\n]+)/g);
		for (const match of colonMatches) {
			const key = match[1];
			let value = match[2].trim();
			if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
				value = value.slice(1, -1);
			}
			args[key] = value;
		}
	}

	// Try comma-separated format
	if (Object.keys(args).length === 0) {
		const parts = trimmed.split(/,\s*/);
		for (const part of parts) {
			const [key, ...valueParts] = part.split(/[:=]\s*/);
			if (key && valueParts.length > 0) {
				let value = valueParts.join(":").trim();
				if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
					value = value.slice(1, -1);
				}
				args[key.trim()] = value;
			}
		}
	}

	return args;
}

/**
 * Check if text contains potential XML tool call markers.
 * Used for early detection before full parsing.
 */
export function hasXmlToolCalls(text: string): boolean {
	return /<\s*(?:tool_calls|function_calls|invoke|tool_call|function_call)/i.test(text);
}

/**
 * Extract and parse all XML tool calls from a complete text string.
 * Returns the text with tool calls removed and the parsed tool calls.
 */
export function extractXmlToolCalls(text: string): { text: string; toolCalls: ParsedToolCall[] } {
	const parser = createXmlToolCallParser();
	const toolCalls: ParsedToolCall[] = [];

	const completed = parser.feed(text);
	toolCalls.push(...completed);

	// Remove tool call XML from the text
	let cleanedText = text;
	for (const tc of toolCalls) {
		cleanedText = cleanedText.replace(tc.rawText, "");
	}

	// Also remove empty container tags that may remain after removing tool calls
	// e.g., <tool_calls>\n\n</tool_calls> or <function_calls></function_calls>
	cleanedText = cleanedText.replace(/<(tool_calls|function_calls)>\s*<\/\1>/gi, "");

	return { text: cleanedText.trim(), toolCalls };
}
