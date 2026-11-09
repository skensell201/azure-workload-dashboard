import { buildMatrix } from '../Aggregation';
import { TaskItem } from '../../models/types';
import { RosterPerson } from '../people';

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

  it('seeds a zero row for a roster person with no tasks', () => {
    const roster: RosterPerson[] = [{ key: 'u3', name: 'Nobody Has Tasks', projects: [] }];
    const m = buildMatrix([task({ assigneeKey: 'u1', assigneeName: 'User One' })], roster);
    const row = m.rows.find((r) => r.key === 'u3')!;
    expect(row).toBeDefined();
    expect(row.name).toBe('Nobody Has Tasks');
    expect(row.cells.size).toBe(0);
    expect(row.total).toEqual({ oe: 0, completed: 0 });
    expect(row.tasks).toEqual([]);
  });

  it('does not duplicate a roster person who also has tasks', () => {
    const roster: RosterPerson[] = [{ key: 'u1', name: 'User One', projects: ['A'] }];
    const m = buildMatrix([task({ assigneeKey: 'u1', assigneeName: 'User One', originalEstimate: 8, completedWork: 2 })], roster);
    expect(m.rows.filter((r) => r.key === 'u1')).toHaveLength(1);
    expect(m.rows.find((r) => r.key === 'u1')!.total).toEqual({ oe: 8, completed: 2 });
  });

  it('does not let roster people introduce new project columns', () => {
    const roster: RosterPerson[] = [{ key: 'u3', name: 'Nobody Has Tasks', projects: [] }];
    const m = buildMatrix([task({ assigneeKey: 'u1', assigneeName: 'User One', project: 'A' })], roster);
    expect(m.projects).toEqual(['A']);
  });

  it('sorts roster-only rows alphabetically alongside people with tasks', () => {
    const roster: RosterPerson[] = [
      { key: 'u3', name: 'Bob', projects: [] },
      { key: 'u4', name: 'Yara', projects: [] },
    ];
    const m = buildMatrix(
      [
        task({ assigneeKey: 'u1', assigneeName: 'Ann' }),
        task({ assigneeKey: 'u2', assigneeName: 'Zoe' }),
      ],
      roster
    );
    expect(m.rows.map((r) => r.name)).toEqual(['Ann', 'Bob', 'Yara', 'Zoe']);
  });

  it('behaves identically to today with no roster passed', () => {
    const m = buildMatrix([task({ assigneeKey: 'u1', assigneeName: 'User One' })]);
    expect(m.rows).toHaveLength(1);
  });

  it('remembers the projects a person is a team member of, even with tasks elsewhere', () => {
    const roster: RosterPerson[] = [{ key: 'u1', name: 'User One', projects: ['A', 'B'] }];
    const m = buildMatrix([task({ assigneeKey: 'u1', assigneeName: 'User One', project: 'A' })], roster);
    const row = m.rows.find((r) => r.key === 'u1')!;
    expect(row.memberProjects).toEqual(['A', 'B']);
    // The project with no tasks has no cell of its own — that is what "no tasks" means.
    expect(row.cells.has('B')).toBe(false);
  });

  it('gives a project whose team has people but no tasks a column of its own', () => {
    const roster: RosterPerson[] = [{ key: 'u3', name: 'Nobody Has Tasks', projects: ['Idle'] }];
    const m = buildMatrix([task({ assigneeKey: 'u1', assigneeName: 'User One', project: 'A' })], roster);
    expect(m.projects).toEqual(['A', 'Idle']);
    // The footer needs a total for that column, or the footer's cell would be missing.
    expect(m.projectTotals.get('Idle')).toEqual({ oe: 0, completed: 0 });
    expect(m.grandTotal).toEqual({ oe: 0, completed: 0 });
  });

  it('merges the membership of a person who is in several projects', () => {
    const roster: RosterPerson[] = [
      { key: 'u1', name: 'User One', projects: ['A'] },
      { key: 'u1', name: 'User One', projects: ['B'] },
    ];
    const m = buildMatrix([], roster);
    expect(m.rows[0].memberProjects).toEqual(['A', 'B']);
    expect(m.projects).toEqual(['A', 'B']);
  });
});
