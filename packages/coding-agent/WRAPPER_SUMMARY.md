# Pi Wrapper Implementation Summary

## Overview

Created a wrapper for the pi-coding-agent that runs the agent and automatically verifies if the response fully answers the original prompt. If not, it retries the task until satisfied.

## Files Created/Modified

### New Files

1. **`wrapper.ts`** - Main wrapper implementation
   - Takes a prompt and runs the agent
   - Checks completion using a secondary LLM call
   - Implements retry logic with configurable max retries
   - Exports both CLI and programmatic APIs

2. **`WRAPPER.md`** - User documentation
   - Installation instructions
   - CLI usage examples
   - Programmatic API documentation
   - How verification works
   - Comparison with standard `pi` command

3. **`examples/sdk/wrapper-example.ts`** - Example code
   - Demonstrates programmatic usage
   - Shows different configuration options

### Modified Files

1. **`package.json`**
   - Added `pi-wrapper` to `bin` entry
   - Added `./wrapper` to `exports` for module import
   - Updated build script to chmod wrapper.js
   - Added `WRAPPER.md` to `files` list for publishing

2. **`tsconfig.build.json`**
   - Extended `include` pattern to include root-level `*.ts` files
   - Changed `rootDir` from `"./src"` to `"./"`

3. **`CHANGELOG.md`**
   - Added entry under `## [Unreleased] > ### Added`
   - Documents the new wrapper feature

4. **`README.md`**
   - Added `pi-wrapper` to CLI mode table
   - Added wrapper example in CLI examples section

### Built Files (generated via npm run build)

1. **`dist/wrapper.js`** - Compiled JavaScript (executable)
2. **`dist/wrapper.d.ts`** - TypeScript type declarations
3. **`dist/wrapper.d.ts.map`** - Source map for declarations
4. **`dist/wrapper.js.map`** - Source map for JavaScript

## Key Features

### CLI Usage (`pi-wrapper`)

```bash
pi-wrapper "Your prompt" [options]
```

Options:
- `--model <id>` - Model to use
- `--api-key <key>` - API key (overrides env var)
- `--max-retries <n>` - Maximum retries (default: 3)
- `--verbose`, `-v` - Show verification details

### Programmatic Usage

```typescript
import { runWrapperWithVerification } from "@mariozechner/pi-coding-agent/wrapper";

await runWrapperWithVerification({
  prompt: "Your task here",
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: "claude-sonnet-4-20250514",
  maxRetries: 3,
  verbose: true,
});
```

### How It Works

1. **Initial Run**: Sends prompt to pi agent with all tools (read, bash, edit, write)
2. **Completion Check**: Extracts last assistant message and sends to LLM for verification
3. **Verification Criteria**:
   - Does response address all parts of original prompt?
   - Are there omissions or incomplete work?
   - Did the assistant claim work done but not show it?
   - Is the response evasive or overly general?
4. **Retry Logic**:
   - If incomplete, sends retry instruction (not duplicate prompt)
   - Continues until complete or max retries reached
5. **Output**: Final response to stdout, verbose info to stderr

### Error Handling

- No API key → Uses session's `getApiKey()` to resolve credentials from same config as agent
- Check fails → Assume complete to avoid infinite loops
- Model not found → Assume complete

## Testing

The wrapper was:
- Built successfully with `npm run build`
- Passed all type checks with `npm run check`
- Tested CLI help output: `node dist/wrapper.js --help`
- Verified module import works from dist

## Next Steps for Users

1. After installing `@mariozechner/pi-coding-agent`, `pi-wrapper` will be available globally
2. Use for automated tasks where complete responses are critical
3. Use `pi` for interactive development sessions
4. See `WRAPPER.md` for full documentation

## Design Decisions

- **In-memory sessions**: Wrapper uses `SessionManager.inMemory()` for no persistence
- **No duplication on retry**: Retry instruction tells agent previous response was incomplete
- **Default to complete**: On errors, assumes complete to prevent infinite loops
- **Separate verification**: Uses separate LLM call, not dependent on agent's self-assessment
- **Standard tools**: Wrapper uses default coding tools (read, bash, edit, write)
