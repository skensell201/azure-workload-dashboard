import { AccessDecision, AccessList, decideAccess } from './access';

/** The subset of AccessService that resolveAccess needs, kept narrow so it is easy to fake in tests. */
export interface AccessServiceLike {
  readList(): Promise<AccessList | null>;
  /**
   * Single identity round trip backing both the admin check and the group-membership
   * check (see I3) -- fetching it twice risked the two answers disagreeing. `verified`
   * distinguishes "identity not returned" from "identity returned with no groups" (see
   * I2); resolveAccess maps verified: false onto membershipUnverified.
   */
  getUserMembership(userId: string): Promise<{ descriptors: string[]; isAdmin: boolean; verified: boolean }>;
}

export interface ResolvedAccess {
  decision: AccessDecision;
  isAdmin: boolean;
  membershipUnverified: boolean;
  list: AccessList | null;
}

/**
 * Pure assembly of the access decision for one user: reads the stored allow-list plus
 * this user's admin/group membership, then hands them to decideAccess (see I5).
 *
 * The membership lookup rides on a single /_apis/identities round trip via
 * getUserMembership (see I3 -- the admin check and the group lookup are derived from the
 * same payload, so they can never disagree), which can itself be denied by server
 * permissions on-prem (see I1) or resolve to no identity at all (see I2). Both cases
 * degrade to "unverified": isAdmin = false, userGroupDescriptors = [], membershipUnverified
 * = true -- a throw is caught directly, and a resolved-but-unverified result
 * (`verified: false`) is mapped the same way rather than treated as "verified: no
 * groups". This function itself must never throw: a broken identities endpoint must not
 * take the whole hub down, and must not prevent the empty-list bootstrap case from still
 * letting everyone in (decideAccess checks the empty list before it ever looks at
 * membershipUnverified).
 */
export async function resolveAccess(input: {
  user: { id: string };
  accessService: AccessServiceLike;
}): Promise<ResolvedAccess> {
  const { user, accessService } = input;
  const list = await accessService.readList();

  let isAdmin = false;
  let userGroupDescriptors: string[] = [];
  let membershipUnverified = false;
  try {
    const membership = await accessService.getUserMembership(user.id);
    isAdmin = membership.isAdmin;
    userGroupDescriptors = membership.descriptors;
    membershipUnverified = !membership.verified;
  } catch {
    isAdmin = false;
    userGroupDescriptors = [];
    membershipUnverified = true;
  }

  const decision = decideAccess({ list, userId: user.id, isAdmin, userGroupDescriptors, membershipUnverified });
  return { decision, isAdmin, membershipUnverified, list };
}
