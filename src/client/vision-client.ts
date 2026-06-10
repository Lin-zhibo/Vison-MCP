import { VisionError } from "../utils/errors.js";
import type { ProcessedImage } from "../utils/image.js";

interface AnalyzeConfig {
  systemPrompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  retries?: number;
  mediaType?: 'image_url' | 'video_url';
  mediaUrl?: string;
}

interface VisionResult {
  text: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface OpenAIContentPart {
  type: "text" | "image_url" | "video_url";
  text?: string;
  image_url?: { url: string; detail?: "auto" | "low" | "high" };
  video_url?: { url: string };
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Send an image + system prompt to an OpenAI-compatible vision API.
 * Includes retry on 429/5xx, immediate throw on 401/403.
 */
export async function analyzeImage(
  image: ProcessedImage,
  config: AnalyzeConfig,
): Promise<VisionResult> {
  const apiKey = process.env.VISIONAI_API_KEY;
  const baseUrl = process.env.VISIONAI_BASE_URL;
  const defaultModel = process.env.VISIONAI_MODEL_NAME ?? "gpt-4o";

  if (!apiKey) {
    throw new VisionError(
      "VISIONAI_API_KEY is not set. Configure it in your environment.",
      "API_ERROR",
    );
  }
  if (!baseUrl) {
    throw new VisionError(
      "VISIONAI_BASE_URL is not set. Configure it in your environment.",
      "API_ERROR",
    );
  }

  const model = config.model ?? defaultModel;
  const maxRetries = config.retries ?? 2;
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const url = normalizedBase.endsWith("/v1")
    ? `${normalizedBase}/chat/completions`
    : `${normalizedBase}/v1/chat/completions`;

  const mediaUrl = config.mediaUrl ?? `data:${image.mimeType};base64,${image.base64}`;
  const content: OpenAIContentPart[] = [
    config.mediaType === 'video_url'
      ? { type: 'video_url', video_url: { url: mediaUrl } }
      : { type: 'image_url', image_url: { url: mediaUrl, detail: 'auto' } },
    {
      type: "text",
      text: config.systemPrompt,
    },
  ];

  const body = {
    model,
    messages: [{ role: "user" as const, content }],
    max_tokens: config.maxTokens ?? 4096,
    temperature: config.temperature ?? 0.3,
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      // Auth errors — no retry
      if (response.status === 401 || response.status === 403) {
        throw new VisionError(
          `Authentication failed (HTTP ${response.status}). Check your VISIONAI_API_KEY.`,
          "API_ERROR",
        );
      }

      // Rate limit or server error — retry
      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
        if (attempt < maxRetries) {
          await sleep(1000 * (attempt + 1));
          continue;
        }
        throw new VisionError(
          `Vision API returned HTTP ${response.status} after ${maxRetries + 1} attempts`,
          "API_ERROR",
        );
      }

      if (!response.ok) {
        throw new VisionError(
          `Vision API returned HTTP ${response.status}: ${response.statusText}`,
          "API_ERROR",
        );
      }

      const data: OpenAIResponse = await response.json();

      const text = data.choices?.[0]?.message?.content;
      if (!text || text.trim().length === 0) {
        throw new VisionError(
          "The model returned an empty response. Try rephrasing your request.",
          "BUSINESS_ERROR",
        );
      }

      return {
        text,
        model: data.model ?? model,
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error) {
      clearTimeout(timeout);

      if (error instanceof VisionError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        lastError = new Error("Request timed out after 60 seconds");
        if (attempt < maxRetries) {
          await sleep(1000 * (attempt + 1));
          continue;
        }
        throw new VisionError(
          `Vision API timed out after ${maxRetries + 1} attempts`,
          "API_ERROR",
        );
      }

      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      throw new VisionError(
        `Vision API request failed: ${lastError.message}`,
        "API_ERROR",
      );
    }
  }

  throw new VisionError(
    `Vision API request failed after all retries: ${lastError?.message ?? "unknown error"}`,
    "API_ERROR",
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
