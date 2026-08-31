# Workload Dashboard — Design

Date: 2026-08-31
Status: approved (design review passed in brainstorming session)

## Problem

Managers (запрос от НО через Хаско Е. Н.) cannot see a specialist's planned load
across all Azure DevOps projects at once. Today they must open every project the
person works in and sum sprint hours by hand. They want "one window": planned
hours (Original Estimate) for a two-week sprint per specialist, across the whole
collection.

## Solution overview

A new Azure DevOps Server extension (`iksoftware.workload-dashboard`) that adds a
hub page to the Boards hub group — same contribution pattern as the existing
`workitems-export` extension. The hub shows a matrix of specialists × projects
with Original Estimate / Completed Work hours aggregated from Tasks assigned to
each person within a selected date window.

Target: Azure DevOps Server `[17.0,)` (2022+), on-prem. Repo:
`azure-workload-dashboard`, standalone (not part of the export extensions).

## Screen

- Toolbar: date-window picker (default: the current two weeks, computed in UTC
  so the default is deterministic across timezones) and a name substring filter.
- Matrix table:
  - rows — specialists (everyone who has at least one matching Task);
  - columns — projects that produced at least one matching Task;
  - cell — `OE / Completed` in hours; `—` when the person has no tasks in that
    project;
  - totals column per person and totals row per project.
- A row expands into the person's task list: work item id (link to the item),
  title, project, iteration, `OE / Completed`.
- Progress indicator while loading: "loaded X of N projects".

## Data flow (fan-out per project)

1. List all collection projects (Core REST API).
2. Per project: fetch the iteration classification tree with dates
   (`workitemclassificationnodes/iterations?$depth=...`). Keep iterations whose
   `[startDate, finishDate]` intersects the selected window. Iterations without
   dates are ignored.
3. Per project with matching iterations: run WIQL
   `WorkItemType = 'Task' AND AssignedTo <> '' AND State <> 'Removed' AND
   (IterationPath = <path1> OR ...)` — exact path match, not `UNDER`, so a dated
   release node that overlaps the window does not drag in its child sprints that
   lie outside the window (each dated node is judged by its own dates). Then
   batch-read fields:
   `System.AssignedTo`, `System.Title`, `System.State`, `System.IterationPath`,
   `Microsoft.VSTS.Scheduling.OriginalEstimate`,
   `Microsoft.VSTS.Scheduling.CompletedWork`.
4. Aggregate client-side with pure functions: `Task[] → Matrix(person ×
   project)`. Hours are taken whole — if an iteration intersects the window, its
   tasks count fully; there is no pro-rating by overlap fraction.

Project requests run in parallel with a concurrency cap (6 at a time). All
requests use the viewer's own token via the extension SDK, so each viewer sees
only projects they can read — this is intended behaviour, not a defect.

## Components

- `ProjectService` — list projects.
- `IterationService` — fetch iteration trees; pure function
  `iterationsIntersecting(window, nodes)`.
- `WorkItemService` — pure WIQL builder + WIQL execution + batch field reads.
- `AggregationService` — pure `buildMatrix(tasks)` producing rows, columns and
  totals.
- UI: `DateRangePicker`, `NameFilter`, `MatrixTable` (expandable rows).
- Entry: `src/hub.ts` + `dist/hub.html`, webpack build, manifest
  `vss-extension.json` with a `ms.vss-web.hub` contribution targeting
  `ms.vss-work-web.work-hub-group`.

Stack mirrors the existing extensions: TypeScript, `azure-devops-extension-sdk`,
webpack, Jest.

## Error handling

- A project that fails to load (403/404/timeout) is skipped; the dashboard still
  renders and shows a warning banner listing skipped projects with the reason
  each one failed. The failure reason is kept per project (not swallowed), and
  logged to the console, so an admin can tell a permissions problem from a bug.
- When *every* project fails, that is a systemic failure (expired token, server
  down), not partial success: the UI shows an error, not an empty matrix.
- Empty result (no tasks in the window) renders an explicit empty state, not a
  blank table.
- Missing `OriginalEstimate` / `CompletedWork` values count as 0.

## Testing

Jest unit tests over the pure core (test names in English):

- iteration/window intersection: inside, overlapping edges, outside, missing
  dates;
- WIQL builder: single and multiple iteration paths, path escaping;
- aggregation: multiple projects, a person absent from a project, empty hour
  fields, totals.

Services touching REST are thin wrappers and are exercised via the pure
functions they delegate to.

## Out of scope (YAGNI)

- CSV/Excel export.
- Remaining Work column.
- Grouping by team/department.
- Pro-rating hours by window overlap.
