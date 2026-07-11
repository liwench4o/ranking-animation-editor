import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { BAR_SIZE, FRAME_HEIGHT, FRAME_PADDING, FRAME_WIDTH, HEIGHT, MARGIN, TOP_N, WIDTH } from '../chart/constants';
import { colorKeyOf, type ColorScale } from '../chart/color';
import { BANNER_MAX_ALPHA, createBandGeometry, getFillOpacity, getLabelOpacity, getStroke } from '../chart/style';
import type { ChartTheme } from '../chart/theme';
import {
  BANNER_GAP,
  BANNER_MAX_LINES,
  BANNER_STACK_BOTTOM,
  BANNER_TEXT_BASELINE_OFFSET,
  BANNER_TEXT_MAX_WIDTH,
  BANNER_LINE_HEIGHT,
  layoutTextBlock,
} from '../chart/textLayout';
import { getNameId } from '../data/dataset';
import type { CaptionOverlay, GhostBar, Keyframe, RankDatum, ResolvedEffects } from '../types';

interface ChartCanvasProps {
  colorScale: ColorScale;
  currentKeyframe?: Keyframe;
  effects: ResolvedEffects;
  frameDuration: number;
  onSelectName: (name: string) => void;
  selectedNames: string[];
  source?: string;
  subtitle: string;
  theme: ChartTheme;
  title: string;
}

const formatNumber = d3.format(',d');

// Active effects fade in/out via the resolve-side envelope; this short exit
// only covers specs the user deletes mid-flight in the editor.
const EFFECT_EXIT_DURATION = 200;
// The banner rises into place as its envelope alpha climbs.
const BANNER_RISE = 12;
const GHOST_CHIP_HEIGHT = 16;
const GHOST_CHIP_PADDING_X = 4;

