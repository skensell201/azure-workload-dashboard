import React from 'react';
import { render } from '@testing-library/react';
import { AccessGate } from '../AccessGate';
import { LoadOrchestrator, LoadResult } from '../../services/LoadOrchestrator';
import { DateWindow } from '../../models/types';

function stubOrchestrator(): LoadOrchestrator {
  const load = async (win: DateWindow): Promise<LoadResult> => ({
    tasks: [],
    skippedProjects: [],
    allProjectsFailed: false,
    projectCount: 0,
    window: win,
    roster: [],
  });
  return { load } as unknown as LoadOrchestrator;
}

describe('AccessGate', () => {
  it('renders exactly the required denial sentence when the user is not listed', () => {
    const { getByText, queryByText } = render(
      <AccessGate
        decision={{ allowed: false, reason: 'not-listed' }}
        listUnreadable={false}
        orchestrator={stubOrchestrator()}
        baseUrl="http://s"
      />
    );
    expect(getByText('You do not have access to Workload. Ask a collection administrator to grant it.')).toBeTruthy();
    expect(queryByText('Refresh')).toBeNull();
  });

  it('renders a distinct error, not the generic denial sentence, when the list could not be read', () => {
    const { getByText, queryByText } = render(
      <AccessGate
        decision={{ allowed: false, reason: 'list-unreadable' }}
        listUnreadable={true}
        orchestrator={stubOrchestrator()}
        baseUrl="http://s"
      />
    );
    expect(getByText(/could not be read/)).toBeTruthy();
    expect(queryByText('You do not have access to Workload. Ask a collection administrator to grant it.')).toBeNull();
  });

  it('renders a distinct sentence directing the user to a collection administrator when membership could not be checked', () => {
    const { getByText, queryByText } = render(
      <AccessGate
        decision={{ allowed: false, reason: 'membership-unverified' }}
        listUnreadable={false}
        orchestrator={stubOrchestrator()}
        baseUrl="http://s"
      />
    );
    expect(
      getByText(
        'Your group membership could not be checked, so access to Workload could not be confirmed. Ask a collection administrator to add you directly.'
      )
    ).toBeTruthy();
    expect(queryByText('You do not have access to Workload. Ask a collection administrator to grant it.')).toBeNull();
  });

  it('renders the app for an allowed non-admin', () => {
    const { getByText } = render(
      <AccessGate
        decision={{ allowed: true, reason: 'unrestricted' }}
        listUnreadable={false}
        orchestrator={stubOrchestrator()}
        baseUrl="http://s"
      />
    );
    expect(getByText('Refresh')).toBeTruthy();
  });

  it('never offers list editing in the hub — that lives in collection settings', () => {
    const { queryByText } = render(
      <AccessGate
        decision={{ allowed: true, reason: 'admin' }}
        listUnreadable={false}
        orchestrator={stubOrchestrator()}
        baseUrl="http://s"
      />
    );
    expect(queryByText('Access')).toBeNull();
    expect(queryByText('Save')).toBeNull();
  });

  it('surfaces the storage warning to an admin who is let in despite an unreadable list', () => {
    const { getByText } = render(
      <AccessGate
        decision={{ allowed: true, reason: 'admin' }}
        listUnreadable={true}
        orchestrator={stubOrchestrator()}
        baseUrl="http://s"
      />
    );
    expect(getByText(/could not be read/)).toBeTruthy();
  });
});
