import { datasetFromDelimitedText, datasetFromRows } from './parseTimeSeries';
import type { Dataset } from '../types';

function expectDataset(result: ReturnType<typeof datasetFromDelimitedText>): Dataset {
  if (!result.ok) {
    throw new Error(`expected a dataset, got error: ${result.error}`);
  }

  return result.dataset;
}

describe('datasetFromDelimitedText', () => {
  it('parses long-format CSV and formats yearly dates as year labels', () => {
    const dataset = expectDataset(
      datasetFromDelimitedText(
        'date,name,category,value\n2000/1/1,Alpha,Tech,10\n2001/1/1,Alpha,Tech,20\n2000/1/1,Beta,Auto,30',
      ),
    );

    expect(dataset.periods.map((period) => period.label)).toEqual(['2000', '2001']);
    expect(dataset.entities).toEqual(['Alpha', 'Beta']);
    expect(dataset.values.get('Alpha')).toEqual([10, 20]);
    expect(dataset.values.get('Beta')).toEqual([30, null]);
    expect(dataset.categoryOf.get('Alpha')).toBe('Tech');
  });

  it('sorts numeric period keys and keeps their raw labels', () => {
    const dataset = expectDataset(
      datasetFromDelimitedText('date,name,value\n2,Song A,7\n1,Song A,5\n1,Song B,3'),
    );

    expect(dataset.periods.map((period) => period.label)).toEqual(['1', '2']);
    expect(dataset.values.get('Song A')).toEqual([5, 7]);
    expect(dataset.values.get('Song B')).toEqual([3, null]);
  });

  it('parses wide-format tables with non-ASCII headers in file order', () => {
    const dataset = expectDataset(
      datasetFromDelimitedText('姓名,2001,2002,2003\n科比,203,310,400\n奥尼尔,500,500,500'),
    );

    expect(dataset.periods.map((period) => period.label)).toEqual(['2001', '2002', '2003']);
    expect([...dataset.entities].sort()).toEqual(['奥尼尔', '科比'].sort());
    expect(dataset.values.get('科比')).toEqual([203, 310, 400]);
  });

  it('parses tab-separated wide tables', () => {
    const dataset = expectDataset(datasetFromDelimitedText('name\t2001\t2002\nA\t1\t2\nB\t3\t4'));

    expect(dataset.periods.map((period) => period.label)).toEqual(['2001', '2002']);
    expect(dataset.values.get('B')).toEqual([3, 4]);
  });

  it('reads quoted thousands separators as numbers', () => {
    const dataset = expectDataset(datasetFromDelimitedText('date,name,value\n2000,X,"72,537"\n2001,X,80000'));

    expect(dataset.values.get('X')).toEqual([72537, 80000]);
  });

  it('rejects empty and unrecognized files with a message', () => {
    expect(datasetFromDelimitedText('').ok).toBe(false);
    expect(datasetFromDelimitedText('a,b\nx,y').ok).toBe(false);
    expect(datasetFromDelimitedText('a,b,c\nx,y,z').ok).toBe(false);
  });
});

describe('datasetFromRows', () => {
  it('accepts pre-parsed rows with numeric cells', () => {
    const rows = [
      { date: '2000/1/1', name: 'Alpha', category: 'Tech', value: 10 },
      { date: '2001/1/1', name: 'Alpha', category: 'Tech', value: 20 },
    ];
    const result = datasetFromRows(rows, ['date', 'name', 'category', 'value'], { source: 'Unit test' });
    const dataset = expectDataset(result);

    expect(dataset.values.get('Alpha')).toEqual([10, 20]);
    expect(dataset.meta.source).toBe('Unit test');
  });
});
