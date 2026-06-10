import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { analyzeImage } from "../client/vision-client.js";
import { uiDiffPrompt } from "../prompts/templates.js";
import { processImage } from "../utils/image.js";
import { catchToolError } from "../utils/errors.js";

export async function handleUiDiff(
  expectedUrl: string,
  actualUrl: string,
  prompt?: string,
): Promise<CallToolResult> {
  try {
    const [expected, actual] = await Promise.all([
      processImage(expectedUrl),
      processImage(actualUrl),
    ]);

    const systemPrompt = uiDiffPrompt(prompt);

    // Describe expected first, then compare actual against description
    const expectedDesc = await analyzeImage(expected, {
      systemPrompt: "Describe this UI screenshot in precise detail. Include layout, colors, typography, spacing, and all visible elements.",
      maxTokens: 1500,
    });

    const result = await analyzeImage(actual, {
      systemPrompt: `[EXPECTED DESIGN DESCRIPTION]:\n${expectedDesc.text}\n\n---\n\n${systemPrompt}`,
    });

    return {
      content: [{ type: "text", text: result.text }],
      structuredContent: {
        model: result.model,
        usage: result.usage,
      },
    };
  } catch (error) {
    return catchToolError(error);
  }
}
