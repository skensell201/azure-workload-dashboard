import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { PeoplePicker } from '../PeoplePicker';

const people = [
  { key: 'u1', name: 'Ann Smith' },
  { key: 'u2', name: 'Bob Jones' },
  { key: 'u3', name: 'Zoe Ann' },
];

function noop(): void {
  /* intentionally empty */
}

describe('PeoplePicker', () => {
  it('lists everyone when the search box is empty', () => {
    const { getByLabelText } = render(
      <PeoplePicker people={people} selected={new Set()} search="" onToggle={noop} onClear={noop} onSelectShown={noop} />
    );
    people.forEach((p) => expect(getByLabelText(p.name)).toBeTruthy());
  });

  it('narrows the list by the search text, matching anywhere in the name', () => {
    const { getByLabelText, queryByLabelText } = render(
      <PeoplePicker people={people} selected={new Set()} search="ann" onToggle={noop} onClear={noop} onSelectShown={noop} />
    );
    expect(getByLabelText('Ann Smith')).toBeTruthy();
    expect(getByLabelText('Zoe Ann')).toBeTruthy();
    expect(queryByLabelText('Bob Jones')).toBeNull();
  });

  it('reports the person whose checkbox was clicked', () => {
    const toggled: string[] = [];
    const { getByLabelText } = render(
      <PeoplePicker
        people={people}
        selected={new Set()}
        search=""
        onToggle={(key) => toggled.push(key)}
        onClear={noop}
        onSelectShown={noop}
      />
    );
    fireEvent.click(getByLabelText('Bob Jones'));
    expect(toggled).toEqual(['u2']);
  });

  it('shows which people are already checked', () => {
    const { getByLabelText } = render(
      <PeoplePicker
        people={people}
        selected={new Set(['u3'])}
        search=""
        onToggle={noop}
        onClear={noop}
        onSelectShown={noop}
      />
    );
    expect((getByLabelText('Zoe Ann') as HTMLInputElement).checked).toBe(true);
    expect((getByLabelText('Ann Smith') as HTMLInputElement).checked).toBe(false);
  });

  it('hands back exactly the people currently shown when adding them all', () => {
    let added: string[] = [];
    const { getByText } = render(
      <PeoplePicker
        people={people}
        selected={new Set()}
        search="ann"
        onToggle={noop}
        onClear={noop}
        onSelectShown={(keys) => (added = keys)}
      />
    );
    fireEvent.click(getByText('Add all shown'));
    expect(added).toEqual(['u1', 'u3']);
  });

  it('says when the search matches nobody', () => {
    const { getByText } = render(
      <PeoplePicker
        people={people}
        selected={new Set()}
        search="nobody"
        onToggle={noop}
        onClear={noop}
        onSelectShown={noop}
      />
    );
    expect(getByText(/Nobody matches/)).toBeTruthy();
  });
});
