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
  | "BUSINESS_ERROR"
  | "VIDEO_ERROR";

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

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

/**
 * Shared error catch for all tool handlers.
 * Converts VisionError and unknown errors into CallToolResult with isError: true.
 */
export function catchToolError(error: unknown): CallToolResult {
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
