export interface AccessEntry {
  id: string;
  name: string;
  kind: 'user' | 'group';
}

export interface AccessList {
  entries: AccessEntry[];
}

export type AccessDecision =
  | { allowed: true; reason: 'unrestricted' | 'admin' | 'user' | 'group' }
  | { allowed: false; reason: 'not-listed' | 'list-unreadable' };

/**
 * Pure gate for the hub. Priority order matters: an admin gets in even when the
 * list is unreadable (bootstrap/recovery path), and an unreadable list must never
 * silently fall through to "unrestricted" for anyone else.
 */
export function decideAccess(input: {
  list: AccessList | null;
  userId: string;
  isAdmin: boolean;
  userGroupIds: string[];
}): AccessDecision {
  const { list, userId, isAdmin, userGroupIds } = input;

  if (isAdmin) return { allowed: true, reason: 'admin' };
  if (list === null) return { allowed: false, reason: 'list-unreadable' };
  if (list.entries.length === 0) return { allowed: true, reason: 'unrestricted' };
  if (list.entries.some((e) => e.id === userId)) return { allowed: true, reason: 'user' };
  // `kind` is UI metadata only (see AccessEntry) and must not gate this check: membership
  // is proven by userGroupIds, not by trusting a stored label.
  if (list.entries.some((e) => userGroupIds.includes(e.id))) return { allowed: true, reason: 'group' };
  return { allowed: false, reason: 'not-listed' };
}
