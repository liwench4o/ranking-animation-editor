import { forwardRef } from 'react';
import { Button, Slider, Tag, Tooltip } from 'antd';
import {
  CaretRightOutlined,
  DeleteOutlined,
  PauseOutlined,
  StepBackwardOutlined,
} from '@ant-design/icons';
import { ALL_EFFECTS } from '../foreshadowing/options';
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

export const TimelinePanel = forwardRef<HTMLElement, TimelinePanelProps>(function TimelinePanel({
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
}, ref) {
  const safeMax = Math.max(0, maxPeriodIndex);
  const formatPeriod = (index: number) => periodLabels[index] ?? String(index);

  return (
    <section ref={ref} className="timeline-panel">
      <div className="timeline-header">
        <h2 className="panel-title">Timeline</h2>
        <div className="timeline-legend">
          {ALL_EFFECTS.map((effect) => (
            <span key={effect.value} className="timeline-legend-item">
              <span aria-hidden="true" className={`timeline-legend-swatch ${effect.value}`} />
              {effect.label}
            </span>
          ))}
        </div>
      </div>
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
          <div className="timeline-playbar">
            <Slider
              ariaLabelForHandle="Timeline period"
              className="timeline-slider flat-slider"
              max={safeMax}
              min={0}
              step={1}
              tooltip={{ formatter: (value) => formatPeriod(value ?? 0) }}
              value={Math.min(currentPeriodIndex, safeMax)}
              onChange={(value) => onPeriodIndexChange(Number(value))}
            />
          </div>
          {safeMax > 0 ? (
            <div aria-hidden="true" className="timeline-ticks">
              {Array.from({ length: safeMax + 1 }, (_, index) => (
                <span
                  key={index}
                  className="timeline-tick"
                  style={{ left: `${(index / safeMax) * 100}%` }}
                />
              ))}
            </div>
          ) : null}
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
            // The band is a bare pill (effect is carried by color, per the header
            // legend), so the details live in its tooltip and accessible name.
            const description = `${targets} · ${label} · ${formatPeriod(item.start)}–${formatPeriod(item.end)}`;

            return (
              <div key={item.id} className="timeline-row">
                <Button
                  aria-label={`Remove ${targets}`}
                  icon={<DeleteOutlined />}
                  size="small"
                  type="text"
                  onClick={() => onRemoveItem(item.id)}
                />
                <Tooltip title={targets}>
                  <Tag className="timeline-brand">{targets}</Tag>
                </Tooltip>
                <div className="timeline-track">
                  <button
                    aria-label={description}
                    className={`timeline-band ${item.effect}`}
                    style={{ left: `${percentStart}%`, width: `${Math.max(2, percentWidth)}%` }}
                    title={description}
                    type="button"
                    onClick={() => onEditItem(item)}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
});

function formatEffect(effect: ForeshadowingSpec['effect']): string {
  if (effect === 'de-emphasis') {
    return 'De-emphasis';
  }

  if (effect === 'pre-scene') {
    return 'Pre-scene';
  }

  return effect.charAt(0).toUpperCase() + effect.slice(1);
}
