# Vison-MCP v1 Design Specification

**Date:** 2026-06-11
**Status:** Approved
**Scope:** v1 — 4 core tools + production-ready infrastructure

---

## 1. Purpose

Vison-MCP is an MCP (Model Context Protocol) server that enables Claude Code to understand and process visual content — screenshots, diagrams, UIs, error messages — through an OpenAI-compatible vision API.

## 2. Architecture

```
Claude Code
    │ MCP Protocol (stdio / JSON-RPC)
    ▼
┌─────────────────────────────────┐
│         Vison-MCP Server        │
│                                 │
│  server.tool("image_analysis")  │
│  server.tool("extract_text...") │
│  server.tool("ui_to_artifact")  │
│  server.tool("diagnose_error")  │
│                                 │
│  ┌─ Prompts Layer ───────────┐ │
│  │ System prompts per tool   │ │
│  │ + parameter interpolation │ │
│  └────────────┬──────────────┘ │
│               │                 │
│  ┌─ Vision Client ──────────┐  │
│  │ OpenAI-compatible         │  │
│  │ POST /v1/chat/completions │  │
│  │ Retry + timeout + errors  │  │
│  └────────────┬──────────────┘  │
└───────────────┼─────────────────┘
                │ HTTP
                ▼
    VISIONAI_BASE_URL (OpenAI-compatible)
```

## 3. Tech Stack

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Language | TypeScript (ESM) | MCP SDK most mature; best AI codegen quality |
| MCP SDK | `@modelcontextprotocol/sdk` ^1.29 | Latest stable; stdio transport ready |
| Transport | stdio | Local server for Claude Code |
| Schema | Zod ^4 | SDK peer dependency; forward-compatible |
| Runtime | Node.js 18+ | Required for global `fetch` |
| API format | OpenAI-compatible `/v1/chat/completions` | Industry standard; broad model support |

## 4. Project Structure

```
Vison-MCP/
├── src/
│   ├── index.ts               # Entry point: stdio transport + connect
│   ├── server.ts              # McpServer init + 4 tool registrations
│   ├── client/
│   │   └── vision-client.ts   # OpenAI-compatible API client with retry
│   ├── tools/
│   │   ├── image-analysis.ts  # General image understanding
│   │   ├── extract-text.ts    # OCR from screenshots
│   │   ├── ui-to-artifact.ts  # UI screenshot → code/spec/prompt
│   │   └── diagnose-error.ts  # Error screenshot → diagnosis + fix
│   ├── prompts/
│   │   └── templates.ts       # System prompts for each tool
│   └── utils/
│       ├── image.ts           # Image processing (base64, fetch, fs, validate)
│       └── errors.ts          # VisionError class (never throw in tools)
├── package.json
├── tsconfig.json
├── README.md
└── .env.example
```

## 5. v1 Tools

### 5.1 `image_analysis`
- **Purpose:** General visual understanding — the fallback for anything not covered by specialized tools
- **Required:** `imageUrl` (string)
- **Optional:** `prompt` (string) — custom analysis instruction
- **Output:** Markdown description of the image content

### 5.2 `extract_text_from_screenshot`
- **Purpose:** OCR from screenshots of terminals, code, documents, or general content
- **Required:** `imageUrl` (string)
- **Optional:** `context` (enum: `terminal` | `code` | `doc` | `all`, default `all`) — tunes the OCR prompt for the content type
- **Output:** Extracted text content

### 5.3 `ui_to_artifact`
- **Purpose:** Convert UI screenshots into structured deliverables
- **Required:** `imageUrl` (string)
- **Optional:** `outputType` (enum: `code` | `prompt` | `spec` | `description`, default `code`) — determines the output format
- **Output:** Generated artifact in the requested format

### 5.4 `diagnose_error_screenshot`
- **Purpose:** Analyze error screenshots (build errors, runtime errors, stack traces) and propose fixes
- **Required:** `imageUrl` (string)
- **Optional:** `context` (string) — language, framework, or environment context
- **Output:** Error diagnosis with root cause analysis and actionable fix suggestions

