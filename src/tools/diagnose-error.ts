import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { analyzeImage } from "../client/vision-client.js";
import { diagnoseErrorPrompt } from "../prompts/templates.js";
import { processImage } from "../utils/image.js";
import { VisionError, formatVisionError } from "../utils/errors.js";

export async function handleDiagnoseError(
  imageUrl: string,
  context?: string,
): Promise<CallToolResult> {
  try {
    const image = await processImage(imageUrl);
    const systemPrompt = diagnoseErrorPrompt(context);
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
