import '../css/style.css';
import '../css/bootstrap.min.css';
import 'gridjs/dist/theme/mermaid.css';
import * as d3 from 'd3';
import { rollup, groups } from 'd3-array';
import * as CONSTANT from './constant';

const { Grid } = require('gridjs');
const data = require('../data/category-brands.csv');
//const data = require('../data/spotify-us-weekly-16.csv');
console.log('data', data);

const names = new Set(data.map((d: any) => d.name));
console.log('names', names);

// Data Table
const nameDataArray = Array.from(groups(data, (d: any) => d.name));
console.log('nameDataArray', nameDataArray);

const dataTable: any[][] = [];
for (let i = 0; i < nameDataArray.length; ++i) {
    //console.log(nameDataArray[i]);
    const dataRow = [];
    dataRow.push(nameDataArray[i][0]);
    for (const object of nameDataArray[i][1]) {
        dataRow.push(object.value.toString());
    }
    //console.log(dataRow);
    dataTable.push(dataRow);
}

const datevalues = Array.from(
    rollup(
        data,
        ([d]: any) => d.value,
        (d: any) => Number(new Date(d.date)),
        (d: any) => d.name,
    ),
)
    .map(([date, data]) => [new Date(date as number), data])
    .sort(([a]: any, [b]: any) => d3.ascending(a, b));
console.log('datevalues', datevalues);

function rank(value: any): any {
    const data: { [k: string]: any } = Array.from(names, name => ({ name, value: value(name) }));
    data.sort((a: any, b: any) => d3.descending(a.value, b.value));
    for (let i = 0; i < data.length; ++i) {
        data[i].rank = Math.min(CONSTANT.TOP_N, i);
    }
    return data;
}

const keyframes = computeKeyframes();
console.log('keyframes', keyframes);

const nameframes = groups(
    (keyframes as any).flatMap(([, data]: any) => data),
    (d: any) => d.name,
);
console.log('nameframes', nameframes);

const prev = new Map(
    (nameframes as any).flatMap(([, data]: any) => d3.pairs(data, (a, b) => [b, a])),
);

const next = new Map((nameframes as any).flatMap(([, data]: any) => d3.pairs(data)));

const formatDate = d3.timeFormat('%Y');
//const formatDate = d3.timeFormat('%e');
const formatNumber = d3.format(',d');

const x = d3
    .scaleLinear()
    .domain([0, 1])
    .range([CONSTANT.MARGIN.LEFT, CONSTANT.WIDTH - CONSTANT.MARGIN.RIGHT]);

const y = d3
    .scaleBand<number>()
    .domain(d3.range(CONSTANT.TOP_N + 1))
    .rangeRound([
        CONSTANT.MARGIN.TOP,
        CONSTANT.MARGIN.TOP + CONSTANT.BAR_SIZE * (CONSTANT.TOP_N + 1 + 0.1),
    ])
    .padding(0.1);

const svg = d3
    .select('#foreshadowing')
    .append('svg')
    .attr('width', CONSTANT.WIDTH)
    .attr('height', CONSTANT.HEIGHT)
    .attr('viewBox', `0 0 ${CONSTANT.SVG_WIDTH} ${CONSTANT.SVG_HEIGHT}`);

const title = svg
    .append('text')
    .attr('id', 'title')
    .attr('y', 32)
    .html('Top Global Brands from 2000 to 2019');
    //.html('Top Streamed Songs in Spotify');

const subTitle = svg
    .append('text')
    .attr('id', 'subtitle')
    .attr('y', 55)
    .html('Brand value, $m');
    //.html('Song stream, #');

const captionSource = svg
    .append('text')
    .attr('id', 'caption')
    .attr('x', CONSTANT.WIDTH - 8)
    .attr('y', CONSTANT.HEIGHT + 38)
    .style('text-anchor', 'end')
    .html('Source: InterBrand');

function computeKeyframes(): any[] {
    const k = parseInt(d3.select('#input-text-interpolation').property('value')); // interpolated frames, disabling interpolation by setting k to 1
    const keyframes = [];
    let ka: any, a: any, kb: any, b: any;
    for ([[ka, a], [kb, b]] of d3.pairs(datevalues)) {
        //console.log('[ka, a]', [ka, a]);
        for (let i = 0; i < k; ++i) {
            const t = i / k;
            keyframes.push([
                new Date(ka * (1 - t) + kb * t),
                rank((name: any) => (a.get(name) || 0) * (1 - t) + (b.get(name) || 0) * t),
            ]);
        }
    }
    keyframes.push([new Date(kb), rank((name: any) => b.get(name) || 0)]);
    return keyframes;
}