export function ChartCanvas({
  colorScale,
  currentKeyframe,
  effects,
  frameDuration,
  onSelectName,
  selectedNames,
  source,
  subtitle,
  theme,
  title,
}: ChartCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedSet = useMemo(() => new Set(selectedNames), [selectedNames]);
  const color = colorScale;

  useEffect(() => {
    if (!containerRef.current || !currentKeyframe) {
      return;
    }

    const { label, data } = currentKeyframe;
    const visibleData = data.filter((datum) => datum.rank < TOP_N).slice(0, TOP_N);
    const maxValue = Math.max(1, d3.max(visibleData, (datum) => datum.value) ?? 1);
    const x = d3.scaleLinear().domain([0, maxValue]).range([MARGIN.LEFT, WIDTH - MARGIN.RIGHT]);
    const { y, offListY, yOf } = createBandGeometry();

    const root = d3.select(containerRef.current);
    let svg = root.select<SVGSVGElement>('svg.ranking-chart');

    if (svg.empty()) {
      svg = root
        .append('svg')
        .attr('class', 'ranking-chart')
        .attr('role', 'img')
        .attr('viewBox', `${-FRAME_PADDING} ${-FRAME_PADDING} ${FRAME_WIDTH} ${FRAME_HEIGHT}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

      svg
        .append('rect')
        .attr('class', 'chart-background')
        .attr('x', -FRAME_PADDING)
        .attr('y', -FRAME_PADDING)
        .attr('width', FRAME_WIDTH)
        .attr('height', FRAME_HEIGHT);
      svg.append('g').attr('class', 'axis-group');
      svg.append('g').attr('class', 'bar-group');
      svg.append('g').attr('class', 'ghost-group');
      svg.append('g').attr('class', 'label-group');
      svg.append('g').attr('class', 'overlay-group');
      svg.append('text').attr('class', 'chart-title').attr('x', 0).attr('y', 18);
      svg.append('text').attr('class', 'chart-subtitle').attr('x', 0).attr('y', 42);
      svg
        .append('text')
        .attr('class', 'year-ticker')
        .attr('x', WIDTH - 8)
        .attr('y', MARGIN.TOP + BAR_SIZE * (TOP_N - 1))
        .attr('text-anchor', 'end')
        .attr('dy', '0.32em');
      svg
        .append('text')
        .attr('class', 'chart-source')
        .attr('x', WIDTH - 8)
        .attr('y', HEIGHT - 10)
        .attr('text-anchor', 'end');
    }

    svg.select<SVGTextElement>('.chart-title').text(title);
    svg.select<SVGTextElement>('.chart-subtitle').text(subtitle);
    svg.select<SVGTextElement>('.year-ticker').text(label);
    svg.select<SVGTextElement>('.chart-source').text(source ? `Source: ${source}` : '');

    const canAnimate = !isTestEnvironment();
    const axis = d3
      .axisTop(x)
      .ticks(WIDTH / 160)
      .tickSizeOuter(0)
      .tickSizeInner(-BAR_SIZE * (TOP_N + y.padding()));

    const axisGroup = svg.select<SVGGElement>('.axis-group').attr('transform', `translate(0,${MARGIN.TOP})`);

    if (canAnimate) {
      axisGroup.transition().duration(frameDuration).ease(d3.easeLinear).call(axis);
    } else {
      axisGroup.call(axis);
    }

    svg.select('.axis-group .domain').remove();
    svg.selectAll('.axis-group .tick:first-of-type text').remove();

    const bars = svg
      .select<SVGGElement>('.bar-group')
      .selectAll<SVGRectElement, RankDatum>('rect')
      .data(visibleData, (datum) => (datum as RankDatum).name);

    const joinedBars = bars
      .join(
        (enter) =>
          enter
            .append('rect')
            .attr('id', (datum) => getNameId(datum.name))
            .attr('class', 'ranking-bar')
            .attr('x', x(0))
            .attr('y', offListY)
            .attr('height', y.bandwidth())
            .attr('width', (datum) => Math.max(0, x(datum.value) - x(0)))
            .style('cursor', 'pointer')
            .on('click', (_event, datum) => onSelectName((datum as unknown as RankDatum).name)),
        (update) => update,
        (exit) => {
          if (canAnimate) {
            return exit.transition().duration(frameDuration).ease(d3.easeLinear).attr('y', offListY).remove();
          }

          return exit.remove();
        },
      );

    const updatingBars: any = canAnimate
      ? joinedBars.transition().duration(frameDuration).ease(d3.easeLinear)
      : joinedBars;

    // The dash pattern flips with selection state; tweening a dasharray string
    // renders garbage mid-transition, so it stays outside the transition.
    joinedBars.attr('stroke-dasharray', (datum) =>
      getStroke(datum as RankDatum, effects, selectedSet)?.kind === 'selection' ? '6 4' : null,
    );

    updatingBars
      .attr('fill', (datum: RankDatum) => color(colorKeyOf(datum)))
      .attr('fill-opacity', (datum: RankDatum) => getFillOpacity(datum, effects))
      .attr('stroke', (datum: RankDatum) => getStroke(datum, effects, selectedSet)?.color ?? null)
      .attr('stroke-opacity', (datum: RankDatum) => getStroke(datum, effects, selectedSet)?.alpha ?? 1)
      .attr('stroke-width', (datum: RankDatum) => {
        const stroke = getStroke(datum, effects, selectedSet);
        return stroke ? (stroke.kind === 'contour' ? 2.5 : 2) : 0;
      })
      .attr('x', x(0))
      .attr('y', (datum: RankDatum) => yOf(datum.rank))
      .attr('height', y.bandwidth())
      .attr('width', (datum: RankDatum) => Math.max(0, x(datum.value) - x(0)));

    const ghosts = svg
      .select<SVGGElement>('.ghost-group')
      .selectAll<SVGGElement, GhostBar>('g.ghost')
      .data(effects.ghosts, (datum) => {
        const ghost = datum as GhostBar;
        return `${ghost.specId}:${ghost.name}`;
      });

    const joinedGhosts = ghosts.join(
      (enter) => {
        const group = enter.append('g').attr('class', 'ghost').attr('opacity', 0);
        group
          .append('rect')
          .attr('class', 'ghost-bar')
          .attr('fill', (datum) => color(colorKeyOf(datum)))
          .attr('fill-opacity', 0.12)
          .attr('stroke', (datum) => color(colorKeyOf(datum)))
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '5 4');
        group
          .append('path')
          .attr('class', 'ghost-clamp-arrow')
          .attr('d', 'M0,-5 L7,0 L0,5 Z')
          .attr('fill', (datum) => color(colorKeyOf(datum)));
        group.append('rect').attr('class', 'ghost-chip').attr('rx', 3).attr('ry', 3);
        group.append('text').attr('class', 'ghost-label').attr('text-anchor', 'end').attr('dy', '0.32em');
        return group;
      },
      (update) => update,
      (exit) => {
        if (canAnimate) {
          return exit.transition().duration(EFFECT_EXIT_DURATION).ease(d3.easeLinear).attr('opacity', 0).remove();
        }

        return exit.remove();
      },
    );

    joinedGhosts
      .select<SVGTextElement>('text.ghost-label')
      .text((datum) => `${datum.name} · ${formatNumber(datum.value)}`);

    // Chip widths must be measured after the label text is set and before the
    // transition retargets the chip geometry.
    const ghostLabelWidths = new Map<string, number>();
    joinedGhosts.each(function measureGhostLabel(datum) {
      const node = d3.select(this).select<SVGTextElement>('text.ghost-label').node();
      const width =
        node && typeof node.getComputedTextLength === 'function'
          ? node.getComputedTextLength()
          : `${datum.name} · ${formatNumber(datum.value)}`.length * 6;
      ghostLabelWidths.set(`${datum.specId}:${datum.name}`, width);
    });
    const ghostLabelWidth = (datum: GhostBar) => ghostLabelWidths.get(`${datum.specId}:${datum.name}`) ?? 0;

    // The foreshadowed value may exceed the current axis domain; clamp the
    // ghost to the plot edge so it stays visible, and point an arrow past the
    // edge so the clamped length isn't read as the actual value.
    const ghostRight = (datum: GhostBar) => Math.min(x(datum.value), WIDTH - MARGIN.RIGHT);

    joinedGhosts
      .select('path.ghost-clamp-arrow')
      .attr('display', (datum) => (x((datum as GhostBar).value) > WIDTH - MARGIN.RIGHT ? null : 'none'));

    const updatingGhosts: any = canAnimate
      ? joinedGhosts.transition().duration(frameDuration).ease(d3.easeLinear)
      : joinedGhosts;

    updatingGhosts.attr('opacity', (datum: GhostBar) => datum.alpha);
    updatingGhosts
      .select('rect.ghost-bar')
      .attr('x', x(0))
      .attr('y', (datum: GhostBar) => yOf(datum.rank))
      .attr('width', (datum: GhostBar) => Math.max(0, ghostRight(datum) - x(0)))
      .attr('height', y.bandwidth());
    updatingGhosts
      .select('path.ghost-clamp-arrow')
      .attr('transform', (datum: GhostBar) => `translate(${WIDTH - MARGIN.RIGHT + 2},${yOf(datum.rank) + y.bandwidth() / 2})`);
    updatingGhosts
      .select('rect.ghost-chip')
      .attr('x', (datum: GhostBar) => ghostRight(datum) - 6 - ghostLabelWidth(datum) - GHOST_CHIP_PADDING_X)
      .attr('y', (datum: GhostBar) => yOf(datum.rank) + y.bandwidth() / 2 - GHOST_CHIP_HEIGHT / 2)
      .attr('width', (datum: GhostBar) => ghostLabelWidth(datum) + GHOST_CHIP_PADDING_X * 2)
      .attr('height', GHOST_CHIP_HEIGHT);
    updatingGhosts
      .select('text')
      .attr('x', (datum: GhostBar) => ghostRight(datum) - 6)
      .attr('y', (datum: GhostBar) => yOf(datum.rank) + y.bandwidth() / 2);

    const labels = svg
      .select<SVGGElement>('.label-group')
      .selectAll<SVGTextElement, RankDatum>('text')
      .data(visibleData, (datum) => (datum as RankDatum).name);

    const joinedLabels = labels
      .join(
        (enter) =>
          enter
            .append('text')
            .attr('class', 'bar-label')
            .attr('x', -6)
            .attr('dy', '-0.25em')
            .attr('transform', (datum) => `translate(${x(datum.value)},${offListY + y.bandwidth() / 2})`)
            .style('font-weight', '700')
            .style('cursor', 'pointer')
            .text((datum) => datum.name)
            .on('click', (_event, datum) => onSelectName((datum as unknown as RankDatum).name))
            .call((text) =>
              text
                .append('tspan')
                .attr('class', 'bar-value')
                .attr('x', -6)
                .attr('dy', '1.15em')
                .style('font-weight', '500'),
            ),
        (update) => update,
        (exit) => {
          if (canAnimate) {
            return exit
              .transition()
              .duration(frameDuration)
              .ease(d3.easeLinear)
              .attr('opacity', 0)
              .attr('transform', function moveOffList(this: SVGTextElement) {
                const current = /translate\(([^,]+),/.exec(d3.select(this).attr('transform') ?? '');
                return `translate(${current?.[1] ?? x(0)},${offListY})`;
              })
              .remove();
          }

          return exit.remove();
        },
      );

    const updatingLabels: any = canAnimate
      ? joinedLabels.transition().duration(frameDuration).ease(d3.easeLinear)
      : joinedLabels;

    updatingLabels
      .attr('opacity', (datum: RankDatum) => getLabelOpacity(datum, effects))
      .attr('transform', (datum: RankDatum) => `translate(${x(datum.value)},${yOf(datum.rank) + y.bandwidth() / 2})`);

    if (canAnimate) {
      // The tween factory runs once when the transition starts, so the value
      // rolls from whatever is currently displayed to the new target.
      updatingLabels.select('tspan.bar-value').textTween(function tweenValue(this: SVGTSpanElement, datum: RankDatum) {
        const previous = Number((this.textContent ?? '').replace(/,/g, '')) || 0;
        const interpolate = d3.interpolateNumber(previous, datum.value);
        return (t: number) => formatNumber(interpolate(t));
      });
    } else {
      joinedLabels.select<SVGTSpanElement>('tspan.bar-value').text((datum) => formatNumber(datum.value));
    }

    const banners = svg
      .select<SVGGElement>('.overlay-group')
      .selectAll<SVGGElement, CaptionOverlay>('g.foreshadow-banner')
      .data(effects.overlays, (datum) => (datum as CaptionOverlay).specId);

    const joinedBanners = banners.join(
      (enter) => {
        const group = enter
          .append('g')
          .attr('class', 'foreshadow-banner')
          .attr('opacity', 0)
          .attr('transform', `translate(0,${BANNER_RISE})`);
        group.append('text').attr('class', 'banner-text').attr('text-anchor', 'end');
        return group;
      },
      (update) => update,
      (exit) => {
        if (canAnimate) {
          return exit.transition().duration(EFFECT_EXIT_DURATION).ease(d3.easeLinear).attr('opacity', 0).remove();
        }

        return exit.remove();
      },
    );

    let bannerBottomY = HEIGHT - BANNER_STACK_BOTTOM;

    joinedBanners.each(function layoutBanner(datum) {
      const group = d3.select(this);
      // Share the right edge with the year ticker and source line.
      const textX = WIDTH - 8;
      const text = group.select<SVGTextElement>('text.banner-text').attr('x', textX).text(null);
      const node = text.node();
      const layout = layoutTextBlock(
        datum.text,
        (line) => measureSvgText(node, line),
        BANNER_TEXT_MAX_WIDTH,
        BANNER_MAX_LINES,
      );
      const slotY = bannerBottomY - layout.textHeight;
      const firstLineY = slotY + BANNER_TEXT_BASELINE_OFFSET;

      text.attr('y', firstLineY).text(null);
      text
        .selectAll<SVGTSpanElement, string>('tspan')
        .data(layout.lines)
        .join('tspan')
        .attr('x', textX)
        .attr('dy', (_line, lineIndex) => (lineIndex === 0 ? 0 : BANNER_LINE_HEIGHT))
        .text((line) => line);

      bannerBottomY = slotY - BANNER_GAP;
    });

    const updatingBanners: any = canAnimate
      ? joinedBanners.transition().duration(frameDuration).ease(d3.easeLinear)
      : joinedBanners;

    updatingBanners
      // The watermark ceiling scales the fade; the rise keeps the raw envelope
      // alpha so the entrance motion still travels its full distance.
      .attr('opacity', (datum: CaptionOverlay) => datum.alpha * BANNER_MAX_ALPHA)
      .attr('transform', (datum: CaptionOverlay) => `translate(0,${BANNER_RISE * (1 - datum.alpha)})`);

    return () => {
      root.selectAll('*').interrupt();
    };
  }, [color, currentKeyframe, effects, frameDuration, onSelectName, selectedSet, source, subtitle, title]);

  return <div ref={containerRef} className="chart-shell" data-theme={theme.name} data-testid="chart-canvas" />;
}

function isTestEnvironment(): boolean {
  return typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
}

function measureSvgText(node: SVGTextElement | null, text: string): number {
  if (!node || typeof node.getComputedTextLength !== 'function') {
    return text.length * 8;
  }

  node.textContent = text;
  return node.getComputedTextLength();
}
