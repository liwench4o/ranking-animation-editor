import { TOP_N } from '../chart/constants';
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

export function resolveEffects(
  specs: ForeshadowingSpec[],
  frameTime: number,
  keyframes: Keyframe[],
  framesPerPeriod: number,
  topN: number = TOP_N,
): ResolvedEffects {
  const decorations = new Map<string, BarDecoration>();
  const ghosts: GhostBar[] = [];
  const overlays: CaptionOverlay[] = [];
  let dimOthers = false;

  for (const spec of specs) {
    if (!isSpecActive(spec, frameTime)) {
      continue;
    }

    if (spec.effect === 'de-emphasis') {
      dimOthers = true;
    }

    if (spec.effect === 'prologue' && spec.caption?.trim()) {
      overlays.push({ specId: spec.id, text: spec.caption.trim() });
    }

    for (const name of spec.targets) {
      const decoration = decorations.get(name) ?? { contour: false, emphasized: false };
      decorations.set(name, {
        contour: decoration.contour || spec.effect === 'contour',
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
          });
        }
      }
    }
  }

  return { dimOthers, decorations, ghosts, overlays };
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
