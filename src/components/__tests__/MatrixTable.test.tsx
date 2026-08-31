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
    const { getByText, getAllByText } = render(<MatrixTable matrix={matrix} filter="" baseUrl="http://s" />);
    expect(getByText('User One')).toBeTruthy();
    expect(getByText('User Two')).toBeTruthy();
    expect(getAllByText('24 / 6').length).toBeGreaterThan(0);
    expect(getAllByText('56 / 24').length).toBeGreaterThan(0);
  });

  it('expands a row into the task list on click', () => {
    const { getByText, queryByText } = render(<MatrixTable matrix={matrix} filter="" baseUrl="http://s" />);
    expect(queryByText('Fix bug')).toBeNull();
    fireEvent.click(getByText('User One'));
    expect(getByText('Fix bug')).toBeTruthy();
  });

  it('filters rows by name substring, case-insensitive', () => {
    const { queryByText } = render(<MatrixTable matrix={matrix} filter="two" baseUrl="http://s" />);
    expect(queryByText('User One')).toBeNull();
    expect(queryByText('User Two')).toBeTruthy();
  });

  it('shows a dash for a project the person has no tasks in', () => {
    const { getAllByText } = render(<MatrixTable matrix={matrix} filter="" baseUrl="http://s" />);
    expect(getAllByText('—').length).toBe(1);
  });
});
