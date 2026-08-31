import { AccessService, AccessDocumentStore } from '../AccessService';
import { ApiClient } from '../ApiClient';
import { AccessList } from '../access';

function fakeApi(handlers: { get?: (path: string) => unknown }): ApiClient {
  return {
    get: async <T>(path: string) => handlers.get!(path) as T,
    post: async <T>() => {
      throw new Error('unexpected POST');
    },
  };
}

function fakeStore(overrides: Partial<AccessDocumentStore> = {}): AccessDocumentStore {
  return {
    getDocument: async () => {
      throw new Error('not implemented');
    },
    setDocument: async (_c, doc) => doc,
    ...overrides,
  };
}

describe('AccessService.searchIdentities', () => {
  it('returns an empty array without calling the API for a blank query', async () => {
    const api = fakeApi({ get: () => { throw new Error('should not be called'); } });
    const results = await new AccessService(api, fakeStore()).searchIdentities('   ');
    expect(results).toEqual([]);
  });

  it('searches with the correct URL and marks groups from isContainer', async () => {
    let calledPath = '';
    const api = fakeApi({
      get: (path) => {
        calledPath = path;
        return {
          value: [
            { id: 'u1', providerDisplayName: 'Alice', isContainer: false },
            { id: 'g1', displayName: 'Team A', isContainer: true },
            { id: 'u2' },
          ],
        };
      },
    });
    const results = await new AccessService(api, fakeStore()).searchIdentities('ali');
    expect(calledPath).toBe('/_apis/identities?searchFilter=General&filterValue=ali&queryMembership=None&api-version=6.0');
    expect(results).toEqual([
      { id: 'u1', name: 'Alice', kind: 'user' },
      { id: 'g1', name: 'Team A', kind: 'group' },
      { id: 'u2', name: 'u2', kind: 'user' },
    ]);
  });
});

describe('AccessService.getUserGroupIds', () => {
  it('resolves the transitive memberOf descriptors to group ids', async () => {
    const paths: string[] = [];
    const api = fakeApi({
      get: (path) => {
        paths.push(path);
        if (path.includes('identityIds=user-1')) {
          return { value: [{ id: 'user-1', memberOf: ['desc-a', 'desc-b'] }] };
        }
        if (path.includes('identityIds=desc-a')) {
          return { value: [{ id: 'group-a' }] };
        }
        if (path.includes('identityIds=desc-b')) {
          return { value: [{ id: 'group-b' }] };
        }
        throw new Error(`unexpected path: ${path}`);
      },
    });
    const ids = await new AccessService(api, fakeStore()).getUserGroupIds('user-1');
    expect(ids.sort()).toEqual(['group-a', 'group-b']);
    expect(paths[0]).toBe('/_apis/identities?identityIds=user-1&queryMembership=Expanded&api-version=6.0');
  });

  it('returns an empty array when the identity has no memberships, without extra calls', async () => {
    const paths: string[] = [];
    const api = fakeApi({
      get: (path) => {
        paths.push(path);
        return { value: [{ id: 'user-1' }] };
      },
    });
    const ids = await new AccessService(api, fakeStore()).getUserGroupIds('user-1');
    expect(ids).toEqual([]);
    expect(paths).toHaveLength(1);
  });
});

describe('AccessService.isCollectionAdmin', () => {
  it('is true when the user is a member of Project Collection Administrators', async () => {
    const api = fakeApi({
      get: (path) => {
        if (path.includes('filterValue=Project')) {
          return { value: [{ id: 'pca-1', providerDisplayName: 'Project Collection Administrators', isContainer: true }] };
        }
        if (path.includes('identityIds=user-1')) {
          return { value: [{ id: 'user-1', memberOf: ['desc-pca'] }] };
        }
        if (path.includes('identityIds=desc-pca')) {
          return { value: [{ id: 'pca-1' }] };
        }
        throw new Error(`unexpected path: ${path}`);
      },
    });
    expect(await new AccessService(api, fakeStore()).isCollectionAdmin('user-1')).toBe(true);
  });

  it('is false when the admin group cannot be found', async () => {
    const api = fakeApi({ get: () => ({ value: [] }) });
    expect(await new AccessService(api, fakeStore()).isCollectionAdmin('user-1')).toBe(false);
  });

  it('is false when the user does not belong to the admin group', async () => {
    const api = fakeApi({
      get: (path) => {
        if (path.includes('filterValue=Project')) {
          return { value: [{ id: 'pca-1', providerDisplayName: 'Project Collection Administrators', isContainer: true }] };
        }
        return { value: [{ id: 'user-1' }] };
      },
    });
    expect(await new AccessService(api, fakeStore()).isCollectionAdmin('user-1')).toBe(false);
  });
});

describe('AccessService.readList', () => {
  it('returns entries from the stored document', async () => {
    const store = fakeStore({
      getDocument: async () => ({ id: 'access-control', entries: [{ id: 'u1', name: 'Alice', kind: 'user' }] }),
    });
    const list = await new AccessService(fakeApi({}), store).readList();
    expect(list).toEqual({ entries: [{ id: 'u1', name: 'Alice', kind: 'user' }] });
  });

  it('returns an empty list when the document does not exist yet (404)', async () => {
    const store = fakeStore({
      getDocument: async () => {
        const e = new Error('not found') as Error & { status: number };
        e.status = 404;
        throw e;
      },
    });
    const list = await new AccessService(fakeApi({}), store).readList();
    expect(list).toEqual({ entries: [] });
  });

  it('returns null (not an empty list, not a throw) when storage fails for another reason', async () => {
    const store = fakeStore({
      getDocument: async () => {
        throw new Error('service unavailable');
      },
    });
    const list = await new AccessService(fakeApi({}), store).readList();
    expect(list).toBeNull();
  });

  it('returns null when no data manager is available at all', async () => {
    const list = await new AccessService(fakeApi({}), null).readList();
    expect(list).toBeNull();
  });
});

describe('AccessService.writeList', () => {
  it('saves the list under the access-control document id', async () => {
    let saved: { collection: string; doc: unknown } | null = null;
    const store = fakeStore({
      setDocument: async (collection, doc) => {
        saved = { collection, doc };
        return doc;
      },
    });
    const list: AccessList = { entries: [{ id: 'u1', name: 'Alice', kind: 'user' }] };
    await new AccessService(fakeApi({}), store).writeList(list);
    expect(saved).not.toBeNull();
    expect((saved!.doc as { id: string; entries: unknown }).id).toBe('access-control');
    expect((saved!.doc as { entries: unknown }).entries).toEqual(list.entries);
  });

  it('throws when no data manager is available, rather than silently dropping the save', async () => {
    await expect(new AccessService(fakeApi({}), null).writeList({ entries: [] })).rejects.toThrow();
  });
});
