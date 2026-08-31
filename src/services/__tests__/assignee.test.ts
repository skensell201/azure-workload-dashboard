import { parseAssignee } from '../assignee';

describe('parseAssignee', () => {
  it('reads identity object with uniqueName and displayName', () => {
    expect(parseAssignee({ displayName: 'Ivan Kostin', uniqueName: 'DOMAIN\\ikostin' })).toEqual({
      key: 'DOMAIN\\ikostin',
      name: 'Ivan Kostin',
    });
  });

  it('falls back to displayName as key when uniqueName is missing', () => {
    expect(parseAssignee({ displayName: 'Ivan Kostin' })).toEqual({ key: 'Ivan Kostin', name: 'Ivan Kostin' });
  });

  it('parses legacy string form "Name <account>"', () => {
    expect(parseAssignee('Ivan Kostin <DOMAIN\\ikostin>')).toEqual({
      key: 'DOMAIN\\ikostin',
      name: 'Ivan Kostin',
    });
  });

  it('returns null for empty values', () => {
    expect(parseAssignee(undefined)).toBeNull();
    expect(parseAssignee('')).toBeNull();
  });

  it('takes the last angle-bracket group as the account', () => {
    expect(parseAssignee('A <x> <y>')).toEqual({ key: 'y', name: 'A <x>' });
  });
});
