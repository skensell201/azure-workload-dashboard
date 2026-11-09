import { LoadOrchestrator } from '../LoadOrchestrator';

const win = { start: '2026-09-01', end: '2026-09-14' };

function makeDeps(
  over: Partial<Record<'getProjects' | 'getIterationPathsIntersecting' | 'queryTaskIds' | 'getFieldsBatch' | 'getProjectMembers', unknown>>
) {
  return {
    projects: {
      getProjects: (over.getProjects as never) ?? (async () => [{ id: '1', name: 'A' }, { id: '2', name: 'B' }]),
    },
    iterations: {
      getIterationPathsIntersecting:
        (over.getIterationPathsIntersecting as never) ?? (async (p: string) => [`${p}\\S1`]),
    },
    workItems: {
      queryTaskIds: (over.queryTaskIds as never) ?? (async () => [10]),
      getFieldsBatch:
        (over.getFieldsBatch as never) ??
        (async (_p: string, ids: number[]) =>
          new Map(
            ids.map((id) => [
              id,
              {
                'System.Title': `task ${id}`,
                'System.State': 'Active',
                'System.IterationPath': 'A\\S1',
                'System.AssignedTo': { displayName: 'User One', uniqueName: 'u1' },
                'Microsoft.VSTS.Scheduling.OriginalEstimate': 8,
                'Microsoft.VSTS.Scheduling.CompletedWork': 3,
              },
            ])
          )),
    },
    teams: {
      getProjectMembers: (over.getProjectMembers as never) ?? (async () => []),
    },
  };
}

describe('LoadOrchestrator', () => {
  it('collects tasks from every project', async () => {
    const result = await new LoadOrchestrator(makeDeps({}) as never).load(win, () => {});
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks.map((t) => t.project).sort()).toEqual(['A', 'B']);
    expect(result.tasks[0]).toMatchObject({
      id: 10,
      title: 'task 10',
      assigneeKey: 'u1',
      assigneeName: 'User One',
      originalEstimate: 8,
      completedWork: 3,
    });
    expect(result.skippedProjects).toEqual([]);
    expect(result.allProjectsFailed).toBe(false);
    expect(result.window).toEqual(win);
    expect(result.projectCount).toBe(2);
  });

  it('skips a failing project and keeps the rest', async () => {
    const deps = makeDeps({
      getIterationPathsIntersecting: async (p: string) => {
        if (p === 'A') throw new Error('403');
        return [`${p}\\S1`];
      },
    });
    const result = await new LoadOrchestrator(deps as never).load(win, () => {});
    expect(result.tasks.map((t) => t.project)).toEqual(['B']);
    expect(result.skippedProjects).toEqual([{ name: 'A', reason: '403' }]);
  });

  it('reports every project failing', async () => {
    const deps = makeDeps({
      getIterationPathsIntersecting: async () => {
        throw new Error('token expired');
      },
    });
    const result = await new LoadOrchestrator(deps as never).load(win, () => {});
    expect(result.tasks).toEqual([]);
    expect([...result.skippedProjects].sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: 'A', reason: 'token expired' },
      { name: 'B', reason: 'token expired' },
    ]);
    expect(result.allProjectsFailed).toBe(true);
  });

  it('skips WIQL for projects with no intersecting iterations', async () => {
    let wiqlCalls = 0;
    const deps = makeDeps({
      getIterationPathsIntersecting: async () => [],
      queryTaskIds: async () => {
        wiqlCalls++;
        return [];
      },
    });
    const result = await new LoadOrchestrator(deps as never).load(win, () => {});
    expect(wiqlCalls).toBe(0);
    expect(result.tasks).toEqual([]);
  });

  it('treats missing hour fields as zero and drops unassigned tasks', async () => {
    const deps = makeDeps({
      getFieldsBatch: async (_p: string, ids: number[]) =>
        new Map([
          [ids[0], { 'System.Title': 'no hours', 'System.State': 'New', 'System.IterationPath': 'A\\S1',
                     'System.AssignedTo': { displayName: 'U', uniqueName: 'u' } }],
        ]),
      getProjects: async () => [{ id: '1', name: 'A' }],
    });
    const result = await new LoadOrchestrator(deps as never).load(win, () => {});
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]).toMatchObject({ originalEstimate: 0, completedWork: 0 });
  });

  it('reports progress once per project', async () => {
    const seen: Array<[number, number]> = [];
    await new LoadOrchestrator(makeDeps({}) as never).load(win, (done, total) => seen.push([done, total]));
    expect(seen).toHaveLength(2);
    expect(seen[seen.length - 1]).toEqual([2, 2]);
  });

  it('returns the roster deduped across projects, with the projects each person belongs to', async () => {
    const deps = makeDeps({
      getProjectMembers: async (projectId: string) =>
        projectId === '1'
          ? [{ key: 'u1', name: 'User One' }, { key: 'u2', name: 'User Two' }]
          : [{ key: 'u2', name: 'User Two' }, { key: 'u3', name: 'User Three' }],
    });
    const result = await new LoadOrchestrator(deps as never).load(win, () => {});
    expect([...result.roster].sort((a, b) => a.key.localeCompare(b.key))).toEqual([
      { key: 'u1', name: 'User One', projects: ['A'] },
      { key: 'u2', name: 'User Two', projects: ['A', 'B'] },
      { key: 'u3', name: 'User Three', projects: ['B'] },
    ]);
  });

  it('uses the project id, not the project name, to fetch members', async () => {
    const seenIds: string[] = [];
    const deps = makeDeps({
      getProjectMembers: async (projectId: string) => {
        seenIds.push(projectId);
        return [];
      },
    });
    await new LoadOrchestrator(deps as never).load(win, () => {});
    expect(seenIds.sort()).toEqual(['1', '2']);
  });

  it('keeps a project’s tasks when only its member fetch fails, and does not mark it skipped', async () => {
    const deps = makeDeps({
      getProjectMembers: async (projectId: string) => {
        if (projectId === '1') throw new Error('members 403');
        return [{ key: 'u2', name: 'User Two' }];
      },
    });
    const result = await new LoadOrchestrator(deps as never).load(win, () => {});
    expect(result.tasks.map((t) => t.project).sort()).toEqual(['A', 'B']);
    expect(result.skippedProjects).toEqual([]);
    expect(result.roster).toEqual([{ key: 'u2', name: 'User Two', projects: ['B'] }]);
  });

  it('skips the member calls entirely and returns an empty roster when includeRoster is false', async () => {
    let calls = 0;
    const deps = makeDeps({
      getProjectMembers: async () => {
        calls++;
        return [{ key: 'u1', name: 'User One' }];
      },
    });
    const result = await new LoadOrchestrator(deps as never).load(win, () => {}, false);
    expect(calls).toBe(0);
    expect(result.roster).toEqual([]);
  });
});
