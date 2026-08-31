import './hub.css';
import * as SDK from 'azure-devops-extension-sdk';
import { CommonServiceIds, ILocationService } from 'azure-devops-extension-api';
import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import { RestApiClient } from './services/ApiClient';
import { ProjectService } from './services/ProjectService';
import { IterationService } from './services/IterationService';
import { WorkItemService } from './services/WorkItemService';
import { LoadOrchestrator, LoadResult } from './services/LoadOrchestrator';
import { buildMatrix } from './services/Aggregation';
import { defaultWindow } from './services/window';
import { DateWindow } from './models/types';
import { MatrixTable } from './components/MatrixTable';

function describeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function App({ orchestrator, baseUrl }: { orchestrator: LoadOrchestrator; baseUrl: string }): JSX.Element {
  const [win, setWin] = useState<DateWindow>(defaultWindow(new Date()));
  const [filter, setFilter] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<LoadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(w: DateWindow): Promise<void> {
    setError(null);
    setResult(null);
    setProgress({ done: 0, total: 0 });
    try {
      const res = await orchestrator.load(w, (done, total) => setProgress({ done, total }));
      setResult(res);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setProgress(null);
    }
  }

  useEffect(() => {
    void load(win);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matrix = useMemo(() => {
    if (!result) return null;
    const needle = filter.trim().toLowerCase();
    const tasks = needle ? result.tasks.filter((t) => t.assigneeName.toLowerCase().includes(needle)) : result.tasks;
    return buildMatrix(tasks);
  }, [result, filter]);
  return (
    <div className="app">
      <div className="toolbar">
        <label>
          С <input type="date" value={win.start} onChange={(e) => setWin({ ...win, start: e.target.value })} />
        </label>
        <label>
          по <input type="date" value={win.end} onChange={(e) => setWin({ ...win, end: e.target.value })} />
        </label>
        <button onClick={() => void load(win)} disabled={progress !== null}>Обновить</button>
        <input
          type="text"
          placeholder="Фильтр по имени…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="hint">в ячейке: Original Estimate / Completed, часы</span>
      </div>
      {progress && <div className="progress">Загружено проектов: {progress.done} из {progress.total}</div>}
      {error && <div className="error-box">Не удалось загрузить данные: {error}</div>}
      {result && result.allProjectsFailed && (
        <div className="error-box">
          Не удалось загрузить ни один проект — вероятно, истёк токен или сервер недоступен. Причина:{' '}
          {result.skippedProjects[0]?.reason}
        </div>
      )}
      {result && !result.allProjectsFailed && result.skippedProjects.length > 0 && (
        <div className="warning">
          Пропущены проекты:{' '}
          {result.skippedProjects.map((s) => `${s.name} (${s.reason})`).join(', ')}
        </div>
      )}
      {matrix && matrix.rows.length === 0 && !progress && !result?.allProjectsFailed && (
        <div className="empty">Нет задач с исполнителями в выбранном окне дат.</div>
      )}
      {matrix && matrix.rows.length > 0 && <MatrixTable matrix={matrix} baseUrl={baseUrl} />}
    </div>
  );
}

async function start(): Promise<void> {
  await SDK.init();
  const loc = await SDK.getService<ILocationService>(CommonServiceIds.LocationService);
  const baseUrl = (await loc.getServiceLocation()).replace(/\/$/, '');
  const token = await SDK.getAccessToken();
  const api = new RestApiClient(baseUrl, token);
  const orchestrator = new LoadOrchestrator({
    projects: new ProjectService(api),
    iterations: new IterationService(api),
    workItems: new WorkItemService(api),
  });
  ReactDOM.render(<App orchestrator={orchestrator} baseUrl={baseUrl} />, document.getElementById('root'));
}

start().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Workload Dashboard init failed:', e);
  const root = document.getElementById('root');
  if (root) root.textContent = `Failed to initialize Workload Dashboard: ${describeError(e)}`;
});
