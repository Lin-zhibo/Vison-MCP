import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleImageAnalysis } from "./tools/image-analysis.js";
import { handleExtractText } from "./tools/extract-text.js";
import { handleUiToArtifact } from "./tools/ui-to-artifact.js";
import { handleDiagnoseError } from "./tools/diagnose-error.js";
import { handleUnderstandDiagram } from "./tools/understand-diagram.js";
import { handleAnalyzeVisualization } from "./tools/analyze-visualization.js";

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

// --- understand_technical_diagram ---
server.tool(
  "understand_technical_diagram",
  "Interpret architecture diagrams, flowcharts, UML, ER, sequence, and system topology diagrams. " +
    "Returns structured analysis of components, relationships, design patterns, and improvement suggestions.",
  {
    imageUrl: z
      .string()
      .describe(
        "Image source: a data URI (data:image/...;base64,...), an http(s) URL, or a local file path",
      ),
    diagramType: z
      .enum(["architecture", "flowchart", "uml", "er", "sequence", "system", "auto"])
      .optional()
      .default("auto")
      .describe(
        "Diagram type hint: 'architecture', 'flowchart', 'uml', 'er', 'sequence', 'system', or 'auto' for auto-detection",
      ),
  },
  async ({ imageUrl, diagramType }) => handleUnderstandDiagram(imageUrl, diagramType),
);

// --- analyze_data_visualization ---
server.tool(
  "analyze_data_visualization",
  "Read charts, dashboards, and statistical visualizations to surface insights, " +
    "trends, patterns, and anomalies with actionable recommendations.",
  {
    imageUrl: z
      .string()
      .describe(
        "Image source: a data URI (data:image/...;base64,...), an http(s) URL, or a local file path",
      ),
    analysisFocus: z
      .enum(["trends", "patterns", "anomalies", "all"])
      .optional()
      .default("all")
      .describe(
        "Analysis lens: 'trends' (time-series focus), 'patterns' (recurring structures), 'anomalies' (outlier detection), 'all' (comprehensive)",
      ),
  },
  async ({ imageUrl, analysisFocus }) => handleAnalyzeVisualization(imageUrl, analysisFocus),
);

export { server };
