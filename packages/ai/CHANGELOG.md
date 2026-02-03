# Changelog

## [Unreleased]

### Added
- Added `AWS_BEDROCK_SKIP_AUTH` and `AWS_BEDROCK_FORCE_HTTP1` environment variables for connecting to unauthenticated Bedrock proxies ([#1320](https://github.com/badlogic/pi-mono/pull/1320) by [@virtuald](https://github.com/virtuald))

- Added `timeout` option to `StreamOptions` for controlling HTTP request timeout in milliseconds (provider-dependent)
- Added XML tool call parser (`createXmlToolCallParser`, `extractXmlToolCalls`, `hasXmlToolCalls`) for handling models that return tool calls in XML format within text content. Supports multiple formats: Anthropic-style (`<tool_calls><invoke name="...">`), function-style (`<function_calls>`), inline name with arg_key/arg_value (`<tool name="..."><arg_key>...</arg_key><arg_value>...</arg_value></tool>`), and self-closing tags. Works with streaming and non-streaming modes, handles JSON and key-value argument formats

### Fixed

- Set OpenAI Responses API requests to `store: false` by default to avoid server-side history logging ([#1308](https://github.com/badlogic/pi-mono/issues/1308))

- Fixed `timeout` stop reason not being handled in OpenAI completions provider, causing "Unhandled stop reason: timeout" error

## [0.52.6] - 2026-02-05

## [0.52.5] - 2026-02-05

### Fixed

- Fixed `supportsXhigh()` to treat Anthropic Messages Opus 4.6 models as xhigh-capable so `streamSimple` can map `xhigh` to adaptive effort `max`

## [0.52.4] - 2026-02-05

## [0.52.3] - 2026-02-05

### Fixed

- Fixed Bedrock Opus 4.6 model IDs (removed `:0` suffix) and cache pricing for `us.*` and `eu.*` variants
- Added missing `eu.anthropic.claude-opus-4-6-v1` inference profile to model catalog
- Fixed Claude Opus 4.6 context window metadata to 200000 for Anthropic and OpenCode providers

## [0.52.2] - 2026-02-05

## [0.52.1] - 2026-02-05

### Added

- Added adaptive thinking support for Claude Opus 4.6 with effort levels (`low`, `medium`, `high`, `max`)
- Added `effort` option to `AnthropicOptions` for controlling adaptive thinking depth
- `thinkingEnabled` now automatically uses adaptive thinking for Opus 4.6+ models and budget-based thinking for older models
- `streamSimple`/`completeSimple` automatically map `ThinkingLevel` to effort levels for Opus 4.6

### Changed

- Updated `@anthropic-ai/sdk` to 0.73.0
- Updated `@aws-sdk/client-bedrock-runtime` to 3.983.0
- Updated `@google/genai` to 1.40.0
- Removed `fast-xml-parser` override (no longer needed)

## [0.52.0] - 2026-02-05

### Added

- Added Claude Opus 4.6 model to the generated model catalog
- Added GPT-5.3 Codex model to the generated model catalog (OpenAI Codex provider only)

## [0.51.6] - 2026-02-04

### Fixed

- Fixed OpenAI Codex Responses provider to respect configured baseUrl ([#1244](https://github.com/badlogic/pi-mono/issues/1244))

## [0.51.5] - 2026-02-04

### Changed

- Changed Bedrock model generation to drop legacy workarounds now handled upstream ([#1239](https://github.com/badlogic/pi-mono/pull/1239) by [@unexge](https://github.com/unexge))

## [0.51.4] - 2026-02-03

## [0.51.3] - 2026-02-03

### Fixed

- Fixed xhigh thinking level support check to accept gpt-5.2 model IDs ([#1209](https://github.com/badlogic/pi-mono/issues/1209))

## [0.51.2] - 2026-02-03

## [0.51.1] - 2026-02-02

### Fixed

- Fixed `cache_control` not being applied to string-format user messages in Anthropic provider

## [0.51.0] - 2026-02-01

### Fixed

- Fixed `cacheRetention` option not being passed through in `buildBaseOptions` ([#1154](https://github.com/badlogic/pi-mono/issues/1154))
- Fixed OAuth login/refresh not using HTTP proxy settings (`HTTP_PROXY`, `HTTPS_PROXY` env vars) ([#1132](https://github.com/badlogic/pi-mono/issues/1132))
- Fixed OpenAI-compatible completions to omit unsupported `strict` tool fields for providers that reject them ([#1172](https://github.com/badlogic/pi-mono/issues/1172))

## [0.50.9] - 2026-02-01
