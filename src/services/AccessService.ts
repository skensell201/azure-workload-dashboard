import { ApiClient } from './ApiClient';
import { AccessEntry, AccessList } from './access';

interface RawIdentity {
  id: string;
  providerDisplayName?: string;
  displayName?: string;
  /** Present on the real identities API; absent identities default to 'user'. */
  isContainer?: boolean;
  memberOf?: string[];
}

/** Minimal shape of azure-devops-extension-api's IExtensionDataManager that this service needs. */
export interface AccessDocumentStore {
  getDocument(collection: string, id: string, options?: unknown): Promise<{ entries?: AccessEntry[] }>;
  setDocument(collection: string, doc: unknown, options?: unknown): Promise<unknown>;
}

const COLLECTION = 'access-control';
const DOC_ID = 'access-control';
const SCOPE = { scopeType: 'Default' };
const PROJECT_COLLECTION_ADMINISTRATORS = 'Project Collection Administrators';

function isDocumentNotFound(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const obj = e as Record<string, unknown>;
  if (obj.status === 404) return true;
  if (typeof obj.message === 'string' && /not found|does not exist/i.test(obj.message)) return true;
  const serverError = obj.serverError as Record<string, unknown> | undefined;
  if (serverError && typeof serverError.typeKey === 'string' && /DocumentNotFound/i.test(serverError.typeKey)) return true;
  return false;
}

function toEntry(i: RawIdentity): AccessEntry {
  return {
    id: i.id,
    name: i.providerDisplayName ?? i.displayName ?? i.id,
    kind: i.isContainer === true ? 'group' : 'user',
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
   * Ids of every group the identity belongs to, transitively. `memberOf` on the identity
   * endpoint holds descriptors, not ids (see module docs), so each descriptor is resolved
   * back through the same identityIds endpoint — which the Azure DevOps identities API
   * accepts in either id or descriptor form — to recover the group's real id.
   */
  async getUserGroupIds(identityId: string): Promise<string[]> {
    const self = await this.fetchIdentity(identityId);
    const descriptors = self?.memberOf ?? [];
    if (descriptors.length === 0) return [];
    const resolved = await Promise.all(descriptors.map((d) => this.fetchIdentity(d)));
    return resolved.filter((r): r is RawIdentity => r !== null).map((r) => r.id);
  }

  async isCollectionAdmin(userId: string): Promise<boolean> {
    const matches = await this.searchIdentities(PROJECT_COLLECTION_ADMINISTRATORS);
    const group = matches.find((m) => m.kind === 'group' && m.name === PROJECT_COLLECTION_ADMINISTRATORS);
    if (!group) return false;
    const groupIds = await this.getUserGroupIds(userId);
    return groupIds.includes(group.id);
  }

  /** null = could not be read (storage unavailable); a missing document means an empty list. */
  async readList(): Promise<AccessList | null> {
    if (!this.store) return null;
    try {
      const doc = await this.store.getDocument(COLLECTION, DOC_ID, SCOPE);
      return { entries: doc.entries ?? [] };
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
