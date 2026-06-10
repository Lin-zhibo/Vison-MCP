import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { analyzeImage } from "../client/vision-client.js";
import { understandDiagramPrompt } from "../prompts/templates.js";
import { processImage } from "../utils/image.js";
import { catchToolError } from "../utils/errors.js";

export async function handleUnderstandDiagram(
  imageUrl: string,
  diagramType: "architecture" | "flowchart" | "uml" | "er" | "sequence" | "system" | "auto" = "auto",
): Promise<CallToolResult> {
  try {
    const image = await processImage(imageUrl);
    const systemPrompt = understandDiagramPrompt(diagramType);
    const result = await analyzeImage(image, { systemPrompt });

    return {
      content: [{ type: "text", text: result.text }],
      structuredContent: {
        model: result.model,
        diagramType,
        usage: result.usage,
      },
    };
  } catch (error) {
    return catchToolError(error);
  }
}
