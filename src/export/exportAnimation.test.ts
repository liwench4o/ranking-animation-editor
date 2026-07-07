import {
  MP4_SCALE,
  advanceExportMotionState,
  planFrames,
  smoothTowards,
  type ExportMotionState,
} from './exportAnimation';
import { renderChartFrame, type FrameScene } from './renderFrame';
import { FRAME_HEIGHT, FRAME_PADDING, FRAME_WIDTH, HEIGHT, TOP_N, WIDTH } from '../chart/constants';
import { createBandGeometry } from '../chart/style';
import { BANNER_PADDING_X, BANNER_TEXT_MAX_WIDTH } from '../chart/textLayout';
import type { RankDatum, ResolvedEffects } from '../types';

describe('export frame dimensions', () => {
  it('wraps the chart in a uniform padding gutter', () => {
    expect(FRAME_WIDTH).toBe(WIDTH + FRAME_PADDING * 2);
    expect(FRAME_HEIGHT).toBe(HEIGHT + FRAME_PADDING * 2);
  });

  it('keeps the scaled MP4 dimensions even for H.264', () => {
    expect((FRAME_WIDTH * MP4_SCALE) % 2).toBe(0);
    expect((FRAME_HEIGHT * MP4_SCALE) % 2).toBe(0);
  });
});

describe('planFrames', () => {
  it('derives frames per period from fps and period duration', () => {
    expect(planFrames(20, 15, 1250)).toEqual({ framesPerPeriod: 19, totalFrames: 362 });
    expect(planFrames(20, 30, 1000)).toEqual({ framesPerPeriod: 30, totalFrames: 571 });
  });

  it('handles tiny datasets', () => {
    expect(planFrames(1, 30, 1250).totalFrames).toBe(1);
    expect(planFrames(0, 30, 1250).totalFrames).toBe(0);
    expect(planFrames(2, 1, 100).framesPerPeriod).toBe(1);
  });
});

describe('smoothTowards', () => {
  it('moves proportionally to the elapsed fraction of the transition', () => {
    expect(smoothTowards(0, 100, 25, 250)).toBeCloseTo(10);
  });

  it('never overshoots and lands exactly when the step covers the transition', () => {
    expect(smoothTowards(0, 100, 250, 250)).toBe(100);
    expect(smoothTowards(0, 100, 400, 250)).toBe(100);
  });

  it('converges toward the target over repeated steps', () => {
    let position = 0;

    for (let step = 0; step < 60; step += 1) {
      position = smoothTowards(position, 100, 33, 250);
    }

    expect(position).toBeGreaterThan(99);
  });
});

describe('advanceExportMotionState', () => {
  it('keeps departing entities renderable until they slide off-list', () => {
    const geometry = createBandGeometry();
    const state: ExportMotionState = { yPositions: new Map(), lastDatumByName: new Map() };
    const alpha: RankDatum = { name: 'Alpha', value: 10, rank: 0, category: 'Tech' };

    expect(advanceExportMotionState([alpha], state, 100, 200, true)).toEqual([alpha]);
    expect(state.yPositions.get('Alpha')).toBe(geometry.yOf(0));

    const leaving = advanceExportMotionState([], state, 100, 200);

    expect(leaving).toEqual([{ ...alpha, rank: TOP_N }]);
    expect(state.yPositions.get('Alpha')).toBeGreaterThan(geometry.yOf(0));
    expect(state.yPositions.get('Alpha')).toBeLessThan(geometry.offListY);

    const parked = advanceExportMotionState([], state, 1000, 200);

    expect(parked).toEqual([]);
    expect(state.yPositions.has('Alpha')).toBe(false);
    expect(state.lastDatumByName.has('Alpha')).toBe(false);
  });
});

