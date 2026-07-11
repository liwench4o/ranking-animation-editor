import * as d3 from 'd3';
import { BAR_SIZE, MARGIN, TOP_N } from './constants';
import type { RankDatum, ResolvedEffects } from '../types';

export const CONTOUR_COLOR = '#1677ff';
export const SELECTION_COLOR = '#1677ff';
export const BASE_OPACITY = 0.9;
// Paper §3.2: while de-emphasis is active, irrelevant bars drop to 20% opacity.
export const DIMMED_OPACITY = 0.2;
// Spec targets rise above the resting opacity while others dim, so the
// figure-ground split reads from both directions.
export const EMPHASIZED_OPACITY = 1;
// Prologue captions overlay the bars as a quiet watermark: the envelope alpha
// is scaled by this ceiling so even a settled caption stays translucent.
export const BANNER_MAX_ALPHA = 0.55;

export interface BandGeometry {
  y: d3.ScaleBand<number>;
  bandwidth: number;
  // The slot just below the visible list: off-list entities carry rank TOP_N,
  // so entering/exiting bars slide through it (clipped by the chart bounds).
  offListY: number;
  yOf: (rank: number) => number;
}

export function createBandGeometry(): BandGeometry {
  const y = d3
    .scaleBand<number>()
    .domain(d3.range(TOP_N + 1))
    .rangeRound([MARGIN.TOP, MARGIN.TOP + BAR_SIZE * (TOP_N + 1)])
    .padding(0.1);
  const offListY = y(TOP_N) ?? MARGIN.TOP + BAR_SIZE * TOP_N;

  return {
    y,
    bandwidth: y.bandwidth(),
    offListY,
    yOf: (rank: number) => y(Math.min(rank, TOP_N)) ?? offListY,
  };
}

export function getFillOpacity(datum: RankDatum, effects: ResolvedEffects): number {
  if (effects.dimAlpha <= 0) {
    return BASE_OPACITY;
  }

  const target = effects.decorations.get(datum.name)?.emphasized ? EMPHASIZED_OPACITY : DIMMED_OPACITY;

  return BASE_OPACITY + (target - BASE_OPACITY) * effects.dimAlpha;
}

// Bar labels sit on the bar itself, so they follow the de-emphasis ramp;
// emphasized and resting bars keep fully opaque labels.
export function getLabelOpacity(datum: RankDatum, effects: ResolvedEffects): number {
  if (effects.dimAlpha <= 0 || effects.decorations.get(datum.name)?.emphasized) {
    return 1;
  }

  return 1 + (DIMMED_OPACITY - 1) * effects.dimAlpha;
}

export interface BarStroke {
  color: string;
  // Contour effect strokes are solid; the editor's selection is dashed so the
  // two can't be confused while authoring.
  kind: 'contour' | 'selection';
  alpha: number;
}

export function getStroke(datum: RankDatum, effects: ResolvedEffects, selectedNames: Set<string>): BarStroke | null {
  const decoration = effects.decorations.get(datum.name);

  if (decoration?.contour && decoration.contourAlpha > 0) {
    return { color: CONTOUR_COLOR, kind: 'contour', alpha: decoration.contourAlpha };
  }

  return selectedNames.has(datum.name) ? { color: SELECTION_COLOR, kind: 'selection', alpha: 1 } : null;
}
