# Vison-MCP — Claude Code Instructions

## Project Overview

Vison-MCP is an MCP server that provides vision AI capabilities (screenshot analysis, OCR, UI-to-code, error diagnosis) to Claude Code through the Model Context Protocol.

## Tech Stack

- TypeScript (ESM) with strict mode
- `@modelcontextprotocol/sdk` ^1.29 — MCP server framework
- Zod ^4 — input validation
- OpenAI-compatible `/v1/chat/completions` — vision API

## Development Commands

```bash
npm install           # Install dependencies
npm run build         # Compile TypeScript (tsc)
npm start             # Run the server (requires build first)
npm run dev           # Watch mode (tsc --watch)
```

## Architecture

```
src/index.ts          # Entry: stdio transport
src/server.ts         # McpServer + 4 tool registrations
src/client/           # Vision API client (retry/timeout)
src/tools/            # One file per tool handler
src/prompts/          # System prompt templates
src/utils/            # Image processing + error handling
```

## Code Conventions

- **Tool handlers never throw.** All errors are caught and returned as `CallToolResult` with `isError: true`.
- **Log to stderr.** Stdout is the MCP transport channel.
- **Use .js extensions in imports.** Required by ESM + NodeNext module resolution.
- **Zod schemas with `.describe()`.** Every parameter must have a description for AI discoverability.
