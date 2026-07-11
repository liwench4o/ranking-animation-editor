import { TOP_N } from '../chart/constants';
import { envelopeAlpha, type EffectEnvelope } from './envelope';
import type {
  BarDecoration,
  CaptionOverlay,
  ForeshadowingSpec,
  GhostBar,
  Keyframe,
  ResolvedEffects,
} from '../types';

export function isSpecActive(spec: ForeshadowingSpec, frameTime: number): boolean {
  return frameTime >= spec.start && frameTime < spec.end;
}

export interface ResolveOptions {
  topN?: number;
  // Fade ramps applied to every effect; omitted means binary on/off.
  envelope?: EffectEnvelope;
}

export function resolveEffects(
  specs: ForeshadowingSpec[],
  frameTime: number,
  keyframes: Keyframe[],
  framesPerPeriod: number,
  options: ResolveOptions = {},
): ResolvedEffects {
  const { topN = TOP_N, envelope } = options;
  const decorations = new Map<string, BarDecoration>();
  const ghosts: GhostBar[] = [];
  const overlays: CaptionOverlay[] = [];
  let dimAlpha = 0;

  for (const spec of specs) {
    if (!isSpecActive(spec, frameTime)) {
      continue;
    }

    const alpha = envelopeAlpha(spec, frameTime, envelope);

    if (spec.effect === 'de-emphasis') {
      dimAlpha = Math.max(dimAlpha, alpha);
    }

    if (spec.effect === 'prologue' && spec.caption?.trim()) {
      overlays.push({ specId: spec.id, text: spec.caption.trim(), alpha });
    }

    for (const name of spec.targets) {
      const decoration = decorations.get(name) ?? { contour: false, contourAlpha: 0, emphasized: false };
      const isContour = spec.effect === 'contour';
      decorations.set(name, {
        contour: decoration.contour || isContour,
        contourAlpha: isContour ? Math.max(decoration.contourAlpha, alpha) : decoration.contourAlpha,
        // Targets of any active spec stay at full prominence while an active
        // de-emphasis spec dims every other bar.
        emphasized: true,
      });
    }

    if (spec.effect === 'pre-scene') {
      const eventKeyframe = keyframeAtPeriod(keyframes, spec.end, framesPerPeriod);
      for (const name of spec.targets) {
        const datum = eventKeyframe?.data.find((candidate) => candidate.name === name);
        if (datum && datum.rank < topN) {
          ghosts.push({
            specId: spec.id,
            name,
            value: datum.value,
            rank: datum.rank,
            category: datum.category,
            alpha,
          });
        }
      }
    }
  }

  return { dimAlpha, decorations, ghosts, overlays };
}

function keyframeAtPeriod(
  keyframes: Keyframe[],
  periodIndex: number,
  framesPerPeriod: number,
): Keyframe | undefined {
  if (keyframes.length === 0) {
    return undefined;
  }

  const frame = Math.round(periodIndex * Math.max(1, framesPerPeriod));
  return keyframes[Math.min(keyframes.length - 1, Math.max(0, frame))];
}
