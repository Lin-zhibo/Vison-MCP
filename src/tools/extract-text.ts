import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { analyzeImage } from "../client/vision-client.js";
import { extractTextPrompt } from "../prompts/templates.js";
import { processImage } from "../utils/image.js";
import { catchToolError } from "../utils/errors.js";

export async function handleExtractText(
  imageUrl: string,
  context: "terminal" | "code" | "doc" | "all" = "all",
): Promise<CallToolResult> {
  try {
    const image = await processImage(imageUrl);
    const systemPrompt = extractTextPrompt(context);
    const result = await analyzeImage(image, { systemPrompt });

    return {
      content: [{ type: "text", text: result.text }],
      structuredContent: {
        text: result.text,
        model: result.model,
        context,
        usage: result.usage,
      },
    };
  } catch (error) {
    return catchToolError(error);
  }
}
