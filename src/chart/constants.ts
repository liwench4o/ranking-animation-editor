export const MARGIN = {
  TOP: 66,
  RIGHT: 10,
  BOTTOM: 20,
  LEFT: 6,
};

export const WIDTH = 800;
export const HEIGHT = 520;
// A uniform gutter baked into the chart frame so the preview and the exported
// GIF/MP4 share the same breathing room by construction (not measured from the
// panel's CSS padding, which depends on viewport size).
export const FRAME_PADDING = 32;
export const FRAME_WIDTH = WIDTH + FRAME_PADDING * 2;
export const FRAME_HEIGHT = HEIGHT + FRAME_PADDING * 2;
export const BAR_SIZE = 44;
export const TOP_N = 10;
export const DEFAULT_INTERPOLATION = 5;
// Milliseconds of animation per period (one period = one column of the data).
export const DEFAULT_PERIOD_DURATION = 1250;
