# Vison-MCP

> MCP server for vision AI — screenshots to code, OCR, error diagnosis, and image analysis via OpenAI-compatible APIs.

## Supported Tools

| Tool | Description |
|------|-------------|
| `image_analysis` | General visual understanding — describe any image in detail |
| `extract_text_from_screenshot` | OCR optimized for terminals, code, documents, and general content |
| `ui_to_artifact` | Convert UI screenshots into code, prompts, specs, or descriptions |
| `diagnose_error_screenshot` | Analyze error screenshots and propose actionable fixes |
| `understand_technical_diagram` | Interpret architecture diagrams, flowcharts, UML, ER, and system diagrams |
| `analyze_data_visualization` | Read charts and dashboards to surface insights, trends, and anomalies |

## Installation

```bash
git clone https://github.com/Lin-zhibo/Vison-MCP.git
cd Vison-MCP
npm install
npm run build
```

## Configuration

Set the following environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VISIONAI_API_KEY` | Yes | — | API authentication key |
| `VISIONAI_BASE_URL` | Yes | — | OpenAI-compatible API endpoint |
| `VISIONAI_MODEL_NAME` | No | `gpt-4o` | Vision model to use |

## Usage

### With Claude Code

Add to your `.claude/settings.json` or `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vison-mcp": {
      "command": "node",
      "args": ["/path/to/Vison-MCP/dist/index.js"],
      "env": {
        "VISIONAI_API_KEY": "your-api-key",
        "VISIONAI_BASE_URL": "https://api.openai.com/v1",
        "VISIONAI_MODEL_NAME": "gpt-4o"
      }
    }
  }
}
```

### Local Development

```bash
# Copy environment template
cp .env.example .env
# Edit .env with your API credentials

# Build and run
npm run build
npm start
```

## Requirements

- Node.js >= 18.0.0
- An OpenAI-compatible vision API endpoint (GPT-4o, Claude Vision, or compatible)

## License

MIT
