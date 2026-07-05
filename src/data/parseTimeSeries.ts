import * as d3 from 'd3';
import type { Dataset, DatasetMeta, Period } from '../types';

export type ParseResult = { ok: true; dataset: Dataset } | { ok: false; error: string };

const DATE_ALIASES = /^(date|year|time|period|week|month|day|quarter|日期|年份|年|时间|周期|季度)$/i;
const NAME_ALIASES = /^(name|item|entity|brand|label|player|song|country|名称|名字|姓名|项目|品牌|国家)$/i;
const VALUE_ALIASES = /^(value|amount|score|count|total|streams|sales|数值|值|金额|分数|数量|销量)$/i;
const CATEGORY_ALIASES = /^(category|group|type|class|genre|artist|类别|分组|类型|歌手)$/i;

export function datasetFromDelimitedText(text: string, meta: DatasetMeta = {}): ParseResult {
  const trimmed = text.replace(/^\uFEFF/, '').trim();

  if (!trimmed) {
    return { ok: false, error: 'The file is empty.' };
  }

  const delimiter = detectDelimiter(trimmed);
  const rows = d3.dsvFormat(delimiter).parse(trimmed);

  if (!rows.columns || rows.columns.length < 2 || rows.length === 0) {
    return { ok: false, error: 'Expected a header row plus at least one data row.' };
  }

  return datasetFromRows(rows, rows.columns, meta);
}

export async function parseDatasetFile(file: File): Promise<ParseResult> {
  const text = await file.text();
  return datasetFromDelimitedText(text, { fileName: file.name, name: file.name.replace(/\.[^.]+$/, '') });
}

export function datasetFromRows(
  rows: Array<Record<string, unknown>>,
  columns: string[],
  meta: DatasetMeta = {},
): ParseResult {
  const dateColumn = columns.find((column) => DATE_ALIASES.test(column.trim()));
  const nameColumn = columns.find((column) => NAME_ALIASES.test(column.trim()));
  const valueColumn = columns.find((column) => VALUE_ALIASES.test(column.trim()));
  const categoryColumn = columns.find((column) => CATEGORY_ALIASES.test(column.trim()));

  if (dateColumn && nameColumn && valueColumn) {
    return buildLongDataset(rows, { dateColumn, nameColumn, valueColumn, categoryColumn }, meta);
  }

  return buildWideDataset(rows, columns, categoryColumn, meta);
}

interface LongColumns {
  dateColumn: string;
  nameColumn: string;
  valueColumn: string;
  categoryColumn?: string;
}

function buildLongDataset(
  rows: Array<Record<string, unknown>>,
  { dateColumn, nameColumn, valueColumn, categoryColumn }: LongColumns,
  meta: DatasetMeta,
): ParseResult {
  const periodKeys: string[] = [];
  const seenPeriods = new Set<string>();
  const categoryOf = new Map<string, string | undefined>();
  const cells: Array<{ period: string; name: string; value: number | null }> = [];

  for (const row of rows) {
    const name = toText(row[nameColumn]);
    const period = toText(row[dateColumn]);

    if (!name || !period) {
      continue;
    }

    if (!seenPeriods.has(period)) {
      seenPeriods.add(period);
      periodKeys.push(period);
    }

    if (!categoryOf.has(name)) {
      const category = categoryColumn ? toText(row[categoryColumn]) : '';
      categoryOf.set(name, category || undefined);
    }

    cells.push({ period, name, value: toNumber(row[valueColumn]) });
  }

  if (cells.length === 0) {
    return { ok: false, error: 'No usable rows found — every row needs a period and an item name.' };
  }

  const periods = orderPeriods(periodKeys);
  const periodIndex = new Map(periods.map((period, index) => [period.key, index]));
  const entities = Array.from(new Set(cells.map((cell) => cell.name))).sort((a, b) => a.localeCompare(b));
  const values = new Map(entities.map((entity) => [entity, new Array<number | null>(periods.length).fill(null)]));

  for (const cell of cells) {
    const series = values.get(cell.name);
    const index = periodIndex.get(cell.period);

    if (series && index !== undefined) {
      series[index] = cell.value;
    }
  }

  return { ok: true, dataset: makeDataset(entities, periods, values, categoryOf, meta) };
}

