import { TaskItem } from '../models/types';

export interface Person {
  key: string;
  name: string;
}

export function peopleOf(tasks: TaskItem[]): Person[] {
  const byKey = new Map<string, Person>();
  for (const t of tasks) if (!byKey.has(t.assigneeKey)) byKey.set(t.assigneeKey, { key: t.assigneeKey, name: t.assigneeName });
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** An explicit selection wins over the search box, which is only there to find people to check. */
export function selectTasks(tasks: TaskItem[], selected: Set<string>, search: string): TaskItem[] {
  if (selected.size > 0) return tasks.filter((t) => selected.has(t.assigneeKey));
  const needle = search.trim().toLowerCase();
  if (!needle) return tasks;
  return tasks.filter((t) => t.assigneeName.toLowerCase().includes(needle));
}
