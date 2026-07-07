import * as d3 from 'd3';
import { TOP_N } from './constants';
import type { Dataset, RankDatum } from '../types';

export type ColorScale = (key: string) => string;
export type ColorMapName = 'muted' | 'tableau' | 'soft' | 'set3';

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

const SOFT_CONTRAST_COLORS = [
  '#7fa7bd',
  '#c49a6c',
  '#8eb99b',
  '#c78383',
  '#9d91b5',
  '#b7a36a',
  '#76aaa4',
  '#b88ca5',
  '#94a875',
  '#9ea8b7',
];

const COLOR_MAPS: Record<ColorMapName, readonly string[]> = {
  muted: MUTED_BAR_COLORS,
  tableau: d3.schemeTableau10,
  soft: SOFT_CONTRAST_COLORS,
  set3: d3.schemeSet3,
};

export const COLOR_MAP_OPTIONS: Array<{ colors: readonly string[]; label: string; value: ColorMapName }> = [
  { colors: COLOR_MAPS.muted, label: 'Muted bars', value: 'muted' },
  { colors: COLOR_MAPS.tableau, label: 'Tableau', value: 'tableau' },
  { colors: COLOR_MAPS.soft, label: 'Soft contrast', value: 'soft' },
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

// The distinct color keys of the bars currently on screen, ordered top rank
// first. The canvas colors each bar by `colorKeyOf`, so a swatch built from
// these keys shows exactly the on-chart colors instead of the palette's raw
// array order.
export function visibleColorKeys(data: readonly RankDatum[] | undefined): string[] {
  if (!data) {
    return [];
  }

  const keys: string[] = [];
  const seen = new Set<string>();

  for (const datum of [...data].filter((row) => row.rank < TOP_N).sort((a, b) => a.rank - b.rank)) {
    const key = colorKeyOf(datum);

    if (!seen.has(key)) {
      seen.add(key);
      keys.push(key);
    }
  }

  return keys;
}

// Swatches for a color-map dropdown preview: the colors this palette assigns to
// the given keys (deduped), padded from the rest of the palette so the strip
// keeps a stable length even when few distinct colors are on screen. Because it
// runs the keys through the same scale the canvas uses, the preview matches the
// actual bar colors.
export function swatchColorsFor(
  dataset: Dataset,
  colorMap: ColorMapName,
  keys: readonly string[],
  count = 6,
): string[] {
  const scale = createColorScale(dataset, colorMap);
  const swatches: string[] = [];
  const seen = new Set<string>();

  const push = (color: string) => {
    if (!seen.has(color)) {
      seen.add(color);
      swatches.push(color);
    }
  };

  for (const key of keys) {
    push(scale(key));

    if (swatches.length >= count) {
      return swatches;
    }
  }

  for (const color of COLOR_MAPS[colorMap]) {
    push(color);

    if (swatches.length >= count) {
      break;
    }
  }

  return swatches;
}
