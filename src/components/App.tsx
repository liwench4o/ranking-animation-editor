import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Button, ConfigProvider, Segmented, Select, Upload } from 'antd';
import { MoonOutlined, SunOutlined, UploadOutlined } from '@ant-design/icons';
import { ChartCanvas } from './ChartCanvas';
import { ControlPanel } from './ControlPanel';
import { DataTablePanel } from './DataTablePanel';
import { ExportControls } from './ExportControls';
import { TimelinePanel } from './TimelinePanel';
import { computeBalancedPreviewHeight } from './previewLayout';
import { DEFAULT_INTERPOLATION, DEFAULT_PERIOD_DURATION } from '../chart/constants';
import {
  COLOR_MAP_OPTIONS,
  DEFAULT_COLOR_MAP,
  createColorScale,
  swatchColorsFor,
  visibleColorKeys,
  type ColorMapName,
} from '../chart/color';
import { DEFAULT_CHART_THEME, getChartTheme, type ChartThemeName } from '../chart/theme';
import { computeKeyframes } from '../data/dataset';
import { parseDatasetFile } from '../data/parseTimeSeries';
import { getEffectOptions } from '../foreshadowing/options';
import { resolveEffects } from '../foreshadowing/resolve';
import type {
  Dataset,
  ForeshadowingEffect,
  ForeshadowingMode,
  ForeshadowingSpec,
} from '../types';

interface AppProps {
  initialDataset: Dataset;
  datasetPresets?: DatasetPreset[];
}

export interface DatasetPreset {
  key: string;
  label: string;
  dataset: Dataset;
}

const DEFAULT_DATASET_KEY = 'default-dataset';
const DESKTOP_LAYOUT_QUERY = '(min-width: 1025px)';

