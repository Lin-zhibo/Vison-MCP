import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { VisionError } from "./errors.js";

const execFileAsync = promisify(execFile);

/** Supported video formats */
const SUPPORTED_VIDEO_FORMATS = new Set(["mp4", "mov", "m4v"]);

const FORMAT_TO_MIME: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
};

/** Maximum local video file size: 8 MB */
const MAX_VIDEO_BYTES = 8 * 1024 * 1024;

/** Video metadata from ffprobe */
export interface VideoMetadata {
  format: string;
  mimeType: string;
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
 * Result is memoized — the check only runs once per process.
 */
let _ffmpegCache: { ffmpeg: string; ffprobe: string } | null = null;

export async function checkFfmpeg(): Promise<{ ffmpeg: string; ffprobe: string }> {
  if (_ffmpegCache) return _ffmpegCache;

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
      "VIDEO_ERROR",
    );
  }

  _ffmpegCache = { ffmpeg: "ffmpeg", ffprobe: "ffprobe" };
  return _ffmpegCache;
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

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(stdout);
    } catch (parseError) {
      throw new VisionError(
        `ffprobe returned invalid JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}. stdout: ${stdout.slice(0, 200)}`,
        "VIDEO_ERROR",
        videoPath,
      );
    }

    const streams = data.streams as Array<{ codec_type: string }> | undefined;
    const videoStream = streams?.find(
      (s: { codec_type: string }) => s.codec_type === "video",
    );

    if (!videoStream) {
      throw new VisionError(
        "No video stream found in file",
        "VIDEO_ERROR",
        videoPath,
      );
    }

    const formatObj = data.format as Record<string, unknown> | undefined;
    const formatStr = (typeof formatObj?.format_name === "string" ? formatObj.format_name : "").split(",")[0];
    if (!SUPPORTED_VIDEO_FORMATS.has(formatStr)) {
      throw new VisionError(
        `Unsupported video format: ${formatStr}. Supported: ${[...SUPPORTED_VIDEO_FORMATS].join(", ")}`,
        "VIDEO_ERROR",
      );
    }

    const sizeBytes = parseInt(String(formatObj?.size ?? "0"), 10);
    if (sizeBytes > MAX_VIDEO_BYTES) {
      throw new VisionError(
        `Video exceeds ${MAX_VIDEO_BYTES / (1024 * 1024)}MB size limit (${(sizeBytes / (1024 * 1024)).toFixed(1)}MB)`,
        "VIDEO_ERROR",
        videoPath,
      );
    }

    const durationRaw = formatObj?.duration;
    const duration = parseFloat(String(durationRaw ?? "0"));
    if (isNaN(duration)) {
      throw new VisionError(
        `Invalid video duration from ffprobe: ${String(durationRaw)}`,
        "VIDEO_ERROR",
        videoPath,
      );
    }

    const mimeType = FORMAT_TO_MIME[formatStr] ?? `video/${formatStr}`;

    return {
      format: formatStr,
      mimeType,
      duration,
      width: (videoStream as unknown as Record<string, unknown>).width as number ?? 0,
      height: (videoStream as unknown as Record<string, unknown>).height as number ?? 0,
      sizeBytes,
    };
  } catch (error) {
    if (error instanceof VisionError) throw error;
    throw new VisionError(
      `Failed to probe video: ${error instanceof Error ? error.message : String(error)}`,
      "VIDEO_ERROR",
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
        "VIDEO_ERROR",
        videoPath,
      );
    }

    return frames;
  } catch (error) {
    if (error instanceof VisionError) throw error;
    throw new VisionError(
      `Failed to extract frames: ${error instanceof Error ? error.message : String(error)}`,
      "VIDEO_ERROR",
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
  ];

  for (const pattern of nativeVideoModels) {
    if (model.includes(pattern)) {
      return "direct";
    }
  }

  return "frames";
}
