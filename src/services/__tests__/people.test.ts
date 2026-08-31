import { peopleOf, selectTasks } from '../people';
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
    originalEstimate: 8,
    completedWork: 2,
    ...over,
  };
}

const tasks = [
  task({ id: 1, assigneeKey: 'u2', assigneeName: 'Zoe' }),
  task({ id: 2, assigneeKey: 'u1', assigneeName: 'Ann' }),
  task({ id: 3, assigneeKey: 'u1', assigneeName: 'Ann' }),
];

describe('peopleOf', () => {
  it('lists each person once, sorted by name', () => {
    expect(peopleOf(tasks)).toEqual([
      { key: 'u1', name: 'Ann' },
      { key: 'u2', name: 'Zoe' },
    ]);
  });

  it('returns nothing for no tasks', () => {
    expect(peopleOf([])).toEqual([]);
  });
});

describe('selectTasks', () => {
  it('keeps only the checked people when a selection exists, ignoring the search text', () => {
    const kept = selectTasks(tasks, new Set(['u2']), 'ann');
    expect(kept.map((t) => t.assigneeName)).toEqual(['Zoe']);
  });

  it('falls back to the search text when nothing is checked', () => {
    const kept = selectTasks(tasks, new Set(), 'ann');
    expect(kept.map((t) => t.id)).toEqual([2, 3]);
  });

  it('matches the search text case-insensitively on any part of the name', () => {
    expect(selectTasks(tasks, new Set(), 'ZO')).toHaveLength(1);
  });

  it('keeps everything when nothing is checked and the search is empty', () => {
    expect(selectTasks(tasks, new Set(), '  ')).toHaveLength(3);
  });
});
