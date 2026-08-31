import React, { useEffect, useState } from 'react';
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AccessEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void (async () => {
      const list = await service.readList();
      if (list === null) {
        setLoadError('The access list could not be read — showing an empty list. Changes may not save until storage is available.');
        setEntries([]);
      } else {
        setEntries(list.entries);
      }
    })();
  }, [service]);

  async function runSearch(q: string): Promise<void> {
    setQuery(q);
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    setResults(await service.searchIdentities(trimmed));
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
      {loadError && <div className="error-box">{loadError}</div>}
      <div className="access-panel-status">{statusText}</div>
      <input
        type="text"
        placeholder="Search identities…"
        value={query}
        onChange={(e) => void runSearch(e.target.value)}
      />
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
        <button onClick={() => void save()} disabled={saving}>
          Save
        </button>
        {saved && <span className="hint">Saved.</span>}
        {saveError && <div className="error-box">{saveError}</div>}
      </div>
    </div>
  );
}
