import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../App';
import { LoadOrchestrator, LoadResult } from '../../services/LoadOrchestrator';
import { DateWindow, TaskItem } from '../../models/types';

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

/** Orchestrator stub: App only ever calls load(). */
function stubOrchestrator(result: Partial<LoadResult>): LoadOrchestrator {
  const load = async (win: DateWindow): Promise<LoadResult> => ({
    tasks: [],
    skippedProjects: [],
    allProjectsFailed: false,
    projectCount: 1,
    window: win,
    ...result,
  });
  return { load } as unknown as LoadOrchestrator;
}

const twoPeople = [
  task({ id: 1, assigneeKey: 'u1', assigneeName: 'User One', project: 'A', originalEstimate: 8, completedWork: 2 }),
  task({ id: 2, assigneeKey: 'u2', assigneeName: 'User Two', project: 'B', originalEstimate: 40, completedWork: 20 }),
];

function renderApp(result: Partial<LoadResult>) {
  return render(<App orchestrator={stubOrchestrator(result)} baseUrl="http://s" />);
}

describe('App', () => {
  it('scopes projects and totals to the filtered person', async () => {
    const { getByPlaceholderText, getByText, getAllByText, queryByText } = renderApp({
      tasks: twoPeople,
      projectCount: 2,
    });
    await waitFor(() => expect(getByText('User One')).toBeTruthy());

    fireEvent.change(getByPlaceholderText('Filter by name…'), { target: { value: 'one' } });

    // Project B belongs only to the filtered-out person, so its column disappears
    // and every total shows User One's hours, not the collection's.
    expect(queryByText('User Two')).toBeNull();
    expect(queryByText('B')).toBeNull();
    expect(getAllByText('8 / 2').length).toBeGreaterThan(0);
    expect(queryByText('48 / 22')).toBeNull();
  });

  it('says nobody matches the filter instead of claiming the window is empty', async () => {
    const { getByPlaceholderText, getByText, queryByText } = renderApp({ tasks: twoPeople, projectCount: 2 });
    await waitFor(() => expect(getByText('User One')).toBeTruthy());

    fireEvent.change(getByPlaceholderText('Filter by name…'), { target: { value: 'nobody here' } });

    expect(getByText(/Nobody matches the filter/)).toBeTruthy();
    expect(queryByText(/No assigned tasks/)).toBeNull();
  });

  it('reports an empty window when the load genuinely returned no tasks', async () => {
    const { getByText } = renderApp({ tasks: [], projectCount: 2 });
    await waitFor(() => expect(getByText(/No assigned tasks/)).toBeTruthy());
  });
});
