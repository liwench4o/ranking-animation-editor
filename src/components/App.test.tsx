import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import type { BrandRecord } from '../types';

const records: BrandRecord[] = [
  { date: '2000/1/1', name: 'Alpha', category: 'Tech', value: 10 },
  { date: '2000/1/1', name: 'Beta', category: 'Auto', value: 30 },
  { date: '2001/1/1', name: 'Alpha', category: 'Tech', value: 20 },
  { date: '2001/1/1', name: 'Beta', category: 'Auto', value: 10 },
];

describe('App', () => {
  it('renders the editor, chart, timeline, and data table', () => {
    render(<App records={records} />);

    expect(screen.getByRole('heading', { name: 'Visual Foreshadowing' })).toBeTruthy();
    expect(screen.getByText('Editing')).toBeTruthy();
    expect(screen.getByText('Preview')).toBeTruthy();
    expect(screen.getByText('Timeline')).toBeTruthy();
    expect(screen.getByText('Data Input')).toBeTruthy();
    expect(screen.getAllByRole('table').length).toBeGreaterThan(0);
  });

  it('updates the visible chart title and subtitle from controls', async () => {
    render(<App records={records} />);

    await userEvent.clear(screen.getByLabelText('Title'));
    await userEvent.type(screen.getByLabelText('Title'), 'Updated ranking');
    await userEvent.clear(screen.getByLabelText('Subtitle'));
    await userEvent.type(screen.getByLabelText('Subtitle'), 'Updated metric');

    expect(screen.getByText('Updated ranking')).toBeTruthy();
    expect(screen.getByText('Updated metric')).toBeTruthy();
  });

  it('toggles playback and changes the selected year from the timeline slider', () => {
    render(<App records={records} />);

    const playButton = screen.getByRole('button', { name: 'Play animation' });
    fireEvent.click(playButton);
    expect(screen.getByRole('button', { name: 'Pause animation' })).toBeTruthy();

    const slider = screen.getByRole('slider', { name: 'Timeline year' });
    fireEvent.keyDown(slider, { code: 'ArrowRight', key: 'ArrowRight', keyCode: 39, which: 39 });

    expect(screen.getByLabelText('Current year').textContent).toBe('2001');
  });

  it('updates effect options when foreshadowing mode changes', async () => {
    render(<App records={records} />);

    expect(screen.getByText('Pre-scene')).toBeTruthy();

    await userEvent.click(screen.getByLabelText('Implicit Foreshadowing'));

    expect(screen.getByText('De-Emphasis')).toBeTruthy();
    expect(screen.queryByText('Pre-scene')).toBeNull();
  });
});
