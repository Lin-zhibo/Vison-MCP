import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleImageAnalysis } from "./tools/image-analysis.js";
import { handleExtractText } from "./tools/extract-text.js";
import { handleUiToArtifact } from "./tools/ui-to-artifact.js";
import { handleDiagnoseError } from "./tools/diagnose-error.js";

const server = new McpServer({
  name: "vison-mcp",
  version: "1.0.0",
});

// --- image_analysis ---
server.tool(
  "image_analysis",
  "Analyze any image with a general vision model. Returns a detailed description " +
    "of the image content, key elements, text, colors, layout, and context clues.",
  {
    imageUrl: z
      .string()
      .describe(
        "Image source: a data URI (data:image/...;base64,...), an http(s) URL, or a local file path",
      ),
    prompt: z
      .string()
      .optional()
      .describe(
        "Optional custom analysis instruction. Overrides the default analysis prompt.",
      ),
  },
  async ({ imageUrl, prompt }) => handleImageAnalysis(imageUrl, prompt),
);

// --- extract_text_from_screenshot ---
server.tool(
  "extract_text_from_screenshot",
  "Extract text from screenshots. Optimized for terminals, code editors, documents, " +
    "and general content. Returns extracted text preserving original structure.",
  {
    imageUrl: z
      .string()
      .describe(
        "Image source: a data URI (data:image/...;base64,...), an http(s) URL, or a local file path",
      ),
    context: z
      .enum(["terminal", "code", "doc", "all"])
      .optional()
      .default("all")
      .describe(
        "Content type: 'terminal' (CLI output), 'code' (source code), 'doc' (document), 'all' (auto-detect)",
      ),
  },
  async ({ imageUrl, context }) => handleExtractText(imageUrl, context),
);

// --- ui_to_artifact ---
server.tool(
  "ui_to_artifact",
  "Convert UI screenshots into structured deliverables: production-ready code, " +
    "image-generation prompts, technical specifications, or detailed descriptions.",
  {
    imageUrl: z
      .string()
      .describe(
        "Image source: a data URI (data:image/...;base64,...), an http(s) URL, or a local file path",
      ),
    outputType: z
      .enum(["code", "prompt", "spec", "description"])
      .optional()
      .default("code")
      .describe(
        "Output type: 'code' (HTML/CSS/React), 'prompt' (AI image gen prompt), " +
          "'spec' (technical spec), 'description' (detailed description)",
      ),
  },
  async ({ imageUrl, outputType }) => handleUiToArtifact(imageUrl, outputType),
);

// --- diagnose_error_screenshot ---
server.tool(
  "diagnose_error_screenshot",
  "Analyze error screenshots (build errors, runtime errors, stack traces) and " +
    "propose actionable fixes with root cause analysis.",
  {
    imageUrl: z
      .string()
      .describe(
        "Image source: a data URI (data:image/...;base64,...), an http(s) URL, or a local file path",
      ),
    context: z
      .string()
      .optional()
      .describe(
        "Additional context: programming language, framework, build tool, or environment details",
      ),
  },
  async ({ imageUrl, context }) => handleDiagnoseError(imageUrl, context),
);

export { server };
