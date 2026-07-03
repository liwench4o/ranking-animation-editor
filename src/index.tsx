import 'antd/dist/reset.css';
import './styles/index.css';
import { createRoot } from 'react-dom/client';
import { App } from './components/App';
import categoryBrandRecords from '../data/category-brands.csv';
import type { BrandRecord } from './types';

const container = document.getElementById('container');

if (!container) {
  throw new Error('Missing #container root element');
}

createRoot(container).render(<App records={categoryBrandRecords as unknown as BrandRecord[]} />);
