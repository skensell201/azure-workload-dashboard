import { ApiClient } from './ApiClient';
import { DateWindow, IterationNode } from '../models/types';

function overlaps(win: DateWindow, start: string, finish: string): boolean {
  // ISO timestamps compare lexicographically; date-only window bounds are extended to day edges.
  return start.slice(0, 10) <= win.end && finish.slice(0, 10) >= win.start;
}

/** Flattens the iteration tree into WIQL iteration paths whose dates intersect the window. */
export function collectIterationPaths(root: IterationNode, win: DateWindow): string[] {
  const result: string[] = [];
  function walk(node: IterationNode, path: string): void {
    const a = node.attributes;
    if (a?.startDate && a?.finishDate && overlaps(win, a.startDate, a.finishDate)) result.push(path);
    for (const child of node.children ?? []) walk(child, `${path}\\${child.name}`);
  }
  walk(root, root.name);
  return result;
}

export class IterationService {
  constructor(private api: ApiClient) {}

  async getIterationPathsIntersecting(project: string, win: DateWindow): Promise<string[]> {
    const root = await this.api.get<IterationNode>(
      `/${encodeURIComponent(project)}/_apis/wit/classificationnodes/iterations?$depth=10&api-version=6.0`
    );
    return collectIterationPaths(root, win);
  }
}
