import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { VisionError } from "./errors.js";

const execFileAsync = promisify(execFile);

/** Supported video formats */
const SUPPORTED_VIDEO_FORMATS = new Set(["mp4", "mov", "m4v"]);

/** Maximum local video file size: 8 MB */
const MAX_VIDEO_BYTES = 8 * 1024 * 1024;

/** Video metadata from ffprobe */
export interface VideoMetadata {
  format: string;
  duration: number;
  width: number;
  height: number;
  sizeBytes: number;
}

/** A single extracted frame */
export interface ExtractedFrame {
  index: number;
  timestamp: number;
  base64: string;
}

/** Configuration for frame extraction */
export interface FrameExtractionConfig {
  fps?: number;
  maxFrames?: number;
  startTime?: number;
}

/** Video processing mode */
export type VideoMode = "direct" | "frames" | "auto";

/**
 * Check if FFmpeg and FFprobe are available on the system PATH.
 */
export async function checkFfmpeg(): Promise<{ ffmpeg: string; ffprobe: string }> {
  const errors: string[] = [];

  try {
    await execFileAsync("ffmpeg", ["-version"], { timeout: 5000 });
  } catch {
    errors.push("ffmpeg");
  }

  try {
    await execFileAsync("ffprobe", ["-version"], { timeout: 5000 });
  } catch {
    errors.push("ffprobe");
  }

  if (errors.length > 0) {
    throw new VisionError(
      `Required tools not found: ${errors.join(", ")}. ` +
        "Install FFmpeg: https://ffmpeg.org/download.html",
      "IMAGE_ERROR",
    );
  }

  return { ffmpeg: "ffmpeg", ffprobe: "ffprobe" };
}

/**
 * Probe a video file and return its metadata using ffprobe.
 */
export async function probeVideo(videoPath: string): Promise<VideoMetadata> {
  await checkFfmpeg();

  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "quiet",
      "-print_format", "json",
      "-show_format",
      "-show_streams",
      videoPath,
    ], { timeout: 15_000 });

    const data = JSON.parse(stdout);
    const videoStream = data.streams?.find(
      (s: { codec_type: string }) => s.codec_type === "video",
    );

    if (!videoStream) {
      throw new VisionError(
        "No video stream found in file",
        "IMAGE_ERROR",
        videoPath,
      );
    }

    const format = (data.format?.format_name ?? "").split(",")[0];
    if (!SUPPORTED_VIDEO_FORMATS.has(format)) {
      throw new VisionError(
        `Unsupported video format: ${format}. Supported: ${[...SUPPORTED_VIDEO_FORMATS].join(", ")}`,
        "IMAGE_ERROR",
      );
    }

    const sizeBytes = parseInt(data.format?.size ?? "0", 10);
    if (sizeBytes > MAX_VIDEO_BYTES) {
      throw new VisionError(
        `Video exceeds ${MAX_VIDEO_BYTES / (1024 * 1024)}MB size limit (${(sizeBytes / (1024 * 1024)).toFixed(1)}MB)`,
        "IMAGE_ERROR",
        videoPath,
      );
    }

    return {
      format,
      duration: parseFloat(data.format?.duration ?? "0"),
      width: videoStream.width ?? 0,
      height: videoStream.height ?? 0,
      sizeBytes,
    };
  } catch (error) {
    if (error instanceof VisionError) throw error;
    throw new VisionError(
      `Failed to probe video: ${error instanceof Error ? error.message : String(error)}`,
      "IMAGE_ERROR",
      videoPath,
    );
  }
}

/**
 * Extract frames from a video using FFmpeg.
 * Returns frames as JPEG base64 strings with timestamps.
 */
export async function extractFrames(
  videoPath: string,
  config: FrameExtractionConfig = {},
): Promise<ExtractedFrame[]> {
  const fps = config.fps ?? 1;
  const maxFrames = config.maxFrames ?? 30;
  const startTime = config.startTime ?? 0;

  await checkFfmpeg();

  try {
    const args = [
      "-ss", String(startTime),
      "-i", videoPath,
      "-vf", `fps=${fps}`,
      "-frames:v", String(maxFrames),
      "-f", "image2pipe",
      "-vcodec", "mjpeg",
      "-q:v", "2",
      "-",
    ];

    const { stdout } = await execFileAsync("ffmpeg", args, {
      timeout: 60_000,
      maxBuffer: 50 * 1024 * 1024,
      encoding: "buffer",
    });

    const frames: ExtractedFrame[] = [];
    const jpegStartMarker = Buffer.from([0xff, 0xd8]);
    const jpegEndMarker = Buffer.from([0xff, 0xd9]);

    let offset = 0;
    let index = 0;

    while (offset < stdout.length && index < maxFrames) {
      const startPos = stdout.indexOf(jpegStartMarker, offset);
      if (startPos === -1) break;

      const endPos = stdout.indexOf(jpegEndMarker, startPos);
      if (endPos === -1) break;

      const frameBuffer = stdout.subarray(startPos, endPos + 2);
      const base64 = frameBuffer.toString("base64");

      frames.push({
        index,
        timestamp: startTime + (index / fps),
        base64,
      });

      offset = endPos + 2;
      index++;
    }

    if (frames.length === 0) {
      throw new VisionError(
        "Failed to extract any frames from video",
        "IMAGE_ERROR",
        videoPath,
      );
    }

    return frames;
  } catch (error) {
    if (error instanceof VisionError) throw error;
    throw new VisionError(
      `Failed to extract frames: ${error instanceof Error ? error.message : String(error)}`,
      "IMAGE_ERROR",
      videoPath,
    );
  }
}

/**
 * Detect video processing mode.
 * Checks VISIONAI_VIDEO_MODE env var, then falls back to model name detection.
 */
export function detectVideoMode(): VideoMode {
  const envMode = process.env.VISIONAI_VIDEO_MODE;
  if (envMode === "direct" || envMode === "frames") {
    return envMode;
  }

  const model = (process.env.VISIONAI_MODEL_NAME ?? "").toLowerCase();

  const nativeVideoModels = [
    "gemini",
    "glm-4v",
    "glm-4.6v",
    "cogview",
    "video",
  ];

  for (const pattern of nativeVideoModels) {
    if (model.includes(pattern)) {
      return "direct";
    }
  }

  return "frames";
}
