import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { buildBrandRows } from '../data/brandData';
import type { BrandRecord, BrandRow } from '../types';

interface DataTablePanelProps {
  records: BrandRecord[];
}

export function DataTablePanel({ records }: DataTablePanelProps) {
  const { columns, rows } = buildBrandRows(records);
  const tableColumns: ColumnsType<BrandRow> = columns.map((column) => ({
    title: column === 'name' ? 'Name' : column,
    dataIndex: column,
    key: column,
    fixed: column === 'name' ? 'left' : undefined,
    render: (value: BrandRow[keyof BrandRow]) =>
      typeof value === 'number' ? value.toLocaleString('en-US') : value,
    sorter:
      column === 'name'
        ? (a, b) => a.name.localeCompare(b.name)
        : (a, b) => Number(a[column] ?? 0) - Number(b[column] ?? 0),
    width: column === 'name' ? 132 : 76,
  }));

  return (
    <section className="data-panel">
      <div className="panel-heading-row">
        <h2 className="panel-title">Data Input</h2>
      </div>
      <Table
        columns={tableColumns}
        dataSource={rows}
        pagination={false}
        rowKey="key"
        scroll={{ x: Math.max(860, columns.length * 82), y: 600 }}
        size="small"
      />
    </section>
  );
}