export function App({ initialDataset, datasetPresets = [] }: AppProps) {
  const availableDatasetPresets = useMemo<DatasetPreset[]>(() => {
    if (datasetPresets.length > 0) {
      return datasetPresets;
    }

    return [
      {
        key: DEFAULT_DATASET_KEY,
        label: initialDataset.meta.fileName ?? initialDataset.meta.name ?? 'Default dataset',
        dataset: initialDataset,
      },
    ];
  }, [datasetPresets, initialDataset]);

  const [dataset, setDataset] = useState(initialDataset);
  const [activeDatasetKey, setActiveDatasetKey] = useState(
    availableDatasetPresets[0]?.key ?? DEFAULT_DATASET_KEY,
  );
  const [title, setTitle] = useState(initialDataset.meta.name ?? 'Ranking over time');
  const [subtitle, setSubtitle] = useState(initialDataset.meta.valueLabel ?? '');
  const [caption, setCaption] = useState('');
  const [interpolation, setInterpolation] = useState(DEFAULT_INTERPOLATION);
  const [periodDuration, setPeriodDuration] = useState(DEFAULT_PERIOD_DURATION);
  const [colorMap, setColorMap] = useState<ColorMapName>(DEFAULT_COLOR_MAP);
  const [chartThemeName, setChartThemeName] = useState<ChartThemeName>(DEFAULT_CHART_THEME);
  const [mode, setMode] = useState<ForeshadowingMode>('explicit');
  const [effect, setEffect] = useState<ForeshadowingEffect>('prologue');
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [playing, setPlaying] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(0);
  const [foreshadowingSpecs, setForeshadowingSpecs] = useState<ForeshadowingSpec[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dataPanelOpen, setDataPanelOpen] = useState(false);
  const [balancedPreviewHeight, setBalancedPreviewHeight] = useState<number | null>(null);
  const panelStackRef = useRef<HTMLDivElement>(null);
  const previewColumnRef = useRef<HTMLElement>(null);
  const timelinePanelRef = useRef<HTMLElement>(null);

  const periodLabels = useMemo(() => dataset.periods.map((period) => period.label), [dataset]);
  // Keyed on the dataset id: value edits keep the same color assignments.
  const colorScale = useMemo(() => createColorScale(dataset, colorMap), [colorMap, dataset.id]);
  const chartTheme = useMemo(() => getChartTheme(chartThemeName), [chartThemeName]);
  const keyframes = useMemo(() => computeKeyframes(dataset, interpolation), [dataset, interpolation]);
  const maxFrameIndex = Math.max(0, keyframes.length - 1);
  const maxPeriodIndex = Math.max(0, dataset.periods.length - 1);
  const clampedFrameIndex = Math.min(frameIndex, maxFrameIndex);
  const currentKeyframe = keyframes[clampedFrameIndex];
  // Preview each palette with the colors it assigns to the bars on screen, so
  // the dropdown swatches track the canvas instead of the palette's raw order.
  const colorMapSwatches = useMemo(() => {
    const keys = visibleColorKeys(currentKeyframe?.data);

    return Object.fromEntries(
      COLOR_MAP_OPTIONS.map((option) => [option.value, swatchColorsFor(dataset, option.value, keys)]),
    ) as Record<ColorMapName, string[]>;
  }, [currentKeyframe, dataset]);
  const frameTime = clampedFrameIndex / interpolation;
  const frameDuration = Math.max(16, periodDuration / interpolation);
  const currentPeriodIndex = Math.min(maxPeriodIndex, Math.floor(frameTime));
  const datasetSelectOptions = useMemo(() => {
    const options = availableDatasetPresets.map((preset) => ({ label: preset.label, value: preset.key }));

    if (!options.some((option) => option.value === activeDatasetKey)) {
      options.push({
        label: dataset.meta.fileName ?? dataset.meta.name ?? 'Uploaded dataset',
        value: activeDatasetKey,
      });
    }

    return options;
  }, [activeDatasetKey, availableDatasetPresets, dataset.meta.fileName, dataset.meta.name]);

  const effects = useMemo(
    () => resolveEffects(foreshadowingSpecs, frameTime, keyframes, interpolation),
    [foreshadowingSpecs, frameTime, interpolation, keyframes],
  );

  const addHint = useMemo(() => {
    if (selectedNames.length === 0) {
      return 'Select at least one item first.';
    }

    if (rangeEnd <= rangeStart) {
      return 'The range must end after it starts.';
    }

    if (effect === 'prologue' && caption.trim().length === 0) {
      return 'Prologue needs a caption.';
    }

    return undefined;
  }, [caption, effect, rangeEnd, rangeStart, selectedNames]);

  useEffect(() => {
    setFrameIndex((value) => Math.min(value, maxFrameIndex));
  }, [maxFrameIndex]);

  useEffect(() => {
    setRangeStart((value) => Math.min(value, maxPeriodIndex));
    setRangeEnd(maxPeriodIndex);
  }, [maxPeriodIndex]);

  // Single clock: frames advance from accumulated real time, so a missed
  // animation frame catches up instead of drifting like setInterval would.
  useEffect(() => {
    if (!playing) {
      return undefined;
    }

    let rafId = 0;
    let last = performance.now();
    let accumulated = 0;

    const tick = (now: number) => {
      accumulated += now - last;
      last = now;

      if (accumulated >= frameDuration) {
        const steps = Math.floor(accumulated / frameDuration);
        accumulated -= steps * frameDuration;
        setFrameIndex((value) => Math.min(value + steps, maxFrameIndex));
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(rafId);
  }, [frameDuration, maxFrameIndex, playing]);

  useEffect(() => {
    if (playing && frameIndex >= maxFrameIndex) {
      setPlaying(false);
    }
  }, [frameIndex, maxFrameIndex, playing]);

  useLayoutEffect(() => {
    const panelStack = panelStackRef.current;
    const previewColumn = previewColumnRef.current;
    const timelinePanel = timelinePanelRef.current;

    if (!panelStack || !previewColumn || !timelinePanel) {
      return undefined;
    }

    let frameId = 0;
    const mediaQuery = window.matchMedia(DESKTOP_LAYOUT_QUERY);

    const readGap = () => {
      const styles = window.getComputedStyle(previewColumn);
      const rawGap = styles.rowGap === 'normal' ? styles.gap : styles.rowGap;
      const parsed = Number.parseFloat(rawGap);

      return Number.isFinite(parsed) ? parsed : 0;
    };

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        if (!mediaQuery.matches) {
          setBalancedPreviewHeight(null);
          return;
        }

        const nextHeight = computeBalancedPreviewHeight({
          gap: readGap(),
          leftColumnHeight: panelStack.getBoundingClientRect().height,
          timelineHeight: timelinePanel.getBoundingClientRect().height,
        });

        setBalancedPreviewHeight((currentHeight) =>
          currentHeight !== null && Math.abs(currentHeight - nextHeight) < 0.5 ? currentHeight : nextHeight,
        );
      });
    };

    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleUpdate);
    resizeObserver?.observe(panelStack);
    resizeObserver?.observe(timelinePanel);

    window.addEventListener('resize', scheduleUpdate);
    mediaQuery.addEventListener('change', scheduleUpdate);
    scheduleUpdate();

    return () => {
      window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', scheduleUpdate);
      mediaQuery.removeEventListener('change', scheduleUpdate);
    };
  }, []);

  const handleModeChange = useCallback((value: ForeshadowingMode) => {
    setMode(value);
    setEffect(getEffectOptions(value)[0].value);
  }, []);

  const handleInterpolationChange = useCallback((value: number) => {
    setPlaying(false);
    setInterpolation(Math.max(1, Math.floor(value) || DEFAULT_INTERPOLATION));
    setFrameIndex(0);
  }, []);

  const handlePeriodDurationChange = useCallback((seconds: number) => {
    const clamped = Math.min(10, Math.max(0.2, seconds || DEFAULT_PERIOD_DURATION / 1000));
    setPeriodDuration(Math.round(clamped * 1000));
  }, []);

  const handlePeriodIndexChange = useCallback(
    (value: number) => {
      setPlaying(false);
      setFrameIndex(Math.min(maxFrameIndex, Math.max(0, value) * interpolation));
    },
    [interpolation, maxFrameIndex],
  );

  const handleRestart = useCallback(() => {
    setPlaying(false);
    setFrameIndex(0);
  }, []);

  const handleRangeChange = useCallback((start: number, end: number) => {
    setRangeStart(start);
    setRangeEnd(end);
  }, []);

  const handleSelectName = useCallback((name: string) => {
    setSelectedNames((value) => (value.includes(name) ? value.filter((item) => item !== name) : [...value, name]));
  }, []);

  const handleAdd = useCallback(() => {
    if (addHint) {
      return;
    }

    setForeshadowingSpecs((specs) => [
      ...specs,
      {
        id: crypto.randomUUID(),
        targets: [...selectedNames],
        mode,
        effect,
        caption: caption.trim() || undefined,
        start: rangeStart,
        end: rangeEnd,
      },
    ]);
    setSelectedNames([]);
    setCaption('');
  }, [addHint, caption, effect, mode, rangeEnd, rangeStart, selectedNames]);

  const handleEditSpec = useCallback((spec: ForeshadowingSpec) => {
    setSelectedNames([...spec.targets]);
    setMode(spec.mode);
    setEffect(spec.effect);
    setCaption(spec.caption ?? '');
    setRangeStart(spec.start);
    setRangeEnd(spec.end);
  }, []);

  const handleDatasetChange = useCallback(
    (next: Dataset) => {
      setDataset(next);

      // Value edits keep the dataset id; only a genuinely new dataset (upload)
      // resets the animation and the authored foreshadowing.
      if (next.id === dataset.id) {
        return;
      }

      setPlaying(false);
      setFrameIndex(0);
      setForeshadowingSpecs([]);
      setSelectedNames([]);
      setCaption('');
      setRangeStart(0);
      setRangeEnd(Math.max(0, next.periods.length - 1));

      if (next.meta.name) {
        setTitle(next.meta.name);
      }

      setSubtitle(next.meta.valueLabel ?? '');
    },
    [dataset.id],
  );

  const handleDatasetPresetChange = useCallback(
    (key: string) => {
      const preset = availableDatasetPresets.find((item) => item.key === key);

      if (!preset) {
        return;
      }

      setActiveDatasetKey(key);
      handleDatasetChange(preset.dataset);
    },
    [availableDatasetPresets, handleDatasetChange],
  );

  const handleUploadFile = useCallback(
    async (file: File) => {
      const result = await parseDatasetFile(file);

      if (result.ok) {
        setUploadError(null);
        setActiveDatasetKey(`upload:${file.name}:${file.lastModified}`);
        handleDatasetChange(result.dataset);
      } else {
        setUploadError(result.error);
        // Surface the error where it is shown: inside the data panel.
        setDataPanelOpen(true);
      }
    },
    [handleDatasetChange],
  );
  const previewPanelStyle = useMemo(
    () =>
      balancedPreviewHeight === null
        ? undefined
        : ({
            '--balanced-preview-height': `${balancedPreviewHeight}px`,
          } as CSSProperties),
    [balancedPreviewHeight],
  );

  return (
    <ConfigProvider
      theme={{
        token: {
          borderRadius: 8,
          colorPrimary: '#1677ff',
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
            <span className="header-count">{dataset.entities.length} items</span>
            <span className="header-count">{dataset.periods.length} periods</span>
            <Select
              aria-label="Dataset"
              className="header-dataset"
              options={datasetSelectOptions}
              popupMatchSelectWidth={false}
              size="small"
              value={activeDatasetKey}
              onChange={handleDatasetPresetChange}
            />
            <Upload
              accept=".csv,.tsv,text/csv,text/tab-separated-values"
              className="header-upload"
              maxCount={1}
              showUploadList={false}
              beforeUpload={(file) => {
                void handleUploadFile(file);
                return Upload.LIST_IGNORE;
              }}
            >
              <Button icon={<UploadOutlined />} size="small" type="primary">
                Upload CSV
              </Button>
            </Upload>
          </div>
        </header>

        <main className="app-main">
          <div className="app-shell">
            <aside className="control-column">
              <div ref={panelStackRef} className="panel-stack">
                <ControlPanel
                  addHint={addHint}
                  brandOptions={dataset.entities}
                  caption={caption}
                  colorMap={colorMap}
                  colorMapSwatches={colorMapSwatches}
                  effect={effect}
                  interpolation={interpolation}
                  maxRangeIndex={maxPeriodIndex}
                  mode={mode}
                  periodDurationSeconds={periodDuration / 1000}
                  periodLabels={periodLabels}
                  rangeEnd={rangeEnd}
                  rangeStart={rangeStart}
                  selectedNames={selectedNames}
                  subtitle={subtitle}
                  title={title}
                  onAdd={handleAdd}
                  onCaptionChange={setCaption}
                  onColorMapChange={setColorMap}
                  onEffectChange={setEffect}
                  onInterpolationChange={handleInterpolationChange}
                  onModeChange={handleModeChange}
                  onPeriodDurationChange={handlePeriodDurationChange}
                  onRangeChange={handleRangeChange}
                  onSelectedNamesChange={setSelectedNames}
                  onSubtitleChange={setSubtitle}
                  onTitleChange={setTitle}
                />
                <section className="tool-panel export-panel">
                  <h2 className="panel-title">Export</h2>
                  <ExportControls
                    color={colorScale}
                    dataset={dataset}
                    periodDurationMs={periodDuration}
                    rankTransitionMs={frameDuration}
                    source={dataset.meta.source}
                    specs={foreshadowingSpecs}
                    subtitle={subtitle}
                    theme={chartTheme}
                    title={title}
                  />
                </section>
              </div>
            </aside>

            <section ref={previewColumnRef} className="preview-column">
              <section
                className={`preview-panel${chartThemeName === 'dark' ? ' is-dark' : ''}`}
                style={previewPanelStyle}
              >
                <div className="preview-header">
                  <h2 className="panel-title">Preview</h2>
                  <Segmented
                    aria-label="Preview theme"
                    size="small"
                    value={chartThemeName}
                    options={[
                      { label: 'Light', value: 'light', icon: <SunOutlined /> },
                      { label: 'Dark', value: 'dark', icon: <MoonOutlined /> },
                    ]}
                    onChange={(value) => setChartThemeName(value as ChartThemeName)}
                  />
                </div>
                <ChartCanvas
                  colorScale={colorScale}
                  currentKeyframe={currentKeyframe}
                  effects={effects}
                  frameDuration={frameDuration}
                  selectedNames={selectedNames}
                  source={dataset.meta.source}
                  subtitle={subtitle}
                  theme={chartTheme}
                  title={title}
                  onSelectName={handleSelectName}
                />
              </section>

              <TimelinePanel
                ref={timelinePanelRef}
                currentPeriodIndex={currentPeriodIndex}
                items={foreshadowingSpecs}
                maxPeriodIndex={maxPeriodIndex}
                periodLabels={periodLabels}
                playing={playing}
                onEditItem={handleEditSpec}
                onPeriodIndexChange={handlePeriodIndexChange}
                onRemoveItem={(id) =>
                  setForeshadowingSpecs((specs) => specs.filter((spec) => spec.id !== id))
                }
                onRestart={handleRestart}
                onTogglePlaying={() => setPlaying((value) => !value)}
              />
            </section>
          </div>

          <section className="data-shell">
            <DataTablePanel
              dataset={dataset}
              error={uploadError}
              open={dataPanelOpen}
              onDatasetChange={handleDatasetChange}
              onOpenChange={setDataPanelOpen}
            />
          </section>
        </main>
      </div>
    </ConfigProvider>
  );
}
