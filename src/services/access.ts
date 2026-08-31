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
 * Suffix of the well-known Project Collection Administrators group's SID-based descriptor
 * on Azure DevOps Server (".../S-1-9-...-0-0-0-0-1"). It is assigned by the server when
 * the collection is created and cannot be produced by creating an ordinary group, unlike
 * the group's display name -- see isCollectionAdminDescriptor for why that matters.
 */
const WELL_KNOWN_ADMIN_SID_SUFFIX = /-0-0-0-0-1$/;
const ADMIN_DISPLAY_NAME_SUFFIX = /project collection administrators$/i;

/**
 * Pure predicate: is this identity the well-known Project Collection Administrators
 * group? Prefers the server-assigned SID suffix on the descriptor -- it cannot be
 * spoofed by creating a same-named group, because that group gets an ordinary
 * project-scoped descriptor instead. The display-name check is kept only as a fallback
 * for when no descriptor is available at all (e.g. a data source that only carries
 * names). It is deliberately NOT consulted when a descriptor is present but simply
 * doesn't match the suffix: that is exactly what an attacker-created group named
 * "Project Collection Administrators" would look like, and falling back to the name in
 * that case would hand it admin rights. A bare display name is user-settable and must
 * never grant admin on its own.
 */
export function isCollectionAdminDescriptor(identity: { descriptor?: string; displayName?: string }): boolean {
  if (identity.descriptor) return WELL_KNOWN_ADMIN_SID_SUFFIX.test(identity.descriptor);
  return typeof identity.displayName === 'string' && ADMIN_DISPLAY_NAME_SUFFIX.test(identity.displayName.trim());
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
  if (list.entries.some((e) => normalize(e.id) === normalizedUserId)) return { allowed: true, reason: 'user' };

  // `kind` is UI metadata only (see AccessEntry) and must not gate this check: membership
  // is proven by a matching descriptor, not by trusting a stored label.
  const normalizedGroups = userGroupDescriptors.map(normalize);
  const inListedGroup = list.entries.some((e) => e.descriptor && normalizedGroups.includes(normalize(e.descriptor)));
  if (inListedGroup) return { allowed: true, reason: 'group' };

  if (membershipUnverified) return { allowed: false, reason: 'membership-unverified' };
  return { allowed: false, reason: 'not-listed' };
}
