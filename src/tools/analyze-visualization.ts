import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { analyzeImage } from "../client/vision-client.js";
import { analyzeDataVizPrompt } from "../prompts/templates.js";
import { processImage } from "../utils/image.js";
import { catchToolError } from "../utils/errors.js";

export async function handleAnalyzeVisualization(
  imageUrl: string,
  analysisFocus: "trends" | "patterns" | "anomalies" | "all" = "all",
): Promise<CallToolResult> {
  try {
    const image = await processImage(imageUrl);
    const systemPrompt = analyzeDataVizPrompt(analysisFocus);
    const result = await analyzeImage(image, { systemPrompt });

    return {
      content: [{ type: "text", text: result.text }],
      structuredContent: {
        model: result.model,
        analysisFocus,
        usage: result.usage,
      },
    };
  } catch (error) {
    return catchToolError(error);
  }
}
