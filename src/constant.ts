import * as d3 from 'd3';

export const MARGIN = {
    TOP: 80,
    RIGHT: 6,
    BOTTOM: 6,
    LEFT: 0,
};

export const WIDTH = 800;
export const HEIGHT = 500;
export const BAR_SIZE = 46;
export const TOP_N = 10;
export const SVG_WIDTH = WIDTH - MARGIN.LEFT - MARGIN.RIGHT; // 794
export const SVG_HEIGHT = MARGIN.TOP + BAR_SIZE * TOP_N + MARGIN.BOTTOM; // 566

export const DURATION = 250;
export const DELAY = 0;

export const DEFAULT_COLOR_SCALE = d3
    .scaleOrdinal()
    .range([
        '#E04644',
        '#FDE47F',
        '#7CCCE5',
        '#82FF92',
        '#555E7B',
        '#B7D968',
        '#B576AD',
        '#42C4BD',
        '#41D620',
        '#85E876',
        '#F4D889',
        '#DA5EED',
        '#2ABFDD',
        '#7182ED',
        '#FFA796',
    ]);

export const DIMENSION_COLOR_SCALE_5 = d3
    .scaleOrdinal()
    .range(['#FAD089', '#FF9C5B', '#F5634A', '#E47277', '#3CBCC1']);

export const DIMENSION_COLOR_SCALE_3 = d3.scaleOrdinal().range(['#79FAC5', '#00D5D5', '#00ACD1']);
