import { EFFECT_ATTACK_MS, EFFECT_RELEASE_MS, envelopeAlpha, makeEnvelope } from './envelope';

const spec = { start: 2, end: 5 };

describe('makeEnvelope', () => {
  it('converts the fixed ms ramps into period units', () => {
    const envelope = makeEnvelope(1250);

    expect(envelope.attackPeriods).toBeCloseTo(EFFECT_ATTACK_MS / 1250);
    expect(envelope.releasePeriods).toBeCloseTo(EFFECT_RELEASE_MS / 1250);
    expect(envelope.lookaheadPeriods).toBe(0);
  });

  it('carries the caller-provided lookahead', () => {
    expect(makeEnvelope(1000, 0.2).lookaheadPeriods).toBe(0.2);
  });
});

describe('envelopeAlpha', () => {
  const envelope = { attackPeriods: 0.4, releasePeriods: 0.3, lookaheadPeriods: 0 };

  it('is binary without an envelope', () => {
    expect(envelopeAlpha(spec, 2)).toBe(1);
  });

  it('ramps in over the attack window after start', () => {
    expect(envelopeAlpha(spec, 2, envelope)).toBe(0);
    expect(envelopeAlpha(spec, 2.2, envelope)).toBeCloseTo(0.5);
    expect(envelopeAlpha(spec, 2.4, envelope)).toBeCloseTo(1);
  });

  it('ramps out to exactly zero at the event', () => {
    expect(envelopeAlpha(spec, 4.7, envelope)).toBeCloseTo(1);
    expect(envelopeAlpha(spec, 4.85, envelope)).toBeCloseTo(0.5);
    expect(envelopeAlpha(spec, 5, envelope)).toBe(0);
  });

  it('shifts sampling forward by the lookahead so the last frame lands at zero', () => {
    const withLookahead = { ...envelope, lookaheadPeriods: 0.2 };

    expect(envelopeAlpha(spec, 4.8, withLookahead)).toBe(0);
    expect(envelopeAlpha(spec, 4.7, withLookahead)).toBeCloseTo(1 / 3);
  });

  it('caps short specs with a triangular envelope instead of overshooting', () => {
    const shortSpec = { start: 0, end: 0.4 };

    expect(envelopeAlpha(shortSpec, 0.2, envelope)).toBeCloseTo(0.5);
    expect(envelopeAlpha(shortSpec, 0.35, envelope)).toBeCloseTo(1 / 6);
  });

  it('treats a zero-width window as an instant ramp', () => {
    const instant = { attackPeriods: 0, releasePeriods: 0.3, lookaheadPeriods: 0 };

    expect(envelopeAlpha(spec, 2, instant)).toBe(1);
  });
});
