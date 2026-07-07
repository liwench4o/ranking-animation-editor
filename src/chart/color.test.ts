import {
  COLOR_MAP_OPTIONS,
  DEFAULT_COLOR_MAP,
  colorKeyOf,
  createColorScale,
  swatchColorsFor,
  visibleColorKeys,
} from './color';
import type { Dataset, RankDatum } from '../types';

function makeDataset(): Dataset {
  return {
    id: 'test',
    entities: ['Alpha', 'Beta', 'Gamma'],
    periods: [{ key: '2000', label: '2000' }],
    values: new Map(),
    categoryOf: new Map([
      ['Alpha', 'Tech'],
      ['Beta', 'Auto'],
      ['Gamma', 'Tech'],
    ]),
    meta: {},
  };
}

describe('createColorScale', () => {
  it('defaults to the muted bar chart palette', () => {
    const scale = createColorScale(makeDataset());

    expect(DEFAULT_COLOR_MAP).toBe('muted');
    expect(scale('Tech')).toBe('#a8bfd3');
    expect(scale('Auto')).toBe('#f4bd8d');
  });

  it('offers selectable color maps and switches palette assignments', () => {
    const optionValues = COLOR_MAP_OPTIONS.map((option) => option.value);
    const muted = createColorScale(makeDataset(), 'muted');
    const tableau = createColorScale(makeDataset(), 'tableau');
    const soft = createColorScale(makeDataset(), 'soft');

    expect(optionValues).toEqual(['muted', 'tableau', 'soft', 'set3']);
    expect(COLOR_MAP_OPTIONS.map((option) => option.label)).not.toContain('Pastel');
    expect(tableau('Tech')).not.toBe(muted('Tech'));
    expect(tableau('Tech')).toBe('#4e79a7');
    expect(soft('Tech')).toBe('#7fa7bd');
  });

  it('assigns the same colors regardless of query order', () => {
    const first = createColorScale(makeDataset());
    const second = createColorScale(makeDataset());

    const techFirst = first('Tech');
    const autoFirst = first('Auto');
    const autoSecond = second('Auto');
    const techSecond = second('Tech');

    expect(techSecond).toBe(techFirst);
    expect(autoSecond).toBe(autoFirst);
    expect(techFirst).not.toBe(autoFirst);
  });

  it('shares one color across entities of the same category', () => {
    const scale = createColorScale(makeDataset());

    expect(scale(colorKeyOf({ name: 'Alpha', category: 'Tech' }))).toBe(
      scale(colorKeyOf({ name: 'Gamma', category: 'Tech' })),
    );
  });

  it('falls back to the entity name when there is no category', () => {
    expect(colorKeyOf({ name: 'Solo' })).toBe('Solo');
  });
});

describe('swatch previews', () => {
  const visibleData: RankDatum[] = [
    { name: 'Beta', value: 30, rank: 0, category: 'Auto' },
    { name: 'Alpha', value: 20, rank: 1, category: 'Tech' },
    { name: 'Gamma', value: 10, rank: 2, category: 'Tech' },
  ];

  it('lists on-screen color keys once, in rank order', () => {
    expect(visibleColorKeys(visibleData)).toEqual(['Auto', 'Tech']);
  });

  it('previews the exact colors the scale assigns to the visible bars', () => {
    const dataset = makeDataset();
    const scale = createColorScale(dataset, 'muted');
    const keys = visibleColorKeys(visibleData);
    const swatches = swatchColorsFor(dataset, 'muted', keys);

    // The leading swatches are the actual bar colors, in the same order.
    expect(swatches.slice(0, keys.length)).toEqual(keys.map((key) => scale(key)));
  });

  it('pads to a stable length with the remaining palette and no duplicates', () => {
    const swatches = swatchColorsFor(makeDataset(), 'muted', visibleColorKeys(visibleData));

    expect(swatches).toHaveLength(6);
    expect(new Set(swatches).size).toBe(swatches.length);
  });

  it('falls back to the palette head when nothing is on screen', () => {
    expect(swatchColorsFor(makeDataset(), 'tableau', [])).toEqual(COLOR_MAP_OPTIONS[1].colors.slice(0, 6));
  });
});
