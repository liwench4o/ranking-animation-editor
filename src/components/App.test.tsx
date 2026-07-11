import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { App } from './App';
import { MARGIN } from '../chart/constants';
import { CONTOUR_COLOR, SELECTION_COLOR, createBandGeometry } from '../chart/style';
import { datasetFromDelimitedText } from '../data/parseTimeSeries';
import type { Dataset } from '../types';

const csv = [
  'date,name,category,value',
  '2000/1/1,Alpha,Tech,10',
  '2000/1/1,Beta,Auto,30',
  '2001/1/1,Alpha,Tech,20',
  '2001/1/1,Beta,Auto,10',
].join('\n');

function makeDataset(meta: Record<string, string> = {}): Dataset {
  const result = datasetFromDelimitedText(csv, {
    name: 'Test ranking',
    valueLabel: 'Points',
    ...meta,
  });

  if (!result.ok) {
    throw new Error(result.error);
  }

  return result.dataset;
}

function readAppStyles(): string {
  return readFileSync('src/styles/index.css', 'utf8');
}

describe('App', () => {
  it('renders the editor, chart, timeline, and collapsible data panel', async () => {
    render(<App initialDataset={makeDataset()} />);

    expect(screen.getByRole('heading', { name: 'Visual Foreshadowing' })).toBeTruthy();
    expect(screen.getByText('Highlighting')).toBeTruthy();
    expect(screen.getByText('Preview')).toBeTruthy();
    expect(screen.getByText('Timeline')).toBeTruthy();
    expect(screen.getByText('Upload CSV')).toBeTruthy();

    await userEvent.click(screen.getByText('Data'));
    expect(screen.getAllByRole('table').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Click or drop/)).toBeNull();
  });

  it('shows the current dataset as a fixed header selector and switches presets', async () => {
    const defaultDataset = makeDataset({ fileName: 'category-brands.csv' });
    const spotifyDataset = makeDataset({ name: 'Spotify weekly streams', fileName: 'spotify-us-weekly-16.csv' });

    render(
      <App
        initialDataset={defaultDataset}
        datasetPresets={[
          { key: 'category-brands', label: 'category-brands.csv', dataset: defaultDataset },
          { key: 'spotify-us-weekly-16', label: 'spotify-us-weekly-16.csv', dataset: spotifyDataset },
        ]}
      />,
    );

    const datasetSelect = screen.getByRole('combobox', { name: 'Dataset' });
    expect(datasetSelect).toBeTruthy();
    expect(screen.getByText('category-brands.csv')).toBeTruthy();

    await userEvent.click(datasetSelect);
    await userEvent.click(await screen.findByTitle('spotify-us-weekly-16.csv'));

    expect(screen.getAllByText('spotify-us-weekly-16.csv').length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue('Spotify weekly streams')).toBeTruthy();
  });

  it('exposes the animation pacing controls with defaults', () => {
    render(<App initialDataset={makeDataset()} />);

    expect(screen.getByRole('slider', { name: 'Smoothness' }).getAttribute('aria-valuenow')).toBe('5');
    expect((screen.getByLabelText('Seconds per period') as HTMLInputElement).value).toBe('1.25');
  });

  it('offers GIF and MP4 export buttons in the export panel', () => {
    render(<App initialDataset={makeDataset()} />);

    expect(screen.getByRole('heading', { name: 'Export' })).toBeTruthy();

    const gifButton = screen.getByRole('button', { name: /GIF/ });
    const mp4Button = screen.getByRole('button', { name: /MP4/ });

    expect(gifButton.closest('.export-panel')).toBeTruthy();
    expect(mp4Button.closest('.export-panel')).toBeTruthy();
    expect(gifButton.closest('.preview-panel')).toBeNull();
    expect(mp4Button.closest('.preview-panel')).toBeNull();
    expect(document.querySelector('.panel-heading-row')).toBeNull();
  });

  it('switches the preview and chart to dark mode from the Preview toggle', async () => {
    render(<App initialDataset={makeDataset()} />);

    const chartShell = document.querySelector('.chart-shell');
    const previewPanel = document.querySelector('.preview-panel');

    // Light is the default.
    expect(chartShell?.getAttribute('data-theme')).toBe('light');
    expect(previewPanel?.classList.contains('is-dark')).toBe(false);

    await userEvent.click(screen.getByText('Dark'));

    expect(chartShell?.getAttribute('data-theme')).toBe('dark');
    expect(previewPanel?.classList.contains('is-dark')).toBe(true);

    await userEvent.click(screen.getByText('Light'));

    expect(chartShell?.getAttribute('data-theme')).toBe('light');
    expect(previewPanel?.classList.contains('is-dark')).toBe(false);
  });

  it('balances desktop height through the preview chart instead of the export gap', () => {
    const css = readAppStyles();

    expect(css).not.toMatch(/\.export-panel\s*\{[^}]*margin-top:\s*auto/s);
    expect(css).toMatch(/\.preview-panel\s*\{[^}]*display:\s*flex/s);
    expect(css).toMatch(/\.preview-panel\s*\{[^}]*height:\s*var\(--balanced-preview-height,\s*auto\)/s);
    expect(css).toMatch(/\.chart-shell\s*\{[^}]*flex:\s*1\s+1\s+auto/s);
  });

  it('updates the visible chart title and subtitle and exposes color map instead of source', async () => {
    render(<App initialDataset={makeDataset()} />);

    await userEvent.clear(screen.getByLabelText('Title'));
    await userEvent.type(screen.getByLabelText('Title'), 'Updated ranking');
    await userEvent.clear(screen.getByLabelText('Subtitle'));
    await userEvent.type(screen.getByLabelText('Subtitle'), 'Updated metric');

    const colorMapSelect = screen.getByRole('combobox', { name: 'Color map' });
    await userEvent.click(colorMapSelect);
    await userEvent.click(await screen.findByText('Soft contrast'));

    expect(screen.getByText('Updated ranking')).toBeTruthy();
    expect(screen.getByText('Updated metric')).toBeTruthy();
    expect(screen.getAllByText('Soft contrast').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.color-map-swatch').length).toBeGreaterThanOrEqual(16);
    expect(screen.queryByLabelText('Source')).toBeNull();
    expect(screen.queryByText(/Source:/)).toBeNull();
  });

  it('uses Ant Design blue for selected and contour borders', async () => {
    render(<App initialDataset={makeDataset()} />);

    const betaBar = document.querySelector<SVGRectElement>('#Beta');
    fireEvent.click(betaBar as SVGRectElement);
    expect(betaBar?.getAttribute('stroke')).toBe(SELECTION_COLOR);
    expect(SELECTION_COLOR).toBe('#1677ff');

    await userEvent.click(screen.getByRole('combobox', { name: 'Select Item(s)' }));
    await userEvent.click(await screen.findByTitle('Alpha'));
    await userEvent.click(screen.getByTitle('Implicit'));
    // getByTitle targets the segmented option; the timeline legend also shows
    // "Contour" as plain text, so getByText would be ambiguous.
    await userEvent.click(screen.getByTitle('Contour'));
    await userEvent.click(screen.getByRole('button', { name: /Add/ }));

    const alphaBar = document.querySelector<SVGRectElement>('#Alpha');
    expect(alphaBar?.getAttribute('stroke')).toBe(CONTOUR_COLOR);
    expect(CONTOUR_COLOR).toBe('#1677ff');
  });

  it('keeps a left chart gutter so bar outlines are not clipped', () => {
    expect(MARGIN.LEFT).toBeGreaterThanOrEqual(4);
  });

  it('toggles playback and changes the selected period from the timeline slider', () => {
    render(<App initialDataset={makeDataset()} />);

    const playButton = screen.getByRole('button', { name: 'Play animation' });
    fireEvent.click(playButton);
    expect(screen.getByRole('button', { name: 'Pause animation' })).toBeTruthy();

    const slider = screen.getByRole('slider', { name: 'Timeline period' });
    fireEvent.keyDown(slider, { code: 'ArrowRight', key: 'ArrowRight', keyCode: 39, which: 39 });

    expect(slider.getAttribute('aria-valuenow')).toBe('1');
  });

  it('places the timeline endpoint labels below the playback bar', () => {
    render(<App initialDataset={makeDataset()} />);

    const scale = document.querySelector('.timeline-scale');

    expect(scale?.closest('.timeline-slider-block')).toBeTruthy();
    expect(scale?.closest('.timeline-playbar')).toBeNull();
  });

  it('positions live chart labels at the vertical center of their bars', () => {
    render(<App initialDataset={makeDataset()} />);

    const geometry = createBandGeometry();
    const betaLabel = [...document.querySelectorAll<SVGTextElement>('.ranking-chart .bar-label')].find((label) =>
      label.textContent?.startsWith('Beta'),
    );
    const y = Number(/translate\([^,]+,([^)]+)\)/.exec(betaLabel?.getAttribute('transform') ?? '')?.[1]);

    expect(y).toBeCloseTo(geometry.yOf(0) + geometry.bandwidth / 2);
  });

  it('restarts the animation from the transport controls', () => {
    render(<App initialDataset={makeDataset()} />);

    const slider = screen.getByRole('slider', { name: 'Timeline period' });
    fireEvent.keyDown(slider, { code: 'ArrowRight', key: 'ArrowRight', keyCode: 39, which: 39 });
    expect(slider.getAttribute('aria-valuenow')).toBe('1');

    fireEvent.click(screen.getByRole('button', { name: 'Restart animation' }));
    expect(slider.getAttribute('aria-valuenow')).toBe('0');
  });

  it('updates effect options when foreshadowing mode changes', async () => {
    render(<App initialDataset={makeDataset()} />);

    // Titles target the effect segmented options; the timeline legend renders
    // all four effect names as plain text, so getByText would be ambiguous and
    // "Pre-scene" would never disappear.
    expect(screen.getByTitle('Pre-scene')).toBeTruthy();

    await userEvent.click(screen.getByTitle('Implicit'));

    expect(screen.getByTitle('De-Emphasis')).toBeTruthy();
    expect(screen.queryByTitle('Pre-scene')).toBeNull();
  });

  it('adds a foreshadowing spec from the editor and lists it on the timeline', async () => {
    render(<App initialDataset={makeDataset()} />);

    expect(screen.getByText(/No foreshadowing yet/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Add/ })).toHaveProperty('disabled', true);

    await userEvent.click(screen.getByRole('combobox', { name: 'Select Item(s)' }));
    await userEvent.click(await screen.findByTitle('Alpha'));
    await userEvent.type(screen.getByLabelText('Caption'), 'Alpha overtakes Beta');
    await userEvent.click(screen.getByRole('button', { name: /Add/ }));

    expect(screen.queryByText(/No foreshadowing yet/)).toBeNull();
    // The band pill carries its details in the accessible name, not as text.
    expect(screen.getByRole('button', { name: /E: Prologue/ })).toBeTruthy();
    expect(screen.getByText('Alpha overtakes Beta')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Remove Alpha' }));

    expect(screen.getByText(/No foreshadowing yet/)).toBeTruthy();
    expect(screen.queryByText('Alpha overtakes Beta')).toBeNull();
  });

  it('keeps disabled Add validation in the button tooltip instead of inline layout', async () => {
    render(<App initialDataset={makeDataset()} />);

    await userEvent.click(screen.getByRole('combobox', { name: 'Select Item(s)' }));
    await userEvent.click(await screen.findByTitle('Alpha'));

    const addButton = screen.getByRole('button', { name: /Add/ });
    const tooltipHost = addButton.closest('.add-button-tooltip');

    expect(addButton).toHaveProperty('disabled', true);
    expect(screen.queryByText('Prologue needs a caption.')).toBeNull();
    expect(tooltipHost?.getAttribute('title')).toBe('Prologue needs a caption.');
  });

  it('wraps long prologue captions in the SVG banner', async () => {
    render(<App initialDataset={makeDataset()} />);

    await userEvent.click(screen.getByRole('combobox', { name: 'Select Item(s)' }));
    await userEvent.click(await screen.findByTitle('Alpha'));
    await userEvent.type(
      screen.getByLabelText('Caption'),
      'Alpha rises while Beta slows across the market and the audience should see this in a compact banner',
    );
    await userEvent.click(screen.getByRole('button', { name: /Add/ }));

    const bannerLines = document.querySelectorAll('.foreshadow-banner .banner-text tspan');

    expect(bannerLines.length).toBeGreaterThan(1);
  });

  it('loads a CSV from the header upload button', async () => {
    render(<App initialDataset={makeDataset()} />);

    const file = new File(['date,name,value\n2010,Gamma,5\n2011,Gamma,8\n2012,Gamma,9'], 'gamma.csv', {
      type: 'text/csv',
    });
    const input = document.querySelector('.header-upload input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText('3 periods')).toBeTruthy();
    expect(screen.getByDisplayValue('gamma')).toBeTruthy();
  });

  it('edits a data table cell and keeps the dataset otherwise intact', async () => {
    render(<App initialDataset={makeDataset()} />);

    await userEvent.click(screen.getByText('Data'));
    await userEvent.click(screen.getByRole('button', { name: 'Edit Alpha 2000' }));
    const input = screen.getByLabelText('Value for Alpha 2000');
    await userEvent.clear(input);
    await userEvent.type(input, '99{enter}');

    expect(screen.getByRole('button', { name: 'Edit Alpha 2000' }).textContent).toBe('99');
    expect(screen.getByRole('button', { name: 'Edit Beta 2000' }).textContent).toBe('30');
  });
});