### Input Design (Unified)
- `imageUrl` supports three sources: `data:` URI, `http(s):` URL, local `file:` path
- All tools annotated `readOnlyHint: true`, `destructiveHint: false`
- All tools use Zod schemas with `.describe()` for parameter documentation

## 6. Data Flow

```
User provides imageUrl
    │
    ▼
MCP tool handler
    │
    ├─ 1. Zod schema validation → INVALID_PARAMETER error if fails
    │
    ├─ 2. processImage(imageUrl) → IMAGE_ERROR if fails
    │     ├─ data: URI → parse, validate base64, check format
    │     ├─ http(s): URL → fetch with timeout, check format/size
    │     └─ local path → fs.readFile, check format/size
    │
    ├─ 3. Inject tool-specific system prompt (from templates.ts)
    │
    ├─ 4. analyzeImage(image, systemPrompt) → API_ERROR if fails
    │     ├─ Build OpenAI vision request (base64 image + text prompt)
    │     ├─ POST to ${BASE_URL}/v1/chat/completions
    │     ├─ Retry: 2 retries on 429/5xx with 1s×retryCount backoff
    │     ├─ Timeout: 60s via AbortController
    │     └─ Auth fail (401/403): throw immediately, no retry
    │
    └─ 5. Return CallToolResult
          ├─ Success: content [{ type: "text", text: result.text }]
          └─ Error: content [{ type: "text", text: error.message }], isError: true
```

## 7. Error Handling

Tool handlers **never throw**. All errors are caught and returned as `{ isError: true }`.

| Error Code | Trigger | User Message Example |
|------------|---------|---------------------|
| `INVALID_PARAMETER` | Zod schema validation failure | Provided by Zod |
| `IMAGE_ERROR` | Unsupported format, file >20MB, invalid base64, file not found | "Unsupported image format: .svg. Supported: png, jpeg, gif, webp." |
| `API_ERROR` | Auth failure (401/403), timeout after retries | "Vision API timed out after 3 attempts." |
| `BUSINESS_ERROR` | API returned empty content | "The model returned an empty response. Try rephrasing." |

## 8. Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `VISIONAI_API_KEY` | Yes | — | API authentication key |
| `VISIONAI_BASE_URL` | Yes | — | OpenAI-compatible endpoint |
| `VISIONAI_MODEL_NAME` | No | `gpt-4o` | Vision model to use |

No `.env` file loader — MCP servers inherit the parent process environment from Claude Code.

## 9. Implementation Order (Dependency-Driven)

```
Phase 1 — Zero dependencies:
  package.json → tsconfig.json → .env.example → src/utils/errors.ts

Phase 2 — Utilities:
  src/utils/image.ts (depends on errors.ts)

Phase 3 — API Client:
  src/client/vision-client.ts (depends on errors.ts, image.ts types)

Phase 4 — Prompts:
  src/prompts/templates.ts (no code dependencies)

Phase 5 — Tool Handlers (parallel after Phases 3+4):
  src/tools/image-analysis.ts
  src/tools/extract-text.ts
  src/tools/ui-to-artifact.ts
  src/tools/diagnose-error.ts

Phase 6 — Server Assembly:
  src/server.ts → src/index.ts
```

## 10. Key Design Decisions

1. **Tool handlers return, never throw.** Throwing from an MCP tool handler crashes the stdio pipe. All errors become `CallToolResult` with `isError: true`.
2. **No dotenv in production.** MCP servers inherit the spawning process's environment. `.env` loading is only for local dev.
3. **System prompts as pure string templates.** No runtime prompt library — just exported constants/functions for transparency and testability.
4. **Single vision client with retry.** One `analyzeImage()` function used by all tools, with built-in retry on transient failures.
5. **Three-way image source support.** Same `imageUrl` parameter handles data URIs, HTTP URLs, and local files — avoiding multiple parameters for the same concept.

## 11. v1.1 and v1.2 (Out of Scope)

| Version | Tools |
|---------|-------|
| v1.1 | `understand_technical_diagram`, `analyze_data_visualization` — structured understanding, reuses v1 prompt infrastructure |
| v1.2 | `ui_diff_check` (dual-input comparison), `video_analysis` (different modality) |

---

## Changelog

- **2026-06-11**: Initial v1 design specification created and approved.
