import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, ConfigProvider, Select, Upload } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { ChartCanvas } from './ChartCanvas';
import { ControlPanel } from './ControlPanel';
import { DataTablePanel } from './DataTablePanel';
import { ExportControls } from './ExportControls';
import { TimelinePanel } from './TimelinePanel';
import { DEFAULT_INTERPOLATION, DEFAULT_PERIOD_DURATION } from '../chart/constants';
import { createColorScale } from '../chart/color';
import { computeKeyframes, updateDatasetMeta } from '../data/dataset';
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

  const periodLabels = useMemo(() => dataset.periods.map((period) => period.label), [dataset]);
  // Keyed on the dataset id: value edits keep the same color assignments.
  const colorScale = useMemo(() => createColorScale(dataset), [dataset.id]);
  const keyframes = useMemo(() => computeKeyframes(dataset, interpolation), [dataset, interpolation]);
  const maxFrameIndex = Math.max(0, keyframes.length - 1);
  const maxPeriodIndex = Math.max(0, dataset.periods.length - 1);
  const clampedFrameIndex = Math.min(frameIndex, maxFrameIndex);
  const currentKeyframe = keyframes[clampedFrameIndex];
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

  const handleSourceChange = useCallback((value: string) => {
    setDataset((current) => updateDatasetMeta(current, { source: value || undefined }));
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

  return (
    <ConfigProvider
      theme={{
        token: {
          borderRadius: 8,
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
              <div className="panel-stack">
                <ControlPanel
                  addHint={addHint}
                  brandOptions={dataset.entities}
                  caption={caption}
                  effect={effect}
                  interpolation={interpolation}
                  maxRangeIndex={maxPeriodIndex}
                  mode={mode}
                  periodDurationSeconds={periodDuration / 1000}
                  periodLabels={periodLabels}
                  rangeEnd={rangeEnd}
                  rangeStart={rangeStart}
                  selectedNames={selectedNames}
                  source={dataset.meta.source ?? ''}
                  subtitle={subtitle}
                  title={title}
                  onAdd={handleAdd}
                  onCaptionChange={setCaption}
                  onEffectChange={setEffect}
                  onInterpolationChange={handleInterpolationChange}
                  onModeChange={handleModeChange}
                  onPeriodDurationChange={handlePeriodDurationChange}
                  onRangeChange={handleRangeChange}
                  onSelectedNamesChange={setSelectedNames}
                  onSourceChange={handleSourceChange}
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
                    title={title}
                  />
                </section>
              </div>
            </aside>

            <section className="preview-column">
              <section className="preview-panel">
                <h2 className="panel-title">Preview</h2>
                <ChartCanvas
                  colorScale={colorScale}
                  currentKeyframe={currentKeyframe}
                  effects={effects}
                  frameDuration={frameDuration}
                  selectedNames={selectedNames}
                  source={dataset.meta.source}
                  subtitle={subtitle}
                  title={title}
                  onSelectName={handleSelectName}
                />
              </section>

              <TimelinePanel
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
