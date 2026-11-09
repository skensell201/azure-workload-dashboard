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
    roster: [],
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

/** Names of the matrix rows, which the picker's own labels would otherwise be confused with. */
function rowNames(container: HTMLElement): string[] {
  return [...container.querySelectorAll('.person-name')].map((el) => el.textContent ?? '');
}

describe('App', () => {
  it('scopes projects and totals to the filtered person', async () => {
    const { getByPlaceholderText, getByText, getAllByText, queryByText } = renderApp({
      tasks: twoPeople,
      projectCount: 2,
    });
    await waitFor(() => expect(getByText('User One')).toBeTruthy());

    fireEvent.change(getByPlaceholderText('Find person…'), { target: { value: 'one' } });

    // Project B belongs only to the filtered-out person, so its column disappears
    // and every total shows User One's hours, not the collection's.
    expect(queryByText('User Two')).toBeNull();
    expect(queryByText('B')).toBeNull();
    expect(getAllByText('8 / 2').length).toBeGreaterThan(0);
    expect(queryByText('48 / 22')).toBeNull();
  });

  it('says nobody matches the search instead of claiming the window is empty', async () => {
    const { getByPlaceholderText, getByText, queryByText } = renderApp({ tasks: twoPeople, projectCount: 2 });
    await waitFor(() => expect(getByText('User One')).toBeTruthy());

    fireEvent.change(getByPlaceholderText('Find person…'), { target: { value: 'nobody here' } });

    expect(getByText(/Nobody matches the search/)).toBeTruthy();
    expect(queryByText(/No assigned tasks/)).toBeNull();
  });

  it('narrows the table to the people checked in the picker, search text notwithstanding', async () => {
    const three = [
      ...twoPeople,
      task({ id: 3, assigneeKey: 'u3', assigneeName: 'Third Person', project: 'C', originalEstimate: 4, completedWork: 1 }),
    ];
    const { container, getByText, getByLabelText, getByPlaceholderText, queryByText } = renderApp({
      tasks: three,
      projectCount: 3,
    });
    await waitFor(() => expect(getByText('User One')).toBeTruthy());

    fireEvent.click(getByText(/^People/));
    fireEvent.click(getByLabelText('User One'));
    fireEvent.click(getByLabelText('Third Person'));
    // A leftover search must not narrow an explicit selection any further.
    fireEvent.change(getByPlaceholderText('Find person…'), { target: { value: 'user one' } });

    expect(rowNames(container)).toEqual(['Third Person', 'User One']);
    // Project B belongs only to the unselected person, so its column goes away.
    expect(queryByText('B')).toBeNull();
  });

  it('clears the selection and goes back to searching everyone', async () => {
    const { container, getByText, getByLabelText } = renderApp({ tasks: twoPeople, projectCount: 2 });
    await waitFor(() => expect(getByText('User One')).toBeTruthy());

    fireEvent.click(getByText(/^People/));
    fireEvent.click(getByLabelText('User One'));
    expect(rowNames(container)).toEqual(['User One']);

    fireEvent.click(getByText('Clear selection'));
    expect(rowNames(container)).toEqual(['User One', 'User Two']);
  });

  it('reports an empty window when the load genuinely returned no tasks', async () => {
    const { getByText } = renderApp({ tasks: [], projectCount: 2 });
    await waitFor(() => expect(getByText(/No assigned tasks/)).toBeTruthy());
  });

  it('shows a roster-only person as a zero row in the Total column', async () => {
    const { getByText, getAllByText } = renderApp({
      tasks: twoPeople,
      projectCount: 2,
      roster: [{ key: 'u9', name: 'Nobody Has Tasks', projects: [] }],
    });
    await waitFor(() => expect(getByText('Nobody Has Tasks')).toBeTruthy());
    expect(getAllByText('0 / 0').length).toBeGreaterThan(0);
  });

  it('hides roster-only rows immediately when the checkbox is unchecked, without reloading', async () => {
    let loadCalls = 0;
    const load = async (win: DateWindow): Promise<LoadResult> => {
      loadCalls++;
      return {
        tasks: twoPeople,
        skippedProjects: [],
        allProjectsFailed: false,
        projectCount: 2,
        window: win,
        roster: [{ key: 'u9', name: 'Nobody Has Tasks', projects: [] }],
      };
    };
    const orchestrator = { load } as unknown as LoadOrchestrator;
    const { getByText, queryByText, getByLabelText } = render(<App orchestrator={orchestrator} baseUrl="http://s" />);
    await waitFor(() => expect(getByText('Nobody Has Tasks')).toBeTruthy());
    expect(loadCalls).toBe(1);

    fireEvent.click(getByLabelText('Include people with no tasks'));

    expect(queryByText('Nobody Has Tasks')).toBeNull();
    expect(loadCalls).toBe(1);
  });

  it('marks a team member who has no tasks in the project as "no tasks"', async () => {
    const { getByText, getAllByText } = renderApp({
      tasks: [task({ id: 1, assigneeKey: 'u1', assigneeName: 'User One', project: 'A' })],
      projectCount: 1,
      roster: [{ key: 'u1', name: 'User One', projects: ['A', 'B'] }],
    });
    await waitFor(() => expect(getByText('User One')).toBeTruthy());

    // A: hours. B: in the team, nothing planned. Only one "no tasks" mark in the row.
    expect(getAllByText('no tasks')).toHaveLength(1);
  });

  it('drops the "no tasks" marks when the roster is switched off', async () => {
    const { getByText, queryAllByText, getByLabelText } = renderApp({
      tasks: [task({ id: 1, assigneeKey: 'u1', assigneeName: 'User One', project: 'A' })],
      projectCount: 1,
      roster: [{ key: 'u1', name: 'User One', projects: ['A', 'B'] }],
    });
    await waitFor(() => expect(getByText('User One')).toBeTruthy());
    expect(queryAllByText('no tasks')).toHaveLength(1);

    fireEvent.click(getByLabelText('Include people with no tasks'));

    expect(queryAllByText('no tasks')).toHaveLength(0);
  });
});
