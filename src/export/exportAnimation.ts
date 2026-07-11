import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import { FRAME_HEIGHT, FRAME_PADDING, FRAME_WIDTH, TOP_N } from '../chart/constants';
import type { ColorScale } from '../chart/color';
import { createBandGeometry } from '../chart/style';
import { LIGHT_THEME, type ChartTheme } from '../chart/theme';
import { computeKeyframes } from '../data/dataset';
import { makeEnvelope } from '../foreshadowing/envelope';
import { resolveEffects } from '../foreshadowing/resolve';
import { renderChartFrame } from './renderFrame';
import type { Dataset, ForeshadowingSpec, RankDatum } from '../types';

export interface ExportOptions {
  dataset: Dataset;
  specs: ForeshadowingSpec[];
  title: string;
  subtitle: string;
  source?: string;
  color: ColorScale;
  // Background/text palette; defaults to light so existing callers keep working.
  theme?: ChartTheme;
  // Milliseconds of animation per data period.
  periodDurationMs: number;
  // How long a rank swap slides in the live preview (periodDuration / interpolation).
  rankTransitionMs: number;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

const GIF_FPS = 15;
const MP4_FPS = 30;
export const MP4_SCALE = 2;

export function planFrames(periodCount: number, fps: number, periodDurationMs: number) {
  const framesPerPeriod = Math.max(1, Math.round((fps * periodDurationMs) / 1000));
  const totalFrames = periodCount <= 1 ? Math.min(1, periodCount) : (periodCount - 1) * framesPerPeriod + 1;

  return { framesPerPeriod, totalFrames };
}

// One smoothing step toward the target slot, matching the live preview where
// d3 retargets a linear transition of rankTransitionMs on every frame.
export function smoothTowards(current: number, target: number, frameDtMs: number, transitionMs: number): number {
  const step = Math.min(1, frameDtMs / Math.max(1, transitionMs));
  return current + (target - current) * step;
}

export interface ExportMotionState {
  yPositions: Map<string, number>;
  lastDatumByName: Map<string, RankDatum>;
}

export function advanceExportMotionState(
  data: RankDatum[],
  state: ExportMotionState,
  frameDtMs: number,
  transitionMs: number,
  firstFrame = false,
): RankDatum[] {
  const geometry = createBandGeometry();
  const currentNames = new Set(data.map((datum) => datum.name));
  const renderData = [...data];

  for (const datum of data) {
    const target = geometry.yOf(datum.rank);
    const current = state.yPositions.get(datum.name) ?? geometry.offListY;
    state.yPositions.set(datum.name, firstFrame ? target : smoothTowards(current, target, frameDtMs, transitionMs));
    state.lastDatumByName.set(datum.name, datum);
  }

  for (const [name, previous] of [...state.lastDatumByName]) {
    if (currentNames.has(name)) {
      continue;
    }

    const current = state.yPositions.get(name) ?? geometry.offListY;
    const next = firstFrame ? geometry.offListY : smoothTowards(current, geometry.offListY, frameDtMs, transitionMs);

    if (next < geometry.offListY - 0.5) {
      state.yPositions.set(name, next);
      renderData.push({ ...previous, rank: TOP_N });
    } else {
      state.yPositions.delete(name);
      state.lastDatumByName.delete(name);
    }
  }

  return renderData;
}

interface FrameContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  index: number;
  total: number;
}

