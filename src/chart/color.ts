import * as d3 from 'd3';
import type { Dataset } from '../types';

export type ColorScale = (key: string) => string;

// Colors keyed by category (falling back to the entity name), with the domain
// fixed up front from the dataset. Assignments therefore depend only on the
// data — not on the order bars happen to be drawn — so the live preview and
// exported frames always agree.
export function createColorScale(dataset: Dataset): ColorScale {
  const domain: string[] = [];
  const seen = new Set<string>();

  for (const entity of dataset.entities) {
    const key = dataset.categoryOf.get(entity) ?? entity;

    if (!seen.has(key)) {
      seen.add(key);
      domain.push(key);
    }
  }

  return d3.scaleOrdinal<string, string>(d3.schemeTableau10).domain(domain);
}

export function colorKeyOf(datum: { category?: string; name: string }): string {
  return datum.category ?? datum.name;
}
