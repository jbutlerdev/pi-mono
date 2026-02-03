# Pi Wrapper with Completion Verification

The `pi-wrapper` is a CLI tool that runs the pi coding agent with automatic completion verification. After the agent finishes a task, it uses a second LLM call to verify whether the response fully answers the original prompt. If not, it retries the task until satisfied.

## Installation

After installing `@mariozechner/pi-coding-agent`, the wrapper is available as:

- **CLI tool**: `pi-wrapper` (installed globally with the package)
- **Programmatic import**: `@mariozechner/pi-coding-agent/wrapper`

## Usage

### CLI

```bash
pi-wrapper "Your prompt here" [options]
```

#### Options

| Option | Description |
|--------|-------------|
| `--model <id>` | Model to use (default: from settings) |
| `--api-key <key>` | Anthropic API key (overrides env var) |
| `--max-retries <n>` | Maximum verification retries (default: 3) |
| `--verbose`, `-v` | Show verification details |
| `--help`, `-h` | Show help |

#### Examples

```bash
# Basic usage
pi-wrapper "Refactor this function to be more efficient"

# With verbose output to see verification results
pi-wrapper "Add error handling to the API client" --verbose

# Custom retry limit
pi-wrapper "Write unit tests for the auth module" --max-retries 5

# Specific model
pi-wrapper "Review the code for security issues" --model claude-sonnet-4-20250514
```

### Programmatic Usage

```typescript
import { runWrapperWithVerification } from "@mariozechner/pi-coding-agent/wrapper";

await runWrapperWithVerification({
  prompt: "Refactor this function to be more efficient",
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: "claude-sonnet-4-20250514",
  maxRetries: 3,
  verbose: true,
});
```

## How It Works

1. **Initial Prompt**: The wrapper sends your prompt to the pi coding agent, which uses all available tools (read, bash, edit, write) to complete the task.

2. **Completion Verification**: After the agent finishes, the wrapper:
   - Extracts the last assistant message
   - Sends a verification prompt to the LLM asking if the response fully addresses the original prompt
   - Receives a JSON response with `{ complete: boolean, reason: string }`

3. **Retry Logic**:
   - If the response is marked as incomplete, the wrapper sends a retry instruction
   - This continues until the response is complete or max retries is reached
   - The retry instruction tells the agent the previous response was incomplete without duplicating the original prompt

4. **Output**: The final response is printed to stdout. Verbose output goes to stderr.

## Verification Criteria

The verification LLM evaluates responses based on:

- Does the response directly address all parts of the original prompt?
- Are there any obvious omissions or incomplete work?
- Did the assistant make claims about completing work that isn't actually shown?
- Is the response evasive or overly general without substance?

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key (used if `--api-key` is not provided) |

## Error Handling

- If the verification check fails, the response is assumed complete to avoid infinite loops
- On any error, the wrapper exits with status code 1

## Comparison with Standard `pi`

| Feature | `pi` | `pi-wrapper` |
|---------|------|--------------|
| Interactive mode | Yes | No |
| Session persistence | Yes | No |
| Completion verification | No | Yes |
| Auto-retry on incomplete response | No | Yes |
| Print mode output | Yes | Yes |
| JSON/RPC mode | Yes | No |

Use `pi-wrapper` for automated tasks where you want to ensure complete responses. Use `pi` for interactive development sessions.
