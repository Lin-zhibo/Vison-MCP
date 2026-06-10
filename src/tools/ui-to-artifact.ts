import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { analyzeImage } from "../client/vision-client.js";
import { uiToArtifactPrompt } from "../prompts/templates.js";
import { processImage } from "../utils/image.js";
import { catchToolError } from "../utils/errors.js";

export async function handleUiToArtifact(
  imageUrl: string,
  outputType: "code" | "prompt" | "spec" | "description" = "code",
): Promise<CallToolResult> {
  try {
    const image = await processImage(imageUrl);
    const systemPrompt = uiToArtifactPrompt(outputType);
    const result = await analyzeImage(image, { systemPrompt });

    return {
      content: [{ type: "text", text: result.text }],
      structuredContent: {
        model: result.model,
        outputType,
        usage: result.usage,
      },
    };
  } catch (error) {
    return catchToolError(error);
  }
}
