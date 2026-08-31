import React from 'react';
import { DateWindow } from '../models/types';
import { Matrix } from '../services/Aggregation';
import { exportBaseName, matrixToTable, toCsv, toXlsxBlob } from '../services/ExportService';

export type Download = (filename: string, content: string | Blob) => void;

const defaultDownload: Download = (filename, content) => {
  const blob = typeof content === 'string' ? new Blob([content], { type: 'text/csv;charset=utf-8' }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export function ExportButtons({
  matrix,
  window: win,
  download = defaultDownload,
}: {
  matrix: Matrix;
  window: DateWindow;
  download?: Download;
}): JSX.Element {
  const disabled = matrix.rows.length === 0;
  const base = exportBaseName(win);
  return (
    <>
      <button disabled={disabled} onClick={() => download(`${base}.csv`, toCsv(matrixToTable(matrix)))}>
        CSV
      </button>
      <button disabled={disabled} onClick={() => download(`${base}.xlsx`, toXlsxBlob(matrix))}>
        Excel
      </button>
    </>
  );
}
