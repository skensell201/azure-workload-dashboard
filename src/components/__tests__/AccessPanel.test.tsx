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

  it('disables Save and hides the reassuring empty-list status when the initial read fails', async () => {
    const { getByText, queryByText } = render(
      <AccessPanel service={fakeService({ readList: async () => null })} onClose={() => {}} />
    );
    await waitFor(() =>
      expect(
        getByText('Could not read the current access list. Saving is disabled so the stored list is not overwritten.')
      ).toBeTruthy()
    );
    expect(queryByText(/Everyone has access/)).toBeNull();
    expect((getByText('Save') as HTMLButtonElement).disabled).toBe(true);
  });

  it('keeps Save enabled when the initial read succeeds with a genuinely empty list', async () => {
    const { getByText } = render(<AccessPanel service={fakeService({ readList: async () => ({ entries: [] }) })} onClose={() => {}} />);
    await waitFor(() => expect(getByText(/Everyone has access/)).toBeTruthy());
    expect((getByText('Save') as HTMLButtonElement).disabled).toBe(false);
  });

  it('treats a rejected read as unreadable rather than as an empty list', async () => {
    const { getByText, queryByText } = render(
      <AccessPanel
        service={fakeService({
          readList: async () => {
            throw new Error('storage down');
          },
        })}
        onClose={() => {}}
      />
    );
    await waitFor(() => expect(getByText(/Could not read the current access list/)).toBeTruthy());
    expect(queryByText(/Everyone has access/)).toBeNull();
    expect((getByText('Save') as HTMLButtonElement).disabled).toBe(true);
  });

  it('offers to create a list only when the stored one could not be read', async () => {
    const { queryByText } = render(<AccessPanel service={fakeService()} onClose={() => {}} />);
    await waitFor(() => expect(queryByText(/Everyone has access/)).toBeTruthy());
    expect(queryByText('Create a new access list')).toBeNull();
  });

  it('creating a new list writes an empty one, re-reads it, and leaves Save disabled meanwhile', async () => {
    const written: AccessList[] = [];
    let stored: AccessList | null = null;
    const { getByText } = render(
      <AccessPanel
        service={fakeService({
          readList: async () => stored,
          writeList: async (list) => {
            written.push(list);
            stored = list;
          },
        })}
        onClose={() => {}}
      />
    );
    await waitFor(() => expect(getByText('Create a new access list')).toBeTruthy());
    expect((getByText('Save') as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(getByText('Create a new access list'));

    await waitFor(() => expect(getByText(/Everyone has access/)).toBeTruthy());
    expect(written).toEqual([{ entries: [] }]);
    expect((getByText('Save') as HTMLButtonElement).disabled).toBe(false);
  });

  it('treats identity ids case-insensitively, as the access gate does', async () => {
    const list: AccessList = { entries: [{ id: 'ABC-1', name: 'Alice', kind: 'user' }] };
    const { getByText, getAllByText } = render(
      <AccessPanel
        service={fakeService({
          readList: async () => list,
          searchIdentities: async () => [{ id: 'abc-1', name: 'Alice', kind: 'user' }],
        })}
        onClose={() => {}}
      />
    );
    await waitFor(() => expect(getByText(/1 entry|1 entries/)).toBeTruthy());

    fireEvent.change(getByText('Access').parentElement!.parentElement!.querySelector('input')!, {
      target: { value: 'ali' },
    });

    await waitFor(() => expect(getAllByText('Alice').length).toBeGreaterThan(1));
    expect((getByText('Add') as HTMLButtonElement).disabled).toBe(true);
  });

  it('reads the list back after saving and reports what storage actually holds', async () => {
    let stored: AccessList | null = { entries: [] };
    const { getByText, getByPlaceholderText } = render(
      <AccessPanel
        service={fakeService({
          readList: async () => stored,
          searchIdentities: async () => [{ id: 'u1', name: 'Alice', kind: 'user' }],
          writeList: async (list) => {
            stored = list;
          },
        })}
        onClose={() => {}}
      />
    );
    await waitFor(() => expect(getByText(/Everyone has access/)).toBeTruthy());

    fireEvent.change(getByPlaceholderText('Search identities…'), { target: { value: 'ali' } });
    await waitFor(() => expect(getByText('Add')).toBeTruthy());
    fireEvent.click(getByText('Add'));
    fireEvent.click(getByText('Save'));

    await waitFor(() => expect(getByText(/Storage now holds 1/)).toBeTruthy());
  });

  it('reports a save that storage did not keep', async () => {
    const { getByText, getByPlaceholderText } = render(
      <AccessPanel
        service={fakeService({
          // Write silently lands somewhere this page cannot read back.
          readList: async () => ({ entries: [] }),
          searchIdentities: async () => [{ id: 'u1', name: 'Alice', kind: 'user' }],
          writeList: async () => undefined,
        })}
        onClose={() => {}}
      />
    );
    await waitFor(() => expect(getByText(/Everyone has access/)).toBeTruthy());

    fireEvent.change(getByPlaceholderText('Search identities…'), { target: { value: 'ali' } });
    await waitFor(() => expect(getByText('Add')).toBeTruthy());
    fireEvent.click(getByText('Add'));
    fireEvent.click(getByText('Save'));

    await waitFor(() => expect(getByText(/Storage now holds 0/)).toBeTruthy());
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

  it('shows an error instead of stale results when a search fails', async () => {
    const { getByPlaceholderText, getByText, queryByText } = render(
      <AccessPanel
        service={fakeService({
          searchIdentities: async () => {
            throw new Error('identities service unavailable');
          },
        })}
        onClose={() => {}}
      />
    );
    fireEvent.change(getByPlaceholderText('Search identities…'), { target: { value: 'bob' } });
    await waitFor(() => expect(getByText(/identities service unavailable/)).toBeTruthy());
    expect(queryByText('Bob')).toBeNull();
  });

  it('does not let a slow earlier search overwrite the results of a newer one', async () => {
    let resolveFirst: (value: AccessEntry[]) => void = () => {};
    const first = new Promise<AccessEntry[]>((resolve) => {
      resolveFirst = resolve;
    });
    const service = fakeService({
      searchIdentities: async (q) => {
        if (q === 'al') return first;
        return [{ id: 'b1', name: 'Bob', kind: 'user' }];
      },
    });
    const { getByPlaceholderText, getByText, queryByText } = render(<AccessPanel service={service} onClose={() => {}} />);
    const input = getByPlaceholderText('Search identities…');

    fireEvent.change(input, { target: { value: 'al' } });
    fireEvent.change(input, { target: { value: 'bob' } });
    await waitFor(() => expect(getByText('Bob')).toBeTruthy());

    resolveFirst([{ id: 'a1', name: 'Alice', kind: 'user' }]);
    await Promise.resolve();
    await Promise.resolve();

    expect(getByText('Bob')).toBeTruthy();
    expect(queryByText('Alice')).toBeNull();
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
