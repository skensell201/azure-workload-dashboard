import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { MatrixTable } from '../MatrixTable';
import { buildMatrix } from '../../services/Aggregation';
import { TaskItem } from '../../models/types';

function task(over: Partial<TaskItem>): TaskItem {
  return {
    id: 1, title: 'Fix bug', state: 'Active', project: 'A', iterationPath: 'A\\S1',
    assigneeKey: 'u1', assigneeName: 'User One', originalEstimate: 8, completedWork: 2, ...over,
  };
}

const matrix = buildMatrix([
  task({ id: 1 }),
  task({ id: 2, title: 'Write docs', project: 'B', originalEstimate: 16, completedWork: 4 }),
  task({ id: 3, assigneeKey: 'u2', assigneeName: 'User Two', project: 'B', originalEstimate: 40, completedWork: 20 }),
]);

describe('MatrixTable', () => {
  it('renders one row per person with per-project cells and totals', () => {
    const { getByText, getAllByText } = render(<MatrixTable matrix={matrix} baseUrl="http://s" />);
    expect(getByText('User One')).toBeTruthy();
    expect(getByText('User Two')).toBeTruthy();
    expect(getAllByText('24 / 6').length).toBeGreaterThan(0);
    expect(getAllByText('56 / 24').length).toBeGreaterThan(0);
  });

  it('spells out what the two numbers mean under every hours column', () => {
    const { getAllByText } = render(<MatrixTable matrix={matrix} baseUrl="http://s" />);
    // One per project column plus the Total column.
    expect(getAllByText('planned / done')).toHaveLength(matrix.projects.length + 1);
  });

  it('expands a row into the task list on click', () => {
    const { getByText, queryByText } = render(<MatrixTable matrix={matrix} baseUrl="http://s" />);
    expect(queryByText('Fix bug')).toBeNull();
    fireEvent.click(getByText('User One'));
    expect(getByText('Fix bug')).toBeTruthy();
  });

  it('shows a dash for a project the person has no tasks in', () => {
    const { getAllByText } = render(<MatrixTable matrix={matrix} baseUrl="http://s" />);
    expect(getAllByText('—').length).toBe(1);
  });

  it('rounds accumulated float hours for display', () => {
    const m = buildMatrix([
      task({ id: 1, originalEstimate: 8, completedWork: 0.3 }),
      task({ id: 2, title: 'Write docs', originalEstimate: 7.5, completedWork: 0.6 }),
    ]);
    const { getAllByText } = render(<MatrixTable matrix={m} baseUrl="http://s" />);
    expect(getAllByText('15.5 / 0.9').length).toBeGreaterThan(0);
  });

  it('says "no tasks" for a project the person is in the team of but has no tasks in', () => {
    const m = buildMatrix(
      [task({ id: 1, assigneeKey: 'u1', assigneeName: 'User One', project: 'A' })],
      [{ key: 'u1', name: 'User One', projects: ['A', 'B'] }]
    );
    const { getAllByText, getByText } = render(<MatrixTable matrix={m} baseUrl="http://s" />);
    expect(getAllByText('no tasks')).toHaveLength(1);
    // The mark belongs to the project the person was not planned in, not to the one with hours.
    const cell = getAllByText('no tasks')[0];
    expect(cell.closest('td')?.previousElementSibling?.textContent).toBe('8 / 2');
  });

  it('keeps the dash for a project the person is not in the team of', () => {
    const m = buildMatrix(
      [
        task({ id: 1, assigneeKey: 'u1', assigneeName: 'User One', project: 'A' }),
        task({ id: 2, assigneeKey: 'u2', assigneeName: 'User Two', project: 'B' }),
      ],
      [{ key: 'u1', name: 'User One', projects: ['A'] }]
    );
    const { container, queryAllByText } = render(<MatrixTable matrix={m} baseUrl="http://s" />);
    // User One is not in B's team and has no task there: that cell stays a dash.
    const row = [...container.querySelectorAll('tr.person-row')].find((tr) =>
      tr.textContent?.includes('User One')
    )!;
    const cells = [...row.querySelectorAll('td')].map((td) => td.textContent);
    expect(cells[1]).toBe('8 / 2');
    expect(cells[2]).toBe('8 / 2');
    expect(cells[3]).toBe('—');
    expect(queryAllByText('no tasks')).toHaveLength(0);
  });
});
