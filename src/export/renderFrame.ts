import * as d3 from 'd3';
import { BAR_SIZE, HEIGHT, MARGIN, TOP_N, WIDTH } from '../chart/constants';
import { colorKeyOf, type ColorScale } from '../chart/color';
import { BANNER_MAX_ALPHA, createBandGeometry, getFillOpacity, getLabelOpacity, getStroke } from '../chart/style';
import { LIGHT_THEME, type ChartTheme } from '../chart/theme';
import {
  BANNER_GAP,
  BANNER_MAX_LINES,
  BANNER_STACK_BOTTOM,
  BANNER_TEXT_BASELINE_OFFSET,
  BANNER_TEXT_MAX_WIDTH,
  BANNER_LINE_HEIGHT,
  layoutTextBlock,
} from '../chart/textLayout';
import type { RankDatum, ResolvedEffects } from '../types';

export interface FrameScene {
  data: RankDatum[];
  label: string;
  effects: ResolvedEffects;
  // Smoothed y position per entity; entities absent from the map sit off-list.
  yPositions: Map<string, number>;
  title: string;
  subtitle: string;
  source?: string;
  color: ColorScale;
  // Background/text palette; defaults to light so existing callers keep working.
  theme?: ChartTheme;
}

const FONT_STACK = '"Aptos", "SF Pro Text", "Segoe UI", sans-serif';
const formatNumber = d3.format(',d');
const noSelection = new Set<string>();
// Mirror the SVG constants in ChartCanvas.
const BANNER_RISE = 12;
const GHOST_CHIP_HEIGHT = 16;
const GHOST_CHIP_PADDING_X = 4;
// Mirrors the .bar-label halo in index.css (paint-order: stroke).
const LABEL_HALO = 'rgba(15, 23, 42, 0.22)';

