import { Button, Slider, Tag } from 'antd';
import {
  CaretRightOutlined,
  DeleteOutlined,
  PauseOutlined,
  StepBackwardOutlined,
} from '@ant-design/icons';
import type { ForeshadowingSpec } from '../types';

interface TimelinePanelProps {
  currentPeriodIndex: number;
  items: ForeshadowingSpec[];
  maxPeriodIndex: number;
  periodLabels: string[];
  playing: boolean;
  onEditItem: (item: ForeshadowingSpec) => void;
  onPeriodIndexChange: (value: number) => void;
  onRemoveItem: (id: string) => void;
  onRestart: () => void;
  onTogglePlaying: () => void;
}

export function TimelinePanel({
  currentPeriodIndex,
  items,
  maxPeriodIndex,
  periodLabels,
  playing,
  onEditItem,
  onPeriodIndexChange,
  onRemoveItem,
  onRestart,
  onTogglePlaying,
}: TimelinePanelProps) {
  const safeMax = Math.max(0, maxPeriodIndex);
  const formatPeriod = (index: number) => periodLabels[index] ?? String(index);

  return (
    <section className="timeline-panel">
      <h2 className="panel-title">Timeline</h2>
      <div className="timeline-controls">
        <div className="transport-buttons">
          <Button
            aria-label="Restart animation"
            icon={<StepBackwardOutlined />}
            shape="circle"
            onClick={onRestart}
          />
          <Button
            aria-label={playing ? 'Pause animation' : 'Play animation'}
            icon={playing ? <PauseOutlined /> : <CaretRightOutlined />}
            shape="circle"
            type="primary"
            onClick={onTogglePlaying}
          />
        </div>
        <div className="timeline-slider-block">
          <Slider
            ariaLabelForHandle="Timeline period"
            className="timeline-slider"
            max={safeMax}
            min={0}
            step={1}
            tooltip={{ formatter: (value) => formatPeriod(value ?? 0) }}
            value={Math.min(currentPeriodIndex, safeMax)}
            onChange={(value) => onPeriodIndexChange(Number(value))}
          />
          <div aria-hidden="true" className="timeline-scale">
            <span>{formatPeriod(0)}</span>
            <span>{formatPeriod(safeMax)}</span>
          </div>
        </div>
      </div>
      <div className="timeline-items">
        {items.length === 0 ? (
          <p className="timeline-empty">No foreshadowing yet — select item(s) and press Add.</p>
        ) : (
          items.map((item) => {
            const percentStart = safeMax > 0 ? (item.start / safeMax) * 100 : 0;
            const percentWidth = safeMax > 0 ? ((item.end - item.start) / safeMax) * 100 : 100;
            const label = `${item.mode === 'explicit' ? 'E' : 'I'}: ${formatEffect(item.effect)}`;
            const targets = item.targets.join(', ');

            return (
              <div key={item.id} className="timeline-row">
                <Button
                  aria-label={`Remove ${targets}`}
                  icon={<DeleteOutlined />}
                  size="small"
                  type="text"
                  onClick={() => onRemoveItem(item.id)}
                />
                <Tag className="timeline-brand" title={targets}>
                  {targets}
                </Tag>
                <div className="timeline-track">
                  <button
                    className={`timeline-band ${item.mode}`}
                    style={{ left: `${percentStart}%`, width: `${Math.max(2, percentWidth)}%` }}
                    title={`${targets} · ${label} · ${formatPeriod(item.start)}–${formatPeriod(item.end)}`}
                    type="button"
                    onClick={() => onEditItem(item)}
                  >
                    {label}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function formatEffect(effect: ForeshadowingSpec['effect']): string {
  if (effect === 'de-emphasis') {
    return 'De-emphasis';
  }

  if (effect === 'pre-scene') {
    return 'Pre-scene';
  }

  return effect.charAt(0).toUpperCase() + effect.slice(1);
}
