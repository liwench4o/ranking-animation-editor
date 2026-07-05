import type { EffectOption, ForeshadowingMode } from '../types';

const explicitEffects: EffectOption[] = [
  { label: 'Prologue', value: 'prologue' },
  { label: 'Pre-scene', value: 'pre-scene' },
];

const implicitEffects: EffectOption[] = [
  { label: 'Contour', value: 'contour' },
  { label: 'De-Emphasis', value: 'de-emphasis' },
];

export function getEffectOptions(mode: ForeshadowingMode): EffectOption[] {
  return mode === 'explicit' ? explicitEffects : implicitEffects;
}