function colorScale(d: any): string {
    const scale = d3.scaleOrdinal(d3.schemeTableau10);
    if (data.some((d: any) => d.category !== undefined)) {
        const categoryByName = new Map(data.map((d: any) => [d.name, d.category]));
        scale.domain(Array.from(categoryByName.values()) as string[]);
        return scale(categoryByName.get(d.name) as string);
    }
    return scale(d.name);
}

function getNameID(name: string): string {
    return name.replace(/[^a-zA-Z]/g, '');
}

function bars(svg: any): any {
    let bar = svg.append('g').attr('id', 'bar-group').attr('fill-opacity', 1).selectAll('rect');

    return ([date, data]: any, transition: any) =>
        (bar = bar
            .data(data.slice(0, CONSTANT.TOP_N), (d: any) => d.name)
            .join(
                (enter: any) =>
                    enter
                        .append('rect')
                        .attr('id', (d: any) => getNameID(d.name))
                        .attr('class', 'rect')
                        .attr('fill', (d: any) => colorScale(d))
                        .attr('fill-opacity', 0.5)
                        .attr('height', y.bandwidth())
                        .attr('x', x(0))
                        .attr('y', (d: any) => y((prev.get(d) || d).rank))
                        .attr('width', (d: any) => x((prev.get(d) || d).value) - x(0))
                        .style('cursor', 'pointer')
                        .on('click', (d: any) => {
                            const barID = getNameID(d.name);
                            const optionID = '#option-' + barID;
                            console.log(d3.select(optionID).attr('selected'));
                            if (d3.select(optionID).attr('selected') !== 'selected') {
                                d3.select(optionID).attr('selected', 'selected');
                            } else {
                                d3.select(optionID).attr('selected', null);
                            }
                        }),
                (update: any) => update,
                (exit: any) =>
                    exit
                        .transition(transition)
                        .remove()
                        .attr('y', (d: any) => y((next.get(d) || d).rank))
                        .attr('width', (d: any) => x((next.get(d) || d).value) - x(0)),
            )
            .call((bar: any) =>
                bar
                    .transition(transition)
                    .attr('y', (d: any) => y(d.rank))
                    .attr('width', (d: any) => x(d.value) - x(0)),
            ));
}

function textTween(a: number, b: number) {
    const i = d3.interpolateNumber(a, b);
    return function (t: any) {
        this.textContent = formatNumber(i(t));
    };
}

function labels(svg: any) {
    let label = svg
        .append('g')
        .attr('id', 'text-group')
        .style('font', 'bold 12px var(--sans-serif)')
        .style('font-variant-numeric', 'tabular-nums')
        .attr('text-anchor', 'end')
        .selectAll('text');

    return ([date, data]: any, transition: any) =>
        (label = label
            .data(data.slice(0, CONSTANT.TOP_N), (d: any) => d.name)
            .join(
                (enter: any) =>
                    enter
                        .append('text')
                        .attr('class', 'bar-label')
                        .attr(
                            'transform',
                            (d: any) =>
                                `translate(${x((prev.get(d) || d).value)},${y(
                                    (prev.get(d) || d).rank,
                                )})`,
                        )
                        .attr('y', y.bandwidth() / 2)
                        .attr('x', -6)
                        .attr('dy', '-0.25em')
                        .text((d: any) => d.name)
                        .style('font-weight', 'bold')
                        .call((text: any) =>
                            text
                                .append('tspan')
                                .attr('fill-opacity', 0.7)
                                .attr('font-weight', 'normal')
                                .attr('x', -6)
                                .attr('dy', '1.15em'),
                        ),
                (update: any) => update,
                (exit: any) =>
                    exit
                        .transition(transition)
                        .remove()
                        .attr(
                            'transform',
                            (d: any) =>
                                `translate(${x((next.get(d) || d).value)},${y(
                                    (next.get(d) || d).rank,
                                )})`,
                        )
                        .call((g: any) =>
                            g
                                .select('tspan')
                                .tween('text', (d: any) =>
                                    textTween(d.value, (next.get(d) || d).value),
                                ),
                        ),
            )
            .call((bar: any) =>
                bar
                    .transition(transition)
                    .attr('transform', (d: any) => `translate(${x(d.value)},${y(d.rank)})`)
                    .call((g: any) =>
                        g
                            .select('tspan')
                            .tween('text', (d: any) =>
                                textTween((prev.get(d) || d).value, d.value),
                            ),
                    ),
            ));
}

