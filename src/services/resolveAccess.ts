import { AccessDecision, AccessList, decideAccess } from './access';

/** The subset of AccessService that resolveAccess needs, kept narrow so it is easy to fake in tests. */
export interface AccessServiceLike {
  readList(): Promise<AccessList | null>;
  isCollectionAdmin(userId: string): Promise<boolean>;
  getUserGroupDescriptors(userId: string): Promise<string[]>;
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
 * The membership lookup rides on the /_apis/identities endpoint, which can itself be
 * denied by server permissions on-prem (see I1) -- both the admin check and the group
 * membership lookup are wrapped in a single try/catch so that EITHER one throwing
 * degrades both to "unverified": isAdmin = false, userGroupDescriptors = [],
 * membershipUnverified = true. This function itself must never throw: a broken
 * identities endpoint must not take the whole hub down, and must not prevent the
 * empty-list bootstrap case from still letting everyone in (decideAccess checks the
 * empty list before it ever looks at membershipUnverified).
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
    const [admin, descriptors] = await Promise.all([
      accessService.isCollectionAdmin(user.id),
      accessService.getUserGroupDescriptors(user.id),
    ]);
    isAdmin = admin;
    userGroupDescriptors = descriptors;
  } catch {
    isAdmin = false;
    userGroupDescriptors = [];
    membershipUnverified = true;
  }

  const decision = decideAccess({ list, userId: user.id, isAdmin, userGroupDescriptors, membershipUnverified });
  return { decision, isAdmin, membershipUnverified, list };
}
