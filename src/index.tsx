import 'antd/dist/reset.css';
import './styles/index.css';
import { createRoot } from 'react-dom/client';
import { App, type DatasetPreset } from './components/App';
import { datasetFromRows } from './data/parseTimeSeries';
import brandValueRows from '../data/brand_values.csv';
import categoryBrandRows from '../data/category-brands.csv';
import spotifyRows from '../data/spotify-us-weekly-16.csv';
import type { DatasetMeta } from './types';

const container = document.getElementById('container');

if (!container) {
  throw new Error('Missing #container root element');
}

function makePreset(
  key: string,
  fileName: string,
  rows: Array<Record<string, unknown>>,
  meta: Omit<DatasetMeta, 'fileName'>,
): DatasetPreset {
  const parsed = datasetFromRows(rows, Object.keys(rows[0] ?? {}), {
    ...meta,
    fileName,
  });

  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  return { key, label: fileName, dataset: parsed.dataset };
}

const datasetPresets = [
  makePreset('category-brands', 'category-brands.csv', categoryBrandRows as unknown as Array<Record<string, unknown>>, {
    name: 'Top Global Brands from 2000 to 2019',
    valueLabel: 'Brand value, $m',
  }),
  makePreset('brand-values', 'brand_values.csv', brandValueRows as unknown as Array<Record<string, unknown>>, {
    name: 'Brand value interpolation sample',
    valueLabel: 'Brand value',
  }),
  makePreset('spotify-us-weekly-16', 'spotify-us-weekly-16.csv', spotifyRows as unknown as Array<Record<string, unknown>>, {
    name: 'Spotify US weekly top tracks',
    valueLabel: 'Streams',
  }),
];

createRoot(container).render(<App initialDataset={datasetPresets[0].dataset} datasetPresets={datasetPresets} />);
