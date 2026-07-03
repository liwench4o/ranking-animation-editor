import { Button, Progress, Slider, Tag } from 'antd';
import { DeleteOutlined, PauseCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';
import type { ForeshadowingItem } from '../types';

interface TimelinePanelProps {
  currentYear: number;
  currentYearIndex: number;
  items: ForeshadowingItem[];
  maxYearIndex: number;
  playing: boolean;
  onRemoveItem: (id: string) => void;
  onTogglePlaying: () => void;
  onYearIndexChange: (value: number) => void;
}

export function TimelinePanel({
  currentYear,
  currentYearIndex,
  items,
  maxYearIndex,
  playing,
  onRemoveItem,
  onTogglePlaying,
  onYearIndexChange,
}: TimelinePanelProps) {
  const safeMax = Math.max(0, maxYearIndex);

  return (
    <section className="timeline-panel">
      <div className="panel-heading-row">
        <h2 className="panel-title">Timeline</h2>
        <Tag aria-label="Current year" color="blue">
          {currentYear}
        </Tag>
      </div>
      <div className="timeline-controls">
        <Button
          aria-label={playing ? 'Pause animation' : 'Play animation'}
          icon={playing ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
          shape="circle"
          type="primary"
          onClick={onTogglePlaying}
        />
        <Slider
          ariaLabelForHandle="Timeline year"
          className="timeline-slider"
          max={safeMax}
          min={0}
          step={1}
          tooltip={{ formatter: (value) => (value ?? 0) + 2000 }}
          value={Math.min(currentYearIndex, safeMax)}
          onChange={(value) => onYearIndexChange(Number(value))}
        />
      </div>
      <div className="timeline-items">
        {items.map((item) => {
          const percentStart = safeMax > 0 ? (item.start / safeMax) * 100 : 0;
          const percentWidth = safeMax > 0 ? ((item.end - item.start) / safeMax) * 100 : 0;
          const label = `${item.mode === 'explicit' ? 'E' : 'I'}: ${formatEffect(item.effect)}`;

          return (
            <div key={item.id} className="timeline-row">
              <Button
                aria-label={`Remove ${item.brand}`}
                icon={<DeleteOutlined />}
                size="small"
                type="text"
                onClick={() => onRemoveItem(item.id)}
              />
              <Tag className="timeline-brand">{item.brand}</Tag>
              <div className="timeline-progress">
                <Progress
                  percent={Math.max(1, percentWidth)}
                  showInfo
                  size={['100%', 13]}
                  strokeColor={item.mode === 'explicit' ? '#1677ff' : '#0f766e'}
                  success={{ percent: percentStart, strokeColor: 'transparent' }}
                  format={() => label}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function formatEffect(effect: ForeshadowingItem['effect']): string {
  if (effect === 'de-emphasis') {
    return 'De-emphasis';
  }

  if (effect === 'pre-scene') {
    return 'Pre-scene';
  }

  return effect.charAt(0).toUpperCase() + effect.slice(1);
}
