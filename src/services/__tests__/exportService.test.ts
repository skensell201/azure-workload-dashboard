import { matrixToTable, tasksToTable, toCsv, exportBaseName } from '../ExportService';
import { buildMatrix } from '../Aggregation';
import { TaskItem } from '../../models/types';

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
      'A — Original Estimate',
      'A — Completed',
      'B — Original Estimate',
      'B — Completed',
      'Total — Original Estimate',
      'Total — Completed',
    ]);
  });

  it('emits numbers, not formatted strings', () => {
    const t = matrixToTable(matrix);
    expect(t.rows[0]).toEqual(['User One', 8, 2, 16, 4, 24, 6]);
  });

  it('leaves a project the person has no tasks in blank rather than zero', () => {
    const t = matrixToTable(matrix);
    expect(t.rows[1]).toEqual(['User Two', null, null, 40, 20, 40, 20]);
  });

  it('appends the totals row', () => {
    const t = matrixToTable(matrix);
    expect(t.rows[t.rows.length - 1]).toEqual(['Total', 8, 2, 56, 24, 64, 26]);
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