function axis(svg: any) {
    const g = svg
        .append('g')
        .attr('id', 'axis-group')
        .attr('transform', `translate(0,${CONSTANT.MARGIN.TOP})`);

    const axis = d3
        .axisTop(x)
        .ticks(CONSTANT.WIDTH / 160)
        .tickSizeOuter(0)
        .tickSizeInner(-CONSTANT.BAR_SIZE * (CONSTANT.TOP_N + y.padding()));

    return (_: any, transition: any) => {
        g.transition(transition).call(axis);
        g.select('.tick:first-of-type text').remove();
        g.selectAll('.tick:not(:first-of-type) line').attr('stroke', 'white');
        g.select('.domain').remove();
    };
}

const halo = function (text: any, strokeWidth: number) {
    text.select(function () {
        return this.parentNode.insertBefore(this.cloneNode(true), this);
    })
        .style('fill', '#fff')
        .style('stroke', '#fff')
        .style('stroke-width', strokeWidth)
        .style('stroke-linejoin', 'round')
        .style('opacity', 2);
};

function ticker(svg: any) {
    const now = svg
        .append('text')
        .attr('id', 'backgroundText')
        .style('font-variant-numeric', 'tabular-nums')
        .attr('text-anchor', 'end')
        .attr('x', CONSTANT.WIDTH - 6)
        .attr('y', CONSTANT.MARGIN.TOP + CONSTANT.BAR_SIZE * (CONSTANT.TOP_N - 1))
        .attr('dy', '0.32em')
        .text(formatDate(keyframes[0][0]));
        //.text('Week ' + formatNumber(keyframes[0][0]));
        //.call(halo, 10);
    console.log('keyframes[0][0]', formatDate(keyframes[0][0]));
    return ([date]: any, transition: any) => {
        transition.end().then(() => now.text(formatDate(date)));
        //transition.end().then(() => now.text('Week ' + formatNumber(date)));
    };
}

// DataTable
new Grid({
    columns: [
        'Name',
        '2000',
        '2001',
        '2002',
        '2003',
        '2004',
        '2005',
        '2006',
        '2007',
        '2008',
        '2009',
        '2010',
        '2011',
        '2012',
        '2013',
        '2014',
        '2015',
        '2016',
        '2017',
        '2018',
    ],
    data: dataTable,
    autoWidth: true,
    fixedHeader: true, // not working
    height: '600px',
    sort: true,
    style: {
        th: {
            padding: '1px',
            'background-color': 'rgba(0, 0, 0, 0.05)',
            color: '#000',
            'border-bottom': '2px solid #ccc',
            'text-align': 'center',
        },
        td: {
            'font-size': '0.75rem',
            padding: '0.1rem',
            'text-align': 'center',
        },
    },
}).render(document.getElementById('data-table'));

// Timeline
const timelineXAxisSVG = d3
    .select('#timeline-tick')
    .append('svg')
    .attr('width', 720)
    .attr('height', 12);
const timelineTickXScale = d3.scaleLinear().domain([2000, 2019]).range([14, 696]);
const timelineXAxis = d3.axisBottom(timelineTickXScale).tickSize(0).ticks(20, '');
timelineXAxisSVG.append('g').call(timelineXAxis);

// Options
const selectItem = d3.select('#select-item');
const nameArray = Array.from(names).sort(function (a: string, b: string) {
    if (a < b) {
        return -1;
    }
    if (a > b) {
        return 1;
    }
    return 0;
});
for (const name of nameArray) {
    selectItem
        .append('option')
        .attr('id', 'option-' + getNameID(name as string))
        .attr('value', getNameID(name as string))
        .text(name as string);
}

const selectEffect = d3.select('#select-effect');
d3.selectAll("input[name='custom-foreshadowing-radio']").on('change', function () {
    selectEffect.selectAll('option').remove();
    const mode = d3.select('input[name="custom-foreshadowing-radio"]:checked').property('value'); // "explicit" "implicit"

    if (mode === 'explicit') {
        selectEffect.append('option').attr('value', 'none').text('None');
        selectEffect.append('option').attr('value', 'prologue').text('Prologue');
        selectEffect.append('option').attr('value', 'pre-scene').text('Pre-scene');
    } else if (mode === 'implicit') {
        selectEffect.append('option').attr('value', 'none').text('None');
        selectEffect.append('option').attr('value', 'contour').text('Contour');
        selectEffect.append('option').attr('value', 'de-emphasis').text('De-Emphasis');
    }
});

