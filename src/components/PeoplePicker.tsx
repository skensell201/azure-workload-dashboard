import React from 'react';
import { Person } from '../services/people';

export function PeoplePicker({
  people,
  selected,
  search,
  onToggle,
  onClear,
  onSelectShown,
}: {
  people: Person[];
  selected: Set<string>;
  search: string;
  onToggle: (key: string) => void;
  onClear: () => void;
  onSelectShown: (keys: string[]) => void;
}): JSX.Element {
  const needle = search.trim().toLowerCase();
  const shown = needle ? people.filter((p) => p.name.toLowerCase().includes(needle)) : people;

  return (
    <div className="people-picker">
      <div className="people-picker-actions">
        <button disabled={shown.length === 0} onClick={() => onSelectShown(shown.map((p) => p.key))}>
          Add all shown
        </button>
        <button disabled={selected.size === 0} onClick={onClear}>
          Clear selection
        </button>
        <span className="hint">
          {selected.size > 0
            ? `${selected.size} selected — the table and exports show only them`
            : 'Nobody selected — the table shows everyone matching the search'}
        </span>
      </div>
      {shown.length === 0 ? (
        <div className="empty">Nobody matches the search.</div>
      ) : (
        <ul className="people-list">
          {shown.map((p) => (
            <li key={p.key}>
              <label>
                <input type="checkbox" checked={selected.has(p.key)} onChange={() => onToggle(p.key)} />
                {p.name}
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
