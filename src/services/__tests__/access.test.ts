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

  it('does not let a stored entry with an empty id match an empty/blank user id', () => {
    const decision = decideAccess({
      ...baseInput,
      list: { entries: [{ id: '', name: 'legacy blank entry', kind: 'user' }] },
      userId: '   ',
    });
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
  it('matches a genuine well-known collection-admin SID descriptor', () => {
    expect(isCollectionAdminDescriptor('Microsoft.TeamFoundation.Identity;S-1-9-1551374245-1-0-0-0-0-0-0-0-0-1')).toBe(true);
  });

  it('does not match an ordinary project group descriptor, even one for a group named "Project Collection Administrators"', () => {
    expect(isCollectionAdminDescriptor('vssgp.Uy0xLTktMTU1MTM3NDI0NS0xLTIxMzEyMzEyMy0y')).toBe(false);
  });

  it('does not match a descriptor that merely ends in the suffix without the full well-known SID form', () => {
    expect(isCollectionAdminDescriptor('Microsoft.TeamFoundation.Identity;S-1-9-somebody-tacked-this-on-0-0-0-0-1')).toBe(false);
  });

  it('does not match a non-admin Microsoft.TeamFoundation.Identity descriptor with a different trailing well-known RID', () => {
    expect(isCollectionAdminDescriptor('Microsoft.TeamFoundation.Identity;S-1-9-1551374245-2-0-0-0-0-2')).toBe(false);
  });
});