function updateForeshadowing(): void {
    const selectedEffect = d3.select('#select-effect').property('value');
    console.log('forshadowing effect', selectedEffect);
    //const currentTimeIndex = parseInt(d3.select('#slider-time').property('value'));
    const currentTimeIndex = parseInt(d3.select('#slider-time').property('value'));
    console.log(currentTimeIndex);

    // Prologue
    // if (currentTimeIndex === 12) {
    //     d3.select('#prologue').transition().duration(500).style('opacity', 1);
    // }
    // if (currentTimeIndex === 18) {
    //     d3.select('#prologue').transition().duration(500).style('opacity', 0);
    // }

    // Contour
    // if (currentTimeIndex === 13) {
    //     d3.select('#CocaCola').attr('stroke', 'red').attr('stroke-width', 3);
    // }
    // if (currentTimeIndex === 18) {
    //     d3.select('#CocaCola').attr('stroke', null).attr('stroke-width', null);
    // }

    // De-emphasis
    if (currentTimeIndex === 13) {
        d3.select('#bar-group').style('opacity', 0.6);
        d3.select('#CocaCola').attr('fill-opacity', 1);
    }
    if (currentTimeIndex === 18) {
        d3.selectAll('#bar-group').style('opacity', 1);
        d3.select('#CocaCola').attr('fill-opacity', 0.5);
    }

    /* 
    //Video purpose
    if (currentTimeIndex === 0) {
        d3.select('#prologue').transition().duration(500).style('opacity', 1);
        //d3.select('#Ford').transition().duration(500).style('opacity', 0.8);
    }
    if (currentTimeIndex === 2) {
        d3.select('#prologue').transition().duration(500).style('opacity', 0);
    }
    if (currentTimeIndex === 6) {
        d3.select('#bar-group').transition().duration(500).style('opacity', 0.6);
    }
    if (currentTimeIndex === 8) {
        d3.select('#Google').attr('fill-opacity', 1);
    }
    if (currentTimeIndex === 10) {
        d3.selectAll('#bar-group').style('opacity', 1);
        d3.select('#Google').attr('fill-opacity', 0.5);
    }
    if (currentTimeIndex === 11) {
        d3.select('#Apple').attr('stroke', 'red').attr('stroke-width', 3);
    }
    
    if (currentTimeIndex === 15) {
        d3.select('#Apple').attr('stroke', null).attr('stroke-width', null);
        if (d3.select('#pre-white').empty()) {
            d3.select('#text-group')
                .append('rect')
                .attr('fill', '#fff')
                .attr('id', 'pre-white')
                .attr('class', 'rect')
                .style('opacity', 0.5)
                .attr('x', 214.7865232815775)
                .attr('y', 270)
                .attr('height', 41)
                .attr('width', 700);

            d3.select('#text-group')
                .append('rect')
                .attr('fill', '#4e79a7')
                .attr('id', 'pre-coca')
                .attr('class', 'rect')
                .style('opacity', 0.8)
                .attr('x', 0)
                .attr('y', 270)
                .attr('height', 41)
                .attr('width', 214.7865232815775);

            d3.select('#text-group')
                .append('text')
                .attr('class', 'bar-label pre-label')
                .attr('id', 'pre-label-coca')
                .attr('transform', 'translate(0, 270)')
                .attr('y', 20.5)
                .attr('x', 6)
                .attr('dy', '-0.25em')
                .style('font-weight', 'bold')
                .text('Pre-scene: Coca-Cola');
        }
    }
    if (currentTimeIndex === 18) {
        d3.select('#pre-white').transition().delay(2000).duration(500).style('opacity', 0).remove();
        d3.select('#pre-coca').transition().delay(1000).duration(500).style('opacity', 0).remove();
        d3.select('#pre-label-coca')
            .transition()
            .delay(1000)
            .duration(500)
            .style('opacity', 0)
            .remove();
    }
    */
}

function updateTitle(): void {
    const inputTitle = d3.select('#input-text-title').property('value');
    d3.select('#title').text(inputTitle);
}

function updateSubTitle(): void {
    const inputSubTitle = d3.select('#input-text-subtitle').property('value');
    d3.select('#subtitle').text(inputSubTitle);
}

function updateInterpolation(): void {
    const durationNumber = parseInt(d3.select('#input-text-duration').property('value'));
}

