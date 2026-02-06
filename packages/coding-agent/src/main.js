"use strict";
/**
 * Main entry point for the coding agent CLI.
 *
 * This file handles CLI argument parsing and translates them into
 * createAgentSession() options. The SDK does the heavy lifting.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const pi_ai_1 = require("@mariozechner/pi-ai");
const chalk_1 = __importDefault(require("chalk"));
const readline_1 = require("readline");
const args_js_1 = require("./cli/args.js");
const config_selector_js_1 = require("./cli/config-selector.js");
const file_processor_js_1 = require("./cli/file-processor.js");
const list_models_js_1 = require("./cli/list-models.js");
const session_picker_js_1 = require("./cli/session-picker.js");
const config_js_1 = require("./config.js");
const auth_storage_js_1 = require("./core/auth-storage.js");
const defaults_js_1 = require("./core/defaults.js");
const index_js_1 = require("./core/export-html/index.js");
const keybindings_js_1 = require("./core/keybindings.js");
const model_registry_js_1 = require("./core/model-registry.js");
const model_resolver_js_1 = require("./core/model-resolver.js");
const package_manager_js_1 = require("./core/package-manager.js");
const resource_loader_js_1 = require("./core/resource-loader.js");
const sdk_js_1 = require("./core/sdk.js");
const session_manager_js_1 = require("./core/session-manager.js");
const settings_manager_js_1 = require("./core/settings-manager.js");
const timings_js_1 = require("./core/timings.js");
const index_js_2 = require("./core/tools/index.js");
const migrations_js_1 = require("./migrations.js");
const index_js_3 = require("./modes/index.js");
const theme_js_1 = require("./modes/interactive/theme/theme.js");
/**
 * Read all content from piped stdin.
 * Returns undefined if stdin is a TTY (interactive terminal).
 */
async function readPipedStdin() {
    // If stdin is a TTY, we're running interactively - don't read stdin
    if (process.stdin.isTTY) {
        return undefined;
    }
    return new Promise((resolve) => {
        let data = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (chunk) => {
            data += chunk;
        });
        process.stdin.on("end", () => {
            resolve(data.trim() || undefined);
        });
        process.stdin.resume();
    });
}
function parsePackageCommand(args) {
    const [command, ...rest] = args;
    if (command !== "install" && command !== "remove" && command !== "update" && command !== "list") {
        return undefined;
    }
    let local = false;
    const sources = [];
    for (const arg of rest) {
        if (arg === "-l" || arg === "--local") {
            local = true;
            continue;
        }
        sources.push(arg);
    }
    return { command, source: sources[0], local };
}
async function handlePackageCommand(args) {
    var _a, _b;
    const options = parsePackageCommand(args);
    if (!options) {
        return false;
    }
    const cwd = process.cwd();
    const agentDir = (0, config_js_1.getAgentDir)();
    const settingsManager = settings_manager_js_1.SettingsManager.create(cwd, agentDir);
    const packageManager = new package_manager_js_1.DefaultPackageManager({ cwd, agentDir, settingsManager });
    // Set up progress callback for CLI feedback
    packageManager.setProgressCallback((event) => {
        if (event.type === "start") {
            process.stdout.write(chalk_1.default.dim(`${event.message}\n`));
        }
        else if (event.type === "error") {
            console.error(chalk_1.default.red(`Error: ${event.message}`));
        }
    });
    if (options.command === "install") {
        if (!options.source) {
            console.error(chalk_1.default.red("Missing install source."));
            process.exit(1);
        }
        await packageManager.install(options.source, { local: options.local });
        packageManager.addSourceToSettings(options.source, { local: options.local });
        console.log(chalk_1.default.green(`Installed ${options.source}`));
        return true;
    }
    if (options.command === "remove") {
        if (!options.source) {
            console.error(chalk_1.default.red("Missing remove source."));
            process.exit(1);
        }
        await packageManager.remove(options.source, { local: options.local });
        const removed = packageManager.removeSourceFromSettings(options.source, { local: options.local });
        if (!removed) {
            console.error(chalk_1.default.red(`No matching package found for ${options.source}`));
            process.exit(1);
        }
        console.log(chalk_1.default.green(`Removed ${options.source}`));
        return true;
    }
    if (options.command === "list") {
        const globalSettings = settingsManager.getGlobalSettings();
        const projectSettings = settingsManager.getProjectSettings();
        const globalPackages = (_a = globalSettings.packages) !== null && _a !== void 0 ? _a : [];
        const projectPackages = (_b = projectSettings.packages) !== null && _b !== void 0 ? _b : [];
        if (globalPackages.length === 0 && projectPackages.length === 0) {
            console.log(chalk_1.default.dim("No packages installed."));
            return true;
        }
        const formatPackage = (pkg, scope) => {
            const source = typeof pkg === "string" ? pkg : pkg.source;
            const filtered = typeof pkg === "object";
            const display = filtered ? `${source} (filtered)` : source;
            console.log(`  ${display}`);
            // Show resolved path
            const path = packageManager.getInstalledPath(source, scope);
            if (path) {
                console.log(chalk_1.default.dim(`    ${path}`));
            }
        };
        if (globalPackages.length > 0) {
            console.log(chalk_1.default.bold("User packages:"));
            for (const pkg of globalPackages) {
                formatPackage(pkg, "user");
            }
        }
        if (projectPackages.length > 0) {
            if (globalPackages.length > 0)
                console.log();
            console.log(chalk_1.default.bold("Project packages:"));
            for (const pkg of projectPackages) {
                formatPackage(pkg, "project");
            }
        }
        return true;
    }
    await packageManager.update(options.source);
    if (options.source) {
        console.log(chalk_1.default.green(`Updated ${options.source}`));
    }
    else {
        console.log(chalk_1.default.green("Updated packages"));
    }
    return true;
}
async function prepareInitialMessage(parsed, autoResizeImages) {
    if (parsed.fileArgs.length === 0) {
        return {};
    }
    const { text, images } = await (0, file_processor_js_1.processFileArguments)(parsed.fileArgs, { autoResizeImages });
    let initialMessage;
    if (parsed.messages.length > 0) {
        initialMessage = text + parsed.messages[0];
        parsed.messages.shift();
    }
    else {
        initialMessage = text;
    }
    return {
        initialMessage,
        initialImages: images.length > 0 ? images : undefined,
    };
}
/**
 * Resolve a session argument to a file path.
 * If it looks like a path, use as-is. Otherwise try to match as session ID prefix.
 */
