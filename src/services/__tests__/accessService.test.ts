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

  it('captures the descriptor field from the identities search response onto each entry', async () => {
    const api = fakeApi({
      get: () => ({
        value: [{ id: 'g1', displayName: 'Team A', isContainer: true, descriptor: 'vssgp.Team-A-descriptor' }],
      }),
    });
    const results = await new AccessService(api, fakeStore()).searchIdentities('team');
    expect(results).toEqual([{ id: 'g1', name: 'Team A', kind: 'group', descriptor: 'vssgp.Team-A-descriptor' }]);
  });
});

describe('AccessService.getUserGroupDescriptors', () => {
  it('returns the memberOf descriptors verbatim from a single identities call (no per-group round trip)', async () => {
    const paths: string[] = [];
    const api = fakeApi({
      get: (path) => {
        paths.push(path);
        return { value: [{ id: 'user-1', memberOf: ['desc-a', 'desc-b'] }] };
      },
    });
    const descriptors = await new AccessService(api, fakeStore()).getUserGroupDescriptors('user-1');
    expect(descriptors).toEqual(['desc-a', 'desc-b']);
    expect(paths).toEqual(['/_apis/identities?identityIds=user-1&queryMembership=Expanded&api-version=6.0']);
  });

  it('returns an empty array when the identity has no memberships, without extra calls', async () => {
    const paths: string[] = [];
    const api = fakeApi({
      get: (path) => {
        paths.push(path);
        return { value: [{ id: 'user-1' }] };
      },
    });
    const descriptors = await new AccessService(api, fakeStore()).getUserGroupDescriptors('user-1');
    expect(descriptors).toEqual([]);
    expect(paths).toHaveLength(1);
  });
});

describe('AccessService.isCollectionAdmin', () => {
  it('is true when a memberOf descriptor carries the well-known admin SID suffix, from a single call', async () => {
    const paths: string[] = [];
    const api = fakeApi({
      get: (path) => {
        paths.push(path);
        return { value: [{ id: 'user-1', memberOf: ['vssgp.SomeOtherGroup', 'Microsoft.TeamFoundation.Identity;S-1-9-1551374245-1-0-0-0-0-0-0-0-0-1'] }] };
      },
    });
    expect(await new AccessService(api, fakeStore()).isCollectionAdmin('user-1')).toBe(true);
    expect(paths).toHaveLength(1);
  });

  it('is false when no memberOf descriptor carries the admin suffix', async () => {
    const api = fakeApi({ get: () => ({ value: [{ id: 'user-1', memberOf: ['vssgp.SomeOtherGroup'] }] }) });
    expect(await new AccessService(api, fakeStore()).isCollectionAdmin('user-1')).toBe(false);
  });

  it('is false when the identity has no memberships', async () => {
    const api = fakeApi({ get: () => ({ value: [{ id: 'user-1' }] }) });
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

  it('returns null (not an empty list) for a bare 404 with no typeKey, since Azure DevOps Server also returns 404 for scope/permission failures', async () => {
    const store = fakeStore({
      getDocument: async () => {
        const e = new Error('not found') as Error & { status: number };
        e.status = 404;
        throw e;
      },
    });
    const list = await new AccessService(fakeApi({}), store).readList();
    expect(list).toBeNull();
  });

  it('returns null for an error whose message merely says "not found", without a recognised typeKey', async () => {
    const store = fakeStore({
      getDocument: async () => {
        throw new Error('Resource not found');
      },
    });
    const list = await new AccessService(fakeApi({}), store).readList();
    expect(list).toBeNull();
  });

  it('returns an empty list only for a genuine DocumentNotFound typeKey', async () => {
    const store = fakeStore({
      getDocument: async () => {
        const e = new Error('document missing') as Error & { serverError: { typeKey: string } };
        e.serverError = { typeKey: 'DocumentNotFoundException' };
        throw e;
      },
    });
    const list = await new AccessService(fakeApi({}), store).readList();
    expect(list).toEqual({ entries: [] });
  });

  it('also recognises a DocumentDoesNotExist typeKey at the top level of the error', async () => {
    const store = fakeStore({
      getDocument: async () => {
        const e = new Error('document missing') as Error & { typeKey: string };
        e.typeKey = 'DocumentDoesNotExistException';
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

  it('returns null when the document has no entries field at all (malformed)', async () => {
    const store = fakeStore({ getDocument: async () => ({ id: 'access-control' }) });
    const list = await new AccessService(fakeApi({}), store).readList();
    expect(list).toBeNull();
  });

  it('returns null when entries is not an array (malformed)', async () => {
    const store = fakeStore({ getDocument: async () => ({ entries: 'not-an-array' }) });
    const list = await new AccessService(fakeApi({}), store).readList();
    expect(list).toBeNull();
  });

  it('returns null when an entry has no string id (malformed)', async () => {
    const store = fakeStore({
      getDocument: async () => ({ entries: [{ name: 'Alice', kind: 'user' }] }),
    });
    const list = await new AccessService(fakeApi({}), store).readList();
    expect(list).toBeNull();
  });

  it('returns null when an entry has a non-string id (malformed)', async () => {
    const store = fakeStore({
      getDocument: async () => ({ entries: [{ id: 42, name: 'Alice', kind: 'user' }] }),
    });
    const list = await new AccessService(fakeApi({}), store).readList();
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
