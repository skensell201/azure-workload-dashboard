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

  useEffect(() => {
    void (async () => {
      const list = await service.readList();
      if (list === null) {
        setListUnreadable(true);
        setEntries([]);
      } else {
        setEntries(list.entries);
      }
    })();
  }, [service]);

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
    if (entries.some((e) => e.id === entry.id)) return;
    setEntries([...entries, entry]);
    setSaved(false);
  }

  function removeEntry(id: string): void {
    setEntries(entries.filter((e) => e.id !== id));
    setSaved(false);
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
              <button onClick={() => addEntry(r)} disabled={entries.some((e) => e.id === r.id)}>
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
