import { TaskItem } from '../models/types';
import { RosterPerson } from './people';

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
  /**
   * Projects whose teams the person belongs to. A project listed here without a cell
   * means "in the project, nothing planned in this window" — the matrix shows that as
   * "no tasks" instead of the dash it uses for people who are not in the project at all.
   */
  memberProjects: string[];
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

export function buildMatrix(tasks: TaskItem[], roster: RosterPerson[] = []): Matrix {
  const rowsByKey = new Map<string, MatrixRow>();
  const projectTotals = new Map<string, MatrixCell>();
  const grandTotal: MatrixCell = { oe: 0, completed: 0 };

  // Team membership is resolved first: someone with tasks in one project may still be
  // a member of another project's team, and that other project is where they are unplanned.
  const membership = new Map<string, string[]>();
  for (const p of roster) {
    const list = membership.get(p.key) ?? [];
    for (const project of p.projects) if (!list.includes(project)) list.push(project);
    membership.set(p.key, list);
  }
  const memberProjectsOf = (key: string): string[] => [...(membership.get(key) ?? [])];

  for (const t of tasks) {
    let row = rowsByKey.get(t.assigneeKey);
    if (!row) {
      row = {
        key: t.assigneeKey,
        name: t.assigneeName,
        cells: new Map(),
        total: { oe: 0, completed: 0 },
        tasks: [],
        memberProjects: memberProjectsOf(t.assigneeKey),
      };
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

  // Roster rows must not touch projectTotals/grandTotal: they carry no tasks.
  for (const p of roster) {
    if (rowsByKey.has(p.key)) continue;
    rowsByKey.set(p.key, {
      key: p.key,
      name: p.name,
      cells: new Map(),
      total: { oe: 0, completed: 0 },
      tasks: [],
      memberProjects: memberProjectsOf(p.key),
    });
  }

  const rows = [...rowsByKey.values()].sort((a, b) => a.name.localeCompare(b.name));
  // A project earns a column when it has tasks in the window or people in its teams:
  // a project nobody was planned in has to stay visible, otherwise "who was left out"
  // cannot be read off the matrix.
  const projectNames = new Set<string>(projectTotals.keys());
  for (const list of membership.values()) for (const project of list) projectNames.add(project);
  const projects = [...projectNames].sort((a, b) => a.localeCompare(b));
  // Every column needs a total cell, or the footer's "0 / 0" would read as missing data.
  for (const project of projects) {
    if (!projectTotals.has(project)) projectTotals.set(project, { oe: 0, completed: 0 });
  }
  return { projects, rows, projectTotals, grandTotal };
}

/**
 * The projects where the person is in the team but has no task in the window — the
 * projects the matrix marks "no tasks". Sorted, so the exports stay stable.
 */
export function projectsWithoutTasks(row: MatrixRow): string[] {
  return row.memberProjects.filter((p) => !row.cells.has(p)).sort((a, b) => a.localeCompare(b));
}
