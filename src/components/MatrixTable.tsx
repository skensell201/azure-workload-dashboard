import React, { useState } from 'react';
import { Matrix, MatrixCell, MatrixRow } from '../services/Aggregation';

function h(n: number): string {
  // Float estimates (0.3h, 0.6h) accumulate binary error; two decimals is finer than anyone plans.
  return String(Math.round(n * 100) / 100);
}

function fmt(c: MatrixCell): string {
  return `${h(c.oe)} / ${h(c.completed)}`;
}

function TaskRows({ row, colSpan, baseUrl }: { row: MatrixRow; colSpan: number; baseUrl: string }): JSX.Element {
  return (
    <tr className="task-details">
      <td colSpan={colSpan}>
        <table className="task-list">
          <tbody>
            {row.tasks.map((t) => (
              <tr key={t.id}>
                <td>
                  <a href={`${baseUrl}/${encodeURIComponent(t.project)}/_workitems/edit/${t.id}`} target="_blank" rel="noreferrer">
                    #{t.id}
                  </a>
                </td>
                <td>{t.title}</td>
                <td>{t.project}</td>
                <td>{t.iterationPath}</td>
                <td>{t.state}</td>
                <td>{h(t.originalEstimate)} / {h(t.completedWork)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </td>
    </tr>
  );
}

export function MatrixTable({ matrix, baseUrl }: { matrix: Matrix; baseUrl: string }): JSX.Element {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const colSpan = matrix.projects.length + 2;

  function toggle(key: string): void {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpanded(next);
  }

  return (
    <div className="matrix-scroll">
      <table className="matrix">
        <thead>
          <tr>
            <th>Person</th>
            <th className="total">
              Total
              <div className="col-legend">planned / done</div>
            </th>
            {matrix.projects.map((p) => (
              <th key={p}>
                {p}
                <div className="col-legend">planned / done</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((r) => (
            <React.Fragment key={r.key}>
              <tr className="person-row" onClick={() => toggle(r.key)}>
                <td>
                  <span className="twisty">{expanded.has(r.key) ? '▾' : '▸'}</span> <span className="person-name">{r.name}</span>
                </td>
                <td className="total">{fmt(r.total)}</td>
                {matrix.projects.map((p) => {
                  const cell = r.cells.get(p);
                  if (cell) return <td key={p}>{fmt(cell)}</td>;
                  // In the project's team but nothing planned in the window — a manager
                  // scanning the column has to see that as different from "not in the project".
                  if (r.memberProjects.includes(p)) {
                    return (
                      <td key={p} className="no-tasks" title="In the project team, no tasks in this window">
                        no tasks
                      </td>
                    );
                  }
                  return <td key={p}>—</td>;
                })}
              </tr>
              {expanded.has(r.key) && <TaskRows row={r} colSpan={colSpan} baseUrl={baseUrl} />}
            </React.Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td className="total">{fmt(matrix.grandTotal)}</td>
            {matrix.projects.map((p) => <td key={p}>{fmt(matrix.projectTotals.get(p)!)}</td>)}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
