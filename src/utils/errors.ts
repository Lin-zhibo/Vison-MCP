/**
 * Unified error type for Vison-MCP.
 * Tool handlers catch these and return as CallToolResult with isError: true.
 */
export class VisionError extends Error {
  public readonly code: ErrorCode;

  constructor(
    message: string,
    code: ErrorCode,
    public readonly details?: string,
  ) {
    super(message);
    this.name = "VisionError";
    this.code = code;
  }
}

export type ErrorCode =
  | "INVALID_PARAMETER"
  | "IMAGE_ERROR"
  | "API_ERROR"
  | "BUSINESS_ERROR";

/**
 * Helper to format a VisionError for display in tool responses.
 */
export function formatVisionError(error: VisionError): string {
  const parts = [`[${error.code}] ${error.message}`];
  if (error.details) {
    parts.push(`Details: ${error.details}`);
  }
  return parts.join("\n");
}
