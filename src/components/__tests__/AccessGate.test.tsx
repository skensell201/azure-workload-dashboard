import React from 'react';
import { render } from '@testing-library/react';
import { AccessGate } from '../AccessGate';
import { LoadOrchestrator, LoadResult } from '../../services/LoadOrchestrator';
import { DateWindow } from '../../models/types';
import { AccessPanelService } from '../AccessPanel';

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

function stubAccessService(): AccessPanelService {
  return {
    readList: async () => ({ entries: [] }),
    searchIdentities: async () => [],
    writeList: async () => undefined,
  };
}

describe('AccessGate', () => {
  it('renders exactly the required denial sentence when the user is not listed', () => {
    const { getByText, queryByText } = render(
      <AccessGate
        decision={{ allowed: false, reason: 'not-listed' }}
        listUnreadable={false}
        orchestrator={stubOrchestrator()}
        baseUrl="http://s"
        accessService={stubAccessService()}
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
        accessService={stubAccessService()}
      />
    );
    expect(getByText(/could not be read/)).toBeTruthy();
    expect(queryByText('You do not have access to Workload. Ask a collection administrator to grant it.')).toBeNull();
  });

  it('renders the app without an Access button for an allowed non-admin', () => {
    const { getByText, queryByText } = render(
      <AccessGate
        decision={{ allowed: true, reason: 'unrestricted' }}
        listUnreadable={false}
        orchestrator={stubOrchestrator()}
        baseUrl="http://s"
        accessService={stubAccessService()}
      />
    );
    expect(getByText('Refresh')).toBeTruthy();
    expect(queryByText('Access')).toBeNull();
  });

  it('renders the app with an Access button for an admin', () => {
    const { getByText } = render(
      <AccessGate
        decision={{ allowed: true, reason: 'admin' }}
        listUnreadable={false}
        orchestrator={stubOrchestrator()}
        baseUrl="http://s"
        accessService={stubAccessService()}
      />
    );
    expect(getByText('Refresh')).toBeTruthy();
    expect(getByText('Access')).toBeTruthy();
  });

  it('surfaces the storage warning to an admin who is let in despite an unreadable list', () => {
    const { getByText } = render(
      <AccessGate
        decision={{ allowed: true, reason: 'admin' }}
        listUnreadable={true}
        orchestrator={stubOrchestrator()}
        baseUrl="http://s"
        accessService={stubAccessService()}
      />
    );
    expect(getByText(/could not be read/)).toBeTruthy();
  });
});
