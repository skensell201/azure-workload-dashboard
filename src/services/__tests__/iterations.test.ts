import { collectIterationPaths } from '../IterationService';
import { IterationNode } from '../../models/types';

const win = { start: '2026-09-01', end: '2026-09-14' };

function node(name: string, start?: string, finish?: string, children?: IterationNode[]): IterationNode {
  return {
    name,
    attributes: start || finish ? { startDate: start, finishDate: finish } : undefined,
    children,
  };
}

describe('collectIterationPaths', () => {
  it('returns paths of iterations overlapping the window', () => {
    const root = node('Proj', undefined, undefined, [
      node('Sprint 1', '2026-08-17T00:00:00Z', '2026-08-30T00:00:00Z'),
      node('Sprint 2', '2026-08-31T00:00:00Z', '2026-09-13T00:00:00Z'),
      node('Sprint 3', '2026-09-14T00:00:00Z', '2026-09-27T00:00:00Z'),
    ]);
    expect(collectIterationPaths(root, win)).toEqual(['Proj\\Sprint 2', 'Proj\\Sprint 3']);
  });

  it('includes an iteration touching the window by a single day', () => {
    const root = node('P', undefined, undefined, [node('S', '2026-08-20T00:00:00Z', '2026-09-01T00:00:00Z')]);
    expect(collectIterationPaths(root, win)).toEqual(['P\\S']);
  });

  it('walks nested iterations and builds full paths', () => {
    const root = node('P', undefined, undefined, [
      node('Release 1', undefined, undefined, [node('Sprint 5', '2026-09-01T00:00:00Z', '2026-09-14T00:00:00Z')]),
    ]);
    expect(collectIterationPaths(root, win)).toEqual(['P\\Release 1\\Sprint 5']);
  });

  it('ignores iterations without dates', () => {
    const root = node('P', undefined, undefined, [node('Backlog')]);
    expect(collectIterationPaths(root, win)).toEqual([]);
  });

  it('includes a dated root node itself when it overlaps', () => {
    const root = node('P', '2026-09-01T00:00:00Z', '2026-09-14T00:00:00Z');
    expect(collectIterationPaths(root, win)).toEqual(['P']);
  });

  it('includes an iteration fully containing the window', () => {
    const root = node('P', undefined, undefined, [node('S', '2026-08-01T00:00:00Z', '2026-10-01T00:00:00Z')]);
    expect(collectIterationPaths(root, win)).toEqual(['P\\S']);
  });
});