async function resolveSessionPath(sessionArg, cwd, sessionDir) {
    // If it looks like a file path, use as-is
    if (sessionArg.includes("/") || sessionArg.includes("\\") || sessionArg.endsWith(".jsonl")) {
        return { type: "path", path: sessionArg };
    }
    // Try to match as session ID in current project first
    const localSessions = await session_manager_js_1.SessionManager.list(cwd, sessionDir);
    const localMatches = localSessions.filter((s) => s.id.startsWith(sessionArg));
    if (localMatches.length >= 1) {
        return { type: "local", path: localMatches[0].path };
    }
    // Try global search across all projects
    const allSessions = await session_manager_js_1.SessionManager.listAll();
    const globalMatches = allSessions.filter((s) => s.id.startsWith(sessionArg));
    if (globalMatches.length >= 1) {
        const match = globalMatches[0];
        return { type: "global", path: match.path, cwd: match.cwd };
    }
    // Not found anywhere
    return { type: "not_found", arg: sessionArg };
}
/** Prompt user for yes/no confirmation */
async function promptConfirm(message) {
    return new Promise((resolve) => {
        const rl = (0, readline_1.createInterface)({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question(`${message} [y/N] `, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
        });
    });
}
async function createSessionManager(parsed, cwd) {
    if (parsed.noSession) {
        return session_manager_js_1.SessionManager.inMemory();
    }
    if (parsed.session) {
        const resolved = await resolveSessionPath(parsed.session, cwd, parsed.sessionDir);
        switch (resolved.type) {
            case "path":
            case "local":
                return session_manager_js_1.SessionManager.open(resolved.path, parsed.sessionDir);
            case "global": {
                // Session found in different project - ask user if they want to fork
                console.log(chalk_1.default.yellow(`Session found in different project: ${resolved.cwd}`));
                const shouldFork = await promptConfirm("Fork this session into current directory?");
                if (!shouldFork) {
                    console.log(chalk_1.default.dim("Aborted."));
                    process.exit(0);
                }
                return session_manager_js_1.SessionManager.forkFrom(resolved.path, cwd, parsed.sessionDir);
            }
            case "not_found":
                console.error(chalk_1.default.red(`No session found matching '${resolved.arg}'`));
                process.exit(1);
        }
    }
    if (parsed.continue) {
        return session_manager_js_1.SessionManager.continueRecent(cwd, parsed.sessionDir);
    }
    // --resume is handled separately (needs picker UI)
    // If --session-dir provided without --continue/--resume, create new session there
    if (parsed.sessionDir) {
        return session_manager_js_1.SessionManager.create(cwd, parsed.sessionDir);
    }
    // Default case (new session) returns undefined, SDK will create one
    return undefined;
}
function buildSessionOptions(parsed, scopedModels, sessionManager, modelRegistry, settingsManager) {
    var _a;
    const options = {};
    if (sessionManager) {
        options.sessionManager = sessionManager;
    }
    // Model from CLI
    if (parsed.provider && parsed.model) {
        const model = modelRegistry.find(parsed.provider, parsed.model);
        if (!model) {
            console.error(chalk_1.default.red(`Model ${parsed.provider}/${parsed.model} not found`));
            process.exit(1);
        }
        options.model = model;
    }
    else if (scopedModels.length > 0 && !parsed.continue && !parsed.resume) {
        // Check if saved default is in scoped models - use it if so, otherwise first scoped model
        const savedProvider = settingsManager.getDefaultProvider();
        const savedModelId = settingsManager.getDefaultModel();
        const savedModel = savedProvider && savedModelId ? modelRegistry.find(savedProvider, savedModelId) : undefined;
        const savedInScope = savedModel ? scopedModels.find((sm) => (0, pi_ai_1.modelsAreEqual)(sm.model, savedModel)) : undefined;
        if (savedInScope) {
            options.model = savedInScope.model;
            // Use thinking level from scoped model config if explicitly set
            if (!parsed.thinking && savedInScope.thinkingLevel) {
                options.thinkingLevel = savedInScope.thinkingLevel;
            }
        }
        else {
            options.model = scopedModels[0].model;
            // Use thinking level from first scoped model if explicitly set
            if (!parsed.thinking && scopedModels[0].thinkingLevel) {
                options.thinkingLevel = scopedModels[0].thinkingLevel;
            }
        }
    }
    // Thinking level from CLI (takes precedence over scoped model thinking levels set above)
    if (parsed.thinking) {
        options.thinkingLevel = parsed.thinking;
    }
    // Timeout from CLI
    if (parsed.timeout) {
        options.timeout = parsed.timeout;
    }
    // Scoped models for Ctrl+P cycling - fill in default thinking level for models without explicit level
    if (scopedModels.length > 0) {
        const defaultThinkingLevel = (_a = settingsManager.getDefaultThinkingLevel()) !== null && _a !== void 0 ? _a : defaults_js_1.DEFAULT_THINKING_LEVEL;
        options.scopedModels = scopedModels.map((sm) => {
            var _a;
            return ({
                model: sm.model,
                thinkingLevel: (_a = sm.thinkingLevel) !== null && _a !== void 0 ? _a : defaultThinkingLevel,
            });
        });
    }
    // API key from CLI - set in authStorage
    // (handled by caller before createAgentSession)
    // Tools
    if (parsed.noTools) {
        // --no-tools: start with no built-in tools
        // --tools can still add specific ones back
        if (parsed.tools && parsed.tools.length > 0) {
            options.tools = parsed.tools.map((name) => index_js_2.allTools[name]);
        }
        else {
            options.tools = [];
        }
    }
    else if (parsed.tools) {
        options.tools = parsed.tools.map((name) => index_js_2.allTools[name]);
    }
    return options;
}
async function handleConfigCommand(args) {
    if (args[0] !== "config") {
        return false;
    }
    const cwd = process.cwd();
    const agentDir = (0, config_js_1.getAgentDir)();
    const settingsManager = settings_manager_js_1.SettingsManager.create(cwd, agentDir);
    const packageManager = new package_manager_js_1.DefaultPackageManager({ cwd, agentDir, settingsManager });
    const resolvedPaths = await packageManager.resolve();
    await (0, config_selector_js_1.selectConfig)({
        resolvedPaths,
        settingsManager,
        cwd,
        agentDir,
    });
    process.exit(0);
}
async function main(args) {
    var _a;
    if (await handlePackageCommand(args)) {
        return;
    }
    if (await handleConfigCommand(args)) {
        return;
    }
    // Run migrations (pass cwd for project-local migrations)
    const { migratedAuthProviders: migratedProviders, deprecationWarnings } = (0, migrations_js_1.runMigrations)(process.cwd());
    // First pass: parse args to get --extension paths
    const firstPass = (0, args_js_1.parseArgs)(args);
    // Early load extensions to discover their CLI flags
    const cwd = process.cwd();
    const agentDir = (0, config_js_1.getAgentDir)();
    const settingsManager = settings_manager_js_1.SettingsManager.create(cwd, agentDir);
    const authStorage = new auth_storage_js_1.AuthStorage();
    const modelRegistry = new model_registry_js_1.ModelRegistry(authStorage, (0, config_js_1.getModelsPath)());
    const resourceLoader = new resource_loader_js_1.DefaultResourceLoader({
        cwd,
        agentDir,
        settingsManager,
        additionalExtensionPaths: firstPass.extensions,
        additionalSkillPaths: firstPass.skills,
        additionalPromptTemplatePaths: firstPass.promptTemplates,
        additionalThemePaths: firstPass.themes,
        noExtensions: firstPass.noExtensions,
        noSkills: firstPass.noSkills,
        noPromptTemplates: firstPass.noPromptTemplates,
        noThemes: firstPass.noThemes,
        systemPrompt: firstPass.systemPrompt,
        appendSystemPrompt: firstPass.appendSystemPrompt,
    });
    await resourceLoader.reload();
    (0, timings_js_1.time)("resourceLoader.reload");
    const extensionsResult = resourceLoader.getExtensions();
    for (const { path, error } of extensionsResult.errors) {
        console.error(chalk_1.default.red(`Failed to load extension "${path}": ${error}`));
    }
    // Apply pending provider registrations from extensions immediately
    // so they're available for model resolution before AgentSession is created
    for (const { name, config } of extensionsResult.runtime.pendingProviderRegistrations) {
        modelRegistry.registerProvider(name, config);
    }
    extensionsResult.runtime.pendingProviderRegistrations = [];
    const extensionFlags = new Map();
    for (const ext of extensionsResult.extensions) {
        for (const [name, flag] of ext.flags) {
            extensionFlags.set(name, { type: flag.type });
        }
    }
    // Second pass: parse args with extension flags
    const parsed = (0, args_js_1.parseArgs)(args, extensionFlags);
    // Pass flag values to extensions via runtime
    for (const [name, value] of parsed.unknownFlags) {
        extensionsResult.runtime.flagValues.set(name, value);
    }
    if (parsed.version) {
        console.log(config_js_1.VERSION);
        process.exit(0);
    }
    if (parsed.help) {
        (0, args_js_1.printHelp)();
        process.exit(0);
    }
    if (parsed.listModels !== undefined) {
        const searchPattern = typeof parsed.listModels === "string" ? parsed.listModels : undefined;
        await (0, list_models_js_1.listModels)(modelRegistry, searchPattern);
        process.exit(0);
    }
    // Read piped stdin content (if any) - skip for RPC mode which uses stdin for JSON-RPC
    if (parsed.mode !== "rpc") {
        const stdinContent = await readPipedStdin();
        if (stdinContent !== undefined) {
            // Force print mode since interactive mode requires a TTY for keyboard input
            parsed.print = true;
            // Prepend stdin content to messages
            parsed.messages.unshift(stdinContent);
        }
    }
    if (parsed.export) {
        let result;
        try {
            const outputPath = parsed.messages.length > 0 ? parsed.messages[0] : undefined;
            result = await (0, index_js_1.exportFromFile)(parsed.export, outputPath);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : "Failed to export session";
            console.error(chalk_1.default.red(`Error: ${message}`));
            process.exit(1);
        }
        console.log(`Exported to: ${result}`);
        process.exit(0);
    }
    if (parsed.mode === "rpc" && parsed.fileArgs.length > 0) {
        console.error(chalk_1.default.red("Error: @file arguments are not supported in RPC mode"));
        process.exit(1);
    }
    const { initialMessage, initialImages } = await prepareInitialMessage(parsed, settingsManager.getImageAutoResize());
    const isInteractive = !parsed.print && parsed.mode === undefined;
    const mode = parsed.mode || "text";
    // --check flag implies print mode
    if (parsed.check) {
        parsed.print = true;
    }
    (0, theme_js_1.initTheme)(settingsManager.getTheme(), isInteractive);
    // Show deprecation warnings in interactive mode
    if (isInteractive && deprecationWarnings.length > 0) {
        await (0, migrations_js_1.showDeprecationWarnings)(deprecationWarnings);
    }
    let scopedModels = [];
    const modelPatterns = (_a = parsed.models) !== null && _a !== void 0 ? _a : settingsManager.getEnabledModels();
    if (modelPatterns && modelPatterns.length > 0) {
        scopedModels = await (0, model_resolver_js_1.resolveModelScope)(modelPatterns, modelRegistry);
    }
    // Create session manager based on CLI flags
    let sessionManager = await createSessionManager(parsed, cwd);
    // Handle --resume: show session picker
    if (parsed.resume) {
        // Initialize keybindings so session picker respects user config
        keybindings_js_1.KeybindingsManager.create();
        const selectedPath = await (0, session_picker_js_1.selectSession)((onProgress) => session_manager_js_1.SessionManager.list(cwd, parsed.sessionDir, onProgress), session_manager_js_1.SessionManager.listAll);
        if (!selectedPath) {
            console.log(chalk_1.default.dim("No session selected"));
            (0, theme_js_1.stopThemeWatcher)();
            process.exit(0);
        }
        sessionManager = session_manager_js_1.SessionManager.open(selectedPath);
    }
    const sessionOptions = buildSessionOptions(parsed, scopedModels, sessionManager, modelRegistry, settingsManager);
    sessionOptions.authStorage = authStorage;
    sessionOptions.modelRegistry = modelRegistry;
    sessionOptions.resourceLoader = resourceLoader;
    // Handle CLI --api-key as runtime override (not persisted)
    if (parsed.apiKey) {
        if (!sessionOptions.model) {
            console.error(chalk_1.default.red("--api-key requires a model to be specified via --provider/--model or -m/--models"));
            process.exit(1);
        }
        authStorage.setRuntimeApiKey(sessionOptions.model.provider, parsed.apiKey);
    }
    const { session, modelFallbackMessage } = await (0, sdk_js_1.createAgentSession)(sessionOptions);
    if (!isInteractive && !session.model) {
        console.error(chalk_1.default.red("No models available."));
        console.error(chalk_1.default.yellow("\nSet an API key environment variable:"));
        console.error("  ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, etc.");
        console.error(chalk_1.default.yellow(`\nOr create ${(0, config_js_1.getModelsPath)()}`));
        process.exit(1);
    }
    // Clamp thinking level to model capabilities (for CLI override case)
    if (session.model && parsed.thinking) {
        let effectiveThinking = parsed.thinking;
        if (!session.model.reasoning) {
            effectiveThinking = "off";
        }
        else if (effectiveThinking === "xhigh" && !(0, pi_ai_1.supportsXhigh)(session.model)) {
            effectiveThinking = "high";
        }
        if (effectiveThinking !== session.thinkingLevel) {
            session.setThinkingLevel(effectiveThinking);
        }
    }
    if (mode === "rpc") {
        await (0, index_js_3.runRpcMode)(session);
    }
    else if (isInteractive) {
        if (scopedModels.length > 0 && (parsed.verbose || !settingsManager.getQuietStartup())) {
            const modelList = scopedModels
                .map((sm) => {
                const thinkingStr = sm.thinkingLevel ? `:${sm.thinkingLevel}` : "";
                return `${sm.model.id}${thinkingStr}`;
            })
                .join(", ");
            console.log(chalk_1.default.dim(`Model scope: ${modelList} ${chalk_1.default.gray("(Ctrl+P to cycle)")}`));
        }
        (0, timings_js_1.printTimings)();
        const mode = new index_js_3.InteractiveMode(session, {
            migratedProviders,
            modelFallbackMessage,
            initialMessage,
            initialImages,
            initialMessages: parsed.messages,
            verbose: parsed.verbose,
        });
        await mode.run();
    }
    else if (parsed.check) {
        const { runPrintModeWithCheck } = await Promise.resolve().then(() => __importStar(require("./modes/print-mode.js")));
        await runPrintModeWithCheck(session, {
            mode,
            messages: parsed.messages,
            initialMessage,
            initialImages,
            maxRetries: parsed.maxRetries,
            verbose: parsed.verbose,
            stream: parsed.stream,
        }, authStorage, modelRegistry);
        (0, theme_js_1.stopThemeWatcher)();
        if (process.stdout.writableLength > 0) {
            await new Promise((resolve) => process.stdout.once("drain", resolve));
        }
        process.exit(0);
    }
}
