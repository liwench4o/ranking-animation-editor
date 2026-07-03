import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfigProvider } from 'antd';
import { ChartCanvas } from './ChartCanvas';
import { ControlPanel } from './ControlPanel';
import { DataTablePanel } from './DataTablePanel';
import { TimelinePanel } from './TimelinePanel';
import {
  DEFAULT_CAPTION,
  DEFAULT_INTERPOLATION,
  DEFAULT_SUBTITLE,
  DEFAULT_TITLE,
  DURATION,
} from '../chart/constants';
import {
  computeKeyframes,
  getBrandNames,
  getEffectOptions,
  getYears,
  sampleForeshadowingItems,
} from '../data/brandData';
import type {
  BrandRecord,
  ForeshadowingEffect,
  ForeshadowingItem,
  ForeshadowingMode,
} from '../types';

interface AppProps {
  records: BrandRecord[];
}

export function App({ records }: AppProps) {
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [subtitle, setSubtitle] = useState(DEFAULT_SUBTITLE);
  const [caption, setCaption] = useState(DEFAULT_CAPTION);
  const [interpolation, setInterpolation] = useState(DEFAULT_INTERPOLATION);
  const [mode, setMode] = useState<ForeshadowingMode>('explicit');
  const [effect, setEffect] = useState<ForeshadowingEffect>('none');
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [playing, setPlaying] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(19);
  const [foreshadowingItems, setForeshadowingItems] =
    useState<ForeshadowingItem[]>(sampleForeshadowingItems);

  const brandOptions = useMemo(() => getBrandNames(records), [records]);
  const years = useMemo(() => getYears(records), [records]);
  const keyframes = useMemo(() => computeKeyframes(records, interpolation), [records, interpolation]);
  const maxFrameIndex = Math.max(0, keyframes.length - 1);
  const maxYearIndex = Math.max(0, years.length - 1);
  const currentKeyframe = keyframes[Math.min(frameIndex, maxFrameIndex)];
  const currentYearIndex = Math.min(maxYearIndex, Math.floor(Math.min(frameIndex, maxFrameIndex) / interpolation));
  const currentYear = currentKeyframe?.[0].getFullYear() ?? years[0] ?? 2000;

  useEffect(() => {
    setFrameIndex((value) => Math.min(value, maxFrameIndex));
  }, [maxFrameIndex]);

  useEffect(() => {
    setRangeEnd(maxYearIndex);
  }, [maxYearIndex]);

  useEffect(() => {
    if (!playing) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setFrameIndex((value) => Math.min(value + 1, maxFrameIndex));
    }, DURATION);

    return () => window.clearInterval(intervalId);
  }, [maxFrameIndex, playing]);

  useEffect(() => {
    if (playing && frameIndex >= maxFrameIndex) {
      setPlaying(false);
    }
  }, [frameIndex, maxFrameIndex, playing]);

  const handleModeChange = useCallback((value: ForeshadowingMode) => {
    setMode(value);
    setEffect(getEffectOptions(value)[0].value);
  }, []);

  const handleInterpolationChange = useCallback((value: number) => {
    setPlaying(false);
    setInterpolation(Math.max(1, Math.floor(value) || DEFAULT_INTERPOLATION));
    setFrameIndex(0);
  }, []);

  const handleYearIndexChange = useCallback(
    (value: number) => {
      setPlaying(false);
      setFrameIndex(Math.min(maxFrameIndex, Math.max(0, value) * interpolation));
    },
    [interpolation, maxFrameIndex],
  );

  const handleSelectName = useCallback((name: string) => {
    setSelectedNames((value) => (value.includes(name) ? value.filter((item) => item !== name) : [...value, name]));
  }, []);

  const handleAdd = useCallback(() => {
    setSelectedNames([]);
    setCaption('');
  }, []);

  return (
    <ConfigProvider
      theme={{
        token: {
          borderRadius: 6,
          colorPrimary: '#1677ff',
          colorSuccess: '#0f766e',
          fontFamily: '"Aptos", "SF Pro Text", "Segoe UI", sans-serif',
        },
      }}
    >
      <div className="app-root">
        <header className="app-header">
          <div>
            <p className="app-kicker">Ranking animation editor</p>
            <h1>Visual Foreshadowing</h1>
          </div>
          <div className="header-meta">
            <span>{brandOptions.length} brands</span>
            <span>{years.length} years</span>
          </div>
        </header>

        <main className="app-shell">
          <aside className="control-column">
            <ControlPanel
              brandOptions={brandOptions}
              caption={caption}
              effect={effect}
              interpolation={interpolation}
              mode={mode}
              rangeEnd={rangeEnd}
              rangeStart={rangeStart}
              selectedNames={selectedNames}
              subtitle={subtitle}
              title={title}
              onAdd={handleAdd}
              onCaptionChange={setCaption}
              onEffectChange={setEffect}
              onInterpolationChange={handleInterpolationChange}
              onModeChange={handleModeChange}
              onRangeEndChange={setRangeEnd}
              onRangeStartChange={setRangeStart}
              onSelectedNamesChange={setSelectedNames}
              onSubtitleChange={setSubtitle}
              onTitleChange={setTitle}
            />
          </aside>

          <section className="preview-column">
            <section className="preview-panel">
              <div className="panel-heading-row">
                <h2 className="panel-title">Preview</h2>
                <span className="preview-status">{playing ? 'Playing' : 'Paused'}</span>
              </div>
              <ChartCanvas
                caption={caption}
                currentKeyframe={currentKeyframe}
                effect={effect}
                mode={mode}
                selectedNames={selectedNames}
                subtitle={subtitle}
                title={title}
                onSelectName={handleSelectName}
              />
            </section>

            <TimelinePanel
              currentYear={currentYear}
              currentYearIndex={currentYearIndex}
              items={foreshadowingItems}
              maxYearIndex={maxYearIndex}
              playing={playing}
              onRemoveItem={(id) =>
                setForeshadowingItems((items) => items.filter((item) => item.id !== id))
              }
              onTogglePlaying={() => setPlaying((value) => !value)}
              onYearIndexChange={handleYearIndexChange}
            />
          </section>

          <aside className="data-column">
            <DataTablePanel records={records} />
          </aside>
        </main>
      </div>
    </ConfigProvider>
  );
}
