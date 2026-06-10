import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { analyzeImage } from "../client/vision-client.js";
import { videoAnalysisPrompt } from "../prompts/templates.js";
import { probeVideo, extractFrames, detectVideoMode } from "../utils/video.js";
import { catchToolError, VisionError } from "../utils/errors.js";
import { writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

export async function handleVideoAnalysis(
  videoUrl: string,
  prompt?: string,
  maxFrames?: number,
  fps?: number,
): Promise<CallToolResult> {
  try {
    const mode = detectVideoMode();
    const systemPrompt = videoAnalysisPrompt(prompt);

    if (mode === "direct") {
      return await analyzeDirect(videoUrl, systemPrompt);
    }

    return await analyzeWithFrames(videoUrl, systemPrompt, maxFrames, fps);
  } catch (error) {
    return catchToolError(error);
  }
}

async function analyzeDirect(
  videoUrl: string,
  systemPrompt: string,
): Promise<CallToolResult> {
  let videoPath = videoUrl;

  if (videoUrl.startsWith("http://") || videoUrl.startsWith("https://")) {
    videoPath = await downloadToTemp(videoUrl);
  }

  const metadata = await probeVideo(videoPath);
  const buffer = await readFile(videoPath);
  const base64 = buffer.toString("base64");

  const apiKey = process.env.VISIONAI_API_KEY;
  const baseUrl = process.env.VISIONAI_BASE_URL;
  const model = process.env.VISIONAI_MODEL_NAME ?? "gpt-4o";

  if (!apiKey || !baseUrl) {
    throw new VisionError(
      "VISIONAI_API_KEY and VISIONAI_BASE_URL must be configured",
      "API_ERROR",
    );
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{
        role: "user",
        content: [
          {
            type: "video_url",
            video_url: { url: `data:video/${metadata.format};base64,${base64}` },
          },
          { type: "text", text: systemPrompt },
        ],
      }],
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok) {
    throw new VisionError(
      `Video API returned HTTP ${response.status}: ${response.statusText}`,
      "API_ERROR",
    );
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    model?: string;
  };
  const text = data.choices?.[0]?.message?.content ?? "";

  return {
    content: [{
      type: "text",
      text: `**Video:** ${metadata.width}x${metadata.height}, ${metadata.duration.toFixed(1)}s, ${metadata.format}\n\n${text}`,
    }],
    structuredContent: {
      mode: "direct",
      metadata: {
        format: metadata.format,
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
      },
    },
  };
}

async function analyzeWithFrames(
  videoUrl: string,
  systemPrompt: string,
  maxFrames?: number,
  fps?: number,
): Promise<CallToolResult> {
  let videoPath = videoUrl;

  if (videoUrl.startsWith("http://") || videoUrl.startsWith("https://")) {
    videoPath = await downloadToTemp(videoUrl);
  }

  const metadata = await probeVideo(videoPath);
  const frames = await extractFrames(videoPath, {
    fps: fps ?? 1,
    maxFrames: maxFrames ?? 30,
  });

  const frameDescriptions: string[] = [];
  for (const frame of frames) {
    const result = await analyzeImage(
      { base64: frame.base64, mimeType: "image/jpeg", source: `frame-${frame.index}` },
      {
        systemPrompt: `Describe this video frame at ${frame.timestamp.toFixed(1)}s. Note visible elements, people, objects, text, actions. Be concise.`,
        maxTokens: 500,
      },
    );
    frameDescriptions.push(`[${frame.timestamp.toFixed(1)}s] ${result.text}`);
  }

  const synthesisResult = await analyzeImage(
    { base64: frames[0].base64, mimeType: "image/jpeg", source: "summary" },
    {
      systemPrompt: `${systemPrompt}

**Video Metadata:**
- Duration: ${metadata.duration.toFixed(1)}s
- Resolution: ${metadata.width}x${metadata.height}
- Format: ${metadata.format}
- Frames analyzed: ${frames.length}

**Frame-by-frame descriptions:**
${frameDescriptions.join("\n\n")}

Synthesize these frame descriptions into a cohesive video analysis following the requested structure. Include timestamps from the frame descriptions.`,
    },
  );

  return {
    content: [{
      type: "text",
      text: `**Video:** ${metadata.width}x${metadata.height}, ${metadata.duration.toFixed(1)}s, ${metadata.format}, ${frames.length} frames\n\n${synthesisResult.text}`,
    }],
    structuredContent: {
      mode: "frames",
      metadata: {
        format: metadata.format,
        duration: metadata.duration,
        width: metadata.width,
        height: metadata.height,
      },
      frameCount: frames.length,
      usage: synthesisResult.usage,
    },
  };
}

async function downloadToTemp(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) {
    throw new VisionError(
      `Failed to download video: HTTP ${response.status}`,
      "IMAGE_ERROR",
      url,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const hash = createHash("md5").update(url).digest("hex").slice(0, 8);
  const ext = url.split(".").pop()?.split("?")[0] ?? "mp4";
  const tmpPath = join(tmpdir(), `vison-mcp-${hash}.${ext}`);

  await writeFile(tmpPath, buffer);
  return tmpPath;
}
