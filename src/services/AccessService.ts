import { ApiClient } from './ApiClient';
import { AccessEntry, AccessList, isCollectionAdminDescriptor } from './access';

interface RawIdentity {
  id: string;
  providerDisplayName?: string;
  displayName?: string;
  /** Present on the real identities API; absent identities default to 'user'. */
  isContainer?: boolean;
  memberOf?: string[];
  /** Descriptor of this identity itself, present on the identities search response. */
  descriptor?: string;
}

/**
 * Minimal shape of azure-devops-extension-api's IExtensionDataManager that this service
 * needs. getDocument's real return value is arbitrary stored JSON, not a typed AccessList
 * -- it must be validated at runtime (see parseStoredList) rather than trusted via a cast.
 */
export interface AccessDocumentStore {
  getDocument(collection: string, id: string, options?: unknown): Promise<unknown>;
  setDocument(collection: string, doc: unknown, options?: unknown): Promise<unknown>;
}

const COLLECTION = 'access-control';
const DOC_ID = 'access-control';
const SCOPE = { scopeType: 'Default' };

/**
 * Azure DevOps Server also returns a bare 404 (and often a generic "not found"-ish
 * message) for scope/permission failures on this endpoint, not just for a genuinely
 * missing document -- see C2. A missing scope must never be misread as "list is empty",
 * so this accepts only a positive identification of document absence: a serverError
 * typeKey (or a top-level typeKey) that actually names DocumentNotFound/DocumentDoesNotExist.
 * Anything else is unrecognised and must be treated as unreadable by the caller.
 */
function isDocumentNotFound(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const obj = e as Record<string, unknown>;
  const serverError = obj.serverError as Record<string, unknown> | undefined;
  const typeKey = serverError?.typeKey ?? obj.typeKey;
  return typeof typeKey === 'string' && /DocumentNotFound|DocumentDoesNotExist/i.test(typeKey);
}

function isValidEntry(e: unknown): e is AccessEntry {
  return !!e && typeof e === 'object' && typeof (e as Record<string, unknown>).id === 'string';
}

/**
 * Validates a raw stored document at runtime -- the TS return type on getDocument is
 * `unknown` precisely because nothing guarantees the stored JSON still matches AccessList
 * (hand-edited storage, a bug in an older version, partial writes). Any shape that isn't
 * unambiguously a valid list is treated as unreadable (null) rather than coerced into an
 * empty list, which would silently open access to everyone (see M1).
 */
function parseStoredList(doc: unknown): AccessList | null {
  if (!doc || typeof doc !== 'object') return null;
  const entries = (doc as Record<string, unknown>).entries;
  if (!Array.isArray(entries) || !entries.every(isValidEntry)) return null;
  return { entries };
}

function toEntry(i: RawIdentity): AccessEntry {
  return {
    id: i.id,
    name: i.providerDisplayName ?? i.displayName ?? i.id,
    kind: i.isContainer === true ? 'group' : 'user',
    descriptor: i.descriptor,
  };
}

/** Identity search/membership over REST, plus allow-list storage in the extension's own data. */
export class AccessService {
  constructor(
    private api: ApiClient,
    private store: AccessDocumentStore | null
  ) {}

  async searchIdentities(query: string): Promise<AccessEntry[]> {
    const q = query.trim();
    if (!q) return [];
    const res = await this.api.get<{ value: RawIdentity[] }>(
      `/_apis/identities?searchFilter=General&filterValue=${encodeURIComponent(q)}&queryMembership=None&api-version=6.0`
    );
    return res.value.map(toEntry);
  }

  /**
   * Descriptors of every group the identity belongs to, taken verbatim from `memberOf` on
   * a single identities call (see I2/I3) -- no per-group round trip to resolve each
   * descriptor to an id, and no attempt to resolve them at all: decideAccess matches
   * stored entries by descriptor directly.
   */
  async getUserGroupDescriptors(userId: string): Promise<string[]> {
    const self = await this.fetchIdentity(userId);
    return self?.memberOf ?? [];
  }

  /**
   * True when the user is a member of the well-known Project Collection Administrators
   * group, identified by the SID suffix on one of their memberOf descriptors (see
   * isCollectionAdminDescriptor for why the suffix, not a name search, is the reliable
   * signal). A single identities call, same shape as getUserGroupDescriptors.
   */
  async isCollectionAdmin(userId: string): Promise<boolean> {
    const self = await this.fetchIdentity(userId);
    const descriptors = self?.memberOf ?? [];
    return descriptors.some((d) => isCollectionAdminDescriptor({ descriptor: d }));
  }

  /** null = could not be read (storage unavailable, or unreadable/malformed); see parseStoredList and isDocumentNotFound. */
  async readList(): Promise<AccessList | null> {
    if (!this.store) return null;
    try {
      const doc = await this.store.getDocument(COLLECTION, DOC_ID, SCOPE);
      return parseStoredList(doc);
    } catch (e) {
      if (isDocumentNotFound(e)) return { entries: [] };
      return null;
    }
  }

  async writeList(list: AccessList): Promise<void> {
    if (!this.store) throw new Error('Access list storage is unavailable.');
    await this.store.setDocument(COLLECTION, { id: DOC_ID, entries: list.entries }, SCOPE);
  }

  private async fetchIdentity(identityId: string): Promise<RawIdentity | null> {
    const res = await this.api.get<{ value: RawIdentity[] }>(
      `/_apis/identities?identityIds=${encodeURIComponent(identityId)}&queryMembership=Expanded&api-version=6.0`
    );
    return res.value[0] ?? null;
  }
}
