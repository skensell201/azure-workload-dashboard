# "No tasks" mark in the project columns — Design

Date: 2026-11-09
Status: approved (design reviewed with the requester)

## Problem

The matrix answers "how many hours is this person planned on, per project" but
not "is this person in the project at all". A manager who looks at the `EDO`
column sees `—` for a specialist who is in the EDO team and was never planned
on the sprint, and `—` for a specialist who has nothing to do with EDO. The two
are the same glyph but different facts, and the first one is exactly what a
manager wants to spot: *who was left off the sprint*.

Request from the EDO team lead: "in the current sprint he has no tasks; I want
some mark next to the surname in the EDO column saying so, so that looking
through the EDO column shows who was not planned".

## Solution

Three states per cell, instead of two:

| Cell | Meaning |
| --- | --- |
| `8 / 2` | the person has tasks in that project |
| `no tasks` | the person is in that project's team, but nothing of theirs was planned in the window |
| `—` | the person is not in that project's team |

The mark exists only where the team roster says the person belongs to the
project, so it never appears for outsiders.

## Data

Team membership is already loaded (`_apis/projects/{id}/teams` plus the members
of each team) for the "include people with no tasks" rows, but the project
each member came from was thrown away. It is now kept:

- `RosterPerson` (`src/services/people.ts`) = `Person` + `projects: string[]` —
  the projects whose teams the person is in.
- `LoadOrchestrator.loadRoster` tags each member with the project it was read
  from and merges people across projects, unioning their project lists.

No new REST calls are introduced: the membership travels with the roster that
was being fetched anyway.

## Aggregation

`buildMatrix(tasks, roster)` (`src/services/Aggregation.ts`):

- every row carries `memberProjects` — the projects whose teams the person is
  in, whether or not they have tasks anywhere;
- a project earns a column when it has tasks in the window **or** people in its
  teams. A project nobody was planned in has to stay visible, otherwise "who
  was left out" cannot be read off the matrix;
- `projectTotals` gets a `0 / 0` entry for every such column, so the footer's
  totals row always has a cell to render.

The rows themselves are unchanged: a roster person with no tasks still gets a
`0 / 0` row, and roster people still contribute no hours to any total.

## Rendering

`MatrixTable` (`src/components/MatrixTable.tsx`) picks the cell content from
the three states above; the mark carries a tooltip ("In the project team, no
tasks in this window") and is styled muted and italic (`td.no-tasks` in
`src/hub.css`) so it reads as information rather than as a number.

## Export

Unchanged on purpose: the project columns of CSV and Excel stay numeric, and a
project a person has no tasks in stays blank rather than zero. A text mark in
a numeric column would break summing and pivoting, which is what the export is
for. The mark is a reading aid on the screen.

## Dependence on the roster

Both the "no tasks" rows and the "no tasks" marks come from the team roster,
so both appear and disappear with the **Include people with no tasks**
checkbox. Unchecking it drops the marks and the extra columns immediately, and
from the next Refresh onward skips the per-project team calls entirely.

If a project's member fetch fails, that project's membership is unknown: the
cells fall back to `—`, and the load is not marked as failed.

## Testing

- `aggregation.test.ts` — membership on a row that already has tasks; a project
  with a team but no tasks gets a column and a `0 / 0` total; merged membership
  of a person in several projects.
- `loadOrchestrator.test.ts` — the roster is deduped across projects and keeps
  the projects each person belongs to.
- `MatrixTable.test.tsx` — the mark lands in the right cell; the dash stays for
  people outside the project.
- `App.test.tsx` — the mark appears with the roster and disappears when the
  checkbox is switched off.

## Release

Version 2.3.0: `package.json` and `vss-extension.json` are bumped, the
extension is built and packaged into `out/`, and the README and the marketplace
overview describe the three cell states.
