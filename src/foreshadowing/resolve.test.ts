import { isSpecActive, resolveEffects } from './resolve';
import type { ForeshadowingSpec, Keyframe } from '../types';

function makeSpec(overrides: Partial<ForeshadowingSpec> = {}): ForeshadowingSpec {
  return {
    id: 'spec-1',
    targets: ['Alpha'],
    mode: 'implicit',
    effect: 'contour',
    start: 0,
    end: 1,
    ...overrides,
  };
}

function makeKeyframe(time: number, label: string, data: Array<[string, number, number]>): Keyframe {
  return { time, label, data: data.map(([name, value, rank]) => ({ name, value, rank })) };
}

// framesPerPeriod = 2: period p starts at keyframe index p * 2.
const keyframes: Keyframe[] = [
  makeKeyframe(0, '2000', [
    ['Beta', 30, 0],
    ['Alpha', 10, 1],
  ]),
  makeKeyframe(0.5, '2000', [
    ['Beta', 20, 0],
    ['Alpha', 15, 1],
  ]),
  makeKeyframe(1, '2001', [
    ['Alpha', 20, 0],
    ['Beta', 10, 1],
  ]),
];

describe('isSpecActive', () => {
  it('activates within [start, end) and ends at the foreshadowed event', () => {
    const spec = makeSpec({ start: 1, end: 3 });

    expect(isSpecActive(spec, 0.5)).toBe(false);
    expect(isSpecActive(spec, 1)).toBe(true);
    expect(isSpecActive(spec, 2.9)).toBe(true);
    expect(isSpecActive(spec, 3)).toBe(false);
  });

  it('never activates a zero-duration spec', () => {
    const spec = makeSpec({ start: 2, end: 2 });

    expect(isSpecActive(spec, 2)).toBe(false);
  });
});

describe('resolveEffects', () => {
  it('returns no effects outside every time window', () => {
    const resolved = resolveEffects([makeSpec({ start: 1, end: 2 })], 0.5, keyframes, 2);

    expect(resolved.dimAlpha).toBe(0);
    expect(resolved.decorations.size).toBe(0);
    expect(resolved.ghosts).toEqual([]);
    expect(resolved.overlays).toEqual([]);
  });

  it('draws a contour only around the targets of an active contour spec', () => {
    const resolved = resolveEffects([makeSpec()], 0.5, keyframes, 2);

    expect(resolved.decorations.get('Alpha')).toEqual({ contour: true, contourAlpha: 1, emphasized: true });
    expect(resolved.decorations.has('Beta')).toBe(false);
    expect(resolved.dimAlpha).toBe(0);
  });

  it('dims other bars while de-emphasis is active and keeps targets emphasized', () => {
    const resolved = resolveEffects([makeSpec({ effect: 'de-emphasis' })], 0.5, keyframes, 2);

    expect(resolved.dimAlpha).toBe(1);
    expect(resolved.decorations.get('Alpha')).toEqual({ contour: false, contourAlpha: 0, emphasized: true });
  });

  it('merges overlapping specs so all active targets stay emphasized', () => {
    const resolved = resolveEffects(
      [makeSpec(), makeSpec({ id: 'spec-2', targets: ['Beta'], effect: 'de-emphasis' })],
      0.5,
      keyframes,
      2,
    );

    expect(resolved.dimAlpha).toBe(1);
    expect(resolved.decorations.get('Alpha')).toEqual({ contour: true, contourAlpha: 1, emphasized: true });
    expect(resolved.decorations.get('Beta')).toEqual({ contour: false, contourAlpha: 0, emphasized: true });
  });

  it('shows a prologue caption only while active and only when non-empty', () => {
    const prologue = makeSpec({ mode: 'explicit', effect: 'prologue', caption: '  Alpha rises  ' });

    expect(resolveEffects([prologue], 0.5, keyframes, 2).overlays).toEqual([
      { specId: 'spec-1', text: 'Alpha rises', alpha: 1 },
    ]);
    expect(resolveEffects([prologue], 1, keyframes, 2).overlays).toEqual([]);
    expect(
      resolveEffects([makeSpec({ effect: 'prologue', caption: '   ' })], 0.5, keyframes, 2).overlays,
    ).toEqual([]);
  });

  it('builds a pre-scene ghost from the keyframe at the event period', () => {
    const resolved = resolveEffects(
      [makeSpec({ mode: 'explicit', effect: 'pre-scene' })],
      0.5,
      keyframes,
      2,
    );

    expect(resolved.ghosts).toEqual([
      { specId: 'spec-1', name: 'Alpha', value: 20, rank: 0, category: undefined, alpha: 1 },
    ]);
    expect(resolveEffects([makeSpec({ effect: 'pre-scene' })], 1, keyframes, 2).ghosts).toEqual([]);
  });

  it('skips pre-scene ghosts for targets outside the visible top ranks', () => {
    const resolved = resolveEffects(
      [makeSpec({ effect: 'pre-scene', targets: ['Beta'] })],
      0.5,
      keyframes,
      2,
      { topN: 1 },
    );

    expect(resolved.ghosts).toEqual([]);
  });

  it('applies the envelope to every effect strength', () => {
    const envelope = { attackPeriods: 0.4, releasePeriods: 0.3, lookaheadPeriods: 0 };
    const specs = [
      makeSpec({ effect: 'de-emphasis' }),
      makeSpec({ id: 'spec-2', mode: 'explicit', effect: 'prologue', caption: 'Soon' }),
      makeSpec({ id: 'spec-3' }),
    ];

    const resolved = resolveEffects(specs, 0.2, keyframes, 2, { envelope });

    expect(resolved.dimAlpha).toBeCloseTo(0.5);
    expect(resolved.overlays[0].alpha).toBeCloseTo(0.5);
    expect(resolved.decorations.get('Alpha')?.contourAlpha).toBeCloseTo(0.5);
  });
});
