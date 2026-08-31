import { decideAccess, AccessList } from '../access';

const list = (ids: string[]): AccessList => ({ entries: ids.map((id) => ({ id, name: id, kind: 'user' as const })) });

describe('decideAccess', () => {
  it('allows an admin even when the list denies them', () => {
    const decision = decideAccess({
      list: list(['other-user']),
      userId: 'admin-1',
      isAdmin: true,
      userGroupIds: [],
    });
    expect(decision).toEqual({ allowed: true, reason: 'admin' });
  });

  it('allows an admin even when the list cannot be read', () => {
    const decision = decideAccess({ list: null, userId: 'admin-1', isAdmin: true, userGroupIds: [] });
    expect(decision).toEqual({ allowed: true, reason: 'admin' });
  });

  it('denies a non-admin with a specific reason when the list cannot be read', () => {
    const decision = decideAccess({ list: null, userId: 'u1', isAdmin: false, userGroupIds: [] });
    expect(decision).toEqual({ allowed: false, reason: 'list-unreadable' });
  });

  it('allows everyone when the list is empty (bootstrap)', () => {
    const decision = decideAccess({ list: { entries: [] }, userId: 'u1', isAdmin: false, userGroupIds: [] });
    expect(decision).toEqual({ allowed: true, reason: 'unrestricted' });
  });

  it('allows a user listed by id', () => {
    const decision = decideAccess({ list: list(['u1', 'u2']), userId: 'u1', isAdmin: false, userGroupIds: [] });
    expect(decision).toEqual({ allowed: true, reason: 'user' });
  });

  it('allows a user who is a transitive member of a listed group', () => {
    const decision = decideAccess({
      list: { entries: [{ id: 'grp-1', name: 'Team A', kind: 'group' }] },
      userId: 'u1',
      isAdmin: false,
      userGroupIds: ['grp-1'],
    });
    expect(decision).toEqual({ allowed: true, reason: 'group' });
  });

  it('does not grant access for a listed group the user does not belong to', () => {
    const decision = decideAccess({
      list: { entries: [{ id: 'grp-1', name: 'Team A', kind: 'group' }] },
      userId: 'u1',
      isAdmin: false,
      userGroupIds: ['grp-2'],
    });
    expect(decision).toEqual({ allowed: false, reason: 'not-listed' });
  });

  it('denies a user who is neither listed nor in a listed group', () => {
    const decision = decideAccess({ list: list(['u2', 'u3']), userId: 'u1', isAdmin: false, userGroupIds: [] });
    expect(decision).toEqual({ allowed: false, reason: 'not-listed' });
  });

  it('compares entry ids exactly, without case folding', () => {
    const decision = decideAccess({
      list: list(['AAAA-BBBB']),
      userId: 'aaaa-bbbb',
      isAdmin: false,
      userGroupIds: [],
    });
    expect(decision).toEqual({ allowed: false, reason: 'not-listed' });
  });
});
