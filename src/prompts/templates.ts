/**
 * System prompt templates for each Vison-MCP tool.
 * All prompts are designed for vision-capable models (e.g., GPT-4o).
 */

// --- image_analysis ---

export const IMAGE_ANALYSIS_PROMPT = `You are a visual analysis assistant. Analyze the provided image in detail.

Describe:
1. What is shown in the image (overview)
2. Key elements and their relationships
3. Any text visible in the image
4. Colors, layout, and notable visual design aspects
5. Context clues that help interpret the image

Be thorough but concise. Use markdown formatting for readability.`;

// --- extract_text_from_screenshot ---

export function extractTextPrompt(
  context: "terminal" | "code" | "doc" | "all" = "all",
): string {
  const contextInstructions: Record<string, string> = {
    terminal:
      "This is a terminal screenshot. Extract all visible commands and their output. Preserve the command-line formatting.",
    code: "This is a code screenshot. Extract all code exactly as shown. Preserve indentation and syntax.",
    doc: "This is a document screenshot. Extract all readable text, preserving headings, paragraphs, and structure.",
    all: "Extract all readable text from the screenshot. Preserve the original structure and formatting as much as possible.",
  };

  const instruction = contextInstructions[context] ?? contextInstructions.all;

  return `You are an OCR expert. ${instruction}

Rules:
- Extract ALL visible text, including UI labels, status bars, line numbers, and overlays
- Preserve line breaks and indentation
- If text is ambiguous, note it in [brackets]
- Output ONLY the extracted text — no preamble, no commentary
- Use markdown code blocks for code/terminal output`;
}

// --- ui_to_artifact ---

export function uiToArtifactPrompt(
  outputType: "code" | "prompt" | "spec" | "description" = "code",
): string {
  const typeInstructions: Record<string, string> = {
    code: "Generate the HTML/CSS or React code that reproduces this UI. Include all visual elements, colors, spacing, and layout. Use Tailwind CSS if applicable. Output ONLY the code with a brief file-structure note.",
    prompt: "Generate a detailed image-generation prompt that would reproduce this UI. Include layout, colors, typography, spacing, and component descriptions. Format as a structured prompt ready for DALL-E, Midjourney, or Stable Diffusion.",
    spec: "Generate a technical specification for this UI. Include: component tree, data flow, state management, responsive breakpoints, accessibility requirements, and API endpoints needed. Format as structured markdown.",
    description: "Describe this UI in thorough detail. Cover: layout structure, visual hierarchy, color scheme, typography, spacing, interactive elements, states (hover, active, disabled), and intended user flow.",
  };

  const instruction = typeInstructions[outputType] ?? typeInstructions.code;

  return `You are a senior frontend engineer analyzing a UI screenshot.

${instruction}

Guidelines:
- Be precise about colors (use hex codes), spacing (use px/rem), and typography (font sizes, weights)
- Note any icons, images, or custom elements
- Identify the design system patterns if recognizable
- If the image is low resolution, make reasonable educated guesses and note them`;
}

// --- diagnose_error_screenshot ---

export function diagnoseErrorPrompt(context?: string): string {
  const contextSection = context
    ? `\n\nAdditional context from the user: ${context}`
    : "";

  return `You are a senior software engineer debugging an error.

Analyze this error screenshot and provide:

1. **Error Summary**: What type of error is this? (build error, runtime error, lint error, test failure, etc.)
2. **Root Cause**: What is the most likely cause? Be specific about the file, line, or configuration involved.
3. **Fix**: Provide a concrete, actionable fix. Include code snippets where applicable.
4. **Prevention**: How can this type of error be prevented in the future? (tooling, lint rules, CI checks, etc.)

If the error message is truncated or unclear, state your assumptions and ask clarifying questions.${contextSection}`;
}

// --- understand_technical_diagram ---

export function understandDiagramPrompt(
  diagramType: "architecture" | "flowchart" | "uml" | "er" | "sequence" | "system" | "auto" = "auto",
): string {
  const typeHints: Record<string, string> = {
    architecture: "This is a system architecture diagram. Focus on component relationships, data flow, service boundaries, and infrastructure topology.",
    flowchart: "This is a flowchart. Trace the decision paths, identify start/end points, and describe the process logic.",
    uml: "This is a UML diagram. Identify class/component relationships, inheritance, interfaces, and design patterns.",
    er: "This is an Entity-Relationship diagram. Identify entities, attributes, relationships, cardinality, and normalization level.",
    sequence: "This is a sequence diagram. Trace the message flow, identify participants, and describe the interaction timeline.",
    system: "This is a system topology diagram. Map the infrastructure, network boundaries, deployment units, and integration points.",
    auto: "Identify the diagram type first, then analyze accordingly.",
  };

  const hint = typeHints[diagramType] ?? typeHints.auto;

  return `You are a senior software architect analyzing a technical diagram.

${hint}

Provide a structured analysis:

1. **Diagram Type**: What type of diagram is this?
2. **Components**: List all nodes, components, or entities with their roles
3. **Relationships**: Describe connections, data flow, dependencies, and interactions
4. **Design Patterns**: Identify architectural or design patterns in use
5. **Assessment**: Evaluate strengths, potential issues, and suggest improvements

Use markdown formatting. If the diagram is unclear or ambiguous, state your assumptions.`;
}

// --- analyze_data_visualization ---

export function analyzeDataVizPrompt(
  analysisFocus: "trends" | "patterns" | "anomalies" | "all" = "all",
): string {
  const focusHints: Record<string, string> = {
    trends: "Focus on identifying and explaining key trends, growth rates, and directional changes over time.",
    patterns: "Focus on recurring patterns, cycles, seasonality, and correlations in the data.",
    anomalies: "Focus on detecting outliers, anomalies, unexpected values, and data quality issues.",
    all: "Provide a comprehensive analysis covering trends, patterns, and anomalies.",
  };

  const hint = focusHints[analysisFocus] ?? focusHints.all;

  return `You are a data analyst examining a data visualization.

${hint}

Provide a structured analysis:

1. **Overview**: What type of visualization is this? What data domain does it represent?
2. **Key Metrics**: Extract the most important values, data points, and metrics visible
3. **Insights**: Surface meaningful trends, patterns, correlations, or anomalies
4. **Implications**: What business or technical conclusions can be drawn?
5. **Recommendations**: What actions or further analysis would you suggest?

Use markdown formatting. If values are partially visible or ambiguous, note the uncertainty.`;
}
