import { buildMatrix } from '../Aggregation';
import { TaskItem } from '../../models/types';

function task(over: Partial<TaskItem>): TaskItem {
  return {
    id: 1,
    title: 't',
    state: 'Active',
    project: 'A',
    iterationPath: 'A\\S1',
    assigneeKey: 'u1',
    assigneeName: 'User One',
    originalEstimate: 0,
    completedWork: 0,
    ...over,
  };
}

describe('buildMatrix', () => {
  it('sums hours per person per project with row and column totals', () => {
    const m = buildMatrix([
      task({ id: 1, assigneeKey: 'u1', project: 'A', originalEstimate: 8, completedWork: 2 }),
      task({ id: 2, assigneeKey: 'u1', project: 'A', originalEstimate: 4, completedWork: 4 }),
      task({ id: 3, assigneeKey: 'u1', project: 'B', originalEstimate: 16, completedWork: 0 }),
      task({ id: 4, assigneeKey: 'u2', assigneeName: 'User Two', project: 'B', originalEstimate: 40, completedWork: 20 }),
    ]);
    expect(m.projects).toEqual(['A', 'B']);
    expect(m.rows.map((r) => r.name)).toEqual(['User One', 'User Two']);
    expect(m.rows[0].cells.get('A')).toEqual({ oe: 12, completed: 6 });
    expect(m.rows[0].cells.get('B')).toEqual({ oe: 16, completed: 0 });
    expect(m.rows[0].total).toEqual({ oe: 28, completed: 6 });
    expect(m.rows[1].cells.has('A')).toBe(false);
    expect(m.projectTotals.get('B')).toEqual({ oe: 56, completed: 20 });
    expect(m.grandTotal).toEqual({ oe: 68, completed: 26 });
  });

  it('sorts people and projects alphabetically', () => {
    const m = buildMatrix([
      task({ assigneeKey: 'z', assigneeName: 'Zoe', project: 'Zeta' }),
      task({ assigneeKey: 'a', assigneeName: 'Ann', project: 'Alpha' }),
    ]);
    expect(m.projects).toEqual(['Alpha', 'Zeta']);
    expect(m.rows.map((r) => r.name)).toEqual(['Ann', 'Zoe']);
  });

  it('keeps the person tasks attached to the row', () => {
    const m = buildMatrix([task({ id: 7 }), task({ id: 8 })]);
    expect(m.rows[0].tasks.map((t) => t.id)).toEqual([7, 8]);
  });

  it('returns an empty matrix for no tasks', () => {
    const m = buildMatrix([]);
    expect(m.rows).toEqual([]);
    expect(m.projects).toEqual([]);
    expect(m.grandTotal).toEqual({ oe: 0, completed: 0 });
  });

  it('totals reflect only the tasks passed in, so a filtered set totals the filtered person', () => {
    const all = [
      task({ id: 1, assigneeKey: 'u1', assigneeName: 'User One', project: 'A', originalEstimate: 8, completedWork: 2 }),
      task({ id: 2, assigneeKey: 'u2', assigneeName: 'User Two', project: 'B', originalEstimate: 40, completedWork: 20 }),
    ];
    const filtered = buildMatrix(all.filter((t) => t.assigneeName.toLowerCase().includes('one')));
    expect(filtered.projects).toEqual(['A']);
    expect(filtered.grandTotal).toEqual({ oe: 8, completed: 2 });
  });
});
