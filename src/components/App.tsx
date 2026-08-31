import React, { useEffect, useMemo, useState } from 'react';
import { LoadOrchestrator, LoadResult } from '../services/LoadOrchestrator';
import { buildMatrix } from '../services/Aggregation';
import { defaultWindow } from '../services/window';
import { DateWindow } from '../models/types';
import { peopleOf, selectTasks, selectRoster } from '../services/people';
import { MatrixTable } from './MatrixTable';
import { ExportButtons } from './ExportButtons';
import { PeoplePicker } from './PeoplePicker';
import { AccessPanel, AccessPanelService } from './AccessPanel';

export function describeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function App({
  orchestrator,
  baseUrl,
  isAdmin,
  accessService,
  accessWarning,
}: {
  orchestrator: LoadOrchestrator;
  baseUrl: string;
  /** Shows the Access toolbar button and panel; both no-ops unless accessService is also given. */
  isAdmin?: boolean;
  accessService?: AccessPanelService;
  accessWarning?: string;
}): JSX.Element {
  const [win, setWin] = useState<DateWindow>(defaultWindow(new Date()));
  const [filter, setFilter] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<LoadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [includeRoster, setIncludeRoster] = useState(true);
  const [accessPanelOpen, setAccessPanelOpen] = useState(false);

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
      const res = await orchestrator.load(w, (done, total) => setProgress({ done, total }), includeRoster);
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
  const people = useMemo(() => (result ? peopleOf(result.tasks, result.roster) : []), [result]);
  const matrix = useMemo(() => {
    if (!result) return null;
    const roster = includeRoster ? selectRoster(result.roster, selected, filter) : [];
    // Narrowing before aggregation keeps columns and totals scoped to the visible people,
    // which is also what the exports are built from.
    return buildMatrix(selectTasks(result.tasks, selected, filter), roster);
  }, [result, selected, filter, includeRoster]);

  function togglePerson(key: string): void {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  }

  const noRows = result !== null && matrix !== null && matrix.rows.length === 0 && progress === null;
  const narrowedEverythingOut = noRows && (needle !== '' || selected.size > 0) && result.tasks.length > 0;

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
          placeholder="Find person…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <button onClick={() => setPickerOpen(!pickerOpen)} disabled={people.length === 0}>
          People{selected.size > 0 ? ` (${selected.size})` : ''}
        </button>
        <label>
          <input
            type="checkbox"
            checked={includeRoster}
            onChange={(e) => setIncludeRoster(e.target.checked)}
          />
          Include people with no tasks
        </label>
        {result && matrix && <ExportButtons matrix={matrix} window={result.window} />}
        {isAdmin && accessService && (
          <button onClick={() => setAccessPanelOpen(!accessPanelOpen)}>Access</button>
        )}
        <span className="hint">
          each cell: planned (Original Estimate) / done (Completed Work), in hours
        </span>
      </div>
      {accessWarning && <div className="warning">{accessWarning}</div>}
      {accessPanelOpen && accessService && (
        <AccessPanel service={accessService} onClose={() => setAccessPanelOpen(false)} />
      )}
      {pickerOpen && people.length > 0 && (
        <PeoplePicker
          people={people}
          selected={selected}
          search={filter}
          onToggle={togglePerson}
          onClear={() => setSelected(new Set())}
          onSelectShown={(keys) => setSelected(new Set([...selected, ...keys]))}
        />
      )}
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
      {narrowedEverythingOut && (
        <div className="empty">
          {selected.size > 0
            ? 'The selected people have no tasks in this window.'
            : `Nobody matches the search “${filter.trim()}”.`}
        </div>
      )}
      {noRows && !narrowedEverythingOut && !result.allProjectsFailed && result.projectCount > 0 && (
        <div className="empty">No assigned tasks in the selected date window.</div>
      )}
      {matrix && matrix.rows.length > 0 && <MatrixTable matrix={matrix} baseUrl={baseUrl} />}
    </div>
  );
}
