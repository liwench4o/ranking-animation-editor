import * as d3 from 'd3';
import { DEFAULT_INTERPOLATION, TOP_N } from '../chart/constants';
import type { Dataset, DatasetMeta, Keyframe, RankDatum } from '../types';

export function getNameId(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '');
}

// Missing values stay missing. A literal 0 remains a present value and can rank.
export function resolveValueSeries(series: Array<number | null>): Array<number | null> {
  return series.map((value) => value ?? null);
}

export function rankEntities(
  names: string[],
  valueAt: (name: string) => number,
  topN: number = TOP_N,
  categoryOf: Map<string, string | undefined> = new Map(),
): RankDatum[] {
  return names
    .map((name) => ({
      name,
      value: valueAt(name),
      rank: 0,
      category: categoryOf.get(name),
    }))
    .sort((a, b) => d3.descending(a.value, b.value))
    .map((datum, index) => ({
      ...datum,
      rank: Math.min(topN, index),
    }));
}

export function computeKeyframes(
  dataset: Dataset,
  interpolation: number = DEFAULT_INTERPOLATION,
  topN: number = TOP_N,
): Keyframe[] {
  const { entities, periods, categoryOf } = dataset;

  if (entities.length === 0 || periods.length === 0) {
    return [];
  }

  const resolved = new Map(entities.map((entity) => [entity, resolveValueSeries(dataset.values.get(entity) ?? [])]));
  const valueAt = (name: string, index: number): number | null => resolved.get(name)?.[index] ?? null;
  const rankPresent = (values: Map<string, number>) =>
    rankEntities([...values.keys()], (name) => values.get(name) ?? 0, topN, categoryOf);
  const valuesAtPeriod = (index: number) => {
    const values = new Map<string, number>();

    for (const entity of entities) {
      const value = valueAt(entity, index);

      if (value !== null) {
        values.set(entity, value);
      }
    }

    return values;
  };

  if (periods.length === 1) {
    return [
      {
        time: 0,
        label: periods[0].label,
        data: rankPresent(valuesAtPeriod(0)),
      },
    ];
  }

  const stepCount = Math.max(1, Math.floor(interpolation) || DEFAULT_INTERPOLATION);
  const keyframes: Keyframe[] = [];

  for (let index = 0; index < periods.length - 1; index += 1) {
    for (let step = 0; step < stepCount; step += 1) {
      const progress = step / stepCount;
      const values = new Map<string, number>();

      for (const entity of entities) {
        const value = interpolatePresence(valueAt(entity, index), valueAt(entity, index + 1), progress);

        if (value !== null) {
          values.set(entity, value);
        }
      }

      keyframes.push({
        time: index + progress,
        label: periods[index].label,
        data: rankPresent(values),
      });
    }
  }

  const lastIndex = periods.length - 1;
  keyframes.push({
    time: lastIndex,
    label: periods[lastIndex].label,
    data: rankPresent(valuesAtPeriod(lastIndex)),
  });

  return keyframes;
}

function interpolatePresence(start: number | null, end: number | null, progress: number): number | null {
  if (start === null && end === null) {
    return null;
  }

  if (start === null && progress === 0) {
    return null;
  }

  return (start ?? 0) * (1 - progress) + (end ?? 0) * progress;
}

export function updateDatasetValue(
  dataset: Dataset,
  entity: string,
  periodIndex: number,
  value: number | null,
): Dataset {
  if (periodIndex < 0 || periodIndex >= dataset.periods.length || !dataset.values.has(entity)) {
    return dataset;
  }

  const values = new Map(dataset.values);
  const series = [...(values.get(entity) ?? new Array<number | null>(dataset.periods.length).fill(null))];
  series[periodIndex] = value;
  values.set(entity, series);

  // Same id on purpose: editing values must not reshuffle the color scale.
  return { ...dataset, values };
}

export function updateDatasetMeta(dataset: Dataset, meta: Partial<DatasetMeta>): Dataset {
  // Same id on purpose: meta edits must not reset the animation or colors.
  return { ...dataset, meta: { ...dataset.meta, ...meta } };
}
