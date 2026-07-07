import {
  Button,
  Form,
  Input,
  InputNumber,
  Segmented,
  Select,
  Slider,
  Tooltip,
} from 'antd';
import { InfoCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { COLOR_MAP_OPTIONS, type ColorMapName } from '../chart/color';
import { BASE_OPACITY } from '../chart/style';
import { getEffectOptions } from '../foreshadowing/options';
import type { ForeshadowingEffect, ForeshadowingMode } from '../types';

const EFFECT_HINTS: Record<ForeshadowingEffect, string> = {
  prologue: 'Shows a caption banner until the event occurs.',
  'pre-scene': 'Previews the value at the event as a dashed ghost bar.',
  contour: 'Outlines the selected bars until the event occurs.',
  'de-emphasis': 'Dims every other bar to spotlight the selection.',
};

interface ControlPanelProps {
  addHint?: string;
  brandOptions: string[];
  caption: string;
  colorMap: ColorMapName;
  colorMapSwatches: Record<ColorMapName, string[]>;
  effect: ForeshadowingEffect;
  interpolation: number;
  maxRangeIndex: number;
  mode: ForeshadowingMode;
  periodDurationSeconds: number;
  periodLabels: string[];
  rangeEnd: number;
  rangeStart: number;
  selectedNames: string[];
  subtitle: string;
  title: string;
  onAdd: () => void;
  onCaptionChange: (value: string) => void;
  onColorMapChange: (value: ColorMapName) => void;
  onEffectChange: (value: ForeshadowingEffect) => void;
  onInterpolationChange: (value: number) => void;
  onModeChange: (value: ForeshadowingMode) => void;
  onPeriodDurationChange: (seconds: number) => void;
  onRangeChange: (start: number, end: number) => void;
  onSelectedNamesChange: (value: string[]) => void;
  onSubtitleChange: (value: string) => void;
  onTitleChange: (value: string) => void;
}

export function ControlPanel({
  addHint,
  brandOptions,
  caption,
  colorMap,
  colorMapSwatches,
  effect,
  interpolation,
  maxRangeIndex,
  mode,
  periodDurationSeconds,
  periodLabels,
  rangeEnd,
  rangeStart,
  selectedNames,
  subtitle,
  title,
  onAdd,
  onCaptionChange,
  onColorMapChange,
  onEffectChange,
  onInterpolationChange,
  onModeChange,
  onPeriodDurationChange,
  onRangeChange,
  onSelectedNamesChange,
  onSubtitleChange,
  onTitleChange,
}: ControlPanelProps) {
  const effectOptions = getEffectOptions(mode);
  const formatPeriod = (index: number) => periodLabels[index] ?? String(index);
  const colorMapOptions = COLOR_MAP_OPTIONS.map((option) => {
    const swatches =
      colorMapSwatches[option.value] ?? option.colors.slice(0, 6);

    return {
      label: (
        <span className="color-map-option" title={option.label}>
          <span aria-hidden="true" className="color-map-swatch-list">
            {swatches.map((color, index) => (
              // Match the bars, which render at BASE_OPACITY over the chart.
              <span
                className="color-map-swatch"
                key={`${color}-${index}`}
                style={{ backgroundColor: color, opacity: BASE_OPACITY }}
              />
            ))}
          </span>
          <span className="color-map-name">{option.label}</span>
        </span>
      ),
      title: option.label,
      value: option.value,
    };
  });

  return (
    <>
      <section className="tool-panel">
        <h2 className="panel-title">Highlighting</h2>
        <Form layout="vertical" size="small" requiredMark={false}>
          <Form.Item label="Select Item(s)">
            <Select
              aria-label="Select Item(s)"
              mode="multiple"
              maxTagCount="responsive"
              options={brandOptions.map((name) => ({
                label: name,
                value: name,
              }))}
              placeholder="Select items"
              value={selectedNames}
              onChange={onSelectedNamesChange}
            />
          </Form.Item>

          <Form.Item label="Foreshadowing Mode">
            <Segmented
              block
              options={[
                { label: 'Explicit', value: 'explicit' },
                { label: 'Implicit', value: 'implicit' },
              ]}
              value={mode}
              onChange={(value) => onModeChange(value as ForeshadowingMode)}
            />
          </Form.Item>

          <Form.Item label="Effect">
            <Segmented
              block
              options={effectOptions.map((option) => ({
                label: option.label,
                value: option.value,
              }))}
              value={effect}
              onChange={(value) => onEffectChange(value as ForeshadowingEffect)}
            />
            <div className="effect-hint">{EFFECT_HINTS[effect]}</div>
          </Form.Item>

          <Form.Item label="Caption">
            <Input.TextArea
              aria-label="Caption"
              autoSize={{ minRows: 3, maxRows: 5 }}
              disabled={effect !== 'prologue'}
              placeholder={
                effect === 'prologue'
                  ? 'Text shown before the event occurs'
                  : 'Only used by the Prologue effect'
              }
              value={caption}
              onChange={(event) => onCaptionChange(event.target.value)}
            />
          </Form.Item>

          <div className="range-heading-row">
            <span className="range-heading-label">Range</span>
            <span className="range-caption" aria-label="Selected range">
              {formatPeriod(rangeStart)} → {formatPeriod(rangeEnd)}
            </span>
          </div>
          <Form.Item className="range-form-item">
            <Slider
              range
              ariaLabelForHandle={['Range start', 'Range end']}
              max={Math.max(1, maxRangeIndex)}
              min={0}
              step={1}
              tooltip={{ formatter: (value) => formatPeriod(value ?? 0) }}
              value={[rangeStart, rangeEnd]}
              onChange={(value) => onRangeChange(value[0], value[1])}
            />
          </Form.Item>

          <Tooltip title={addHint} placement="top">
            <span className="add-button-tooltip" title={addHint}>
              <Button
                block
                disabled={Boolean(addHint)}
                icon={<PlusOutlined />}
                type="primary"
                onClick={onAdd}
              >
                Add
              </Button>
            </span>
          </Tooltip>
        </Form>
      </section>

      <section className="tool-panel">
        <h2 className="panel-title">Animation Setting</h2>
        <Form
          className="compact-settings-form"
          size="small"
          requiredMark={false}
        >
          <div className="settings-row">
            <label className="settings-label" htmlFor="title-input">
              Title
            </label>
            <Input
              aria-label="Title"
              id="title-input"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
            />
          </div>
          <div className="settings-row">
            <label className="settings-label" htmlFor="subtitle-input">
              Subtitle
            </label>
            <Input
              aria-label="Subtitle"
              id="subtitle-input"
              value={subtitle}
              onChange={(event) => onSubtitleChange(event.target.value)}
            />
          </div>
          <div className="settings-row">
            <label className="settings-label" htmlFor="color-map-select">
              Color map
            </label>
            <Select
              aria-label="Color map"
              id="color-map-select"
              options={colorMapOptions}
              value={colorMap}
              onChange={(value) => onColorMapChange(value)}
            />
          </div>
          <div className="settings-row">
            <span className="settings-label">
              Smoothness
              <Tooltip title="Interpolated frames per period - higher is smoother.">
                <InfoCircleOutlined className="settings-help-icon" />
              </Tooltip>
            </span>
            <div className="settings-control">
              <Slider
                ariaLabelForHandle="Smoothness"
                marks={{ 1: '1', 10: '10', 20: '20' }}
                max={20}
                min={1}
                step={1}
                value={interpolation}
                onChange={(value) => onInterpolationChange(Number(value))}
              />
            </div>
          </div>
          <div className="settings-row">
            <label className="settings-label" htmlFor="period-duration-input">
              Seconds per period
            </label>
            <InputNumber
              aria-label="Seconds per period"
              className="settings-number-input"
              id="period-duration-input"
              min={0.2}
              max={10}
              step={0.1}
              value={periodDurationSeconds}
              onChange={(value) =>
                onPeriodDurationChange(Number(value ?? 1.25))
              }
            />
          </div>
        </Form>
      </section>
    </>
  );
}
