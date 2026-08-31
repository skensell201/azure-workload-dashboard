import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { AccessPanel, AccessPanelService } from '../AccessPanel';
import { AccessEntry, AccessList } from '../../services/access';

function fakeService(overrides: Partial<AccessPanelService> = {}): AccessPanelService {
  return {
    readList: async () => ({ entries: [] }),
    searchIdentities: async () => [],
    writeList: async () => undefined,
    ...overrides,
  };
}

describe('AccessPanel', () => {
  it('announces that everyone has access when the stored list is empty', async () => {
    const { getByText } = render(<AccessPanel service={fakeService()} onClose={() => {}} />);
    await waitFor(() => expect(getByText(/Everyone has access/)).toBeTruthy());
  });

  it('shows how many entries are active when the list is non-empty', async () => {
    const list: AccessList = { entries: [{ id: 'u1', name: 'Alice', kind: 'user' }, { id: 'g1', name: 'Team A', kind: 'group' }] };
    const { getByText, getAllByText } = render(
      <AccessPanel service={fakeService({ readList: async () => list })} onClose={() => {}} />
    );
    await waitFor(() => expect(getByText(/2 entries/)).toBeTruthy());
    expect(getAllByText('Alice').length).toBeGreaterThan(0);
    expect(getAllByText('Team A').length).toBeGreaterThan(0);
  });

  it('shows an explicit storage error and starts with an empty editable list when the list cannot be read', async () => {
    const { getByText } = render(
      <AccessPanel service={fakeService({ readList: async () => null })} onClose={() => {}} />
    );
    await waitFor(() => expect(getByText(/could not be read/)).toBeTruthy());
    expect(getByText(/Everyone has access/)).toBeTruthy();
  });

  it('searching renders results with an Add action', async () => {
    const results: AccessEntry[] = [{ id: 'u2', name: 'Bob', kind: 'user' }];
    const { getByPlaceholderText, getByText } = render(
      <AccessPanel service={fakeService({ searchIdentities: async (q) => (q === 'bob' ? results : []) })} onClose={() => {}} />
    );
    fireEvent.change(getByPlaceholderText('Search identities…'), { target: { value: 'bob' } });
    await waitFor(() => expect(getByText('Bob')).toBeTruthy());
  });

  it('adding a search result then saving passes the new list to the service', async () => {
    const results: AccessEntry[] = [{ id: 'u2', name: 'Bob', kind: 'user' }];
    let saved: AccessList | null = null;
    const service = fakeService({
      searchIdentities: async () => results,
      writeList: async (list) => {
        saved = list;
      },
    });
    const { getByPlaceholderText, getByText } = render(<AccessPanel service={service} onClose={() => {}} />);
    await waitFor(() => expect(getByText(/Everyone has access/)).toBeTruthy());

    fireEvent.change(getByPlaceholderText('Search identities…'), { target: { value: 'bob' } });
    await waitFor(() => expect(getByText('Bob')).toBeTruthy());
    fireEvent.click(getByText('Add'));
    fireEvent.click(getByText('Save'));

    await waitFor(() => expect(saved).toEqual({ entries: [{ id: 'u2', name: 'Bob', kind: 'user' }] }));
  });

  it('removing an entry drops it from the pending list', async () => {
    const list: AccessList = { entries: [{ id: 'u1', name: 'Alice', kind: 'user' }] };
    const { getByText, queryByText } = render(
      <AccessPanel service={fakeService({ readList: async () => list })} onClose={() => {}} />
    );
    await waitFor(() => expect(getByText('Alice')).toBeTruthy());

    fireEvent.click(getByText('Remove'));

    expect(queryByText('Alice')).toBeNull();
    expect(getByText(/Everyone has access/)).toBeTruthy();
  });
});
