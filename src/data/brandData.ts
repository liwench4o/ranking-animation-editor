import * as d3 from 'd3';
import { DEFAULT_INTERPOLATION, TOP_N } from '../chart/constants';
import type {
  BrandRecord,
  BrandRow,
  EffectOption,
  ForeshadowingItem,
  ForeshadowingMode,
  Keyframe,
  NormalizedBrandRecord,
  RankDatum,
} from '../types';

const explicitEffects: EffectOption[] = [
  { label: 'None', value: 'none' },
  { label: 'Prologue', value: 'prologue' },
  { label: 'Pre-scene', value: 'pre-scene' },
];

const implicitEffects: EffectOption[] = [
  { label: 'None', value: 'none' },
  { label: 'Contour', value: 'contour' },
  { label: 'De-Emphasis', value: 'de-emphasis' },
];

export const sampleForeshadowingItems: ForeshadowingItem[] = [
  { id: 'ford', brand: 'Ford', mode: 'explicit', effect: 'prologue', start: 0, end: 2 },
  { id: 'google', brand: 'Google', mode: 'implicit', effect: 'de-emphasis', start: 5, end: 10 },
  { id: 'apple', brand: 'Apple', mode: 'implicit', effect: 'contour', start: 11, end: 15 },
  { id: 'coca-cola', brand: 'Coca-Cola', mode: 'explicit', effect: 'pre-scene', start: 15, end: 19 },
];

export function getEffectOptions(mode: ForeshadowingMode): EffectOption[] {
  return mode === 'explicit' ? explicitEffects : implicitEffects;
}

export function getNameId(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '');
}

export function normalizeRecords(records: BrandRecord[]): NormalizedBrandRecord[] {
  return records
    .map((record) => {
      const date = record.date instanceof Date ? record.date : new Date(record.date);
      const value = typeof record.value === 'number' ? record.value : Number(record.value);

      return {
        date,
        name: record.name,
        category: record.category,
        value,
      };
    })
    .filter((record) => record.name && Number.isFinite(record.value) && !Number.isNaN(record.date.valueOf()));
}

export function getBrandNames(records: BrandRecord[]): string[] {
  return Array.from(new Set(normalizeRecords(records).map((record) => record.name))).sort((a, b) =>
    a.localeCompare(b),
  );
}

export function getYears(records: BrandRecord[]): number[] {
  return Array.from(new Set(normalizeRecords(records).map((record) => record.date.getFullYear()))).sort(
    (a, b) => a - b,
  );
}

export function buildBrandRows(records: BrandRecord[]): { columns: string[]; rows: BrandRow[] } {
  const normalized = normalizeRecords(records);
  const years = getYears(records);
  const rowsByName = new Map<string, BrandRow>();

  for (const record of normalized) {
    const year = String(record.date.getFullYear());
    const row = rowsByName.get(record.name) ?? { key: record.name, name: record.name };
    row[year] = record.value;
    rowsByName.set(record.name, row);
  }

  return {
    columns: ['name', ...years.map(String)],
    rows: Array.from(rowsByName.values()),
  };
}

export function rankBrands(
  names: string[],
  valueAt: (name: string) => number,
  topN: number = TOP_N,
  categoryByName: Map<string, string | undefined> = new Map(),
): RankDatum[] {
  return names
    .map((name) => ({
      name,
      value: valueAt(name),
      rank: 0,
      category: categoryByName.get(name),
    }))
    .sort((a, b) => d3.descending(a.value, b.value))
    .map((datum, index) => ({
      ...datum,
      rank: Math.min(topN, index),
    }));
}

export function buildDateValues(records: BrandRecord[]): Array<[Date, Map<string, number>]> {
  const normalized = normalizeRecords(records);
  const valuesByDate = new Map<number, Map<string, number>>();

  for (const record of normalized) {
    const dateKey = record.date.valueOf();
    const values = valuesByDate.get(dateKey) ?? new Map<string, number>();
    values.set(record.name, record.value);
    valuesByDate.set(dateKey, values);
  }

  return Array.from(valuesByDate.entries())
    .map(([date, values]) => [new Date(date), values] as [Date, Map<string, number>])
    .sort(([a], [b]) => d3.ascending(a, b));
}

export function getCategoryByName(records: BrandRecord[]): Map<string, string | undefined> {
  const categoryByName = new Map<string, string | undefined>();

  for (const record of normalizeRecords(records)) {
    if (!categoryByName.has(record.name)) {
      categoryByName.set(record.name, record.category);
    }
  }

  return categoryByName;
}

export function computeKeyframes(
  records: BrandRecord[],
  interpolation: number = DEFAULT_INTERPOLATION,
  topN: number = TOP_N,
): Keyframe[] {
  const names = getBrandNames(records);
  const dateValues = buildDateValues(records);
  const categoryByName = getCategoryByName(records);
  const stepCount = Math.max(1, Math.floor(interpolation) || DEFAULT_INTERPOLATION);
  const keyframes: Keyframe[] = [];

  if (dateValues.length === 0) {
    return keyframes;
  }

  if (dateValues.length === 1) {
    const [date, values] = dateValues[0];
    return [[date, rankBrands(names, (name) => values.get(name) ?? 0, topN, categoryByName)]];
  }

  for (let index = 0; index < dateValues.length - 1; index += 1) {
    const [startDate, startValues] = dateValues[index];
    const [endDate, endValues] = dateValues[index + 1];

    for (let step = 0; step < stepCount; step += 1) {
      const progress = step / stepCount;
      const date = new Date(startDate.valueOf() * (1 - progress) + endDate.valueOf() * progress);
      const ranked = rankBrands(
        names,
        (name) => (startValues.get(name) ?? 0) * (1 - progress) + (endValues.get(name) ?? 0) * progress,
        topN,
        categoryByName,
      );
      keyframes.push([date, ranked]);
    }
  }

  const [lastDate, lastValues] = dateValues[dateValues.length - 1];
  keyframes.push([lastDate, rankBrands(names, (name) => lastValues.get(name) ?? 0, topN, categoryByName)]);

  return keyframes;
}
