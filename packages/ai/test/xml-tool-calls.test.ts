import { describe, expect, it } from "vitest";
import { createXmlToolCallParser, extractXmlToolCalls, hasXmlToolCalls } from "../src/utils/xml-tool-calls.js";

describe("xml-tool-calls", () => {
	describe("hasXmlToolCalls", () => {
		it("detects tool_calls tags", () => {
			expect(hasXmlToolCalls("Hello <tool_calls>")).toBe(true);
			expect(hasXmlToolCalls("<tool_calls><invoke>")).toBe(true);
		});

		it("detects function_calls tags", () => {
			expect(hasXmlToolCalls("<function_calls>")).toBe(true);
		});

		it("detects invoke tags", () => {
			expect(hasXmlToolCalls("<invoke>")).toBe(true);
		});

		it("detects tool_call tags", () => {
			expect(hasXmlToolCalls("<tool_call>")).toBe(true);
		});

		it("returns false for plain text", () => {
			expect(hasXmlToolCalls("Hello world")).toBe(false);
			expect(hasXmlToolCalls("Some <other> tags")).toBe(false);
		});
	});

	describe("anthropic-style format", () => {
		it("parses single tool call", () => {
			const text = `<tool_calls>
<invoke name="bash">
{"command": "ls -la"}
</invoke>
</tool_calls>`;

			const { text: cleaned, toolCalls } = extractXmlToolCalls(text);

			expect(toolCalls).toHaveLength(1);
			expect(toolCalls[0].name).toBe("bash");
			expect(toolCalls[0].arguments).toEqual({ command: "ls -la" });
			expect(cleaned).toBe("");
		});

		it("parses multiple tool calls", () => {
			const text = `<tool_calls>
<invoke name="bash">
{"command": "ls"}
</invoke>
<invoke name="read">
{"path": "file.txt"}
</invoke>
</tool_calls>`;

			const { toolCalls } = extractXmlToolCalls(text);

			expect(toolCalls).toHaveLength(2);
			expect(toolCalls[0].name).toBe("bash");
			expect(toolCalls[0].arguments).toEqual({ command: "ls" });
			expect(toolCalls[1].name).toBe("read");
			expect(toolCalls[1].arguments).toEqual({ path: "file.txt" });
		});

		it("handles text before and after tool calls", () => {
			const text = `Let me check the files:
<tool_calls>
<invoke name="bash">
{"command": "ls"}
</invoke>
</tool_calls>
Done!`;

			const { text: cleaned, toolCalls } = extractXmlToolCalls(text);

			expect(toolCalls).toHaveLength(1);
			expect(toolCalls[0].name).toBe("bash");
			expect(cleaned).toContain("Let me check the files:");
			expect(cleaned).toContain("Done!");
		});
	});

	describe("function_calls format", () => {
		it("parses function_calls container", () => {
			const text = `<function_calls>
<invoke name="write">
{"path": "test.txt", "content": "hello"}
</invoke>
</function_calls>`;

			const { toolCalls } = extractXmlToolCalls(text);

			expect(toolCalls).toHaveLength(1);
			expect(toolCalls[0].name).toBe("write");
			expect(toolCalls[0].arguments).toEqual({ path: "test.txt", content: "hello" });
		});
	});

	describe("self-closing tag format", () => {
		it("parses tool_call with name attribute", () => {
			const text = `<tool_call name="edit">{"path": "file.txt", "oldText": "old", "newText": "new"}</tool_call>`;

			const { toolCalls } = extractXmlToolCalls(text);

			expect(toolCalls).toHaveLength(1);
			expect(toolCalls[0].name).toBe("edit");
			expect(toolCalls[0].arguments).toEqual({ path: "file.txt", oldText: "old", newText: "new" });
		});

		it("parses function_call tag", () => {
			const text = `<function_call name="grep">{"pattern": "TODO", "path": "src/"}</function_call>`;

			const { toolCalls } = extractXmlToolCalls(text);

			expect(toolCalls).toHaveLength(1);
			expect(toolCalls[0].name).toBe("grep");
			expect(toolCalls[0].arguments).toEqual({ pattern: "TODO", path: "src/" });
		});
	});

	describe("streaming parsing", () => {
		it("handles incremental text deltas", () => {
			const parser = createXmlToolCallParser();

			const deltas = [
				`<tool_calls>
<invoke name="bash">
{"command": "`,
				`ls -la"}
</invoke>
</tool_calls>`,
			];

			const allCompleted: any[] = [];
			for (const delta of deltas) {
				const completed = parser.feed(delta);
				allCompleted.push(...completed);
			}

			expect(allCompleted).toHaveLength(1);
			expect(allCompleted[0].name).toBe("bash");
			expect(allCompleted[0].arguments).toEqual({ command: "ls -la" });
		});

		it("doesn't emit incomplete tool calls", () => {
			const parser = createXmlToolCallParser();

			// Feed partial content
			let completed = parser.feed(`<tool_calls>
<invoke name="bash">
{"command": "ls`);

			expect(completed).toHaveLength(0);
			expect(parser.isInToolCall()).toBe(true);

			// Feed more
			completed = parser.feed(` -la"}`);

			// Still incomplete (no closing tag)
			expect(completed).toHaveLength(0);

			// Feed closing tag
			completed = parser.feed(`</invoke>
</tool_calls>`);

			expect(completed).toHaveLength(1);
		});
	});

	describe("key-value argument parsing", () => {
		it("parses key=value format", () => {
			const text = `<tool_calls>
<invoke name="bash">
command="ls -la" timeout=30
</invoke>
</tool_calls>`;

			const { toolCalls } = extractXmlToolCalls(text);

			expect(toolCalls[0].arguments).toEqual({ command: "ls -la", timeout: "30" });
		});

		it("parses key: value format", () => {
			const text = `<tool_calls>
<invoke name="write">
path: "test.txt", content: "hello"
</invoke>
</tool_calls>`;

			const { toolCalls } = extractXmlToolCalls(text);

			expect(toolCalls[0].arguments).toEqual({ path: "test.txt", content: "hello" });
		});

		it("falls back to empty object for unparseable content", () => {
			const text = `<tool_calls>
<invoke name="bash">
just some random text
</invoke>
</tool_calls>`;

			const { toolCalls } = extractXmlToolCalls(text);

			expect(toolCalls[0].name).toBe("bash");
			expect(toolCalls[0].arguments).toEqual({});
		});
	});

	describe("complex scenarios", () => {
		it("handles nested XML-like structures in arguments", () => {
			const text = `<tool_calls>
<invoke name="write">
{"content": "<div>Hello</div>"}
</invoke>
</tool_calls>`;

			const { toolCalls } = extractXmlToolCalls(text);

			expect(toolCalls).toHaveLength(1);
			expect(toolCalls[0].arguments).toEqual({ content: "<div>Hello</div>" });
		});

		it("handles special characters in arguments", () => {
			const text = `<tool_calls>
<invoke name="bash">
{"command": "echo 'hello & world'"}
</invoke>
</tool_calls>`;

			const { toolCalls } = extractXmlToolCalls(text);

			expect(toolCalls[0].arguments).toEqual({ command: "echo 'hello & world'" });
		});

		it("handles empty arguments", () => {
			const text = `<tool_calls>
<invoke name="bash">
</invoke>
</tool_calls>`;

			const { toolCalls } = extractXmlToolCalls(text);

			expect(toolCalls).toHaveLength(1);
			expect(toolCalls[0].name).toBe("bash");
			expect(toolCalls[0].arguments).toEqual({});
		});

		it("handles mixed content with multiple tool calls", () => {
			const text = `I'll help you with that.
<tool_calls>
<invoke name="read">{"path": "README.md"}</invoke>
<invoke name="grep">{"pattern": "TODO"}</invoke>
</tool_calls>
Let me know what you find!`;

			const { text: cleaned, toolCalls } = extractXmlToolCalls(text);

			expect(toolCalls).toHaveLength(2);
			expect(cleaned).toContain("I'll help you with that.");
			expect(cleaned).toContain("Let me know what you find!");
			expect(cleaned).not.toContain("<tool_calls>");
		});
	});

	describe("parser state management", () => {
		it("resets properly", () => {
			const parser = createXmlToolCallParser();

			// Feed a complete tool call
			const completed = parser.feed(`<tool_calls><invoke name="bash">{"cmd":"ls"}</invoke></tool_calls>`);
			expect(completed).toHaveLength(1);
			expect(completed[0].name).toBe("bash");

			// After parsing, the raw text is removed from buffer, only container tags remain
			expect(parser.getPartial()).toContain("tool_calls");

			parser.reset();
			expect(parser.getPartial()).toBe("");
			expect(parser.isInToolCall()).toBe(false);
		});

		it("handles multiple reset cycles", () => {
			const parser = createXmlToolCallParser();

			// First tool call
			let completed = parser.feed(`<tool_calls><invoke name="bash">{"cmd":"ls"}</invoke></tool_calls>`);
			expect(completed).toHaveLength(1);

			// Reset
			parser.reset();

			// Second tool call
			completed = parser.feed(`<tool_calls><invoke name="read">{"path":"file.txt"}</invoke></tool_calls>`);
			expect(completed).toHaveLength(1);
			expect(completed[0].name).toBe("read");
		});
	});

	describe("arg_key/arg_value format", () => {
		it("parses single tool call with arg_key/arg_value", () => {
			const text = `<tool_call>read<arg_key>path</arg_key><arg_value>/data/file.txt</arg_value></tool_call>`;

			const { text: cleaned, toolCalls } = extractXmlToolCalls(text);

			expect(toolCalls).toHaveLength(1);
			expect(toolCalls[0].name).toBe("read");
			expect(toolCalls[0].arguments).toEqual({ path: "/data/file.txt" });
			expect(cleaned).toBe("");
		});

		it("parses tool call with multiple args", () => {
			const text = `<tool_call>edit<arg_key>path</arg_key><arg_value>test.ts</arg_value><arg_key>oldText</arg_key><arg_value>foo</arg_value><arg_key>newText</arg_key><arg_value>bar</arg_value></tool_call>`;

			const { toolCalls } = extractXmlToolCalls(text);

			expect(toolCalls).toHaveLength(1);
			expect(toolCalls[0].name).toBe("edit");
			expect(toolCalls[0].arguments).toEqual({
				path: "test.ts",
				oldText: "foo",
				newText: "bar",
			});
		});

		it("parses multiple tool calls with arg_key/arg_value", () => {
			const text = `Let me explore each package:
<tool_call>read<arg_key>path</arg_key><arg_value>/data/pkg1/README.md</arg_value></tool_call><tool_call>read<arg_key>path</arg_key><arg_value>/data/pkg2/README.md</arg_value></tool_call>`;

			const { text: cleaned, toolCalls } = extractXmlToolCalls(text);

			expect(toolCalls).toHaveLength(2);
			expect(toolCalls[0].name).toBe("read");
			expect(toolCalls[0].arguments).toEqual({ path: "/data/pkg1/README.md" });
			expect(toolCalls[1].name).toBe("read");
			expect(toolCalls[1].arguments).toEqual({ path: "/data/pkg2/README.md" });
			expect(cleaned).toContain("Let me explore each package:");
		});

		it("handles bash command with arg_key/arg_value", () => {
			const text = `<tool_call>bash<arg_key>command</arg_key><arg_value>ls -la</arg_value></tool_call>`;

			const { toolCalls } = extractXmlToolCalls(text);

			expect(toolCalls).toHaveLength(1);
			expect(toolCalls[0].name).toBe("bash");
			expect(toolCalls[0].arguments).toEqual({ command: "ls -la" });
		});

		it("handles multiline arg values", () => {
			const text = `<tool_call>write<arg_key>path</arg_key><arg_value>test.txt</arg_value><arg_key>content</arg_key><arg_value>line1
line2
line3</arg_value></tool_call>`;

			const { toolCalls } = extractXmlToolCalls(text);

			expect(toolCalls).toHaveLength(1);
			expect(toolCalls[0].name).toBe("write");
			expect(toolCalls[0].arguments).toEqual({
				path: "test.txt",
				content: "line1\nline2\nline3",
			});
		});

		it("streams arg_key/arg_value format incrementally", () => {
			const parser = createXmlToolCallParser();

			// Partial content
			let completed = parser.feed(`<tool_call>read<arg_key>path</arg_key>`);
			expect(completed).toHaveLength(0);
			expect(parser.isInToolCall()).toBe(true);

			// More partial
			completed = parser.feed(`<arg_value>/data/file.txt</arg_value>`);
			expect(completed).toHaveLength(0);

			// Complete
			completed = parser.feed(`</tool_call>`);
			expect(completed).toHaveLength(1);
			expect(completed[0].name).toBe("read");
			expect(completed[0].arguments).toEqual({ path: "/data/file.txt" });
		});
	});
});
