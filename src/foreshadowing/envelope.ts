import type { ForeshadowingSpec } from '../types';

// Fixed wall-clock ramps so effect entrances/exits feel the same at every
// Smoothness setting and export frame rate.
export const EFFECT_ATTACK_MS = 400;
export const EFFECT_RELEASE_MS = 300;

// Ramp windows in period units (the frameTime coordinate). `lookaheadPeriods`
// shifts sampling forward one frame for renderers that only *reach* a sampled
// value at the next tick (the live preview retargets a linear transition per
// frame), so the fade-out lands exactly on the event instead of trailing it.
export interface EffectEnvelope {
  attackPeriods: number;
  releasePeriods: number;
  lookaheadPeriods: number;
}

export function makeEnvelope(periodDurationMs: number, lookaheadPeriods = 0): EffectEnvelope {
  const safeDuration = Math.max(1, periodDurationMs);

  return {
    attackPeriods: EFFECT_ATTACK_MS / safeDuration,
    releasePeriods: EFFECT_RELEASE_MS / safeDuration,
    lookaheadPeriods,
  };
}

// Alpha of an active spec at frameTime: ramps in after `start` and back to
// exactly zero at `end`, the foreshadowed event. Callers are expected to have
// already checked isSpecActive; without an envelope the effect is binary.
export function envelopeAlpha(
  spec: Pick<ForeshadowingSpec, 'start' | 'end'>,
  frameTime: number,
  envelope?: EffectEnvelope,
): number {
  if (!envelope) {
    return 1;
  }

  const time = frameTime + envelope.lookaheadPeriods;

  if (time >= spec.end) {
    return 0;
  }

  const attack = ramp((time - spec.start) / envelope.attackPeriods);
  const release = ramp((spec.end - time) / envelope.releasePeriods);

  return Math.min(attack, release);
}

function ramp(value: number): number {
  // A zero-width window divides to NaN/Infinity: treat as an instant ramp.
  if (Number.isNaN(value)) {
    return 1;
  }

  return Math.min(1, Math.max(0, value));
}
