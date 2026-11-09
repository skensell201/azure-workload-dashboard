import { matrixToTable, noTasksToTable, tasksToTable, toCsv, toXlsxBlob, exportBaseName } from '../ExportService';
import { buildMatrix } from '../Aggregation';
import { TaskItem } from '../../models/types';
import * as XLSX from 'xlsx';

function task(over: Partial<TaskItem>): TaskItem {
  return {
    id: 1,
    title: 'Fix bug',
    state: 'Active',
    project: 'A',
    iterationPath: 'A\\S1',
    assigneeKey: 'u1',
    assigneeName: 'User One',
    originalEstimate: 8,
    completedWork: 2,
    ...over,
  };
}

const matrix = buildMatrix([
  task({ id: 1, originalEstimate: 8, completedWork: 2 }),
  task({ id: 2, project: 'B', originalEstimate: 16, completedWork: 4 }),
  task({ id: 3, assigneeKey: 'u2', assigneeName: 'User Two', project: 'B', originalEstimate: 40, completedWork: 20 }),
]);

describe('matrixToTable', () => {
  it('splits each project into separate estimate and completed columns so Excel can sum them', () => {
    const t = matrixToTable(matrix);
    expect(t.headers).toEqual([
      'Person',
      'Total — Original Estimate',
      'Total — Completed',
      'A — Original Estimate',
      'A — Completed',
      'B — Original Estimate',
      'B — Completed',
      'Projects without tasks',
    ]);
  });

  it('emits numbers, not formatted strings', () => {
    const t = matrixToTable(matrix);
    expect(t.rows[0]).toEqual(['User One', 24, 6, 8, 2, 16, 4, '']);
  });

  it('leaves a project the person has no tasks in blank rather than zero', () => {
    const t = matrixToTable(matrix);
    expect(t.rows[1]).toEqual(['User Two', 40, 20, null, null, 40, 20, '']);
  });

  it('appends the totals row', () => {
    const t = matrixToTable(matrix);
    expect(t.rows[t.rows.length - 1]).toEqual(['Total', 64, 26, 8, 2, 56, 24, '']);
  });

  it('lists the projects a team member was not planned in, without touching the hours columns', () => {
    const m = buildMatrix(
      [task({ id: 1, assigneeKey: 'u1', assigneeName: 'User One', project: 'A' })],
      [{ key: 'u1', name: 'User One', projects: ['A', 'B', 'C'] }]
    );
    const t = matrixToTable(m);
    expect(t.headers[t.headers.length - 1]).toBe('Projects without tasks');
    expect(t.rows[0][t.rows[0].length - 1]).toBe('B, C');
    // The hours columns stay numbers: 8 and 2 for A, blanks for B and C.
    expect(t.rows[0].slice(1, 7)).toEqual([8, 2, 8, 2, null, null]);
  });
});

describe('noTasksToTable', () => {
  it('lists one row per person and project they are in the team of but have no task in', () => {
    const m = buildMatrix(
      [
        task({ id: 1, assigneeKey: 'u1', assigneeName: 'User One', project: 'A' }),
        task({ id: 2, assigneeKey: 'u2', assigneeName: 'User Two', project: 'A' }),
      ],
      [
        { key: 'u1', name: 'User One', projects: ['A', 'B'] },
        { key: 'u2', name: 'User Two', projects: ['A'] },
      ]
    );
    const t = noTasksToTable(m);
    expect(t.headers).toEqual(['Person', 'Project']);
    expect(t.rows).toEqual([['User One', 'B']]);
  });

  it('is empty when nobody was left unplanned', () => {
    expect(noTasksToTable(matrix).rows).toEqual([]);
  });
});

describe('tasksToTable', () => {
  it('flattens every task of every person', () => {
    const t = tasksToTable(matrix);
    expect(t.headers).toEqual([
      'Id',
      'Title',
      'Person',
      'Project',
      'Iteration',
      'State',
      'Original Estimate',
      'Completed',
    ]);
    expect(t.rows).toHaveLength(3);
    expect(t.rows[0]).toEqual([1, 'Fix bug', 'User One', 'A', 'A\\S1', 'Active', 8, 2]);
  });
});

describe('toCsv', () => {
  it('quotes cells containing separators and doubles inner quotes', () => {
    const csv = toCsv({ headers: ['a', 'b'], rows: [['x,y', 'say "hi"']] });
    expect(csv).toContain('"x,y","say ""hi"""');
  });

  it('writes blanks for null cells', () => {
    expect(toCsv({ headers: ['a', 'b'], rows: [[null, 3]] })).toContain('\n,3');
  });

  it('starts with a BOM so Excel opens UTF-8 names correctly', () => {
    expect(toCsv({ headers: ['Имя'], rows: [] }).charCodeAt(0)).toBe(0xfeff);
  });

  it('neutralises leading characters Excel would read as a formula', () => {
    expect(toCsv({ headers: ['a'], rows: [['=cmd()']] })).toContain("'=cmd()");
  });
});

describe('exportBaseName', () => {
  it('names the file after the loaded window', () => {
    expect(exportBaseName({ start: '2026-08-31', end: '2026-09-13' })).toBe('workload-2026-08-31_2026-09-13');
  });
});

describe('toXlsxBlob', () => {
  it('writes the matrix, the tasks and the unplanned people into three sheets', async () => {
    const blob = toXlsxBlob(matrix);
    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
    const wb = XLSX.read(Buffer.from(buffer), { type: 'buffer' });
    expect(wb.SheetNames).toEqual(['Workload', 'Tasks', 'No tasks']);
  });
});
