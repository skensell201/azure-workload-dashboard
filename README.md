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

The `Total` column sits immediately after the name, so the number that matters
most stays visible however many projects the collection has.

## Picking people

The search box finds people by name. **People** opens a picker listing everyone
with tasks in the window; tick as many as you need and the table, its totals and
both exports narrow to exactly those people. An explicit selection wins over the
search text, so you can keep searching for the next person to add without losing
the ones already ticked. `Clear selection` goes back to showing everyone the
search matches.

## People with no tasks

Today's matrix is built from Task work items, so a specialist with nothing
assigned in the window would otherwise be invisible to management. With
**Include people with no tasks** checked (the default), the table also seeds a
zero row — `0 / 0`, no project columns — for every person who belongs to a
project team but has no Task in the window. The roster comes from each
project's team membership (`_apis/projects/{id}/teams` and its members), the
only roster on-prem exposes without Graph API scopes. Unchecking the box
hides those rows immediately and, from the next Refresh onward, skips the
extra per-project team calls entirely, which makes the load faster.

## Export

**CSV** writes the matrix exactly as displayed, including the name filter, with a
UTF-8 BOM so Excel opens Cyrillic names correctly. **Excel** writes a workbook with
two sheets: `Workload` (the same matrix) and `Tasks` (every task behind it — id,
title, person, project, iteration, state, hours), so the numbers can be pivoted.

In both formats each project becomes two numeric columns, `— Original Estimate`
and `— Completed`, rather than one `48 / 32` string, so the values can be summed.
A project a person has no tasks in is left blank rather than zero. Files are named
after the loaded window, e.g. `workload-2026-08-31_2026-09-13.xlsx`.

## Access

The hub is gated by an allow-list of collection identities (users and, since LDAP/AD
groups show up as ordinary collection identities, groups too — nested groups resolve
transitively).

- **An empty list means everyone has access.** This is the bootstrap: a fresh install
  must not lock out the very administrator who has to configure it. As soon as the list
  has at least one entry, the restriction becomes active for everyone else.
- **Members of `Project Collection Administrators`** always have access, list or no
  list, and are the only ones who can manage it.
- A user is let in if they are listed by identity id, or are a transitive member of a
  listed group, or are a collection administrator.
- The list is edited in **Collection Settings → Extensions → Workload Access**: search
  identities, `Add`, `Remove`, then `Save`. Azure DevOps only shows that page to users who
  can administer the collection, so the page sits where every other extension's settings
  do rather than inside the dashboard.
- A denied user sees one sentence, never an empty table or a stack trace:
  *"You do not have access to Workload. Ask a collection administrator to grant it."*
- **If the allow-list itself cannot be read** (the extension's data storage is
  unavailable), the hub denies everyone except collection administrators and shows an
  explicit error instead of the denial sentence, so an admin can still get in and fix
  it. This never falls back to per-browser storage — a per-browser fallback would let
  anyone self-authorise — and it never fails open. In that state **Save is disabled**, so
  a list that could not be read cannot be silently overwritten; the panel instead offers
  **Create a new access list**, a deliberate action that stores an empty list (and
  therefore opens the hub to everyone until entries are added).
- **On a fresh install** the allow-list document does not exist yet. Whether that reads
  as "absent" (everyone allowed) or as "unreadable" depends on how this server reports a
  missing document, so ordinary users may see the denial message until an administrator
  opens **Workload Access** once and uses **Create a new access list**. Doing that on day
  one is the recommended first step regardless.
- **Do not add `vso.extension_data` / `vso.extension_data_write` to `scopes`.** Azure
  DevOps Server rejects the package outright with *"Scope is not valid. Cannot mix uri
  based and modern scopes"*. The extension data manager the allow-list is stored through
  works without them on-prem, as the sibling `AzureWorkItems_Export` extension has done
  for years with the same three scopes this one declares.

`vss-extension.json` also declares a `ms.vss-web.control-constraint` so a denied user's
Boards navigation can hide the Workload hub entirely on hosts that honour it; this has
not been verified against this on-prem host and may simply be ignored. Either way,
**hiding the hub is UI-level gating, not a security boundary**: the extension reads data
with the viewer's own access token, so anyone with project access can call the same REST
APIs directly regardless of what the hub shows or hides. Real confidentiality comes from
project permissions in Azure DevOps itself, not from this extension.

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
