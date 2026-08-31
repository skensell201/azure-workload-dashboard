import { resolveAccess, AccessServiceLike } from '../resolveAccess';
import { AccessList } from '../access';

function fakeAccessService(overrides: Partial<AccessServiceLike> = {}): AccessServiceLike {
  return {
    readList: async () => ({ entries: [] }),
    isCollectionAdmin: async () => false,
    getUserGroupDescriptors: async () => [],
    ...overrides,
  };
}

describe('resolveAccess', () => {
  it('allows a user listed by a matching group descriptor when everything works normally', async () => {
    const list: AccessList = { entries: [{ id: 'grp-1', name: 'Team A', kind: 'group', descriptor: 'vssgp.team-a' }] };
    const result = await resolveAccess({
      user: { id: 'u1' },
      accessService: fakeAccessService({
        readList: async () => list,
        getUserGroupDescriptors: async () => ['vssgp.team-a'],
      }),
    });
    expect(result).toEqual({
      decision: { allowed: true, reason: 'group' },
      isAdmin: false,
      membershipUnverified: false,
      list,
    });
  });

  it('degrades to denied membership-unverified, never throwing, when the membership call throws', async () => {
    const list: AccessList = { entries: [{ id: 'someone-else', name: 'Someone', kind: 'user' }] };
    const result = await resolveAccess({
      user: { id: 'u1' },
      accessService: fakeAccessService({
        readList: async () => list,
        isCollectionAdmin: async () => false,
        getUserGroupDescriptors: async () => {
          throw new Error('403: no permission to read identities');
        },
      }),
    });
    expect(result).toEqual({
      decision: { allowed: false, reason: 'membership-unverified' },
      isAdmin: false,
      membershipUnverified: true,
      list,
    });
  });

  it('degrades to denied membership-unverified, never throwing, when the admin check throws', async () => {
    const list: AccessList = { entries: [{ id: 'someone-else', name: 'Someone', kind: 'user' }] };
    const result = await resolveAccess({
      user: { id: 'u1' },
      accessService: fakeAccessService({
        readList: async () => list,
        isCollectionAdmin: async () => {
          throw new Error('403: no permission to read identities');
        },
        getUserGroupDescriptors: async () => [],
      }),
    });
    expect(result).toEqual({
      decision: { allowed: false, reason: 'membership-unverified' },
      isAdmin: false,
      membershipUnverified: true,
      list,
    });
  });

  it('still allows everyone under the empty-list bootstrap even when the membership lookup throws', async () => {
    const result = await resolveAccess({
      user: { id: 'u1' },
      accessService: fakeAccessService({
        readList: async () => ({ entries: [] }),
        isCollectionAdmin: async () => {
          throw new Error('403');
        },
        getUserGroupDescriptors: async () => {
          throw new Error('403');
        },
      }),
    });
    expect(result.decision).toEqual({ allowed: true, reason: 'unrestricted' });
    expect(result.membershipUnverified).toBe(true);
  });

  it('denies with list-unreadable, not admin, when readList returns null and the user is not an admin', async () => {
    const result = await resolveAccess({
      user: { id: 'u1' },
      accessService: fakeAccessService({ readList: async () => null }),
    });
    expect(result.decision).toEqual({ allowed: false, reason: 'list-unreadable' });
    expect(result.list).toBeNull();
  });

  it('allows an admin even when readList returns null', async () => {
    const result = await resolveAccess({
      user: { id: 'admin-1' },
      accessService: fakeAccessService({ readList: async () => null, isCollectionAdmin: async () => true }),
    });
    expect(result.decision).toEqual({ allowed: true, reason: 'admin' });
    expect(result.isAdmin).toBe(true);
  });
});