async function forEachFrame(
  options: ExportOptions,
  fps: number,
  scale: number,
  onFrame: (frame: FrameContext) => void | Promise<void>,
): Promise<void> {
  const { dataset, specs, periodDurationMs, rankTransitionMs, signal, onProgress } = options;
  const theme = options.theme ?? LIGHT_THEME;
  const { framesPerPeriod } = planFrames(dataset.periods.length, fps, periodDurationMs);
  const keyframes = computeKeyframes(dataset, framesPerPeriod);

  if (keyframes.length === 0) {
    throw new Error('Nothing to export — the dataset is empty.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = FRAME_WIDTH * scale;
  canvas.height = FRAME_HEIGHT * scale;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D is not available in this browser.');
  }

  const frameDtMs = 1000 / fps;
  // Stateless frames are drawn at their exact envelope value — no lookahead.
  const envelope = makeEnvelope(periodDurationMs);
  const motionState: ExportMotionState = { yPositions: new Map(), lastDatumByName: new Map() };

  for (let index = 0; index < keyframes.length; index += 1) {
    if (signal?.aborted) {
      throw new DOMException('Export cancelled', 'AbortError');
    }

    const keyframe = keyframes[index];
    const effects = resolveEffects(specs, keyframe.time, keyframes, framesPerPeriod, { envelope });
    const renderData = advanceExportMotionState(keyframe.data, motionState, frameDtMs, rankTransitionMs, index === 0);

    // Paint the whole padded frame white, then shift the chart content into the
    // interior so the surrounding gutter stays blank — matching the preview.
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
    ctx.setTransform(scale, 0, 0, scale, FRAME_PADDING * scale, FRAME_PADDING * scale);
    renderChartFrame(ctx, {
      data: renderData,
      label: keyframe.label,
      effects,
      yPositions: motionState.yPositions,
      title: options.title,
      subtitle: options.subtitle,
      source: options.source,
      color: options.color,
      theme,
    });

    await onFrame({ canvas, ctx, index, total: keyframes.length });
    onProgress?.(index + 1, keyframes.length);

    if (index % 5 === 4) {
      // Keep the progress UI responsive between frame batches.
      await yieldToEventLoop();
    }
  }
}

// MessageChannel instead of setTimeout: timers are clamped to ~1s in hidden
// or backgrounded tabs, which would stretch an export from seconds to minutes.
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    channel.port2.postMessage(null);
  });
}

export async function exportGif(options: ExportOptions): Promise<Blob> {
  const gif = GIFEncoder();
  const delay = Math.round(1000 / GIF_FPS);

  await forEachFrame(options, GIF_FPS, 1, ({ ctx }) => {
    const { data, width, height } = ctx.getImageData(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
    const palette = quantize(data, 256);
    const indexed = applyPalette(data, palette);
    gif.writeFrame(indexed, width, height, { palette, delay });
  });

  gif.finish();
  return new Blob([gif.bytes()], { type: 'image/gif' });
}

export async function exportMp4(options: ExportOptions): Promise<Blob> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('Video export needs WebCodecs — please use a recent Chrome, Edge, or Safari.');
  }

  const width = FRAME_WIDTH * MP4_SCALE;
  const height = FRAME_HEIGHT * MP4_SCALE;
  const codec = await pickAvcCodec(width, height, MP4_FPS);

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: 'avc', width, height },
    fastStart: 'in-memory',
  });

  let encoderError: Error | null = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (error) => {
      encoderError = error instanceof Error ? error : new Error(String(error));
    },
  });

  try {
    encoder.configure({ codec, width, height, bitrate: 8_000_000, framerate: MP4_FPS });

    const microsecondsPerFrame = 1_000_000 / MP4_FPS;

    await forEachFrame(options, MP4_FPS, MP4_SCALE, async ({ canvas, index }) => {
      if (encoderError) {
        throw encoderError;
      }

      const frame = new VideoFrame(canvas, {
        timestamp: Math.round(index * microsecondsPerFrame),
        duration: Math.round(microsecondsPerFrame),
      });
      encoder.encode(frame, { keyFrame: index % 60 === 0 });
      frame.close();

      while (encoder.encodeQueueSize > 4) {
        await yieldToEventLoop();
      }
    });

    await encoder.flush();
  } finally {
    if (encoder.state !== 'closed') {
      encoder.close();
    }
  }

  if (encoderError) {
    throw encoderError;
  }

  muxer.finalize();
  return new Blob([(muxer.target as ArrayBufferTarget).buffer], { type: 'video/mp4' });
}

async function pickAvcCodec(width: number, height: number, framerate: number): Promise<string> {
  // high@4.0 first for 1600x1040@30, then progressively safer profiles.
  const candidates = ['avc1.640028', 'avc1.4d0028', 'avc1.42001f'];

  for (const codec of candidates) {
    const support = await VideoEncoder.isConfigSupported({ codec, width, height, framerate });

    if (support.supported) {
      return codec;
    }
  }

  throw new Error('This browser has no supported H.264 encoder configuration.');
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
