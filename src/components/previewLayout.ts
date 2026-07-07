interface PreviewHeightInput {
  gap: number;
  leftColumnHeight: number;
  timelineHeight: number;
}

export function computeBalancedPreviewHeight({
  gap,
  leftColumnHeight,
  timelineHeight,
}: PreviewHeightInput): number {
  const height = leftColumnHeight - timelineHeight - gap;

  if (!Number.isFinite(height)) {
    return 0;
  }

  return Math.max(0, Math.round(height * 100) / 100);
}
