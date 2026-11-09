import { DateWindow, NamedRef, TaskItem } from '../models/types';
import { ProjectService } from './ProjectService';
import { IterationService } from './IterationService';
import { WorkItemService } from './WorkItemService';
import { TeamService } from './TeamService';
import { RosterPerson } from './people';
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
  roster: RosterPerson[];
}

interface Deps {
  projects: ProjectService;
  iterations: IterationService;
  workItems: WorkItemService;
  teams: TeamService;
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export class LoadOrchestrator {
  constructor(private deps: Deps) {}

  async load(
    win: DateWindow,
    onProgress: (done: number, total: number) => void,
    includeRoster = true
  ): Promise<LoadResult> {
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
    const roster = includeRoster ? await this.loadRoster(projects) : [];
    return {
      tasks: perProject.flat(),
      skippedProjects,
      allProjectsFailed: projects.length > 0 && skippedProjects.length === projects.length,
      window: win,
      projectCount: projects.length,
      roster,
    };
  }

  /** A project's member list is a courtesy, not core data: a fetch failure here must never mark the project skipped. */
  private async loadRoster(projects: NamedRef[]): Promise<RosterPerson[]> {
    const perProject = await runBatched(projects, async (p: NamedRef) => {
      try {
        const members = await this.deps.teams.getProjectMembers(p.id);
        // Remember which project each member belongs to: that is what makes "no tasks" sayable.
        return members.map((m) => ({ ...m, projects: [p.name] }));
      } catch (e) {
        console.warn(`Workload Dashboard: could not load members for project ${p.name}`, e);
        return [] as RosterPerson[];
      }
    });
    const byKey = new Map<string, RosterPerson>();
    for (const members of perProject) {
      for (const m of members) {
        const existing = byKey.get(m.key);
        if (!existing) {
          byKey.set(m.key, { key: m.key, name: m.name, projects: [...m.projects] });
          continue;
        }
        for (const project of m.projects) {
          if (!existing.projects.includes(project)) existing.projects.push(project);
        }
      }
    }
    return [...byKey.values()];
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
