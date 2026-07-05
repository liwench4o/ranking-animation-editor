import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
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
    source: 'Test',
    valueLabel: 'Points',
    ...meta,
  });

  if (!result.ok) {
    throw new Error(result.error);
  }

  return result.dataset;
}

describe('App', () => {
  it('renders the editor, chart, timeline, and collapsible data panel', async () => {
    render(<App initialDataset={makeDataset()} />);

    expect(screen.getByRole('heading', { name: 'Visual Foreshadowing' })).toBeTruthy();
    expect(screen.getByText('Editing')).toBeTruthy();
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

  it('updates the visible chart title, subtitle, and source from controls', async () => {
    render(<App initialDataset={makeDataset()} />);

    await userEvent.clear(screen.getByLabelText('Title'));
    await userEvent.type(screen.getByLabelText('Title'), 'Updated ranking');
    await userEvent.clear(screen.getByLabelText('Subtitle'));
    await userEvent.type(screen.getByLabelText('Subtitle'), 'Updated metric');
    await userEvent.clear(screen.getByLabelText('Source'));
    await userEvent.type(screen.getByLabelText('Source'), 'Fresh data');

    expect(screen.getByText('Updated ranking')).toBeTruthy();
    expect(screen.getByText('Updated metric')).toBeTruthy();
    expect(screen.getByText('Source: Fresh data')).toBeTruthy();
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

    expect(screen.getByText('Pre-scene')).toBeTruthy();

    await userEvent.click(screen.getByText('Implicit'));

    expect(screen.getByText('De-Emphasis')).toBeTruthy();
    expect(screen.queryByText('Pre-scene')).toBeNull();
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
    expect(screen.getByText('E: Prologue')).toBeTruthy();
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
