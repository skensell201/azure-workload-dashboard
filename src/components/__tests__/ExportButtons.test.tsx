import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { ExportButtons } from '../ExportButtons';
import { buildMatrix } from '../../services/Aggregation';
import { TaskItem } from '../../models/types';

function task(over: Partial<TaskItem>): TaskItem {
  return {
    id: 1,
    title: 'Fix bug',
    state: 'Active',
    project: 'A',
    iterationPath: 'A\\S1',
    assigneeKey: 'u1',
    assigneeName: 'User One',
    originalEstimate: 8,
    completedWork: 2,
    ...over,
  };
}

const win = { start: '2026-08-31', end: '2026-09-13' };
const matrix = buildMatrix([task({})]);

describe('ExportButtons', () => {
  it('downloads a CSV named after the window, containing the matrix', () => {
    const saved: Array<{ name: string; content: string | Blob }> = [];
    const { getByText } = render(
      <ExportButtons matrix={matrix} window={win} download={(name, content) => saved.push({ name, content })} />
    );

    fireEvent.click(getByText('CSV'));

    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('workload-2026-08-31_2026-09-13.csv');
    expect(String(saved[0].content)).toContain('User One');
  });

  it('downloads an Excel workbook', () => {
    const saved: Array<{ name: string; content: string | Blob }> = [];
    const { getByText } = render(
      <ExportButtons matrix={matrix} window={win} download={(name, content) => saved.push({ name, content })} />
    );

    fireEvent.click(getByText('Excel'));

    expect(saved).toHaveLength(1);
    expect(saved[0].name).toBe('workload-2026-08-31_2026-09-13.xlsx');
    expect(saved[0].content).toBeInstanceOf(Blob);
  });

  it('disables both buttons when there is nothing to export', () => {
    const { getByText } = render(<ExportButtons matrix={buildMatrix([])} window={win} download={() => undefined} />);
    expect((getByText('CSV') as HTMLButtonElement).disabled).toBe(true);
    expect((getByText('Excel') as HTMLButtonElement).disabled).toBe(true);
  });
});
