import React, { useState } from 'react';
import { Matrix, MatrixCell, MatrixRow } from '../services/Aggregation';

function fmt(c: MatrixCell): string {
  return `${c.oe} / ${c.completed}`;
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
                <td>{t.originalEstimate} / {t.completedWork}</td>
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
    <table className="matrix">
      <thead>
        <tr>
          <th>Специалист</th>
          {matrix.projects.map((p) => <th key={p}>{p}</th>)}
          <th>Итого</th>
        </tr>
      </thead>
      <tbody>
        {matrix.rows.map((r) => (
          <React.Fragment key={r.key}>
            <tr className="person-row" onClick={() => toggle(r.key)}>
              <td>{r.name}</td>
              {matrix.projects.map((p) => {
                const cell = r.cells.get(p);
                return <td key={p}>{cell ? fmt(cell) : '—'}</td>;
              })}
              <td className="total">{fmt(r.total)}</td>
            </tr>
            {expanded.has(r.key) && <TaskRows row={r} colSpan={colSpan} baseUrl={baseUrl} />}
          </React.Fragment>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td>Итого</td>
          {matrix.projects.map((p) => <td key={p}>{fmt(matrix.projectTotals.get(p)!)}</td>)}
          <td className="total">{fmt(matrix.grandTotal)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
