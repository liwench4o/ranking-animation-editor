export type ChartThemeName = 'light' | 'dark';

export interface ChartTheme {
  name: ChartThemeName;
  // Chart background rect (live) and export frame fill.
  background: string;
  title: string;
  subtitle: string;
  source: string;
  // Year ticker fill; its 0.18 opacity is fixed by the renderer, not the theme.
  ticker: string;
  axisText: string;
  axisLine: string;
  ghostLabel: string;
}

// Light theme mirrors the colors previously hardcoded in the CSS and the export
// canvas. The dark values below must stay in sync with the dark rules in
// src/styles/index.css (the live SVG path can't read this object).
export const LIGHT_THEME: ChartTheme = {
  name: 'light',
  background: '#ffffff',
  title: '#111827',
  subtitle: '#64748b',
  source: '#94a3b8',
  ticker: '#334155',
  axisText: '#64748b',
  axisLine: '#eef2f7',
  ghostLabel: '#64748b',
};

export const DARK_THEME: ChartTheme = {
  name: 'dark',
  background: '#0b0e14',
  title: '#f8fafc',
  subtitle: '#cbd5e1',
  source: '#94a3b8',
  ticker: '#e2e8f0',
  axisText: '#94a3b8',
  axisLine: '#1f2933',
  ghostLabel: '#94a3b8',
};

export const DEFAULT_CHART_THEME: ChartThemeName = 'light';

export function getChartTheme(name: ChartThemeName): ChartTheme {
  return name === 'dark' ? DARK_THEME : LIGHT_THEME;
}
