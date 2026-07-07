import { useRef, useState } from 'react';
import { Button, Progress } from 'antd';
import { CloseOutlined, FileImageOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { downloadBlob, exportGif, exportMp4 } from '../export/exportAnimation';
import type { ColorScale } from '../chart/color';
import type { ChartTheme } from '../chart/theme';
import type { Dataset, ForeshadowingSpec } from '../types';

interface ExportControlsProps {
  color: ColorScale;
  dataset: Dataset;
  periodDurationMs: number;
  rankTransitionMs: number;
  source?: string;
  specs: ForeshadowingSpec[];
  subtitle: string;
  theme: ChartTheme;
  title: string;
}

type ExportKind = 'gif' | 'mp4';

export function ExportControls({
  color,
  dataset,
  periodDurationMs,
  rankTransitionMs,
  source,
  specs,
  subtitle,
  theme,
  title,
}: ExportControlsProps) {
  const [running, setRunning] = useState<{ kind: ExportKind; percent: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runExport = async (kind: ExportKind) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setRunning({ kind, percent: 0 });

    try {
      const options = {
        dataset,
        specs,
        title,
        subtitle,
        source,
        color,
        theme,
        periodDurationMs,
        rankTransitionMs,
        signal: controller.signal,
        onProgress: (done: number, total: number) =>
          setRunning({ kind, percent: Math.round((done / total) * 100) }),
      };
      const blob = kind === 'gif' ? await exportGif(options) : await exportMp4(options);
      downloadBlob(blob, `${sanitizeFilename(title)}.${kind}`);
    } catch (thrown) {
      if (!(thrown instanceof DOMException && thrown.name === 'AbortError')) {
        setError(thrown instanceof Error ? thrown.message : String(thrown));
      }
    } finally {
      abortRef.current = null;
      setRunning(null);
    }
  };

  if (running) {
    return (
      <div className="export-controls">
        <span className="export-kind">{running.kind.toUpperCase()}</span>
        <Progress className="export-progress" percent={running.percent} size="small" status="active" />
        <Button
          aria-label="Cancel export"
          icon={<CloseOutlined />}
          size="small"
          type="text"
          onClick={() => abortRef.current?.abort()}
        />
      </div>
    );
  }

  return (
    <div className="export-controls">
      {error ? (
        <span className="export-error" title={error}>
          {error}
        </span>
      ) : null}
      <div className="export-buttons">
        <Button block size="small" icon={<FileImageOutlined />} onClick={() => runExport('gif')}>
          GIF
        </Button>
        <Button block size="small" icon={<VideoCameraOutlined />} onClick={() => runExport('mp4')}>
          MP4
        </Button>
      </div>
    </div>
  );
}

function sanitizeFilename(title: string): string {
  const cleaned = title.trim().replace(/[\\/:*?"<>|]+/g, '-');
  return cleaned || 'bar-chart-race';
}
