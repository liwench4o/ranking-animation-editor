import { computeBalancedPreviewHeight } from './previewLayout';

describe('computeBalancedPreviewHeight', () => {
  it('uses the remaining left-column height for the preview panel', () => {
    expect(
      computeBalancedPreviewHeight({
        gap: 16,
        leftColumnHeight: 848,
        timelineHeight: 147,
      }),
    ).toBe(685);
  });

  it('does not return a negative preview height when the timeline is taller than the left column', () => {
    expect(
      computeBalancedPreviewHeight({
        gap: 16,
        leftColumnHeight: 120,
        timelineHeight: 160,
      }),
    ).toBe(0);
  });
});
