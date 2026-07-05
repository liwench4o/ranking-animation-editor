import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { BAR_SIZE, HEIGHT, MARGIN, TOP_N, WIDTH } from '../chart/constants';
import { colorKeyOf, type ColorScale } from '../chart/color';
import { createBandGeometry, getFillOpacity, getStroke } from '../chart/style';
import {
  BANNER_GAP,
  BANNER_PADDING_Y,
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
  title: string;
}

const formatNumber = d3.format(',d');

// Banner entrance is aesthetic, not frame pacing; keep it fixed.
const BANNER_ENTRANCE_DURATION = 500;

export function ChartCanvas({
  colorScale,
  currentKeyframe,
  effects,
  frameDuration,
  onSelectName,
  selectedNames,
  source,
  subtitle,
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
        .attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

      svg.append('g').attr('class', 'axis-group');
      svg.append('g').attr('class', 'bar-group');
      svg.append('g').attr('class', 'ghost-group');
      svg.append('g').attr('class', 'label-group');
      svg.append('g').attr('class', 'overlay-group');
      svg.append('text').attr('class', 'chart-title').attr('x', 0).attr('y', 32);
      svg.append('text').attr('class', 'chart-subtitle').attr('x', 0).attr('y', 56);
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

    updatingBars
      .attr('fill', (datum: RankDatum) => color(colorKeyOf(datum)))
      .attr('fill-opacity', (datum: RankDatum) => getFillOpacity(datum, effects))
      .attr('stroke', (datum: RankDatum) => getStroke(datum, effects, selectedSet))
      .attr('stroke-width', (datum: RankDatum) =>
        effects.decorations.get(datum.name)?.contour || selectedSet.has(datum.name) ? 2.5 : 0,
      )
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
        group.append('text').attr('class', 'ghost-label').attr('text-anchor', 'end').attr('dy', '0.32em');
        return group;
      },
      (update) => update,
      (exit) => {
        if (canAnimate) {
          return exit.transition().duration(frameDuration).ease(d3.easeLinear).attr('opacity', 0).remove();
        }

        return exit.remove();
      },
    );

    joinedGhosts
      .select<SVGTextElement>('text.ghost-label')
      .text((datum) => `${datum.name} · ${formatNumber(datum.value)}`);

    // The foreshadowed value may exceed the current axis domain; clamp the
    // ghost to the plot edge so it stays visible.
    const ghostRight = (datum: GhostBar) => Math.min(x(datum.value), WIDTH - MARGIN.RIGHT);

    const updatingGhosts: any = canAnimate
      ? joinedGhosts.transition().duration(frameDuration).ease(d3.easeLinear)
      : joinedGhosts;

    updatingGhosts.attr('opacity', 1);
    updatingGhosts
      .select('rect')
      .attr('x', x(0))
      .attr('y', (datum: GhostBar) => yOf(datum.rank))
      .attr('width', (datum: GhostBar) => Math.max(0, ghostRight(datum) - x(0)))
      .attr('height', y.bandwidth());
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
            .attr('transform', (datum) => `translate(${x(datum.value)},${offListY})`)
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
      .attr('opacity', 1)
      .attr('transform', (datum: RankDatum) => `translate(${x(datum.value)},${yOf(datum.rank)})`);

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
          .attr('transform', 'translate(0,12)');
        group.append('rect').attr('class', 'banner-box').attr('rx', 8).attr('ry', 8);
        group.append('text').attr('class', 'banner-text').attr('text-anchor', 'end');
        return group;
      },
      (update) => update,
      (exit) => {
        if (canAnimate) {
          return exit.transition().duration(frameDuration).ease(d3.easeLinear).attr('opacity', 0).remove();
        }

        return exit.remove();
      },
    );

    let bannerBottomY = HEIGHT - 60;

    joinedBanners.each(function layoutBanner(datum) {
      const group = d3.select(this);
      const textX = WIDTH - 30;
      const text = group.select<SVGTextElement>('text.banner-text').attr('x', textX).text(null);
      const node = text.node();
      const layout = layoutTextBlock(
        datum.text,
        (line) => measureSvgText(node, line),
        BANNER_TEXT_MAX_WIDTH,
      );
      const boxX = textX - layout.boxWidth;
      const boxY = bannerBottomY - layout.boxHeight;
      const firstLineY = boxY + BANNER_PADDING_Y + BANNER_TEXT_BASELINE_OFFSET;

      text.attr('y', firstLineY).text(null);
      text
        .selectAll<SVGTSpanElement, string>('tspan')
        .data(layout.lines)
        .join('tspan')
        .attr('x', textX)
        .attr('dy', (_line, lineIndex) => (lineIndex === 0 ? 0 : BANNER_LINE_HEIGHT))
        .text((line) => line);

      group
        .select('rect.banner-box')
        .attr('x', boxX)
        .attr('y', boxY)
        .attr('width', layout.boxWidth)
        .attr('height', layout.boxHeight);

      bannerBottomY = boxY - BANNER_GAP;
    });

    const updatingBanners: any = canAnimate
      ? joinedBanners.transition().duration(BANNER_ENTRANCE_DURATION).ease(d3.easeCubicOut)
      : joinedBanners;

    updatingBanners.attr('opacity', 1).attr('transform', 'translate(0,0)');

    return () => {
      root.selectAll('*').interrupt();
    };
  }, [color, currentKeyframe, effects, frameDuration, onSelectName, selectedSet, source, subtitle, title]);

  return <div ref={containerRef} className="chart-shell" data-testid="chart-canvas" />;
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