// Mirrors the SVG renderer in ChartCanvas: same constants, same style logic,
// but stateless — every frame is drawn from scratch at its exact values.
export function renderChartFrame(ctx: CanvasRenderingContext2D, scene: FrameScene): void {
  const { data, label, effects, yPositions, title, subtitle, source, color, theme = LIGHT_THEME } = scene;
  const geometry = createBandGeometry();
  const visible = data.filter((datum) => datum.rank < TOP_N).slice(0, TOP_N);
  const maxValue = Math.max(1, d3.max(visible, (datum) => datum.value) ?? 1);
  const x = d3.scaleLinear().domain([0, maxValue]).range([MARGIN.LEFT, WIDTH - MARGIN.RIGHT]);
  const bandwidth = geometry.bandwidth;
  const yFor = (datum: RankDatum) => yPositions.get(datum.name) ?? geometry.yOf(datum.rank);
  // Draw only bars above the off-list slot: parked entities are invisible,
  // while entering/exiting ones mid-slide still show.
  const drawable = data.filter((datum) => yFor(datum) < geometry.offListY - 0.5);

  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  drawAxis(ctx, x, theme);

  for (const datum of drawable) {
    const barY = yFor(datum);
    const width = Math.max(0, x(datum.value) - x(0));

    ctx.globalAlpha = getFillOpacity(datum, effects);
    ctx.fillStyle = color(colorKeyOf(datum));
    ctx.fillRect(x(0), barY, width, bandwidth);
    ctx.globalAlpha = 1;

    const stroke = getStroke(datum, effects, noSelection);

    if (stroke) {
      ctx.globalAlpha = stroke.alpha;
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(x(0), barY, width, bandwidth);
      ctx.globalAlpha = 1;
    }
  }

  for (const ghost of effects.ghosts) {
    if (ghost.alpha <= 0) {
      continue;
    }

    // Same clamp as the SVG renderer: the foreshadowed value may exceed the
    // current axis domain; the arrow past the edge marks the clamped length.
    const plotRight = WIDTH - MARGIN.RIGHT;
    const clamped = x(ghost.value) > plotRight;
    const right = Math.min(x(ghost.value), plotRight);
    const ghostY = geometry.yOf(ghost.rank);
    const ghostCenterY = ghostY + bandwidth / 2;
    const width = Math.max(0, right - x(0));
    const ghostColor = color(colorKeyOf(ghost));

    ctx.globalAlpha = 0.12 * ghost.alpha;
    ctx.fillStyle = ghostColor;
    ctx.fillRect(x(0), ghostY, width, bandwidth);
    ctx.globalAlpha = ghost.alpha;
    ctx.strokeStyle = ghostColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(x(0), ghostY, width, bandwidth);
    ctx.setLineDash([]);

    if (clamped) {
      ctx.beginPath();
      ctx.moveTo(plotRight + 2, ghostCenterY - 5);
      ctx.lineTo(plotRight + 9, ghostCenterY);
      ctx.lineTo(plotRight + 2, ghostCenterY + 5);
      ctx.closePath();
      ctx.fillStyle = ghostColor;
      ctx.fill();
    }

    ctx.font = `600 11px ${FONT_STACK}`;
    const ghostText = `${ghost.name} · ${formatNumber(ghost.value)}`;
    const labelWidth = ctx.measureText(ghostText).width;

    ctx.globalAlpha = 0.85 * ghost.alpha;
    ctx.fillStyle = theme.background;
    roundedRect(
      ctx,
      right - 6 - labelWidth - GHOST_CHIP_PADDING_X,
      ghostCenterY - GHOST_CHIP_HEIGHT / 2,
      labelWidth + GHOST_CHIP_PADDING_X * 2,
      GHOST_CHIP_HEIGHT,
      3,
    );
    ctx.fill();

    ctx.globalAlpha = ghost.alpha;
    ctx.fillStyle = theme.ghostLabel;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(ghostText, right - 6, ghostCenterY);
    ctx.globalAlpha = 1;
  }

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'right';
  ctx.lineJoin = 'round';

  for (const datum of drawable) {
    const barY = yFor(datum);
    const labelX = x(datum.value) - 6;
    const labelCenterY = barY + bandwidth / 2;
    // Mirror the SVG label offsets, anchored on the bar center, with the same
    // halo and de-emphasis ramp as the live labels.
    ctx.globalAlpha = getLabelOpacity(datum, effects);
    ctx.strokeStyle = LABEL_HALO;
    ctx.lineWidth = 2;
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 12px ${FONT_STACK}`;
    ctx.strokeText(datum.name, labelX, labelCenterY - 0.25 * 12);
    ctx.fillText(datum.name, labelX, labelCenterY - 0.25 * 12);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.84)';
    ctx.font = `500 12px ${FONT_STACK}`;
    ctx.strokeText(formatNumber(datum.value), labelX, labelCenterY + 0.9 * 12);
    ctx.fillText(formatNumber(datum.value), labelX, labelCenterY + 0.9 * 12);
  }

  ctx.globalAlpha = 1;

  let bannerBottomY = HEIGHT - BANNER_STACK_BOTTOM;

  effects.overlays.forEach((overlay) => {
    const alpha = overlay.alpha;

    if (alpha <= 0) {
      return;
    }

    // Share the right edge with the year ticker and source line.
    const textX = WIDTH - 8;
    ctx.font = `700 15px ${FONT_STACK}`;
    ctx.textAlign = 'right';
    const layout = layoutTextBlock(
      overlay.text,
      (line) => ctx.measureText(line).width,
      BANNER_TEXT_MAX_WIDTH,
      BANNER_MAX_LINES,
    );
    const slotY = bannerBottomY - layout.textHeight;
    // The banner rises into its settled slot as the envelope climbs, matching
    // the SVG entrance; the stack math uses the settled position.
    const rise = BANNER_RISE * (1 - alpha);
    const firstLineY = slotY + BANNER_TEXT_BASELINE_OFFSET;

    // Watermark over the bars (mirrors .banner-text in index.css): translucent
    // gray text with a halo in the chart background color for legibility.
    ctx.globalAlpha = alpha * BANNER_MAX_ALPHA;
    ctx.strokeStyle = theme.background;
    ctx.lineWidth = 3;
    ctx.fillStyle = theme.bannerText;
    layout.lines.forEach((line, lineIndex) => {
      const lineY = firstLineY + rise + lineIndex * BANNER_LINE_HEIGHT;
      ctx.strokeText(line, textX, lineY);
      ctx.fillText(line, textX, lineY);
    });
    ctx.globalAlpha = 1;
    bannerBottomY = slotY - BANNER_GAP;
  });

  ctx.fillStyle = theme.title;
  ctx.font = `700 30px ${FONT_STACK}`;
  ctx.textAlign = 'left';
  ctx.fillText(title, 0, 18);

  ctx.fillStyle = theme.subtitle;
  ctx.font = `600 14px ${FONT_STACK}`;
  ctx.fillText(subtitle, 0, 42);

  ctx.fillStyle = theme.ticker;
  ctx.globalAlpha = 0.18;
  ctx.font = `700 78px ${FONT_STACK}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, WIDTH - 8, MARGIN.TOP + BAR_SIZE * (TOP_N - 1));
  ctx.globalAlpha = 1;
  ctx.textBaseline = 'alphabetic';

  if (source) {
    ctx.fillStyle = theme.source;
    ctx.font = `600 11px ${FONT_STACK}`;
    ctx.textAlign = 'right';
    ctx.fillText(`Source: ${source}`, WIDTH - 8, HEIGHT - 10);
  }
}

function drawAxis(ctx: CanvasRenderingContext2D, x: d3.ScaleLinear<number, number>, theme: ChartTheme): void {
  const tickCount = WIDTH / 160;
  const ticks = x.ticks(tickCount);
  const format = x.tickFormat(tickCount);
  const gridBottom = MARGIN.TOP + BAR_SIZE * (TOP_N + 0.1);

  ctx.strokeStyle = theme.axisLine;
  ctx.lineWidth = 1;
  ctx.fillStyle = theme.axisText;
  ctx.font = `600 11px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  for (const tick of ticks) {
    const tickX = x(tick);
    ctx.beginPath();
    ctx.moveTo(tickX, MARGIN.TOP);
    ctx.lineTo(tickX, gridBottom);
    ctx.stroke();

    // The live axis removes the first tick label; mirror that.
    if (tick !== ticks[0]) {
      ctx.fillText(format(tick), tickX, MARGIN.TOP - 8);
    }
  }
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
