import { decideAccess, isCollectionAdminDescriptor, AccessList } from '../access';

const list = (ids: string[]): AccessList => ({ entries: ids.map((id) => ({ id, name: id, kind: 'user' as const })) });

const baseInput = {
  userId: 'u1',
  isAdmin: false,
  userGroupDescriptors: [] as string[],
  membershipUnverified: false,
};

describe('decideAccess', () => {
  it('allows an admin even when the list denies them', () => {
    const decision = decideAccess({
      ...baseInput,
      list: list(['other-user']),
      userId: 'admin-1',
      isAdmin: true,
    });
    expect(decision).toEqual({ allowed: true, reason: 'admin' });
  });

  it('allows an admin even when the list cannot be read', () => {
    const decision = decideAccess({ ...baseInput, list: null, userId: 'admin-1', isAdmin: true });
    expect(decision).toEqual({ allowed: true, reason: 'admin' });
  });

  it('denies a non-admin with a specific reason when the list cannot be read', () => {
    const decision = decideAccess({ ...baseInput, list: null });
    expect(decision).toEqual({ allowed: false, reason: 'list-unreadable' });
  });

  it('allows everyone when the list is empty (bootstrap)', () => {
    const decision = decideAccess({ ...baseInput, list: { entries: [] } });
    expect(decision).toEqual({ allowed: true, reason: 'unrestricted' });
  });

  it('allows everyone when the list is empty (bootstrap) even when membership could not be verified', () => {
    const decision = decideAccess({ ...baseInput, list: { entries: [] }, membershipUnverified: true });
    expect(decision).toEqual({ allowed: true, reason: 'unrestricted' });
  });

  it('allows a user listed by id', () => {
    const decision = decideAccess({ ...baseInput, list: list(['u1', 'u2']) });
    expect(decision).toEqual({ allowed: true, reason: 'user' });
  });

  it('allows a user listed by id even when membership could not be verified', () => {
    const decision = decideAccess({ ...baseInput, list: list(['u1', 'u2']), membershipUnverified: true });
    expect(decision).toEqual({ allowed: true, reason: 'user' });
  });

  it('compares entry ids case-insensitively, after trimming', () => {
    const decision = decideAccess({
      ...baseInput,
      list: { entries: [{ id: ' AAAA-BBBB ', name: 'x', kind: 'user' }] },
      userId: 'aaaa-bbbb',
    });
    expect(decision).toEqual({ allowed: true, reason: 'user' });
  });

  it('allows a user who is a member of a listed group, matched by descriptor', () => {
    const decision = decideAccess({
      ...baseInput,
      list: { entries: [{ id: 'grp-1', name: 'Team A', kind: 'group', descriptor: 'vssgp.team-a' }] },
      userGroupDescriptors: ['vssgp.team-a'],
    });
    expect(decision).toEqual({ allowed: true, reason: 'group' });
  });

  it('matches group descriptors case-insensitively, after trimming', () => {
    const decision = decideAccess({
      ...baseInput,
      list: { entries: [{ id: 'grp-1', name: 'Team A', kind: 'group', descriptor: ' VSSGP.Team-A ' }] },
      userGroupDescriptors: ['vssgp.team-a'],
    });
    expect(decision).toEqual({ allowed: true, reason: 'group' });
  });

  it('does not grant access for a listed group the user does not belong to', () => {
    const decision = decideAccess({
      ...baseInput,
      list: { entries: [{ id: 'grp-1', name: 'Team A', kind: 'group', descriptor: 'vssgp.team-a' }] },
      userGroupDescriptors: ['vssgp.team-b'],
    });
    expect(decision).toEqual({ allowed: false, reason: 'not-listed' });
  });

  it('does not crash and cannot match by group on a legacy entry with no descriptor (pre-migration data)', () => {
    const decision = decideAccess({
      ...baseInput,
      list: { entries: [{ id: 'grp-1', name: 'Team A', kind: 'group' }] },
      userGroupDescriptors: ['vssgp.team-a'],
    });
    expect(decision).toEqual({ allowed: false, reason: 'not-listed' });
  });

  it('denies a user who is neither listed nor in a listed group', () => {
    const decision = decideAccess({ ...baseInput, list: list(['u2', 'u3']) });
    expect(decision).toEqual({ allowed: false, reason: 'not-listed' });
  });

  it('denies with a distinct reason when membership could not be verified and the user is not listed by id', () => {
    const decision = decideAccess({
      ...baseInput,
      list: { entries: [{ id: 'grp-1', name: 'Team A', kind: 'group', descriptor: 'vssgp.team-a' }] },
      membershipUnverified: true,
    });
    expect(decision).toEqual({ allowed: false, reason: 'membership-unverified' });
  });
});

describe('isCollectionAdminDescriptor', () => {
  it('matches the well-known SID suffix on the descriptor', () => {
    expect(
      isCollectionAdminDescriptor({ descriptor: 'Microsoft.TeamFoundation.Identity;S-1-9-1551374245-1-0-0-0-0-0-0-0-0-1' })
    ).toBe(true);
  });

  it('does not match an arbitrary project group named "Project Collection Administrators" with a normal SID', () => {
    expect(
      isCollectionAdminDescriptor({
        descriptor: 'vssgp.Uy0xLTktMTU1MTM3NDI0NS0xLTIxMzEyMzEyMy0y',
        displayName: 'Project Collection Administrators',
      })
    ).toBe(false);
  });

  it('applies the display-name fallback only when no descriptor is present at all', () => {
    expect(isCollectionAdminDescriptor({ displayName: 'Project Collection Administrators' })).toBe(true);
    expect(isCollectionAdminDescriptor({ displayName: 'Some Other Group' })).toBe(false);
  });
});
