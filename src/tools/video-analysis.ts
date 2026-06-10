import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { analyzeImage } from "../client/vision-client.js";
import { videoAnalysisPrompt } from "../prompts/templates.js";
import { probeVideo, extractFrames, detectVideoMode } from "../utils/video.js";
import { catchToolError, VisionError } from "../utils/errors.js";
import { writeFile, readFile, unlink } from "node:fs/promises";
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
  let isTemp = false;

  if (videoUrl.startsWith("http://") || videoUrl.startsWith("https://")) {
    videoPath = await downloadToTemp(videoUrl);
    isTemp = true;
  }

  try {
    const metadata = await probeVideo(videoPath);
    const buffer = await readFile(videoPath);
    const base64 = buffer.toString("base64");

    const result = await analyzeImage(
      { base64, mimeType: 'image/jpeg', source: videoUrl },
      {
        systemPrompt,
        maxTokens: 4096,
        retries: 2,
        mediaType: 'video_url',
        mediaUrl: `data:${metadata.mimeType};base64,${base64}`,
      },
    );

    const videoText = `**Video:** ${metadata.width}x${metadata.height}, ${metadata.duration.toFixed(1)}s, ${metadata.format}\n\n${result.text}`;

    return {
      content: [{ type: "text", text: videoText }],
      structuredContent: {
        text: videoText,
        mode: "direct",
        metadata: {
          format: metadata.format,
          duration: metadata.duration,
          width: metadata.width,
          height: metadata.height,
        },
      },
    };
  } finally {
    if (isTemp) {
      await unlink(videoPath).catch(() => {});
    }
  }
}

async function analyzeWithFrames(
  videoUrl: string,
  systemPrompt: string,
  maxFrames?: number,
  fps?: number,
): Promise<CallToolResult> {
  let videoPath = videoUrl;
  let isTemp = false;

  if (videoUrl.startsWith("http://") || videoUrl.startsWith("https://")) {
    videoPath = await downloadToTemp(videoUrl);
    isTemp = true;
  }

  try {
    const metadata = await probeVideo(videoPath);
    const frames = await extractFrames(videoPath, {
      fps: fps ?? 1,
      maxFrames: maxFrames ?? 30,
    });

    const CHUNK_SIZE = 5;
    const frameDescriptions: { index: number; timestamp: number; text: string }[] = [];

    for (let i = 0; i < frames.length; i += CHUNK_SIZE) {
      const chunk = frames.slice(i, i + CHUNK_SIZE);
      const results = await Promise.all(
        chunk.map((frame) =>
          analyzeImage(
            { base64: frame.base64, mimeType: "image/jpeg", source: `frame-${frame.index}` },
            {
              systemPrompt: `Describe this video frame at ${frame.timestamp.toFixed(1)}s. Note visible elements, people, objects, text, actions. Be concise.`,
              maxTokens: 500,
            },
          ).then((result) => ({
            index: frame.index,
            timestamp: frame.timestamp,
            text: result.text,
          }))
        ),
      );
      frameDescriptions.push(...results);
    }

    frameDescriptions.sort((a, b) => a.index - b.index);
    const descriptions = frameDescriptions.map(
      (fd) => `[${fd.timestamp.toFixed(1)}s] ${fd.text}`,
    );

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
${descriptions.join("\n\n")}

Synthesize these frame descriptions into a cohesive video analysis following the requested structure. Include timestamps from the frame descriptions.`,
      },
    );

    const videoText = `**Video:** ${metadata.width}x${metadata.height}, ${metadata.duration.toFixed(1)}s, ${metadata.format}, ${frames.length} frames\n\n${synthesisResult.text}`;

    return {
      content: [{ type: "text", text: videoText }],
      structuredContent: {
        text: videoText,
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
  } finally {
    if (isTemp) {
      await unlink(videoPath).catch(() => {});
    }
  }
}

async function downloadToTemp(url: string): Promise<string> {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) {
    throw new VisionError(
      `Failed to download video: HTTP ${response.status}`,
      "VIDEO_ERROR",
      url,
    );
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const sizeBytes = parseInt(contentLength, 10);
    const MAX_VIDEO_BYTES = 8 * 1024 * 1024;
    if (!isNaN(sizeBytes) && sizeBytes > MAX_VIDEO_BYTES) {
      console.error(
        `[vison-mcp] Warning: remote video Content-Length is ${(sizeBytes / (1024 * 1024)).toFixed(1)}MB ` +
        `(limit is ${MAX_VIDEO_BYTES / (1024 * 1024)}MB). Download may fail.`,
      );
    }
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const hash = createHash("md5").update(url).digest("hex").slice(0, 8);
  const ext = url.split(".").pop()?.split("?")[0] ?? "mp4";
  const tmpPath = join(tmpdir(), `vison-mcp-${hash}.${ext}`);

  await writeFile(tmpPath, buffer);
  return tmpPath;
}
