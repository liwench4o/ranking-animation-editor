export const MARGIN = {
  TOP: 48,
  RIGHT: 10,
  BOTTOM: 20,
  LEFT: 6,
};

export const HEIGHT = 520;
// A uniform gutter baked into the chart frame so the preview and the exported
// GIF/MP4 share the same breathing room by construction (not measured from the
// panel's CSS padding, which depends on viewport size).
export const FRAME_PADDING = 28;
export const FRAME_HEIGHT = HEIGHT + FRAME_PADDING * 2;
// The exported frame is locked to exact 16:9: the height is the settled
// dimension and the width adapts to it, landing on standard video resolutions
// (GIF at 1× = 1024×576, MP4 at 2× = 2048×1152). Keep FRAME_HEIGHT divisible
// by 9 so the derived width stays integral.
export const FRAME_WIDTH = (FRAME_HEIGHT / 9) * 16;
export const WIDTH = FRAME_WIDTH - FRAME_PADDING * 2;
export const BAR_SIZE = 46;
export const TOP_N = 10;
export const DEFAULT_INTERPOLATION = 5;
// Milliseconds of animation per period (one period = one column of the data).
export const DEFAULT_PERIOD_DURATION = 1250;
