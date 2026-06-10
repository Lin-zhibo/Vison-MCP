import { readFile } from "node:fs/promises";
import { VisionError } from "./errors.js";

/** Supported MIME types for image processing */
const SUPPORTED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

/** Maximum image size: 20 MB */
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/** Processed image ready for the vision API */
export interface ProcessedImage {
  /** Raw base64 data without the data: URI prefix */
  base64: string;
  /** Resolved MIME type, e.g. "image/png" */
  mimeType: string;
  /** Original source reference for error messages */
  source: string;
}

/**
 * Process an image from a data URI, HTTP URL, or local file path.
 * Returns a ProcessedImage with raw base64 and resolved MIME type.
 * Throws VisionError with code IMAGE_ERROR on any failure.
 */
export async function processImage(imageUrl: string): Promise<ProcessedImage> {
  if (imageUrl.startsWith("data:")) {
    return processDataUri(imageUrl);
  }
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return processHttpUrl(imageUrl);
  }
  return processLocalFile(imageUrl);
}

async function processDataUri(dataUri: string): Promise<ProcessedImage> {
  const match = dataUri.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) {
    throw new VisionError(
      "Invalid data URI format. Expected: data:image/<type>;base64,<data>",
      "IMAGE_ERROR",
      "The provided string is not a valid base64 data URI.",
    );
  }

  const mimeType = match[1];
  const base64 = match[2];

  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    throw new VisionError(
      `Unsupported image format: ${mimeType}. Supported: ${[...SUPPORTED_MIME_TYPES].join(", ")}`,
      "IMAGE_ERROR",
    );
  }

  // Validate base64 decodes correctly
  try {
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length > MAX_IMAGE_BYTES) {
      throw new VisionError(
        `Image exceeds ${MAX_IMAGE_BYTES / (1024 * 1024)}MB size limit (${(buffer.length / (1024 * 1024)).toFixed(1)}MB)`,
        "IMAGE_ERROR",
      );
    }
  } catch {
    throw new VisionError(
      "Invalid base64 data in image URI",
      "IMAGE_ERROR",
    );
  }

  return { base64, mimeType, source: "data URI" };
}

async function processHttpUrl(url: string): Promise<ProcessedImage> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === "AbortError") {
      throw new VisionError(
        "Image download timed out after 30 seconds",
        "IMAGE_ERROR",
        url,
      );
    }
    throw new VisionError(
      `Failed to fetch image: ${error instanceof Error ? error.message : String(error)}`,
      "IMAGE_ERROR",
      url,
    );
  }
  clearTimeout(timeout);

  if (!response.ok) {
    throw new VisionError(
      `Failed to fetch image: HTTP ${response.status} ${response.statusText}`,
      "IMAGE_ERROR",
      url,
    );
  }

  const contentType = response.headers.get("content-type") ?? "image/png";
  const mimeType = contentType.split(";")[0].trim();

  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    throw new VisionError(
      `Unsupported image format: ${mimeType}. Supported: ${[...SUPPORTED_MIME_TYPES].join(", ")}`,
      "IMAGE_ERROR",
      `URL: ${url}, Content-Type: ${contentType}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new VisionError(
      `Image exceeds ${MAX_IMAGE_BYTES / (1024 * 1024)}MB size limit (${(buffer.length / (1024 * 1024)).toFixed(1)}MB)`,
      "IMAGE_ERROR",
      url,
    );
  }

  const base64 = buffer.toString("base64");
  return { base64, mimeType, source: url };
}

async function processLocalFile(filePath: string): Promise<ProcessedImage> {
  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch (error) {
    throw new VisionError(
      `Cannot read file: ${error instanceof Error ? error.message : String(error)}`,
      "IMAGE_ERROR",
      filePath,
    );
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new VisionError(
      `Image exceeds ${MAX_IMAGE_BYTES / (1024 * 1024)}MB size limit (${(buffer.length / (1024 * 1024)).toFixed(1)}MB)`,
      "IMAGE_ERROR",
      filePath,
    );
  }

  // Detect MIME type from file extension
  const ext = filePath.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
  };
  const mimeType = mimeMap[ext ?? ""];

  if (!mimeType) {
    throw new VisionError(
      `Cannot determine image format from extension: .${ext ?? "unknown"}. Supported: ${Object.keys(mimeMap).join(", ")}`,
      "IMAGE_ERROR",
      filePath,
    );
  }

  const base64 = buffer.toString("base64");
  return { base64, mimeType, source: filePath };
}
