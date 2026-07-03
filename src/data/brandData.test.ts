import {
  buildBrandRows,
  computeKeyframes,
  getEffectOptions,
  rankBrands,
} from './brandData';
import type { BrandRecord } from '../types';

const sampleRecords: BrandRecord[] = [
  { date: '2000/1/1', name: 'Alpha', category: 'Tech', value: 10 },
  { date: '2000/1/1', name: 'Beta', category: 'Auto', value: 30 },
  { date: '2001/1/1', name: 'Alpha', category: 'Tech', value: 20 },
  { date: '2001/1/1', name: 'Beta', category: 'Auto', value: 10 },
];

describe('brand data transforms', () => {
  it('groups CSV records into one table row per brand with year columns', () => {
    const { columns, rows } = buildBrandRows(sampleRecords);

    expect(columns).toEqual(['name', '2000', '2001']);
    expect(rows).toEqual([
      { key: 'Alpha', name: 'Alpha', '2000': 10, '2001': 20 },
      { key: 'Beta', name: 'Beta', '2000': 30, '2001': 10 },
    ]);
  });

  it('computes sorted interpolated keyframes from dated values', () => {
    const keyframes = computeKeyframes(sampleRecords, 2, 2);

    expect(keyframes).toHaveLength(3);
    expect(keyframes.map(([date]) => date.getFullYear())).toEqual([2000, 2000, 2001]);
    expect(keyframes[0][1].map((datum) => datum.name)).toEqual(['Beta', 'Alpha']);
    expect(keyframes[1][1]).toEqual([
      { name: 'Beta', value: 20, rank: 0, category: 'Auto' },
      { name: 'Alpha', value: 15, rank: 1, category: 'Tech' },
    ]);
  });

  it('ranks descending and caps rank indexes at the visible top count', () => {
    const ranked = rankBrands(['Low', 'High', 'Middle'], (name) => ({ Low: 1, High: 9, Middle: 5 })[name] ?? 0, 1);

    expect(ranked).toEqual([
      { name: 'High', value: 9, rank: 0 },
      { name: 'Middle', value: 5, rank: 1 },
      { name: 'Low', value: 1, rank: 1 },
    ]);
  });

  it('returns explicit and implicit effect options from mode', () => {
    expect(getEffectOptions('explicit').map((option) => option.value)).toEqual([
      'none',
      'prologue',
      'pre-scene',
    ]);
    expect(getEffectOptions('implicit').map((option) => option.value)).toEqual([
      'none',
      'contour',
      'de-emphasis',
    ]);
  });
});
