import { computeKeyframes, rankEntities, resolveValueSeries, updateDatasetValue } from './dataset';
import type { Dataset } from '../types';

function makeDataset(overrides: Partial<Dataset> = {}): Dataset {
  return {
    id: 'test-dataset',
    entities: ['Alpha', 'Beta'],
    periods: [
      { key: '2000', label: '2000' },
      { key: '2001', label: '2001' },
    ],
    values: new Map([
      ['Alpha', [10, 20]],
      ['Beta', [30, 10]],
    ]),
    categoryOf: new Map([
      ['Alpha', 'Tech'],
      ['Beta', 'Auto'],
    ]),
    meta: {},
    ...overrides,
  };
}

describe('computeKeyframes', () => {
  it('computes interpolated keyframes with period labels and times', () => {
    const keyframes = computeKeyframes(makeDataset(), 2, 2);

    expect(keyframes).toHaveLength(3);
    expect(keyframes.map((keyframe) => keyframe.time)).toEqual([0, 0.5, 1]);
    expect(keyframes.map((keyframe) => keyframe.label)).toEqual(['2000', '2000', '2001']);
    expect(keyframes[1].data).toEqual([
      { name: 'Beta', value: 20, rank: 0, category: 'Auto' },
      { name: 'Alpha', value: 15, rank: 1, category: 'Tech' },
    ]);
  });

  it('omits missing values instead of carrying them forward or zero-filling them', () => {
    const dataset = makeDataset({
      values: new Map([
        ['Alpha', [10, null]],
        ['Beta', [null, 4]],
      ]),
    });
    const keyframes = computeKeyframes(dataset, 1, 2);

    expect(keyframes).toHaveLength(2);
    expect(keyframes[0].data.find((datum) => datum.name === 'Beta')).toBeUndefined();
    expect(keyframes[1].data.find((datum) => datum.name === 'Alpha')).toBeUndefined();
    expect(keyframes[1].data.find((datum) => datum.name === 'Beta')?.value).toBe(4);
  });

  it('keeps explicit zero values distinct from missing values', () => {
    const dataset = makeDataset({
      values: new Map([
        ['Alpha', [0, 4]],
        ['Beta', [null, 2]],
      ]),
    });
    const keyframes = computeKeyframes(dataset, 1, 2);

    expect(keyframes[0].data.find((datum) => datum.name === 'Alpha')).toMatchObject({ value: 0 });
    expect(keyframes[0].data.find((datum) => datum.name === 'Beta')).toBeUndefined();
  });

  it('interpolates only while an entity is present in at least one side of the period transition', () => {
    const dataset = makeDataset({
      periods: [
        { key: '2000', label: '2000' },
        { key: '2001', label: '2001' },
      ],
      values: new Map([
        ['Alpha', [10, null]],
        ['Beta', [null, 20]],
      ]),
    });
    const keyframes = computeKeyframes(dataset, 4, 2);

    expect(keyframes[0].data.find((datum) => datum.name === 'Alpha')?.value).toBe(10);
    expect(keyframes[0].data.find((datum) => datum.name === 'Beta')).toBeUndefined();
    expect(keyframes[2].data.find((datum) => datum.name === 'Alpha')?.value).toBe(5);
    expect(keyframes[2].data.find((datum) => datum.name === 'Beta')?.value).toBe(10);
    expect(keyframes[4].data.find((datum) => datum.name === 'Alpha')).toBeUndefined();
    expect(keyframes[4].data.find((datum) => datum.name === 'Beta')?.value).toBe(20);
  });

  it('returns a single frame for single-period datasets', () => {
    const dataset = makeDataset({
      periods: [{ key: '2000', label: '2000' }],
      values: new Map([
        ['Alpha', [10]],
        ['Beta', [30]],
      ]),
    });

    const keyframes = computeKeyframes(dataset, 5, 2);

    expect(keyframes).toHaveLength(1);
    expect(keyframes[0].data[0]).toEqual({ name: 'Beta', value: 30, rank: 0, category: 'Auto' });
  });
});

describe('resolveValueSeries', () => {
  it('preserves missing values and explicit zeros', () => {
    expect(resolveValueSeries([null, 5, null, 0, 7])).toEqual([null, 5, null, 0, 7]);
  });
});

describe('rankEntities', () => {
  it('ranks descending and caps rank indexes at the visible top count', () => {
    const ranked = rankEntities(['Low', 'High', 'Middle'], (name) => ({ Low: 1, High: 9, Middle: 5 })[name] ?? 0, 1);

    expect(ranked).toEqual([
      { name: 'High', value: 9, rank: 0, category: undefined },
      { name: 'Middle', value: 5, rank: 1, category: undefined },
      { name: 'Low', value: 1, rank: 1, category: undefined },
    ]);
  });
});

describe('updateDatasetValue', () => {
  it('updates one cell immutably and keeps the dataset id', () => {
    const dataset = makeDataset();
    const next = updateDatasetValue(dataset, 'Alpha', 1, 99);

    expect(next).not.toBe(dataset);
    expect(next.id).toBe(dataset.id);
    expect(next.values.get('Alpha')).toEqual([10, 99]);
    expect(dataset.values.get('Alpha')).toEqual([10, 20]);
  });

  it('ignores unknown entities and out-of-range periods', () => {
    const dataset = makeDataset();

    expect(updateDatasetValue(dataset, 'Nobody', 0, 1)).toBe(dataset);
    expect(updateDatasetValue(dataset, 'Alpha', 9, 1)).toBe(dataset);
  });
});
