export interface AccessEntry {
  id: string;
  name: string;
  kind: 'user' | 'group';
  /**
   * Captured verbatim from the identities search response's `descriptor` field when the
   * entry is added (see I2/I3). Entries saved by a version of this extension that
   * predates descriptor capture will lack this field: such an entry can still match a
   * user by `id` (see decideAccess), but a group entry with no descriptor can never
   * match by group membership -- it is simply skipped, never treated as a wildcard.
   */
  descriptor?: string;
}

export interface AccessList {
  entries: AccessEntry[];
}

export type AccessDecision =
  | { allowed: true; reason: 'unrestricted' | 'admin' | 'user' | 'group' }
  | { allowed: false; reason: 'not-listed' | 'list-unreadable' | 'membership-unverified' };

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Full well-known form of the Project Collection Administrators group's SID-based
 * descriptor on Azure DevOps Server. It is assigned by the server when the collection is
 * created and cannot be produced by creating an ordinary group, unlike the group's
 * display name -- see isCollectionAdminDescriptor for why that matters. Anchored to the
 * whole descriptor (not just the trailing "-0-0-0-0-1") so a fabricated descriptor that
 * merely happens to end the same way does not match.
 */
const WELL_KNOWN_ADMIN_SID = /^Microsoft\.TeamFoundation\.Identity;S-1-9-\d+(-\d+)*-0-0-0-0-1$/i;

/**
 * Pure predicate: is this descriptor the well-known Project Collection Administrators
 * group? Matched only by the server-assigned SID form -- it cannot be spoofed by
 * creating a same-named group, because that group gets an ordinary project-scoped
 * descriptor instead. There is deliberately no display-name fallback: a bare display
 * name is user-settable, and a future caller passing an object carrying a name would
 * otherwise silently reintroduce the spoof this predicate exists to prevent. The only
 * production call site already has a descriptor whenever the identity is real, so
 * narrowing to just the descriptor string costs nothing.
 */
export function isCollectionAdminDescriptor(descriptor: string): boolean {
  return WELL_KNOWN_ADMIN_SID.test(descriptor);
}

/**
 * Pure gate for the hub. Priority order matters:
 *  1. an admin gets in even when the list is unreadable (bootstrap/recovery path);
 *  2. an unreadable list must never silently fall through to "unrestricted" for anyone
 *     else;
 *  3. an empty list (bootstrap) must let everyone in, even if membership could not be
 *     verified -- a fresh install must not lock out the admin who has to configure it,
 *     and an identities outage must not turn into an outage for every ordinary user too;
 *  4. being listed directly by id always works, even when membership is unverified;
 *  5. group membership only grants access when it was actually verified;
 *  6. an unverified membership lookup denies with its own reason, distinct from a
 *     plain "not listed", so the UI can point the user at a collection administrator
 *     instead of implying they were deliberately excluded.
 */
export function decideAccess(input: {
  list: AccessList | null;
  userId: string;
  isAdmin: boolean;
  userGroupDescriptors: string[];
  membershipUnverified: boolean;
}): AccessDecision {
  const { list, userId, isAdmin, userGroupDescriptors, membershipUnverified } = input;

  if (isAdmin) return { allowed: true, reason: 'admin' };
  if (list === null) return { allowed: false, reason: 'list-unreadable' };
  if (list.entries.length === 0) return { allowed: true, reason: 'unrestricted' };

  const normalizedUserId = normalize(userId);
  // Guard the empty-id edge: without this, a stored entry with an empty (or
  // whitespace-only) id would match an equally empty/blank userId and grant access.
  if (normalizedUserId && list.entries.some((e) => normalize(e.id) === normalizedUserId)) {
    return { allowed: true, reason: 'user' };
  }

  // `kind` is UI metadata only (see AccessEntry) and must not gate this check: membership
  // is proven by a matching descriptor, not by trusting a stored label.
  const normalizedGroups = userGroupDescriptors.map(normalize);
  const inListedGroup = list.entries.some((e) => e.descriptor && normalizedGroups.includes(normalize(e.descriptor)));
  if (inListedGroup) return { allowed: true, reason: 'group' };

  if (membershipUnverified) return { allowed: false, reason: 'membership-unverified' };
  return { allowed: false, reason: 'not-listed' };
}