const maxIndex = parseInt(d3.select('#slider-time').property('max'));
const minIndex = parseInt(d3.select('#slider-time').property('min'));
function drawCurrentProgress() {
    const value = parseInt(d3.select('#slider-time').property('value'));
    const percentage = (value / (maxIndex - minIndex)) * 100;
    //console.log(percentage);
    // Set progress style
    d3.select('#slider-time').style(
        'background',
        () =>
            'linear-gradient(to right, #808080 0%, #808080 ' +
            percentage +
            '%, #eee ' +
            percentage +
            '%, #eee)',
    );
}

function updateTimeIndex(timeIndex: number, keyframeIndex: number): void {
    d3.select('#slider-time').property('value', timeIndex);
    const year = timeIndex + 2000;
    d3.select('#slider-text').text(year);
    drawCurrentProgress();
}

d3.select('#input-text-title').on('input', function () {
    updateTitle();
});

d3.select('#input-text-subtitle').on('input', function () {
    updateSubTitle();
});

d3.select('#btn-add').on('click', () => {
    d3.select('#input-prologue').property('value', '');

    const options = d3.selectAll('#select-item option');
    for (const option of options.nodes()) {
        d3.select(option).attr('selected', null);
    }

    if (!d3.select('#ford-white').empty()) {
        d3.select('#ford-white').transition().duration(500).style('opacity', 0).remove();
    } else if (!d3.select('#google-white').empty()) {
        d3.select('#google-white').transition().duration(500).style('opacity', 0).remove();
    } else if (!d3.select('#apple-white').empty()) {
        d3.select('#apple-white').transition().duration(500).style('opacity', 0).remove();
    } else if (!d3.select('#coca-white').empty()) {
        d3.select('#coca-white').transition().duration(500).style('opacity', 0).remove();
    }
});

d3.select('#ford-label').on('click', () => {
    d3.select('#ford-foreshadowing').transition().duration(500).style('opacity', 0).remove();
});

d3.select('#google-label').on('click', () => {
    d3.select('#google-foreshadowing').transition().duration(500).style('opacity', 0).remove();
});

d3.select('#apple-label').on('click', () => {
    d3.select('#apple-foreshadowing').transition().duration(500).style('opacity', 0).remove();
});

d3.select('#coca-label').on('click', () => {
    d3.select('#coca-foreshadowing').transition().duration(500).style('opacity', 0).remove();
});

let playAnimation = false;
d3.select('#play').on('click', function () {
    if (playAnimation) {
        playAnimation = false;
        d3.select(this).property('value', '▶');
    } else {
        playAnimation = true;
        d3.select(this).property('value', '■');
    }
});

let timeIndex = 0;
let keyframeIndex = 0;
d3.select('#slider-time').on('input', function () {
    playAnimation = false;
    d3.select('#play').property('value', '▶');
    timeIndex = parseInt(d3.select(this).property('value'));
    const k = parseInt(d3.select('#input-text-interpolation').property('value')); // 5
    keyframeIndex = timeIndex * k;
    const keyframe = keyframes[keyframeIndex]; // TODO
    // Extract the top bar’s value.
    x.domain([0, keyframe[1][0].value]);

    const transition = svg.transition().duration(CONSTANT.DURATION).ease(d3.easeLinear);
    updateAxis(keyframe, transition);
    updateBars(keyframe, transition);
    updateLabels(keyframe, transition);
    updateTicker(keyframe, transition);
    updateForeshadowing();
    updateTimeIndex(timeIndex, keyframeIndex);
});

const updateBars = bars(svg);
const updateAxis = axis(svg);
const updateLabels = labels(svg);
const updateTicker = ticker(svg);

const tick = d3.interval(() => {
    if (playAnimation) {
        const keyframesNumber = keyframes.length;
        const keyframe = keyframes[keyframeIndex];
        timeIndex = Math.floor(keyframeIndex / 5);
        // console.log('keyframesNumber', keyframesNumber);
        // console.log('keyframeIndex', keyframeIndex);
        // console.log(keyframes.length);

        // Extract the top bar’s value.
        x.domain([0, keyframe[1][0].value]);

        const transition = svg.transition().duration(CONSTANT.DURATION).ease(d3.easeLinear);

        updateAxis(keyframe, transition);
        updateBars(keyframe, transition);
        updateLabels(keyframe, transition);
        updateTicker(keyframe, transition);
        updateForeshadowing();
        updateTimeIndex(timeIndex, keyframeIndex);

        if (keyframeIndex === keyframesNumber - 1) {
            tick.stop();
        }
        ++keyframeIndex;
    }
}, CONSTANT.DURATION);