function buildWideDataset(
  rows: Array<Record<string, unknown>>,
  columns: string[],
  categoryColumn: string | undefined,
  meta: DatasetMeta,
): ParseResult {
  const [nameColumn, ...rest] = columns;
  const periodColumns = rest.filter((column) => column !== categoryColumn);

  if (periodColumns.length < 2) {
    return {
      ok: false,
      error:
        'Unrecognized format. Use long format (date, name, value[, category]) or wide format (name in the first column, one column per period).',
    };
  }

  let numericCells = 0;
  let filledCells = 0;

  for (const row of rows) {
    for (const column of periodColumns) {
      const raw = toText(row[column]);

      if (raw === '') {
        continue;
      }

      filledCells += 1;

      if (toNumber(row[column]) !== null) {
        numericCells += 1;
      }
    }
  }

  if (filledCells === 0 || numericCells / filledCells < 0.6) {
    return {
      ok: false,
      error: 'The period columns are not numeric — expected one numeric column per period after the item name.',
    };
  }

  const entities: string[] = [];
  const categoryOf = new Map<string, string | undefined>();
  const values = new Map<string, Array<number | null>>();

  for (const row of rows) {
    const name = toText(row[nameColumn]);

    if (!name || values.has(name)) {
      continue;
    }

    entities.push(name);
    const category = categoryColumn ? toText(row[categoryColumn]) : '';
    categoryOf.set(name, category || undefined);
    values.set(
      name,
      periodColumns.map((column) => toNumber(row[column])),
    );
  }

  if (entities.length === 0) {
    return { ok: false, error: 'No usable rows found — every row needs an item name in the first column.' };
  }

  entities.sort((a, b) => a.localeCompare(b));
  // Wide-format columns keep their file order: the author already ordered them.
  const periods = periodColumns.map((column) => ({ key: column, label: column.trim() }));

  return { ok: true, dataset: makeDataset(entities, periods, values, categoryOf, meta) };
}

function makeDataset(
  entities: string[],
  periods: Period[],
  values: Map<string, Array<number | null>>,
  categoryOf: Map<string, string | undefined>,
  meta: DatasetMeta,
): Dataset {
  return { id: crypto.randomUUID(), entities, periods, values, categoryOf, meta };
}

function orderPeriods(keys: string[]): Period[] {
  const numeric = keys.every((key) => key !== '' && !Number.isNaN(Number(key)));

  if (numeric) {
    return keys
      .slice()
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => ({ key, label: key }));
  }

  const timestamps = keys.map((key) => Date.parse(key));

  if (timestamps.every((timestamp) => !Number.isNaN(timestamp))) {
    const sorted = keys
      .map((key, index) => ({ key, timestamp: timestamps[index] }))
      .sort((a, b) => a.timestamp - b.timestamp);
    const labels = formatDateLabels(sorted.map((entry) => entry.timestamp));
    return sorted.map((entry, index) => ({ key: entry.key, label: labels[index] }));
  }

  // Not sortable as numbers or dates: trust the order of first appearance.
  return keys.map((key) => ({ key, label: key }));
}

function formatDateLabels(timestamps: number[]): string[] {
  const dates = timestamps.map((timestamp) => new Date(timestamp));
  const pad = (part: number) => String(part).padStart(2, '0');

  if (dates.every((date) => date.getMonth() === 0 && date.getDate() === 1)) {
    return dates.map((date) => String(date.getFullYear()));
  }

  if (dates.every((date) => date.getDate() === 1)) {
    return dates.map((date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`);
  }

  return dates.map((date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`);
}

function detectDelimiter(text: string): string {
  const firstLine = text.slice(0, text.indexOf('\n') === -1 ? text.length : text.indexOf('\n'));
  const candidates: Array<[string, number]> = [',', '\t', ';'].map((delimiter) => [
    delimiter,
    firstLine.split(delimiter).length,
  ]);
  candidates.sort((a, b) => b[1] - a[1]);
  return candidates[0][1] > 1 ? candidates[0][0] : ',';
}

function toText(cell: unknown): string {
  return cell == null ? '' : String(cell).trim();
}

function toNumber(cell: unknown): number | null {
  if (typeof cell === 'number') {
    return Number.isFinite(cell) ? cell : null;
  }

  const cleaned = toText(cell).replace(/[,\s]/g, '');

  if (cleaned === '') {
    return null;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}
