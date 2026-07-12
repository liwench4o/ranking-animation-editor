import * as d3 from 'd3';
import type { Dataset } from '../types';

export type ColorScale = (key: string) => string;
export type ColorMapName = 'muted' | 'tableau' | 'modern' | 'set3';

export const DEFAULT_COLOR_MAP: ColorMapName = 'muted';

const MUTED_BAR_COLORS = [
  '#a8bfd3',
  '#f4bd8d',
  '#eda3a3',
  '#b7d6d2',
  '#f2dca0',
  '#c9b4c6',
  '#acd1a6',
  '#cab8ad',
  '#d7c2a5',
  '#b7c8a8',
];

// Mid-tone hues tuned for this chart's rendering: bars draw at 0.9 opacity on
// both the white and #0b0e14 surfaces, with white labels sitting on the fill.
// Validated (0.9-blended, per surface) with the dataviz palette checker:
// OKLCH L within both mode bands, chroma ≥ 0.10, worst adjacent CVD ΔE 12.1.
// The order is the colorblind-safety mechanism — append, never reshuffle.
const MODERN_COLORS = [
  '#4c7fdb',
  '#cf8030',
  '#17a68e',
  '#d05d66',
  '#8a6cd2',
  '#b6923a',
  '#5399d3',
  '#c060a8',
  '#5ba05c',
  '#d3799b',
];

const COLOR_MAPS: Record<ColorMapName, readonly string[]> = {
  muted: MUTED_BAR_COLORS,
  tableau: d3.schemeTableau10,
  modern: MODERN_COLORS,
  set3: d3.schemeSet3,
};

export const COLOR_MAP_OPTIONS: Array<{ colors: readonly string[]; label: string; value: ColorMapName }> = [
  { colors: COLOR_MAPS.muted, label: 'Muted bars', value: 'muted' },
  { colors: COLOR_MAPS.tableau, label: 'Tableau', value: 'tableau' },
  { colors: COLOR_MAPS.modern, label: 'Modern', value: 'modern' },
  { colors: COLOR_MAPS.set3, label: 'Set3', value: 'set3' },
];

// Colors keyed by category (falling back to the entity name), with the domain
// fixed up front from the dataset. Assignments therefore depend only on the
// data — not on the order bars happen to be drawn — so the live preview and
// exported frames always agree.
export function createColorScale(dataset: Dataset, colorMap: ColorMapName = DEFAULT_COLOR_MAP): ColorScale {
  const domain: string[] = [];
  const seen = new Set<string>();

  for (const entity of dataset.entities) {
    const key = dataset.categoryOf.get(entity) ?? entity;

    if (!seen.has(key)) {
      seen.add(key);
      domain.push(key);
    }
  }

  return d3.scaleOrdinal<string, string>(COLOR_MAPS[colorMap]).domain(domain);
}

export function colorKeyOf(datum: { category?: string; name: string }): string {
  return datum.category ?? datum.name;
}
