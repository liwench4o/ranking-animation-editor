import { memo, useCallback, useMemo, useState } from 'react';
import { Alert, Collapse, Input, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { updateDatasetValue } from '../data/dataset';
import type { Dataset } from '../types';

interface DataTablePanelProps {
  dataset: Dataset;
  error: string | null;
  open: boolean;
  onDatasetChange: (dataset: Dataset) => void;
  onOpenChange: (open: boolean) => void;
}

interface TableRow {
  key: string;
  name: string;
  values: Array<number | null>;
}

interface EditingCell {
  entity: string;
  periodIndex: number;
}

// One shared formatter: per-cell toLocaleString would build a fresh
// NumberFormat for every one of the grid's thousands of values.
const numberFormat = new Intl.NumberFormat('en-US');

const NAME_COLUMN_WIDTH = 148;
const VALUE_COLUMN_WIDTH = 88;
const TABLE_BODY_HEIGHT = 420;

// memo: the panel stays mounted once opened, and App re-renders every
// animation frame during playback — identical props must skip the table.
export const DataTablePanel = memo(function DataTablePanel({
  dataset,
  error,
  open,
  onDatasetChange,
  onOpenChange,
}: DataTablePanelProps) {
  const [editing, setEditing] = useState<EditingCell | null>(null);

  const rows = useMemo<TableRow[]>(
    () =>
      dataset.entities.map((entity) => ({
        key: entity,
        name: entity,
        values: dataset.values.get(entity) ?? [],
      })),
    [dataset],
  );

  const commitEdit = useCallback(
    (entity: string, periodIndex: number, raw: string) => {
      setEditing(null);
      const cleaned = raw.replace(/[,\s]/g, '');
      const parsed = cleaned === '' ? null : Number(cleaned);

      if (parsed !== null && !Number.isFinite(parsed)) {
        return;
      }

      onDatasetChange(updateDatasetValue(dataset, entity, periodIndex, parsed));
    },
    [dataset, onDatasetChange],
  );

  const columns = useMemo<ColumnsType<TableRow>>(
    () => [
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
        fixed: 'left',
        width: NAME_COLUMN_WIDTH,
        className: 'data-cell-name',
        sorter: (a, b) => a.name.localeCompare(b.name),
      },
      ...dataset.periods.map((period, periodIndex) => ({
        title: period.label,
        key: `${period.key}:${periodIndex}`,
        width: VALUE_COLUMN_WIDTH,
        align: 'right' as const,
        className: 'data-cell-value',
        sorter: (a: TableRow, b: TableRow) => (a.values[periodIndex] ?? 0) - (b.values[periodIndex] ?? 0),
        render: (_: unknown, row: TableRow) => {
          const isEditing = editing?.entity === row.name && editing.periodIndex === periodIndex;
          const value = row.values[periodIndex];

          if (isEditing) {
            return (
              <Input
                aria-label={`Value for ${row.name} ${period.label}`}
                autoFocus
                className="cell-edit-input"
                defaultValue={value ?? ''}
                size="small"
                onBlur={(event) => commitEdit(row.name, periodIndex, event.target.value)}
                onPressEnter={(event) => commitEdit(row.name, periodIndex, event.currentTarget.value)}
              />
            );
          }

          return (
            <button
              aria-label={`Edit ${row.name} ${period.label}`}
              className="cell-edit-button"
              type="button"
              onClick={() => setEditing({ entity: row.name, periodIndex })}
            >
              {value !== null && value !== undefined ? (
                numberFormat.format(value)
              ) : (
                <span className="cell-empty">—</span>
              )}
            </button>
          );
        },
      })),
    ],
    [commitEdit, dataset.periods, editing],
  );

  return (
    <section className="data-panel">
      <Collapse
        activeKey={open ? ['data'] : []}
        ghost
        items={[
          {
            key: 'data',
            label: (
              <div className="data-summary">
                <span className="panel-title">Data</span>
                <span className="data-summary-meta">
                  {dataset.meta.name ? `${dataset.meta.name} · ` : ''}
                  {dataset.entities.length} items × {dataset.periods.length} periods
                </span>
              </div>
            ),
            children: (
              <>
                {error ? <Alert className="data-upload-error" message={error} showIcon type="error" /> : null}
                <Table
                  columns={columns}
                  dataSource={rows}
                  pagination={false}
                  rowKey="key"
                  scroll={{
                    x: Math.max(860, NAME_COLUMN_WIDTH + dataset.periods.length * VALUE_COLUMN_WIDTH),
                    y: TABLE_BODY_HEIGHT,
                  }}
                  showSorterTooltip={false}
                  size="small"
                  virtual
                />
              </>
            ),
          },
        ]}
        onChange={(keys) => onOpenChange((Array.isArray(keys) ? keys : [keys]).includes('data'))}
      />
    </section>
  );
});
