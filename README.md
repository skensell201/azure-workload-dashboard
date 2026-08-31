<img src="images/icon.png" width="96" align="right" alt="">

# Workload Dashboard

An Azure DevOps Server (on-prem) extension that shows specialist workload across
**all projects in the collection** in a single matrix: rows are people, columns are
projects, and each cell is `Original Estimate / Completed Work` hours, summed from
Task work items whose iteration intersects a selectable date window (default: the
current two-week sprint). Clicking a row expands it into that person's task list,
with links back to each work item. Hours are read straight from the Task work
items' `Microsoft.VSTS.Scheduling.OriginalEstimate` and
`Microsoft.VSTS.Scheduling.CompletedWork` fields — the extension does not compute
or estimate hours itself. Each viewer only sees the projects they already have
access to.

## Export

**CSV** writes the matrix exactly as displayed, including the name filter, with a
UTF-8 BOM so Excel opens Cyrillic names correctly. **Excel** writes a workbook with
two sheets: `Workload` (the same matrix) and `Tasks` (every task behind it — id,
title, person, project, iteration, state, hours), so the numbers can be pivoted.

In both formats each project becomes two numeric columns, `— Original Estimate`
and `— Completed`, rather than one `48 / 32` string, so the values can be summed.
A project a person has no tasks in is left blank rather than zero. Files are named
after the loaded window, e.g. `workload-2026-08-31_2026-09-13.xlsx`.

## Install

1. Download the `.vsix` package from this repository's [GitHub Releases](../../releases).
2. In your Azure DevOps Server collection, go to **Collection Settings → Extensions
   → Manage Extensions**, and choose **Upload / install extension**.
3. Upload the downloaded `.vsix` file, then install it to the target collection.
4. Open any project's **Boards** hub group — a new **Workload** hub appears
   alongside Boards, Backlogs, Sprints, etc.

## Build from source

```bash
npm install
npm test
npm run package
```

`npm run package` builds the production bundle with webpack and then packages the
extension with `tfx-cli`, producing a `.vsix` file under `out/`.

Other useful scripts:

```bash
npm run build      # webpack production build only (outputs to dist/)
npm run typecheck  # tsc --noEmit
```
