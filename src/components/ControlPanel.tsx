import { Button, Form, Input, InputNumber, Radio, Select, Space, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { getEffectOptions } from '../data/brandData';
import type { EffectOption, ForeshadowingEffect, ForeshadowingMode } from '../types';

interface ControlPanelProps {
  brandOptions: string[];
  caption: string;
  effect: ForeshadowingEffect;
  interpolation: number;
  mode: ForeshadowingMode;
  rangeEnd: number;
  rangeStart: number;
  selectedNames: string[];
  subtitle: string;
  title: string;
  onAdd: () => void;
  onCaptionChange: (value: string) => void;
  onEffectChange: (value: ForeshadowingEffect) => void;
  onInterpolationChange: (value: number) => void;
  onModeChange: (value: ForeshadowingMode) => void;
  onRangeEndChange: (value: number) => void;
  onRangeStartChange: (value: number) => void;
  onSelectedNamesChange: (value: string[]) => void;
  onSubtitleChange: (value: string) => void;
  onTitleChange: (value: string) => void;
}

export function ControlPanel({
  brandOptions,
  caption,
  effect,
  interpolation,
  mode,
  rangeEnd,
  rangeStart,
  selectedNames,
  subtitle,
  title,
  onAdd,
  onCaptionChange,
  onEffectChange,
  onInterpolationChange,
  onModeChange,
  onRangeEndChange,
  onRangeStartChange,
  onSelectedNamesChange,
  onSubtitleChange,
  onTitleChange,
}: ControlPanelProps) {
  const effectOptions = getEffectOptions(mode);

  return (
    <div className="panel-stack">
      <section className="tool-panel">
        <h2 className="panel-title">Editing</h2>
        <Form layout="vertical" size="small" requiredMark={false}>
          <Form.Item label="Select Item(s)">
            <Select
              aria-label="Select Item(s)"
              mode="multiple"
              maxTagCount="responsive"
              options={brandOptions.map((name) => ({ label: name, value: name }))}
              placeholder="Select brands"
              value={selectedNames}
              onChange={onSelectedNamesChange}
            />
          </Form.Item>

          <Form.Item label="Foreshadowing Mode">
            <Radio.Group value={mode} onChange={(event) => onModeChange(event.target.value)}>
              <Space direction="vertical" size={2}>
                <Radio value="explicit">Explicit Foreshadowing</Radio>
                <Radio value="implicit">Implicit Foreshadowing</Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

          <Form.Item label="Effect">
            <Select
              aria-label="Effect"
              options={effectOptions}
              value={effect}
              onChange={(value) => onEffectChange(value)}
            />
            <div className="effect-chip-row" aria-label="Available effects">
              {effectOptions.map((option: EffectOption) => (
                <Tag key={option.value} color={option.value === effect ? 'processing' : 'default'}>
                  {option.label}
                </Tag>
              ))}
            </div>
          </Form.Item>

          <Form.Item label="Caption">
            <Input.TextArea
              aria-label="Caption"
              autoSize={{ minRows: 3, maxRows: 5 }}
              value={caption}
              onChange={(event) => onCaptionChange(event.target.value)}
            />
          </Form.Item>

          <Form.Item label="Range">
            <Space.Compact block>
              <InputNumber
                aria-label="Range from"
                min={0}
                max={rangeEnd}
                value={rangeStart}
                onChange={(value) => onRangeStartChange(Number(value ?? 0))}
              />
              <InputNumber
                aria-label="Range to"
                min={rangeStart}
                value={rangeEnd}
                onChange={(value) => onRangeEndChange(Number(value ?? rangeStart))}
              />
            </Space.Compact>
          </Form.Item>

          <Button block icon={<PlusOutlined />} type="primary" onClick={onAdd}>
            Add
          </Button>
        </Form>
      </section>

      <section className="tool-panel">
        <h2 className="panel-title">Animation Setting</h2>
        <Form layout="vertical" size="small" requiredMark={false}>
          <Form.Item label="Title">
            <Input
              aria-label="Title"
              id="title-input"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
            />
          </Form.Item>
          <Form.Item label="Subtitle">
            <Input
              aria-label="Subtitle"
              id="subtitle-input"
              value={subtitle}
              onChange={(event) => onSubtitleChange(event.target.value)}
            />
          </Form.Item>
          <Form.Item label="Interpolation">
            <InputNumber
              aria-label="Interpolation"
              min={1}
              max={20}
              value={interpolation}
              onChange={(value) => onInterpolationChange(Number(value ?? 1))}
            />
          </Form.Item>
        </Form>
      </section>
    </div>
  );
}
