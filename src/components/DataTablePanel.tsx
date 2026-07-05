import { useMemo, useState } from 'react';
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

export function DataTablePanel({
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

  const commitEdit = (entity: string, periodIndex: number, raw: string) => {
    setEditing(null);
    const cleaned = raw.replace(/[,\s]/g, '');
    const parsed = cleaned === '' ? null : Number(cleaned);

    if (parsed !== null && !Number.isFinite(parsed)) {
      return;
    }

    onDatasetChange(updateDatasetValue(dataset, entity, periodIndex, parsed));
  };

  const columns: ColumnsType<TableRow> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      fixed: 'left',
      width: 132,
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    ...dataset.periods.map((period, periodIndex) => ({
      title: period.label,
      key: `${period.key}:${periodIndex}`,
      width: 76,
      sorter: (a: TableRow, b: TableRow) => (a.values[periodIndex] ?? 0) - (b.values[periodIndex] ?? 0),
      render: (_: unknown, row: TableRow) => {
        const isEditing = editing?.entity === row.name && editing.periodIndex === periodIndex;
        const value = row.values[periodIndex];

        if (isEditing) {
          return (
            <Input
              aria-label={`Value for ${row.name} ${period.label}`}
              autoFocus
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
            {value !== null && value !== undefined ? value.toLocaleString('en-US') : '—'}
          </button>
        );
      },
    })),
  ];

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
                  scroll={{ x: Math.max(860, (dataset.periods.length + 1) * 82), y: 420 }}
                  size="small"
                />
              </>
            ),
          },
        ]}
        onChange={(keys) => onOpenChange((Array.isArray(keys) ? keys : [keys]).includes('data'))}
      />
    </section>
  );
}
