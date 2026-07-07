import * as d3 from 'd3';
import { BAR_SIZE, MARGIN, TOP_N } from './constants';
import type { RankDatum, ResolvedEffects } from '../types';

export const CONTOUR_COLOR = '#1677ff';
export const SELECTION_COLOR = '#1677ff';
export const BASE_OPACITY = 0.9;
// Paper §3.2: while de-emphasis is active, irrelevant bars drop to 20% opacity.
export const DIMMED_OPACITY = 0.2;

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
  if (effects.decorations.get(datum.name)?.emphasized) {
    return BASE_OPACITY;
  }

  return effects.dimOthers ? DIMMED_OPACITY : BASE_OPACITY;
}

export function getStroke(datum: RankDatum, effects: ResolvedEffects, selectedNames: Set<string>): string | null {
  if (effects.decorations.get(datum.name)?.contour) {
    return CONTOUR_COLOR;
  }

  return selectedNames.has(datum.name) ? SELECTION_COLOR : null;
}
