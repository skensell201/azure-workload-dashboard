import React, { useEffect, useMemo, useState } from 'react';
import { LoadOrchestrator, LoadResult } from '../services/LoadOrchestrator';
import { buildMatrix } from '../services/Aggregation';
import { defaultWindow } from '../services/window';
import { DateWindow } from '../models/types';
import { MatrixTable } from './MatrixTable';

export function describeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function App({
  orchestrator,
  baseUrl,
}: {
  orchestrator: LoadOrchestrator;
  baseUrl: string;
}): JSX.Element {
  const [win, setWin] = useState<DateWindow>(defaultWindow(new Date()));
  const [filter, setFilter] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<LoadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(w: DateWindow): Promise<void> {
    if (!w.start || !w.end || w.start > w.end) {
      setError('Enter a valid period: the start date must not be later than the end date.');
      setResult(null);
      setProgress(null);
      return;
    }
    setError(null);
    setResult(null);
    setProgress({ done: 0, total: 0 });
    try {
      const res = await orchestrator.load(w, (done, total) => setProgress({ done, total }));
      setResult(res);
    } catch (e) {
      setError(`Failed to load data: ${describeError(e)}`);
    } finally {
      setProgress(null);
    }
  }

  useEffect(() => {
    void load(win);
  }, []);

  const needle = filter.trim().toLowerCase();
  const matrix = useMemo(() => {
    if (!result) return null;
    // Filtering before aggregation keeps columns and totals scoped to the visible people.
    const tasks = needle ? result.tasks.filter((t) => t.assigneeName.toLowerCase().includes(needle)) : result.tasks;
    return buildMatrix(tasks);
  }, [result, needle]);

  const noRows = result !== null && matrix !== null && matrix.rows.length === 0 && progress === null;
  const filteredEverythingOut = noRows && needle !== '' && result.tasks.length > 0;

  return (
    <div className="app">
      <div className="toolbar">
        <label>
          From <input type="date" value={win.start} onChange={(e) => setWin({ ...win, start: e.target.value })} />
        </label>
        <label>
          to <input type="date" value={win.end} onChange={(e) => setWin({ ...win, end: e.target.value })} />
        </label>
        <button onClick={() => void load(win)} disabled={progress !== null}>Refresh</button>
        <input
          type="text"
          placeholder="Filter by name…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="hint">cell: Original Estimate / Completed, hours</span>
      </div>
      {progress && <div className="progress">Loaded {progress.done} of {progress.total} projects</div>}
      {error && <div className="error-box">{error}</div>}
      {result && result.allProjectsFailed && (
        <div className="error-box">
          No project could be loaded — the token has probably expired or the server is unreachable. Reason:{' '}
          {[...new Set(result.skippedProjects.map((s) => s.reason))].join('; ')}
        </div>
      )}
      {result && !result.allProjectsFailed && result.skippedProjects.length > 0 && (
        <div className="warning">
          Skipped projects: {result.skippedProjects.map((s) => `${s.name} (${s.reason})`).join(', ')}
        </div>
      )}
      {result && result.projectCount === 0 && (
        <div className="warning">No projects are visible — check your permissions in the collection.</div>
      )}
      {result && matrix && result.projectCount > 0 && !result.allProjectsFailed && (() => {
        const stale = result.window.start !== win.start || result.window.end !== win.end;
        return (
          <div className={`loaded-window${stale ? ' stale' : ''}`}>
            Data for: {result.window.start} — {result.window.end}
            {stale ? ' (window changed — click Refresh)' : ''}
          </div>
        );
      })()}
      {filteredEverythingOut && (
        <div className="empty">Nobody matches the filter “{filter.trim()}”.</div>
      )}
      {noRows && !filteredEverythingOut && !result.allProjectsFailed && result.projectCount > 0 && (
        <div className="empty">No assigned tasks in the selected date window.</div>
      )}
      {matrix && matrix.rows.length > 0 && <MatrixTable matrix={matrix} baseUrl={baseUrl} />}
    </div>
  );
}
