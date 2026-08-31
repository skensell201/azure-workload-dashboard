import { DateWindow, NamedRef, TaskItem } from '../models/types';
import { ProjectService } from './ProjectService';
import { IterationService } from './IterationService';
import { WorkItemService } from './WorkItemService';
import { parseAssignee } from './assignee';
import { runBatched } from '../utils/batch';

export const TASK_FIELDS = [
  'System.Title',
  'System.State',
  'System.IterationPath',
  'System.AssignedTo',
  'Microsoft.VSTS.Scheduling.OriginalEstimate',
  'Microsoft.VSTS.Scheduling.CompletedWork',
];

export interface SkippedProject {
  name: string;
  reason: string;
}

export interface LoadResult {
  tasks: TaskItem[];
  skippedProjects: SkippedProject[];
  allProjectsFailed: boolean;
  window: DateWindow;
  projectCount: number;
}

interface Deps {
  projects: ProjectService;
  iterations: IterationService;
  workItems: WorkItemService;
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export class LoadOrchestrator {
  constructor(private deps: Deps) {}

  async load(win: DateWindow, onProgress: (done: number, total: number) => void): Promise<LoadResult> {
    const projects = await this.deps.projects.getProjects();
    const skippedProjects: SkippedProject[] = [];
    let done = 0;
    const perProject = await runBatched(projects, async (p: NamedRef) => {
      try {
        return await this.loadProject(p.name, win);
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        // Keep the reason: on-prem 403/404s must be distinguishable from bugs in the mapper.
        console.warn(`Workload Dashboard: skipping project ${p.name}`, e);
        skippedProjects.push({ name: p.name, reason });
        return [] as TaskItem[];
      } finally {
        done++;
        onProgress(done, projects.length);
      }
    });
    return {
      tasks: perProject.flat(),
      skippedProjects,
      allProjectsFailed: projects.length > 0 && skippedProjects.length === projects.length,
      window: win,
      projectCount: projects.length,
    };
  }

  private async loadProject(project: string, win: DateWindow): Promise<TaskItem[]> {
    const paths = await this.deps.iterations.getIterationPathsIntersecting(project, win);
    if (paths.length === 0) return [];
    const ids = await this.deps.workItems.queryTaskIds(project, paths);
    const fields = await this.deps.workItems.getFieldsBatch(project, ids, TASK_FIELDS);
    const tasks: TaskItem[] = [];
    for (const [id, f] of fields) {
      const assignee = parseAssignee(f['System.AssignedTo']);
      if (!assignee) continue;
      tasks.push({
        id,
        title: String(f['System.Title'] ?? ''),
        state: String(f['System.State'] ?? ''),
        project,
        iterationPath: String(f['System.IterationPath'] ?? ''),
        assigneeKey: assignee.key,
        assigneeName: assignee.name,
        originalEstimate: num(f['Microsoft.VSTS.Scheduling.OriginalEstimate']),
        completedWork: num(f['Microsoft.VSTS.Scheduling.CompletedWork']),
      });
    }
    return tasks;
  }
}
