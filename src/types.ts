export interface BrandRecord {
  date: string | number | Date;
  name: string;
  category?: string;
  value: string | number;
}

export interface NormalizedBrandRecord {
  date: Date;
  name: string;
  category?: string;
  value: number;
}

export interface BrandRow {
  key: string;
  name: string;
  [year: string]: string | number;
}

export interface RankDatum {
  name: string;
  value: number;
  rank: number;
  category?: string;
}

export type Keyframe = [Date, RankDatum[]];

export type ForeshadowingMode = 'explicit' | 'implicit';

export type ForeshadowingEffect =
  | 'none'
  | 'prologue'
  | 'pre-scene'
  | 'contour'
  | 'de-emphasis';

export interface EffectOption {
  label: string;
  value: ForeshadowingEffect;
}

export interface ForeshadowingItem {
  id: string;
  brand: string;
  mode: ForeshadowingMode;
  effect: Exclude<ForeshadowingEffect, 'none'>;
  start: number;
  end: number;
}