describe('renderChartFrame', () => {
  function makeStubContext() {
    const calls: Record<string, unknown[][]> = {};
    const sequence: Array<{ name: string; args: unknown[] }> = [];
    const record =
      (name: string) =>
      (...args: unknown[]) => {
        (calls[name] ??= []).push(args);
        sequence.push({ name, args });
        if (name === 'measureText') {
          return { width: String(args[0] ?? '').length * 8, actualBoundingBoxAscent: 12, actualBoundingBoxDescent: 4 };
        }
        if (name === 'getImageData') {
          return { data: new Uint8ClampedArray(4), width: 1, height: 1 };
        }
        return undefined;
      };
    const ctx = new Proxy(
      {},
      {
        get: (target, property: string) => record(property),
        set: () => true,
      },
    ) as unknown as CanvasRenderingContext2D;

    return { ctx, calls, sequence };
  }

  function makeScene(overrides: Partial<FrameScene> = {}): FrameScene {
    const data: RankDatum[] = Array.from({ length: TOP_N + 2 }, (_, index) => ({
      name: `Item ${index}`,
      value: 100 - index,
      rank: Math.min(TOP_N, index),
    }));
    const effects: ResolvedEffects = {
      dimOthers: false,
      decorations: new Map(),
      ghosts: [],
      overlays: [],
    };

    return {
      data,
      label: '2000',
      effects,
      yPositions: new Map(),
      bannerAlpha: new Map(),
      title: 'Title',
      subtitle: 'Subtitle',
      source: 'Test',
      color: () => '#123456',
      ...overrides,
    };
  }

  it('draws the background plus one bar per visible entity', () => {
    const { ctx, calls } = makeStubContext();

    renderChartFrame(ctx, makeScene());

    expect(calls.fillRect?.length).toBe(1 + TOP_N);
    const drawnText = (calls.fillText ?? []).map((args) => args[0]);
    expect(drawnText).toContain('Item 0');
    expect(drawnText).toContain('Title');
    expect(drawnText).toContain('2000');
  });

  it('draws bar names and values inside the bar height', () => {
    const { ctx, calls, sequence } = makeStubContext();
    const geometry = createBandGeometry();

    renderChartFrame(ctx, makeScene());

    const itemNameCall = calls.fillText?.find((args) => args[0] === 'Item 0');
    const itemNameIndex = sequence.findIndex((entry) => entry.name === 'fillText' && entry.args[0] === 'Item 0');
    const itemValueCall = sequence
      .slice(itemNameIndex + 1)
      .find((entry) => entry.name === 'fillText' && entry.args[0] === '100')?.args;
    const barTop = geometry.yOf(0);
    const barBottom = barTop + geometry.bandwidth;

    expect(Number(itemNameCall?.[2])).toBeGreaterThan(barTop);
    expect(Number(itemNameCall?.[2])).toBeLessThan(barBottom);
    expect(Number(itemValueCall?.[2])).toBeGreaterThan(barTop);
    expect(Number(itemValueCall?.[2])).toBeLessThan(barBottom);
  });

  it('draws ghost bars and prologue banners when effects are active', () => {
    const { ctx, calls } = makeStubContext();
    const scene = makeScene({
      effects: {
        dimOthers: false,
        decorations: new Map(),
        ghosts: [{ specId: 's1', name: 'Item 3', value: 120, rank: 0 }],
        overlays: [{ specId: 's2', text: 'Something is coming' }],
      },
      bannerAlpha: new Map([['s2', 1]]),
    });

    renderChartFrame(ctx, scene);

    expect(calls.setLineDash?.some((args) => Array.isArray(args[0]) && (args[0] as number[]).length === 2)).toBe(true);
    const drawnText = (calls.fillText ?? []).map((args) => args[0]);
    expect(drawnText).toContain('Something is coming');
    expect(drawnText.some((text) => typeof text === 'string' && text.startsWith('Item 3'))).toBe(true);
  });

  it('wraps long prologue banners across multiple canvas lines', () => {
    const { ctx, calls, sequence } = makeStubContext();
    const scene = makeScene({
      effects: {
        dimOthers: false,
        decorations: new Map(),
        ghosts: [],
        overlays: [
          {
            specId: 's2',
            text: 'Alpha rises while Beta slows across the market and the audience should see this in a compact banner',
          },
        ],
      },
      bannerAlpha: new Map([['s2', 1]]),
    });

    renderChartFrame(ctx, scene);

    const bannerLines = (calls.fillText ?? [])
      .map((args) => args[0])
      .filter((text) => typeof text === 'string' && /Alpha|Beta|market|audience|compact/.test(text));
    expect(bannerLines.length).toBeGreaterThan(1);

    let lastMoveTo = -1;
    for (let index = sequence.length - 1; index >= 0; index -= 1) {
      if (sequence[index].name === 'moveTo') {
        lastMoveTo = index;
        break;
      }
    }
    const backgroundLineTos = sequence.slice(lastMoveTo).filter((entry) => entry.name === 'lineTo');
    const rectTopLeftX = Number(sequence[lastMoveTo].args[0]) - 8;
    const rectTopY = Number(sequence[lastMoveTo].args[1]);
    const rectWidth = Number(backgroundLineTos[0].args[0]) - rectTopLeftX + 8;
    const rectHeight = Number(backgroundLineTos[1].args[1]) - rectTopY + 8;

    expect(rectWidth).toBeLessThanOrEqual(BANNER_TEXT_MAX_WIDTH + BANNER_PADDING_X * 2);
    expect(rectHeight).toBeGreaterThan(34);
  });
});
