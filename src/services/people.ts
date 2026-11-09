import { TaskItem } from '../models/types';

export interface Person {
  key: string;
  name: string;
}

/**
 * A person from the team roster, together with the projects whose teams they belong to.
 * The membership is what lets the matrix say "no tasks" instead of a bare dash: it
 * separates "in the project, nothing planned" from "not in the project at all".
 */
export interface RosterPerson extends Person {
  projects: string[];
}

export function peopleOf(tasks: TaskItem[], roster: Person[] = []): Person[] {
  const byKey = new Map<string, Person>();
  for (const t of tasks) if (!byKey.has(t.assigneeKey)) byKey.set(t.assigneeKey, { key: t.assigneeKey, name: t.assigneeName });
  for (const p of roster) if (!byKey.has(p.key)) byKey.set(p.key, p);
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** An explicit selection wins over the search box, which is only there to find people to check. */
export function selectTasks(tasks: TaskItem[], selected: Set<string>, search: string): TaskItem[] {
  if (selected.size > 0) return tasks.filter((t) => selected.has(t.assigneeKey));
  const needle = search.trim().toLowerCase();
  if (!needle) return tasks;
  return tasks.filter((t) => t.assigneeName.toLowerCase().includes(needle));
}

/** Mirrors selectTasks so a selected or searched-for roster person with no tasks doesn't vanish from the matrix. */
export function selectRoster<T extends Person>(roster: T[], selected: Set<string>, search: string): T[] {
  if (selected.size > 0) return roster.filter((p) => selected.has(p.key));
  const needle = search.trim().toLowerCase();
  if (!needle) return roster;
  return roster.filter((p) => p.name.toLowerCase().includes(needle));
}
