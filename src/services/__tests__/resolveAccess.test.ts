import { resolveAccess, AccessServiceLike } from '../resolveAccess';
import { AccessList } from '../access';

function fakeAccessService(overrides: Partial<AccessServiceLike> = {}): AccessServiceLike {
  return {
    readList: async () => ({ entries: [] }),
    getUserMembership: async () => ({ descriptors: [], isAdmin: false, verified: true }),
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
        getUserMembership: async () => ({ descriptors: ['vssgp.team-a'], isAdmin: false, verified: true }),
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
        getUserMembership: async () => {
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

  it('treats a resolved identity that could not be verified (verified: false) as membership-unverified, not as "no groups"', async () => {
    // e.g. a 200 response with an empty `value` array: wrong id space, unresolvable
    // identity, or a permission mode that filters instead of rejecting (see I2). This
    // must not be mistaken for a verified "this user is in no groups and is not an admin".
    const list: AccessList = { entries: [{ id: 'someone-else', name: 'Someone', kind: 'user' }] };
    const result = await resolveAccess({
      user: { id: 'u1' },
      accessService: fakeAccessService({
        readList: async () => list,
        getUserMembership: async () => ({ descriptors: [], isAdmin: false, verified: false }),
      }),
    });
    expect(result).toEqual({
      decision: { allowed: false, reason: 'membership-unverified' },
      isAdmin: false,
      membershipUnverified: true,
      list,
    });
  });

  it('treats a resolved identity with an empty memberOf as verified -- simply grants no groups, not membership-unverified', async () => {
    const list: AccessList = { entries: [{ id: 'someone-else', name: 'Someone', kind: 'user' }] };
    const result = await resolveAccess({
      user: { id: 'u1' },
      accessService: fakeAccessService({
        readList: async () => list,
        getUserMembership: async () => ({ descriptors: [], isAdmin: false, verified: true }),
      }),
    });
    expect(result).toEqual({
      decision: { allowed: false, reason: 'not-listed' },
      isAdmin: false,
      membershipUnverified: false,
      list,
    });
  });

  it('still allows everyone under the empty-list bootstrap even when the membership lookup throws', async () => {
    const result = await resolveAccess({
      user: { id: 'u1' },
      accessService: fakeAccessService({
        readList: async () => ({ entries: [] }),
        getUserMembership: async () => {
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
      accessService: fakeAccessService({
        readList: async () => null,
        getUserMembership: async () => ({ descriptors: [], isAdmin: true, verified: true }),
      }),
    });
    expect(result.decision).toEqual({ allowed: true, reason: 'admin' });
    expect(result.isAdmin).toBe(true);
  });

  it('fetches identity membership exactly once (the admin check and group lookup are derived from the same payload)', async () => {
    let calls = 0;
    const list: AccessList = { entries: [] };
    await resolveAccess({
      user: { id: 'u1' },
      accessService: fakeAccessService({
        readList: async () => list,
        getUserMembership: async () => {
          calls++;
          return { descriptors: [], isAdmin: false, verified: true };
        },
      }),
    });
    expect(calls).toBe(1);
  });
});
