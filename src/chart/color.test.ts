import { colorKeyOf, createColorScale } from './color';
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
