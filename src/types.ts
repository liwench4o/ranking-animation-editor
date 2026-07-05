export interface RankDatum {
  name: string;
  value: number;
  rank: number;
  category?: string;
}

// One step of the ordered temporal dimension. `key` is the raw value from the
// source data; `label` is what the UI displays. Periods are not required to be
// dates — week numbers, quarters, or arbitrary ordered labels all work.
export interface Period {
  key: string;
  label: string;
}

export interface DatasetMeta {
  fileName?: string;
  name?: string;
  source?: string;
  valueLabel?: string;
}

export interface Dataset {
  id: string;
  entities: string[];
  periods: Period[];
  // Per-entity series aligned with `periods`; null marks a missing value.
  values: Map<string, Array<number | null>>;
  categoryOf: Map<string, string | undefined>;
  meta: DatasetMeta;
}

export interface Keyframe {
  // Continuous period coordinate: periodIndex + progress within the period.
  time: number;
  label: string;
  data: RankDatum[];
}

export type ForeshadowingMode = 'explicit' | 'implicit';

export type ForeshadowingEffect = 'prologue' | 'pre-scene' | 'contour' | 'de-emphasis';

export interface EffectOption {
  label: string;
  value: ForeshadowingEffect;
}

// The paper's 3-tuple (visual effect, timing, duration): `start` and `end` are
// period indices; the spec is active while start <= frameTime < end, where
// `end` marks the foreshadowed event at which the effect disappears.
export interface ForeshadowingSpec {
  id: string;
  targets: string[];
  mode: ForeshadowingMode;
  effect: ForeshadowingEffect;
  caption?: string;
  start: number;
  end: number;
}

export interface BarDecoration {
  contour: boolean;
  emphasized: boolean;
}

export interface GhostBar {
  specId: string;
  name: string;
  value: number;
  rank: number;
  category?: string;
}

export interface CaptionOverlay {
  specId: string;
  text: string;
}

export interface ResolvedEffects {
  dimOthers: boolean;
  decorations: Map<string, BarDecoration>;
  ghosts: GhostBar[];
  overlays: CaptionOverlay[];
}
