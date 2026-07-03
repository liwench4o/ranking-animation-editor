import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import {
  BAR_SIZE,
  DEFAULT_CAPTION,
  DURATION,
  HEIGHT,
  MARGIN,
  TOP_N,
  WIDTH,
} from '../chart/constants';
import { getNameId } from '../data/brandData';
import type { ForeshadowingEffect, ForeshadowingMode, Keyframe, RankDatum } from '../types';

interface ChartCanvasProps {
  caption: string;
  currentKeyframe?: Keyframe;
  effect: ForeshadowingEffect;
  mode: ForeshadowingMode;
  onSelectName: (name: string) => void;
  selectedNames: string[];
  subtitle: string;
  title: string;
}

const color = d3.scaleOrdinal<string, string>(d3.schemeTableau10);
const formatDate = d3.timeFormat('%Y');
const formatNumber = d3.format(',d');

export function ChartCanvas({
  caption,
  currentKeyframe,
  effect,
  mode,
  onSelectName,
  selectedNames,
  subtitle,
  title,
}: ChartCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedSet = useMemo(() => new Set(selectedNames), [selectedNames]);

  useEffect(() => {
    if (!containerRef.current || !currentKeyframe) {
      return;
    }

    const [date, data] = currentKeyframe;
    const visibleData = data.slice(0, TOP_N);
    const maxValue = d3.max(visibleData, (datum) => datum.value) ?? 1;
    const x = d3.scaleLinear().domain([0, maxValue]).range([MARGIN.LEFT, WIDTH - MARGIN.RIGHT]);
    const y = d3
      .scaleBand<number>()
      .domain(d3.range(TOP_N))
      .rangeRound([MARGIN.TOP, MARGIN.TOP + BAR_SIZE * TOP_N])
      .padding(0.1);

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
      svg.append('g').attr('class', 'label-group');
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
        .attr('text-anchor', 'end')
        .text('Source: InterBrand');
      svg.append('text').attr('class', 'foreshadow-caption').attr('x', WIDTH - 18).attr('y', HEIGHT - 94);
    }

    svg.select<SVGTextElement>('.chart-title').text(title);
    svg.select<SVGTextElement>('.chart-subtitle').text(subtitle);
    svg.select<SVGTextElement>('.year-ticker').text(formatDate(date));

    const canAnimate = !isTestEnvironment();
    const axis = d3
      .axisTop(x)
      .ticks(WIDTH / 160)
      .tickSizeOuter(0)
      .tickSizeInner(-BAR_SIZE * (TOP_N + y.padding()));

    const axisGroup = svg.select<SVGGElement>('.axis-group').attr('transform', `translate(0,${MARGIN.TOP})`);

    if (canAnimate) {
      axisGroup.transition().duration(DURATION).ease(d3.easeLinear).call(axis);
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
            .attr('y', (datum) => y(datum.rank) ?? MARGIN.TOP)
            .attr('height', y.bandwidth())
            .attr('width', 0)
            .style('cursor', 'pointer')
            .on('click', (_event, datum) => onSelectName((datum as unknown as RankDatum).name)),
        (update) => update,
        (exit) => {
          if (canAnimate) {
            return exit.transition().duration(DURATION).ease(d3.easeLinear).attr('width', 0).remove();
          }

          return exit.remove();
        },
      );

    const updatingBars: any = canAnimate
      ? joinedBars.transition().duration(DURATION).ease(d3.easeLinear)
      : joinedBars;

    updatingBars
      .attr('fill', (datum: RankDatum) => color(datum.category ?? datum.name))
      .attr('fill-opacity', (datum: RankDatum) => getFillOpacity(datum, effect, selectedSet))
      .attr('stroke', (datum: RankDatum) => getStroke(datum, effect, selectedSet))
      .attr('stroke-width', (datum: RankDatum) =>
        selectedSet.has(datum.name) || effect === 'contour' ? 2.5 : 0,
      )
      .attr('x', x(0))
      .attr('y', (datum: RankDatum) => y(datum.rank) ?? MARGIN.TOP)
      .attr('height', y.bandwidth())
      .attr('width', (datum: RankDatum) => Math.max(0, x(datum.value) - x(0)));

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
            .style('font-weight', '700')
            .style('cursor', 'pointer')
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
            return exit.transition().duration(DURATION).ease(d3.easeLinear).attr('opacity', 0).remove();
          }

          return exit.remove();
        },
      );

    const updatingLabels: any = canAnimate
      ? joinedLabels.transition().duration(DURATION).ease(d3.easeLinear)
      : joinedLabels;

    updatingLabels
      .attr('opacity', 1)
      .attr('transform', (datum: RankDatum) => `translate(${x(datum.value)},${y(datum.rank) ?? MARGIN.TOP})`)
      .each(function updateLabel(this: SVGTextElement, datum: RankDatum) {
        const label = d3.select(this);
        label.text(datum.name);
        label
          .append('tspan')
          .attr('class', 'bar-value')
          .attr('x', -6)
          .attr('dy', '1.15em')
          .style('font-weight', '500')
          .text(formatNumber(datum.value));
      });

    const captionText = effect === 'prologue' || effect === 'pre-scene' ? caption || DEFAULT_CAPTION : '';
    svg
      .select<SVGTextElement>('.foreshadow-caption')
      .attr('text-anchor', 'end')
      .attr('opacity', captionText ? 1 : 0)
      .text(`${mode === 'explicit' ? 'E' : 'I'}: ${captionText}`);

    return () => {
      root.selectAll('*').interrupt();
    };
  }, [caption, currentKeyframe, effect, mode, onSelectName, selectedSet, subtitle, title]);

  return <div ref={containerRef} className="chart-shell" data-testid="chart-canvas" />;
}

function isTestEnvironment(): boolean {
  return typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
}

function getFillOpacity(
  datum: RankDatum,
  effect: ForeshadowingEffect,
  selectedNames: Set<string>,
): number {
  if (effect === 'de-emphasis' && selectedNames.size > 0) {
    return selectedNames.has(datum.name) ? 0.95 : 0.28;
  }

  return selectedNames.has(datum.name) ? 0.9 : 0.62;
}

function getStroke(datum: RankDatum, effect: ForeshadowingEffect, selectedNames: Set<string>): string | null {
  if (effect === 'contour' && (selectedNames.size === 0 || selectedNames.has(datum.name))) {
    return '#d64545';
  }

  return selectedNames.has(datum.name) ? '#0f766e' : null;
}
