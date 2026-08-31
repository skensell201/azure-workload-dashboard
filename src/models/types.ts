export interface NamedRef {
  id: string;
  name: string;
}

/** Inclusive ISO date window, e.g. { start: '2026-09-01', end: '2026-09-14' }. */
export interface DateWindow {
  start: string;
  end: string;
}

/** Classification node as returned by _apis/wit/classificationnodes/iterations. */
export interface IterationNode {
  name: string;
  attributes?: { startDate?: string; finishDate?: string };
  children?: IterationNode[];
}

export interface TaskItem {
  id: number;
  title: string;
  state: string;
  project: string;
  iterationPath: string;
  assigneeKey: string;
  assigneeName: string;
  originalEstimate: number;
  completedWork: number;
}
