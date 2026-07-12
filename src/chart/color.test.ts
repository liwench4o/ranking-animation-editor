import { COLOR_MAP_OPTIONS, DEFAULT_COLOR_MAP, colorKeyOf, createColorScale } from './color';
import type { Dataset } from '../types';

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
    const modern = createColorScale(makeDataset(), 'modern');

    expect(optionValues).toEqual(['muted', 'tableau', 'modern', 'set3']);
    expect(COLOR_MAP_OPTIONS.map((option) => option.label)).not.toContain('Pastel');
    expect(tableau('Tech')).not.toBe(muted('Tech'));
    expect(tableau('Tech')).toBe('#4e79a7');
    expect(modern('Tech')).toBe('#4c7fdb');
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
