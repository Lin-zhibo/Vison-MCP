import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { analyzeImage } from "../client/vision-client.js";
import { IMAGE_ANALYSIS_PROMPT } from "../prompts/templates.js";
import { processImage } from "../utils/image.js";
import { VisionError, formatVisionError } from "../utils/errors.js";

export async function handleImageAnalysis(
  imageUrl: string,
  prompt?: string,
): Promise<CallToolResult> {
  try {
    const image = await processImage(imageUrl);

    const systemPrompt = prompt
      ? `${IMAGE_ANALYSIS_PROMPT}\n\nAdditional user instructions: ${prompt}`
      : IMAGE_ANALYSIS_PROMPT;

    const result = await analyzeImage(image, { systemPrompt });

    return {
      content: [{ type: "text", text: result.text }],
      structuredContent: {
        model: result.model,
        usage: result.usage,
      },
    };
  } catch (error) {
    if (error instanceof VisionError) {
      return {
        content: [{ type: "text", text: formatVisionError(error) }],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: "text",
          text: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}
