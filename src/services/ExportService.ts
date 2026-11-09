import * as XLSX from 'xlsx';
import { CellValue, DateWindow, Table } from '../models/types';
import { Matrix, projectsWithoutTasks } from './Aggregation';

const BOM = '﻿';

/**
 * Estimate and completed live in separate numeric columns so the export can be summed and pivoted.
 * The "no tasks" mark is information, not a number, so it stays out of the hours columns and
 * goes into its own column — and into its own sheet with one row per person and project.
 */
export function matrixToTable(matrix: Matrix): Table {
  const headers = [
    'Person',
    'Total — Original Estimate',
    'Total — Completed',
    ...matrix.projects.flatMap((p) => [`${p} — Original Estimate`, `${p} — Completed`]),
    'Projects without tasks',
  ];
  const rows: CellValue[][] = matrix.rows.map((r) => [
    r.name,
    r.total.oe,
    r.total.completed,
    // A project the person has no tasks in stays blank: zero would read as "planned nothing".
    ...matrix.projects.flatMap((p) => {
      const cell = r.cells.get(p);
      return cell ? [cell.oe, cell.completed] : [null, null];
    }),
    projectsWithoutTasks(r).join(', '),
  ]);
  rows.push([
    'Total',
    matrix.grandTotal.oe,
    matrix.grandTotal.completed,
    ...matrix.projects.flatMap((p) => {
      const cell = matrix.projectTotals.get(p);
      return cell ? [cell.oe, cell.completed] : [null, null];
    }),
    '',
  ]);
  return { headers, rows };
}

/** One row per person and project where the person is in the team but has no task in the window. */
export function noTasksToTable(matrix: Matrix): Table {
  return {
    headers: ['Person', 'Project'],
    rows: matrix.rows.flatMap((r) => projectsWithoutTasks(r).map((p) => [r.name, p])),
  };
}

export function tasksToTable(matrix: Matrix): Table {
  return {
    headers: ['Id', 'Title', 'Person', 'Project', 'Iteration', 'State', 'Original Estimate', 'Completed'],
    rows: matrix.rows.flatMap((r) =>
      r.tasks.map((t) => [
        t.id,
        t.title,
        r.name,
        t.project,
        t.iterationPath,
        t.state,
        t.originalEstimate,
        t.completedWork,
      ])
    ),
  };
}

/** Excel treats cells starting with = + - @ as formulas even in CSV; prefix with ' to force text. */
function deFormula(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function csvCell(value: CellValue): string {
  if (value === null) return '';
  const s = deFormula(String(value));
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(table: Table): string {
  const header = table.headers.map(csvCell).join(',');
  const body = table.rows.map((row) => row.map(csvCell).join(','));
  return BOM + [header, ...body].join('\n') + '\n';
}

function sheetOf(table: Table): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet([table.headers, ...table.rows.map((row) => row.map((c) => (c === null ? '' : c)))]);
}

/** Three sheets: the matrix as shown, the tasks behind it, and who was left unplanned. */
export function toXlsxBlob(matrix: Matrix): Blob {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheetOf(matrixToTable(matrix)), 'Workload');
  XLSX.utils.book_append_sheet(wb, sheetOf(tasksToTable(matrix)), 'Tasks');
  XLSX.utils.book_append_sheet(wb, sheetOf(noTasksToTable(matrix)), 'No tasks');
  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function exportBaseName(win: DateWindow): string {
  return `workload-${win.start}_${win.end}`;
}
