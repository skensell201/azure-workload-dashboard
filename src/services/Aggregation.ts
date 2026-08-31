import { TaskItem } from '../models/types';

export interface MatrixCell {
  oe: number;
  completed: number;
}

export interface MatrixRow {
  key: string;
  name: string;
  cells: Map<string, MatrixCell>;
  total: MatrixCell;
  tasks: TaskItem[];
}

export interface Matrix {
  projects: string[];
  rows: MatrixRow[];
  projectTotals: Map<string, MatrixCell>;
  grandTotal: MatrixCell;
}

function add(cell: MatrixCell, t: TaskItem): void {
  cell.oe += t.originalEstimate;
  cell.completed += t.completedWork;
}

export function buildMatrix(tasks: TaskItem[]): Matrix {
  const rowsByKey = new Map<string, MatrixRow>();
  const projectTotals = new Map<string, MatrixCell>();
  const grandTotal: MatrixCell = { oe: 0, completed: 0 };

  for (const t of tasks) {
    let row = rowsByKey.get(t.assigneeKey);
    if (!row) {
      row = { key: t.assigneeKey, name: t.assigneeName, cells: new Map(), total: { oe: 0, completed: 0 }, tasks: [] };
      rowsByKey.set(t.assigneeKey, row);
    }
    let cell = row.cells.get(t.project);
    if (!cell) {
      cell = { oe: 0, completed: 0 };
      row.cells.set(t.project, cell);
    }
    let pt = projectTotals.get(t.project);
    if (!pt) {
      pt = { oe: 0, completed: 0 };
      projectTotals.set(t.project, pt);
    }
    add(cell, t);
    add(row.total, t);
    add(pt, t);
    add(grandTotal, t);
    row.tasks.push(t);
  }

  const rows = [...rowsByKey.values()].sort((a, b) => a.name.localeCompare(b.name));
  const projects = [...projectTotals.keys()].sort((a, b) => a.localeCompare(b));
  return { projects, rows, projectTotals, grandTotal };
}
