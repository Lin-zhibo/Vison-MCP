#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { server } from "./server.js";

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr — stdout is the MCP transport channel
  console.error("Vison-MCP v1.0.0 running on stdio");
  console.error(
    "Tools: image_analysis, extract_text_from_screenshot, ui_to_artifact, diagnose_error_screenshot, understand_technical_diagram, analyze_data_visualization, ui_diff_check, video_analysis",
  );
}

main().catch((error: unknown) => {
  console.error("Fatal startup error:", error);
  process.exit(1);
});
