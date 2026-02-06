"use strict";
/**
 * CLI argument parsing and help display
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidThinkingLevel = isValidThinkingLevel;
exports.parseArgs = parseArgs;
exports.printHelp = printHelp;
const chalk_1 = __importDefault(require("chalk"));
const config_js_1 = require("../config.js");
const index_js_1 = require("../core/tools/index.js");
const VALID_THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh"];
function isValidThinkingLevel(level) {
    return VALID_THINKING_LEVELS.includes(level);
}
function parseArgs(args, extensionFlags) {
    var _a, _b, _c, _d;
    const result = {
        messages: [],
        fileArgs: [],
        unknownFlags: new Map(),
    };
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--help" || arg === "-h") {
            result.help = true;
        }
        else if (arg === "--version" || arg === "-v") {
            result.version = true;
        }
        else if (arg === "--mode" && i + 1 < args.length) {
            const mode = args[++i];
            if (mode === "text" || mode === "json" || mode === "rpc") {
                result.mode = mode;
            }
        }
        else if (arg === "--continue" || arg === "-c") {
            result.continue = true;
        }
        else if (arg === "--check") {
            result.check = true;
        }
        else if (arg === "--max-retries" && i + 1 < args.length) {
            result.maxRetries = Number.parseInt(args[++i], 10);
        }
        else if (arg === "--stream") {
            result.stream = true;
        }
        else if (arg === "--no-stream") {
            result.stream = false;
        }
        else if (arg === "--resume" || arg === "-r") {
            result.resume = true;
        }
        else if (arg === "--provider" && i + 1 < args.length) {
            result.provider = args[++i];
        }
        else if (arg === "--model" && i + 1 < args.length) {
            result.model = args[++i];
        }
        else if (arg === "--api-key" && i + 1 < args.length) {
            result.apiKey = args[++i];
        }
        else if (arg === "--system-prompt" && i + 1 < args.length) {
            result.systemPrompt = args[++i];
        }
        else if (arg === "--append-system-prompt" && i + 1 < args.length) {
            result.appendSystemPrompt = args[++i];
        }
        else if (arg === "--no-session") {
            result.noSession = true;
        }
        else if (arg === "--session" && i + 1 < args.length) {
            result.session = args[++i];
        }
        else if (arg === "--session-dir" && i + 1 < args.length) {
            result.sessionDir = args[++i];
        }
        else if (arg === "--models" && i + 1 < args.length) {
            result.models = args[++i].split(",").map((s) => s.trim());
        }
        else if (arg === "--no-tools") {
            result.noTools = true;
        }
        else if (arg === "--tools" && i + 1 < args.length) {
            const toolNames = args[++i].split(",").map((s) => s.trim());
            const validTools = [];
            for (const name of toolNames) {
                if (name in index_js_1.allTools) {
                    validTools.push(name);
                }
                else {
                    console.error(chalk_1.default.yellow(`Warning: Unknown tool "${name}". Valid tools: ${Object.keys(index_js_1.allTools).join(", ")}`));
                }
            }
            result.tools = validTools;
        }
        else if (arg === "--thinking" && i + 1 < args.length) {
            const level = args[++i];
            if (isValidThinkingLevel(level)) {
                result.thinking = level;
            }
            else {
                console.error(chalk_1.default.yellow(`Warning: Invalid thinking level "${level}". Valid values: ${VALID_THINKING_LEVELS.join(", ")}`));
            }
        }
        else if (arg === "--timeout" && i + 1 < args.length) {
            const timeout = args[++i];
            const parsed = Number.parseInt(timeout, 10);
            if (!Number.isNaN(parsed) && parsed > 0) {
                result.timeout = parsed;
            }
            else {
                console.error(chalk_1.default.yellow(`Warning: Invalid timeout "${timeout}". Must be a positive number in milliseconds.`));
            }
        }
        else if (arg === "--print" || arg === "-p") {
            result.print = true;
        }
        else if (arg === "--export" && i + 1 < args.length) {
            result.export = args[++i];
        }
        else if ((arg === "--extension" || arg === "-e") && i + 1 < args.length) {
            result.extensions = (_a = result.extensions) !== null && _a !== void 0 ? _a : [];
            result.extensions.push(args[++i]);
        }
        else if (arg === "--no-extensions") {
            result.noExtensions = true;
        }
        else if (arg === "--skill" && i + 1 < args.length) {
            result.skills = (_b = result.skills) !== null && _b !== void 0 ? _b : [];
            result.skills.push(args[++i]);
        }
        else if (arg === "--prompt-template" && i + 1 < args.length) {
            result.promptTemplates = (_c = result.promptTemplates) !== null && _c !== void 0 ? _c : [];
            result.promptTemplates.push(args[++i]);
        }
        else if (arg === "--theme" && i + 1 < args.length) {
            result.themes = (_d = result.themes) !== null && _d !== void 0 ? _d : [];
            result.themes.push(args[++i]);
        }
        else if (arg === "--no-skills") {
            result.noSkills = true;
        }
        else if (arg === "--no-prompt-templates") {
            result.noPromptTemplates = true;
        }
        else if (arg === "--no-themes") {
            result.noThemes = true;
        }
        else if (arg === "--list-models") {
            // Check if next arg is a search pattern (not a flag or file arg)
            if (i + 1 < args.length && !args[i + 1].startsWith("-") && !args[i + 1].startsWith("@")) {
                result.listModels = args[++i];
            }
            else {
                result.listModels = true;
            }
        }
        else if (arg === "--verbose") {
            result.verbose = true;
        }
        else if (arg.startsWith("@")) {
            result.fileArgs.push(arg.slice(1)); // Remove @ prefix
        }
        else if (arg.startsWith("--") && extensionFlags) {
            // Check if it's an extension-registered flag
            const flagName = arg.slice(2);
            const extFlag = extensionFlags.get(flagName);
            if (extFlag) {
                if (extFlag.type === "boolean") {
                    result.unknownFlags.set(flagName, true);
                }
                else if (extFlag.type === "string" && i + 1 < args.length) {
                    result.unknownFlags.set(flagName, args[++i]);
                }
            }
            // Unknown flags without extensionFlags are silently ignored (first pass)
        }
        else if (!arg.startsWith("-")) {
            result.messages.push(arg);
        }
    }
    return result;
}
function printHelp() {
    console.log(`${chalk_1.default.bold(config_js_1.APP_NAME)} - AI coding assistant with read, bash, edit, write tools

${chalk_1.default.bold("Usage:")}
  ${config_js_1.APP_NAME} [options] [@files...] [messages...]

${chalk_1.default.bold("Commands:")}
  ${config_js_1.APP_NAME} install <source> [-l]    Install extension source and add to settings
  ${config_js_1.APP_NAME} remove <source> [-l]     Remove extension source from settings
  ${config_js_1.APP_NAME} update [source]          Update installed extensions (skips pinned sources)
  ${config_js_1.APP_NAME} list                     List installed extensions from settings
  ${config_js_1.APP_NAME} config                   Open TUI to enable/disable package resources

${chalk_1.default.bold("Options:")}
  --provider <name>              Provider name (default: google)
  --model <id>                   Model ID (default: gemini-2.5-flash)
  --api-key <key>                API key (defaults to env vars)
  --system-prompt <text>         System prompt (default: coding assistant prompt)
  --append-system-prompt <text>  Append text or file contents to the system prompt
  --mode <mode>                  Output mode: text (default), json, or rpc
  --print, -p                    Non-interactive mode: process prompt and exit
  --check                        Enable completion verification with auto-retry
  --max-retries <n>             Maximum retries for completion check (default: 3)
  --stream                       Stream output live (default for --check)
  --no-stream                    Disable streaming; output only final message
  --continue, -c                 Continue previous session
  --resume, -r                   Select a session to resume
  --session <path>               Use specific session file
  --session-dir <dir>            Directory for session storage and lookup
  --no-session                   Don't save session (ephemeral)
  --models <patterns>            Comma-separated model patterns for Ctrl+P cycling
                                 Supports globs (anthropic/*, *sonnet*) and fuzzy matching
  --no-tools                     Disable all built-in tools
  --tools <tools>                Comma-separated list of tools to enable (default: read,bash,edit,write)
                                 Available: read, bash, edit, write, grep, find, ls
  --thinking <level>             Set thinking level: off, minimal, low, medium, high, xhigh
  --timeout <ms>                 HTTP request timeout in milliseconds (provider-dependent)
  --extension, -e <path>         Load an extension file (can be used multiple times)
  --no-extensions                Disable extension discovery (explicit -e paths still work)
  --skill <path>                 Load a skill file or directory (can be used multiple times)
  --no-skills                    Disable skills discovery and loading
  --prompt-template <path>       Load a prompt template file or directory (can be used multiple times)
  --no-prompt-templates          Disable prompt template discovery and loading
  --theme <path>                 Load a theme file or directory (can be used multiple times)
  --no-themes                    Disable theme discovery and loading
  --export <file>                Export session file to HTML and exit
  --list-models [search]         List available models (with optional fuzzy search)
  --verbose                      Force verbose startup (overrides quietStartup setting)
  --help, -h                     Show this help
  --version, -v                  Show version number

Extensions can register additional flags (e.g., --plan from plan-mode extension).

${chalk_1.default.bold("Examples:")}
  # Interactive mode
  ${config_js_1.APP_NAME}

  # Interactive mode with initial prompt
  ${config_js_1.APP_NAME} "List all .ts files in src/"

  # Include files in initial message
  ${config_js_1.APP_NAME} @prompt.md @image.png "What color is the sky?"

  # Non-interactive mode (process and exit)
  ${config_js_1.APP_NAME} -p "List all .ts files in src/"

  # Multiple messages (interactive)
  ${config_js_1.APP_NAME} "Read package.json" "What dependencies do we have?"

  # Continue previous session
  ${config_js_1.APP_NAME} --continue "What did we discuss?"

  # Use different model
  ${config_js_1.APP_NAME} --provider openai --model gpt-4o-mini "Help me refactor this code"

  # Limit model cycling to specific models
  ${config_js_1.APP_NAME} --models claude-sonnet,claude-haiku,gpt-4o

  # Limit to a specific provider with glob pattern
  ${config_js_1.APP_NAME} --models "github-copilot/*"

  # Cycle models with fixed thinking levels
  ${config_js_1.APP_NAME} --models sonnet:high,haiku:low

  # Start with a specific thinking level
  ${config_js_1.APP_NAME} --thinking high "Solve this complex problem"

  # Read-only mode (no file modifications possible)
  ${config_js_1.APP_NAME} --tools read,grep,find,ls -p "Review the code in src/"

  # Export a session file to HTML
  ${config_js_1.APP_NAME} --export ~/${config_js_1.CONFIG_DIR_NAME}/agent/sessions/--path--/session.jsonl
  ${config_js_1.APP_NAME} --export session.jsonl output.html

${chalk_1.default.bold("Environment Variables:")}
  ANTHROPIC_API_KEY                - Anthropic Claude API key
  ANTHROPIC_OAUTH_TOKEN            - Anthropic OAuth token (alternative to API key)
  OPENAI_API_KEY                   - OpenAI GPT API key
  AZURE_OPENAI_API_KEY             - Azure OpenAI API key
  AZURE_OPENAI_BASE_URL            - Azure OpenAI base URL (https://{resource}.openai.azure.com/openai/v1)
  AZURE_OPENAI_RESOURCE_NAME       - Azure OpenAI resource name (alternative to base URL)
  AZURE_OPENAI_API_VERSION         - Azure OpenAI API version (default: v1)
  AZURE_OPENAI_DEPLOYMENT_NAME_MAP - Azure OpenAI model=deployment map (comma-separated)
  GEMINI_API_KEY                   - Google Gemini API key
  GROQ_API_KEY                     - Groq API key
  CEREBRAS_API_KEY                 - Cerebras API key
  XAI_API_KEY                      - xAI Grok API key
  OPENROUTER_API_KEY               - OpenRouter API key
  AI_GATEWAY_API_KEY               - Vercel AI Gateway API key
  ZAI_API_KEY                      - ZAI API key
  MISTRAL_API_KEY                  - Mistral API key
  MINIMAX_API_KEY                  - MiniMax API key
  KIMI_API_KEY                     - Kimi For Coding API key
  AWS_PROFILE                      - AWS profile for Amazon Bedrock
  AWS_ACCESS_KEY_ID                - AWS access key for Amazon Bedrock
  AWS_SECRET_ACCESS_KEY            - AWS secret key for Amazon Bedrock
  AWS_BEARER_TOKEN_BEDROCK         - Bedrock API key (bearer token)
  AWS_REGION                       - AWS region for Amazon Bedrock (e.g., us-east-1)
  ${config_js_1.ENV_AGENT_DIR.padEnd(32)} - Session storage directory (default: ~/${config_js_1.CONFIG_DIR_NAME}/agent)
  PI_PACKAGE_DIR                   - Override package directory (for Nix/Guix store paths)
  PI_SHARE_VIEWER_URL              - Base URL for /share command (default: https://pi.dev/session/)
  PI_AI_ANTIGRAVITY_VERSION        - Override Antigravity User-Agent version (e.g., 1.23.0)

${chalk_1.default.bold("Available Tools (default: read, bash, edit, write):")}
  read   - Read file contents
  bash   - Execute bash commands
  edit   - Edit files with find/replace
  write  - Write files (creates/overwrites)
  grep   - Search file contents (read-only, off by default)
  find   - Find files by glob pattern (read-only, off by default)
  ls     - List directory contents (read-only, off by default)
`);
}
