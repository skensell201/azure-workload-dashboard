import React, { useEffect, useRef, useState } from 'react';
import { AccessEntry, AccessList } from '../services/access';

export interface AccessPanelService {
  searchIdentities(query: string): Promise<AccessEntry[]>;
  readList(): Promise<AccessList | null>;
  writeList(list: AccessList): Promise<void>;
}

function describeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Matches how the gate compares ids, so the panel cannot store two entries it treats as one. */
function sameId(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Admin-only: search identities and edit the allow-list that gates the hub. */
export function AccessPanel({ service, onClose }: { service: AccessPanelService; onClose: () => void }): JSX.Element {
  const [entries, setEntries] = useState<AccessEntry[]>([]);
  // Distinct from a genuinely empty list (see C3): when the initial read fails, saving
  // must be disabled outright so admins never overwrite a list they never actually saw.
  const [listUnreadable, setListUnreadable] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AccessEntry[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // Guards against an out-of-order response: only the most recently issued search may
  // apply its results (see M3) -- a slow earlier search resolving after a newer one must
  // not clobber what the user is currently looking at.
  const latestSearchSeq = useRef(0);

  async function loadList(): Promise<void> {
    try {
      const list = await service.readList();
      if (list === null) {
        setListUnreadable(true);
        setEntries([]);
      } else {
        setListUnreadable(false);
        setEntries(list.entries);
      }
    } catch {
      // A rejecting service must land in the same state as an unreadable list, or Save
      // would stay enabled over entries the admin never saw (see C3).
      setListUnreadable(true);
      setEntries([]);
    }
  }

  useEffect(() => {
    void loadList();
  }, [service]);

  /** The only action allowed to replace an unreadable list, so it is deliberate and labelled. */
  async function createList(): Promise<void> {
    setSaving(true);
    setSaveError(null);
    try {
      await service.writeList({ entries: [] });
      await loadList();
    } catch (e) {
      setSaveError(describeError(e));
    } finally {
      setSaving(false);
    }
  }

  async function runSearch(q: string): Promise<void> {
    setQuery(q);
    const trimmed = q.trim();
    const seq = ++latestSearchSeq.current;
    if (!trimmed) {
      setResults([]);
      setSearchError(null);
      return;
    }
    try {
      const found = await service.searchIdentities(trimmed);
      if (seq !== latestSearchSeq.current) return;
      setResults(found);
      setSearchError(null);
    } catch (e) {
      if (seq !== latestSearchSeq.current) return;
      setResults([]);
      setSearchError(describeError(e));
    }
  }

  function addEntry(entry: AccessEntry): void {
    if (isListed(entry.id)) return;
    setEntries([...entries, entry]);
    setSaved(false);
  }

  function removeEntry(id: string): void {
    setEntries(entries.filter((e) => sameId(e.id, id) === false));
    setSaved(false);
  }

  function isListed(id: string): boolean {
    return entries.some((e) => sameId(e.id, id));
  }

  async function save(): Promise<void> {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await service.writeList({ entries });
      setSaved(true);
    } catch (e) {
      setSaveError(describeError(e));
    } finally {
      setSaving(false);
    }
  }

  const statusText =
    entries.length === 0
      ? 'Everyone has access — the list is empty'
      : `${entries.length} entries — only they and collection administrators have access`;

  return (
    <div className="access-panel">
      <div className="access-panel-header">
        <h3>Access</h3>
        <button onClick={onClose}>Close</button>
      </div>
      {listUnreadable ? (
        <div className="error-box">
          Could not read the current access list. Saving is disabled so the stored list is not overwritten.
          <div className="access-panel-actions">
            <button onClick={() => void createList()} disabled={saving}>
              Create a new access list
            </button>
            <span className="hint">
              This replaces whatever is stored with an empty list — everyone will have access until you add
              entries.
            </span>
          </div>
        </div>
      ) : (
        <div className="access-panel-status">{statusText}</div>
      )}
      <input
        type="text"
        placeholder="Search identities…"
        value={query}
        onChange={(e) => void runSearch(e.target.value)}
      />
      {searchError && <div className="error-box">{searchError}</div>}
      {results.length > 0 && (
        <ul className="access-search-results">
          {results.map((r) => (
            <li key={r.id}>
              <span>{r.name}</span>
              <span className="access-kind">{r.kind}</span>
              <button onClick={() => addEntry(r)} disabled={isListed(r.id)}>
                Add
              </button>
            </li>
          ))}
        </ul>
      )}
      <ul className="access-current-list">
        {entries.map((e) => (
          <li key={e.id}>
            <span>{e.name}</span>
            <span className="access-kind">{e.kind}</span>
            <button onClick={() => removeEntry(e.id)}>Remove</button>
          </li>
        ))}
      </ul>
      <div className="access-panel-actions">
        <button onClick={() => void save()} disabled={saving || listUnreadable}>
          Save
        </button>
        {saved && <span className="hint">Saved.</span>}
        {saveError && <div className="error-box">{saveError}</div>}
      </div>
    </div>
  );
}
