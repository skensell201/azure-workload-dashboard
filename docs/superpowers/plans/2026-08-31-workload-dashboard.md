# Workload Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Azure DevOps Server extension showing a matrix of specialists × projects with Original Estimate / Completed Work hours for a selected two-week window, aggregated across the whole collection.

**Architecture:** A Boards hub (same contribution pattern as `../AzureWorkItems_Export`). Pure core (window/iteration intersection, WIQL builder, matrix aggregation) is unit-tested; thin REST services fan out per project with concurrency 6; React UI renders the matrix with expandable rows.

**Tech Stack:** TypeScript, React 16, azure-devops-extension-sdk 4, webpack 5, Jest + ts-jest, tfx-cli. Target Azure DevOps Server `[17.0,)`.

**Spec:** `docs/superpowers/specs/2026-08-31-workload-dashboard-design.md`

**Conventions:** test names in English; comments only for constraints code can't show. Reference implementation to copy patterns from: `/Users/skensel/WORKING/AI/AzureWorkItems_Export`.

---

## File structure

```
azure-workload-dashboard/
  package.json  tsconfig.json  webpack.config.js  jest.config.js
  vss-extension.json  overview.md  .gitignore
  images/icon.png                      (placeholder copied from AzureWorkItems_Export)
  test/styleMock.js
  src/hub.html  src/hub.tsx  src/hub.css
  src/models/types.ts                  (shared interfaces)
  src/utils/batch.ts                   (runBatched — copied verbatim)
  src/services/ApiClient.ts            (copied verbatim)
  src/services/ProjectService.ts       (list projects)
  src/services/IterationService.ts     (iteration tree → intersecting paths; pure core inside)
  src/services/WiqlBuilder.ts          (pure)
  src/services/WorkItemService.ts      (WIQL exec + batch field reads)
  src/services/Aggregation.ts          (pure buildMatrix)
  src/services/LoadOrchestrator.ts     (fan-out, progress, skipped projects)
  src/services/assignee.ts             (pure AssignedTo parsing)
  src/services/window.ts               (pure defaultWindow)
  src/components/MatrixTable.tsx
  src/services/__tests__/*.test.ts
  src/components/__tests__/MatrixTable.test.tsx
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `webpack.config.js`, `jest.config.js`, `.gitignore`, `test/styleMock.js`, `src/hub.html`, `src/utils/batch.ts`, `src/services/ApiClient.ts`, `images/icon.png`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "workload-dashboard",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "webpack --mode production",
    "test": "jest",
    "typecheck": "tsc --noEmit",
    "package": "npm run build && tfx extension create --manifest-globs vss-extension.json --output-path out"
  },
  "dependencies": {
    "azure-devops-extension-api": "^4.230.0",
    "azure-devops-extension-sdk": "^4.0.2",
    "react": "^16.14.0",
    "react-dom": "^16.14.0"
  },
  "devDependencies": {
    "@testing-library/react": "^12.1.5",
    "@types/jest": "^29.5.12",
    "@types/react": "^16.14.60",
    "@types/react-dom": "^16.9.24",
    "css-loader": "^7.1.2",
    "html-webpack-plugin": "^5.6.7",
    "jest": "^29.7.0",
    "jest-environment-jsdom": "^29.7.0",
    "style-loader": "^4.0.0",
    "tfx-cli": "^0.17.0",
    "ts-jest": "^29.1.4",
    "ts-loader": "^9.5.1",
    "typescript": "^5.4.5",
    "webpack": "^5.91.0",
    "webpack-cli": "^5.1.4"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`, `jest.config.js`, `webpack.config.js`, `.gitignore`, `test/styleMock.js`, `src/hub.html`**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "module": "ESNext",
    "moduleResolution": "node",
    "jsx": "react",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "lib": ["ES2017", "DOM"]
  },
  "include": ["src"]
}
```

`jest.config.js`:
```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: { '\\.css$': '<rootDir>/test/styleMock.js' },
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react' } }] },
};
```

`webpack.config.js`:
```js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: { hub: './src/hub.tsx' },
  output: {
    path: path.resolve(__dirname, 'dist'),
    // Content-hashed filename so a new build is never served from a stale browser/CDN cache.
    filename: '[name].[contenthash].js',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
    alias: { 'azure-devops-extension-sdk': path.resolve('node_modules/azure-devops-extension-sdk') },
  },
  module: {
    rules: [
      { test: /\.tsx?$/, loader: 'ts-loader' },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
    ],
  },
  plugins: [new HtmlWebpackPlugin({ template: 'src/hub.html', filename: 'hub.html', inject: 'body' })],
};
```

`.gitignore`:
```
node_modules/
dist/
out/
```

`test/styleMock.js`:
```js
module.exports = {};
```

`src/hub.html`:
```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Workload Dashboard</title></head>
<body>
  <div id="root"></div>
</body>
</html>
```

- [ ] **Step 3: Copy proven files verbatim**

```bash
cp ../AzureWorkItems_Export/src/services/ApiClient.ts src/services/ApiClient.ts
mkdir -p src/utils images
cp ../AzureWorkItems_Export/src/utils/batch.ts src/utils/batch.ts
cp ../AzureWorkItems_Export/images/icon.png images/icon.png
```

- [ ] **Step 4: Install and verify**

Run: `npm install && npx tsc --noEmit`
Expected: install succeeds; typecheck passes (no src errors yet besides none).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold extension project"
```

---

### Task 2: Models + iteration window intersection (pure, TDD)

**Files:**
- Create: `src/models/types.ts`, `src/services/IterationService.ts`
- Test: `src/services/__tests__/iterations.test.ts`

- [ ] **Step 1: Create `src/models/types.ts`**

```ts
export interface NamedRef {
  id: string;
  name: string;
}

/** Inclusive ISO date window, e.g. { start: '2026-09-01', end: '2026-09-14' }. */
export interface DateWindow {
  start: string;
  end: string;
}

/** Classification node as returned by _apis/wit/classificationnodes/iterations. */
export interface IterationNode {
  name: string;
  attributes?: { startDate?: string; finishDate?: string };
  children?: IterationNode[];
}

export interface TaskItem {
  id: number;
  title: string;
  state: string;
  project: string;
  iterationPath: string;
  assigneeKey: string;
  assigneeName: string;
  originalEstimate: number;
  completedWork: number;
}
```

- [ ] **Step 2: Write the failing test**

`src/services/__tests__/iterations.test.ts`:
```ts
import { collectIterationPaths } from '../IterationService';
import { IterationNode } from '../../models/types';

const win = { start: '2026-09-01', end: '2026-09-14' };

function node(name: string, start?: string, finish?: string, children?: IterationNode[]): IterationNode {
  return {
    name,
    attributes: start || finish ? { startDate: start, finishDate: finish } : undefined,
    children,
  };
}

describe('collectIterationPaths', () => {
  it('returns paths of iterations overlapping the window', () => {
    const root = node('Proj', undefined, undefined, [
      node('Sprint 1', '2026-08-17T00:00:00Z', '2026-08-30T00:00:00Z'),
      node('Sprint 2', '2026-08-31T00:00:00Z', '2026-09-13T00:00:00Z'),
      node('Sprint 3', '2026-09-14T00:00:00Z', '2026-09-27T00:00:00Z'),
    ]);
    expect(collectIterationPaths(root, win)).toEqual(['Proj\\Sprint 2', 'Proj\\Sprint 3']);
  });

  it('includes an iteration touching the window by a single day', () => {
    const root = node('P', undefined, undefined, [node('S', '2026-08-20T00:00:00Z', '2026-09-01T00:00:00Z')]);
    expect(collectIterationPaths(root, win)).toEqual(['P\\S']);
  });

  it('walks nested iterations and builds full paths', () => {
    const root = node('P', undefined, undefined, [
      node('Release 1', undefined, undefined, [node('Sprint 5', '2026-09-01T00:00:00Z', '2026-09-14T00:00:00Z')]),
    ]);
    expect(collectIterationPaths(root, win)).toEqual(['P\\Release 1\\Sprint 5']);
  });

  it('ignores iterations without dates', () => {
    const root = node('P', undefined, undefined, [node('Backlog')]);
    expect(collectIterationPaths(root, win)).toEqual([]);
  });

  it('includes a dated root node itself when it overlaps', () => {
    const root = node('P', '2026-09-01T00:00:00Z', '2026-09-14T00:00:00Z');
    expect(collectIterationPaths(root, win)).toEqual(['P']);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest iterations -t collectIterationPaths`
Expected: FAIL — cannot find module `../IterationService`.

- [ ] **Step 4: Write minimal implementation**

`src/services/IterationService.ts`:
```ts
import { ApiClient } from './ApiClient';
import { DateWindow, IterationNode } from '../models/types';

function overlaps(win: DateWindow, start: string, finish: string): boolean {
  // ISO timestamps compare lexicographically; date-only window bounds are extended to day edges.
  return start.slice(0, 10) <= win.end && finish.slice(0, 10) >= win.start;
}

/** Flattens the iteration tree into WIQL iteration paths whose dates intersect the window. */
export function collectIterationPaths(root: IterationNode, win: DateWindow): string[] {
  const result: string[] = [];
  function walk(node: IterationNode, path: string): void {
    const a = node.attributes;
    if (a?.startDate && a?.finishDate && overlaps(win, a.startDate, a.finishDate)) result.push(path);
    for (const child of node.children ?? []) walk(child, `${path}\\${child.name}`);
  }
  walk(root, root.name);
  return result;
}

export class IterationService {
  constructor(private api: ApiClient) {}

  async getIterationPathsIntersecting(project: string, win: DateWindow): Promise<string[]> {
    const root = await this.api.get<IterationNode>(
      `/${encodeURIComponent(project)}/_apis/wit/classificationnodes/iterations?$depth=10&api-version=6.0`
    );
    return collectIterationPaths(root, win);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest iterations`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/models/types.ts src/services/IterationService.ts src/services/__tests__/iterations.test.ts
git commit -m "feat: iteration window intersection"
```

---

### Task 3: WIQL builder (pure, TDD)

**Files:**
- Create: `src/services/WiqlBuilder.ts`
- Test: `src/services/__tests__/wiqlBuilder.test.ts`

- [ ] **Step 1: Write the failing test**

`src/services/__tests__/wiqlBuilder.test.ts`:
```ts
import { buildTaskWiql } from '../WiqlBuilder';

describe('buildTaskWiql', () => {
  it('builds a query over a single iteration path', () => {
    expect(buildTaskWiql(['P\\Sprint 1'])).toBe(
      "SELECT [System.Id] FROM workitems " +
        "WHERE [System.WorkItemType] = 'Task' " +
        "AND [System.AssignedTo] <> '' " +
        "AND [System.State] <> 'Removed' " +
        "AND ([System.IterationPath] UNDER 'P\\Sprint 1')"
    );
  });

  it('joins several iteration paths with OR', () => {
    expect(buildTaskWiql(['P\\S1', 'P\\S2'])).toContain(
      "([System.IterationPath] UNDER 'P\\S1' OR [System.IterationPath] UNDER 'P\\S2')"
    );
  });

  it('escapes single quotes inside iteration paths', () => {
    expect(buildTaskWiql(["P\\O'Brien sprint"])).toContain("UNDER 'P\\O''Brien sprint'");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest wiqlBuilder`
Expected: FAIL — cannot find module `../WiqlBuilder`.

- [ ] **Step 3: Write minimal implementation**

`src/services/WiqlBuilder.ts`:
```ts
export function buildTaskWiql(iterationPaths: string[]): string {
  const under = iterationPaths
    .map((p) => `[System.IterationPath] UNDER '${p.replace(/'/g, "''")}'`)
    .join(' OR ');
  return (
    'SELECT [System.Id] FROM workitems ' +
    "WHERE [System.WorkItemType] = 'Task' " +
    "AND [System.AssignedTo] <> '' " +
    "AND [System.State] <> 'Removed' " +
    `AND (${under})`
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest wiqlBuilder`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/WiqlBuilder.ts src/services/__tests__/wiqlBuilder.test.ts
git commit -m "feat: WIQL builder for sprint tasks"
```

---

### Task 4: Assignee parsing + default window (pure, TDD)

**Files:**
- Create: `src/services/assignee.ts`, `src/services/window.ts`
- Test: `src/services/__tests__/assignee.test.ts`, `src/services/__tests__/window.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/services/__tests__/assignee.test.ts`:
```ts
import { parseAssignee } from '../assignee';

describe('parseAssignee', () => {
  it('reads identity object with uniqueName and displayName', () => {
    expect(parseAssignee({ displayName: 'Ivan Kostin', uniqueName: 'DOMAIN\\ikostin' })).toEqual({
      key: 'DOMAIN\\ikostin',
      name: 'Ivan Kostin',
    });
  });

  it('falls back to displayName as key when uniqueName is missing', () => {
    expect(parseAssignee({ displayName: 'Ivan Kostin' })).toEqual({ key: 'Ivan Kostin', name: 'Ivan Kostin' });
  });

  it('parses legacy string form "Name <account>"', () => {
    expect(parseAssignee('Ivan Kostin <DOMAIN\\ikostin>')).toEqual({
      key: 'DOMAIN\\ikostin',
      name: 'Ivan Kostin',
    });
  });

  it('returns null for empty values', () => {
    expect(parseAssignee(undefined)).toBeNull();
    expect(parseAssignee('')).toBeNull();
  });
});
```

`src/services/__tests__/window.test.ts`:
```ts
import { defaultWindow } from '../window';

describe('defaultWindow', () => {
  it('starts on Monday of the current week and spans 14 days', () => {
    // 2026-09-03 is a Thursday.
    expect(defaultWindow(new Date('2026-09-03T12:00:00Z'))).toEqual({ start: '2026-08-31', end: '2026-09-13' });
  });

  it('starts on the same day when today is Monday', () => {
    expect(defaultWindow(new Date('2026-08-31T00:00:00Z'))).toEqual({ start: '2026-08-31', end: '2026-09-13' });
  });

  it('treats Sunday as the last day of the week', () => {
    expect(defaultWindow(new Date('2026-09-06T00:00:00Z'))).toEqual({ start: '2026-08-31', end: '2026-09-13' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest assignee window`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write minimal implementations**

`src/services/assignee.ts`:
```ts
export interface Assignee {
  key: string;
  name: string;
}

/** AssignedTo comes as an identity object on modern APIs and as "Name <account>" on legacy ones. */
export function parseAssignee(value: unknown): Assignee | null {
  if (!value) return null;
  if (typeof value === 'object') {
    const v = value as { displayName?: string; uniqueName?: string };
    if (!v.displayName && !v.uniqueName) return null;
    const name = v.displayName ?? v.uniqueName ?? '';
    return { key: v.uniqueName ?? name, name };
  }
  if (typeof value === 'string') {
    const m = value.match(/^(.*?)\s*<(.+)>$/);
    if (m) return { key: m[2], name: m[1] };
    return { key: value, name: value };
  }
  return null;
}
```

`src/services/window.ts`:
```ts
import { DateWindow } from '../models/types';

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Monday of the current week (UTC) through Sunday of the next week — 14 days inclusive. */
export function defaultWindow(today: Date): DateWindow {
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const shiftToMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - shiftToMonday);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 13);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest assignee window`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/assignee.ts src/services/window.ts src/services/__tests__/assignee.test.ts src/services/__tests__/window.test.ts
git commit -m "feat: assignee parsing and default two-week window"
```

---

### Task 5: Matrix aggregation (pure, TDD)

**Files:**
- Create: `src/services/Aggregation.ts`
- Test: `src/services/__tests__/aggregation.test.ts`

- [ ] **Step 1: Write the failing test**

`src/services/__tests__/aggregation.test.ts`:
```ts
import { buildMatrix } from '../Aggregation';
import { TaskItem } from '../../models/types';

function task(over: Partial<TaskItem>): TaskItem {
  return {
    id: 1,
    title: 't',
    state: 'Active',
    project: 'A',
    iterationPath: 'A\\S1',
    assigneeKey: 'u1',
    assigneeName: 'User One',
    originalEstimate: 0,
    completedWork: 0,
    ...over,
  };
}

describe('buildMatrix', () => {
  it('sums hours per person per project with row and column totals', () => {
    const m = buildMatrix([
      task({ id: 1, assigneeKey: 'u1', project: 'A', originalEstimate: 8, completedWork: 2 }),
      task({ id: 2, assigneeKey: 'u1', project: 'A', originalEstimate: 4, completedWork: 4 }),
      task({ id: 3, assigneeKey: 'u1', project: 'B', originalEstimate: 16, completedWork: 0 }),
      task({ id: 4, assigneeKey: 'u2', assigneeName: 'User Two', project: 'B', originalEstimate: 40, completedWork: 20 }),
    ]);
    expect(m.projects).toEqual(['A', 'B']);
    expect(m.rows.map((r) => r.name)).toEqual(['User One', 'User Two']);
    expect(m.rows[0].cells.get('A')).toEqual({ oe: 12, completed: 6 });
    expect(m.rows[0].cells.get('B')).toEqual({ oe: 16, completed: 0 });
    expect(m.rows[0].total).toEqual({ oe: 28, completed: 6 });
    expect(m.rows[1].cells.has('A')).toBe(false);
    expect(m.projectTotals.get('B')).toEqual({ oe: 56, completed: 20 });
    expect(m.grandTotal).toEqual({ oe: 68, completed: 26 });
  });

  it('sorts people and projects alphabetically', () => {
    const m = buildMatrix([
      task({ assigneeKey: 'z', assigneeName: 'Zoe', project: 'Zeta' }),
      task({ assigneeKey: 'a', assigneeName: 'Ann', project: 'Alpha' }),
    ]);
    expect(m.projects).toEqual(['Alpha', 'Zeta']);
    expect(m.rows.map((r) => r.name)).toEqual(['Ann', 'Zoe']);
  });

  it('keeps the person tasks attached to the row', () => {
    const m = buildMatrix([task({ id: 7 }), task({ id: 8 })]);
    expect(m.rows[0].tasks.map((t) => t.id)).toEqual([7, 8]);
  });

  it('returns an empty matrix for no tasks', () => {
    const m = buildMatrix([]);
    expect(m.rows).toEqual([]);
    expect(m.projects).toEqual([]);
    expect(m.grandTotal).toEqual({ oe: 0, completed: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest aggregation`
Expected: FAIL — cannot find module `../Aggregation`.

- [ ] **Step 3: Write minimal implementation**

`src/services/Aggregation.ts`:
```ts
import { TaskItem } from '../models/types';

export interface MatrixCell {
  oe: number;
  completed: number;
}

export interface MatrixRow {
  key: string;
  name: string;
  cells: Map<string, MatrixCell>;
  total: MatrixCell;
  tasks: TaskItem[];
}

export interface Matrix {
  projects: string[];
  rows: MatrixRow[];
  projectTotals: Map<string, MatrixCell>;
  grandTotal: MatrixCell;
}

function add(cell: MatrixCell, t: TaskItem): void {
  cell.oe += t.originalEstimate;
  cell.completed += t.completedWork;
}

export function buildMatrix(tasks: TaskItem[]): Matrix {
  const rowsByKey = new Map<string, MatrixRow>();
  const projectTotals = new Map<string, MatrixCell>();
  const grandTotal: MatrixCell = { oe: 0, completed: 0 };

  for (const t of tasks) {
    let row = rowsByKey.get(t.assigneeKey);
    if (!row) {
      row = { key: t.assigneeKey, name: t.assigneeName, cells: new Map(), total: { oe: 0, completed: 0 }, tasks: [] };
      rowsByKey.set(t.assigneeKey, row);
    }
    let cell = row.cells.get(t.project);
    if (!cell) {
      cell = { oe: 0, completed: 0 };
      row.cells.set(t.project, cell);
    }
    let pt = projectTotals.get(t.project);
    if (!pt) {
      pt = { oe: 0, completed: 0 };
      projectTotals.set(t.project, pt);
    }
    add(cell, t);
    add(row.total, t);
    add(pt, t);
    add(grandTotal, t);
    row.tasks.push(t);
  }

  const rows = [...rowsByKey.values()].sort((a, b) => a.name.localeCompare(b.name));
  const projects = [...projectTotals.keys()].sort((a, b) => a.localeCompare(b));
  return { projects, rows, projectTotals, grandTotal };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest aggregation`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/Aggregation.ts src/services/__tests__/aggregation.test.ts
git commit -m "feat: person-by-project matrix aggregation"
```

---

### Task 6: REST services — ProjectService and WorkItemService

**Files:**
- Create: `src/services/ProjectService.ts`, `src/services/WorkItemService.ts`
- Test: `src/services/__tests__/workItemService.test.ts`

- [ ] **Step 1: Write the failing test (fake ApiClient, no network)**

`src/services/__tests__/workItemService.test.ts`:
```ts
import { WorkItemService } from '../WorkItemService';
import { ApiClient } from '../ApiClient';

function fakeApi(handlers: { get?: (path: string) => unknown; post?: (path: string, body: unknown) => unknown }): ApiClient {
  return {
    get: async <T>(path: string) => handlers.get!(path) as T,
    post: async <T>(path: string, body: unknown) => handlers.post!(path, body) as T,
  };
}

describe('WorkItemService', () => {
  it('queryTaskIds posts WIQL to the project scope and returns ids', async () => {
    let posted: { path: string; body: unknown } | null = null;
    const api = fakeApi({
      post: (path, body) => {
        posted = { path, body };
        return { workItems: [{ id: 5 }, { id: 9 }] };
      },
    });
    const ids = await new WorkItemService(api).queryTaskIds('My Proj', ["My Proj\\S1"]);
    expect(ids).toEqual([5, 9]);
    expect(posted!.path).toBe('/My%20Proj/_apis/wit/wiql?api-version=6.0');
    expect((posted!.body as { query: string }).query).toContain("UNDER 'My Proj\\S1'");
  });

  it('getFieldsBatch chunks ids and merges responses', async () => {
    const paths: string[] = [];
    const api = fakeApi({
      get: (path) => {
        paths.push(path);
        const ids = /ids=([\d,]+)/.exec(path)![1].split(',').map(Number);
        return { value: ids.map((id) => ({ id, fields: { 'System.Title': `t${id}` } })) };
      },
    });
    const ids = Array.from({ length: 150 }, (_, i) => i + 1);
    const fields = await new WorkItemService(api).getFieldsBatch('P', ids, ['System.Title']);
    expect(paths).toHaveLength(2);
    expect(fields.size).toBe(150);
    expect(fields.get(150)).toEqual({ 'System.Title': 't150' });
  });

  it('getFieldsBatch returns an empty map for no ids without calling the API', async () => {
    const api = fakeApi({});
    const fields = await new WorkItemService(api).getFieldsBatch('P', [], ['System.Title']);
    expect(fields.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest workItemService`
Expected: FAIL — cannot find module `../WorkItemService`.

- [ ] **Step 3: Write implementations**

`src/services/ProjectService.ts`:
```ts
import { ApiClient } from './ApiClient';
import { NamedRef } from '../models/types';

export class ProjectService {
  constructor(private api: ApiClient) {}

  async getProjects(): Promise<NamedRef[]> {
    const res = await this.api.get<{ value: NamedRef[] }>('/_apis/projects?$top=1000&api-version=6.0');
    return res.value;
  }
}
```

`src/services/WorkItemService.ts`:
```ts
import { ApiClient } from './ApiClient';
import { buildTaskWiql } from './WiqlBuilder';
import { runBatched } from '../utils/batch';

// Smaller chunk keeps the GET workitems query string under on-prem IIS URL limits.
const CHUNK = 100;

export class WorkItemService {
  constructor(private api: ApiClient) {}

  async queryTaskIds(project: string, iterationPaths: string[]): Promise<number[]> {
    const res = await this.api.post<{ workItems?: { id: number }[] }>(
      `/${encodeURIComponent(project)}/_apis/wit/wiql?api-version=6.0`,
      { query: buildTaskWiql(iterationPaths) }
    );
    return (res.workItems ?? []).map((w) => w.id);
  }

  /** Fetches fields for the given ids in chunks; merges into id -> fields.
   *  Uses GET _apis/wit/workitems (some on-prem builds 404 on the POST workitemsbatch route).
   *  errorPolicy=omit skips ids the user cannot read. */
  async getFieldsBatch(project: string, ids: number[], fields: string[]): Promise<Map<number, Record<string, unknown>>> {
    const result = new Map<number, Record<string, unknown>>();
    if (ids.length === 0) return result;
    const chunks: number[][] = [];
    for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));
    const responses = await runBatched(chunks, (chunk) =>
      this.api.get<{ value: { id: number; fields: Record<string, unknown> }[] }>(
        `/${encodeURIComponent(project)}/_apis/wit/workitems?ids=${chunk.join(',')}` +
          `&fields=${fields.join(',')}&errorPolicy=omit&api-version=6.0`
      )
    );
    for (const res of responses) for (const wi of res.value) result.set(wi.id, wi.fields);
    return result;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest workItemService`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/ProjectService.ts src/services/WorkItemService.ts src/services/__tests__/workItemService.test.ts
git commit -m "feat: project and work item REST services"
```

---

### Task 7: LoadOrchestrator — fan-out with progress and skipped projects (TDD)

**Files:**
- Create: `src/services/LoadOrchestrator.ts`
- Test: `src/services/__tests__/loadOrchestrator.test.ts`

- [ ] **Step 1: Write the failing test (fake services)**

`src/services/__tests__/loadOrchestrator.test.ts`:
```ts
import { LoadOrchestrator } from '../LoadOrchestrator';

const win = { start: '2026-09-01', end: '2026-09-14' };

function makeDeps(over: Partial<Record<'getProjects' | 'getIterationPathsIntersecting' | 'queryTaskIds' | 'getFieldsBatch', unknown>>) {
  return {
    projects: {
      getProjects: (over.getProjects as never) ?? (async () => [{ id: '1', name: 'A' }, { id: '2', name: 'B' }]),
    },
    iterations: {
      getIterationPathsIntersecting:
        (over.getIterationPathsIntersecting as never) ?? (async (p: string) => [`${p}\\S1`]),
    },
    workItems: {
      queryTaskIds: (over.queryTaskIds as never) ?? (async () => [10]),
      getFieldsBatch:
        (over.getFieldsBatch as never) ??
        (async (_p: string, ids: number[]) =>
          new Map(
            ids.map((id) => [
              id,
              {
                'System.Title': `task ${id}`,
                'System.State': 'Active',
                'System.IterationPath': 'A\\S1',
                'System.AssignedTo': { displayName: 'User One', uniqueName: 'u1' },
                'Microsoft.VSTS.Scheduling.OriginalEstimate': 8,
                'Microsoft.VSTS.Scheduling.CompletedWork': 3,
              },
            ])
          )),
    },
  };
}

describe('LoadOrchestrator', () => {
  it('collects tasks from every project', async () => {
    const result = await new LoadOrchestrator(makeDeps({}) as never).load(win, () => {});
    expect(result.tasks).toHaveLength(2);
    expect(result.tasks.map((t) => t.project).sort()).toEqual(['A', 'B']);
    expect(result.tasks[0]).toMatchObject({
      id: 10,
      title: 'task 10',
      assigneeKey: 'u1',
      assigneeName: 'User One',
      originalEstimate: 8,
      completedWork: 3,
    });
    expect(result.skippedProjects).toEqual([]);
  });

  it('skips a failing project and keeps the rest', async () => {
    const deps = makeDeps({
      getIterationPathsIntersecting: async (p: string) => {
        if (p === 'A') throw new Error('403');
        return [`${p}\\S1`];
      },
    });
    const result = await new LoadOrchestrator(deps as never).load(win, () => {});
    expect(result.tasks.map((t) => t.project)).toEqual(['B']);
    expect(result.skippedProjects).toEqual(['A']);
  });

  it('skips WIQL for projects with no intersecting iterations', async () => {
    let wiqlCalls = 0;
    const deps = makeDeps({
      getIterationPathsIntersecting: async () => [],
      queryTaskIds: async () => {
        wiqlCalls++;
        return [];
      },
    });
    const result = await new LoadOrchestrator(deps as never).load(win, () => {});
    expect(wiqlCalls).toBe(0);
    expect(result.tasks).toEqual([]);
  });

  it('treats missing hour fields as zero and drops unassigned tasks', async () => {
    const deps = makeDeps({
      getFieldsBatch: async (_p: string, ids: number[]) =>
        new Map([
          [ids[0], { 'System.Title': 'no hours', 'System.State': 'New', 'System.IterationPath': 'A\\S1',
                     'System.AssignedTo': { displayName: 'U', uniqueName: 'u' } }],
        ]),
      getProjects: async () => [{ id: '1', name: 'A' }],
    });
    const result = await new LoadOrchestrator(deps as never).load(win, () => {});
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]).toMatchObject({ originalEstimate: 0, completedWork: 0 });
  });

  it('reports progress once per project', async () => {
    const seen: Array<[number, number]> = [];
    await new LoadOrchestrator(makeDeps({}) as never).load(win, (done, total) => seen.push([done, total]));
    expect(seen).toHaveLength(2);
    expect(seen[seen.length - 1]).toEqual([2, 2]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest loadOrchestrator`
Expected: FAIL — cannot find module `../LoadOrchestrator`.

- [ ] **Step 3: Write implementation**

`src/services/LoadOrchestrator.ts`:
```ts
import { DateWindow, NamedRef, TaskItem } from '../models/types';
import { ProjectService } from './ProjectService';
import { IterationService } from './IterationService';
import { WorkItemService } from './WorkItemService';
import { parseAssignee } from './assignee';
import { runBatched } from '../utils/batch';

export const TASK_FIELDS = [
  'System.Title',
  'System.State',
  'System.IterationPath',
  'System.AssignedTo',
  'Microsoft.VSTS.Scheduling.OriginalEstimate',
  'Microsoft.VSTS.Scheduling.CompletedWork',
];

export interface LoadResult {
  tasks: TaskItem[];
  skippedProjects: string[];
}

interface Deps {
  projects: ProjectService;
  iterations: IterationService;
  workItems: WorkItemService;
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

export class LoadOrchestrator {
  constructor(private deps: Deps) {}

  async load(win: DateWindow, onProgress: (done: number, total: number) => void): Promise<LoadResult> {
    const projects = await this.deps.projects.getProjects();
    const skippedProjects: string[] = [];
    let done = 0;
    const perProject = await runBatched(projects, async (p: NamedRef) => {
      try {
        return await this.loadProject(p.name, win);
      } catch {
        skippedProjects.push(p.name);
        return [] as TaskItem[];
      } finally {
        done++;
        onProgress(done, projects.length);
      }
    });
    return { tasks: perProject.flat(), skippedProjects };
  }

  private async loadProject(project: string, win: DateWindow): Promise<TaskItem[]> {
    const paths = await this.deps.iterations.getIterationPathsIntersecting(project, win);
    if (paths.length === 0) return [];
    const ids = await this.deps.workItems.queryTaskIds(project, paths);
    const fields = await this.deps.workItems.getFieldsBatch(project, ids, TASK_FIELDS);
    const tasks: TaskItem[] = [];
    for (const [id, f] of fields) {
      const assignee = parseAssignee(f['System.AssignedTo']);
      if (!assignee) continue;
      tasks.push({
        id,
        title: String(f['System.Title'] ?? ''),
        state: String(f['System.State'] ?? ''),
        project,
        iterationPath: String(f['System.IterationPath'] ?? ''),
        assigneeKey: assignee.key,
        assigneeName: assignee.name,
        originalEstimate: num(f['Microsoft.VSTS.Scheduling.OriginalEstimate']),
        completedWork: num(f['Microsoft.VSTS.Scheduling.CompletedWork']),
      });
    }
    return tasks;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest loadOrchestrator`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the whole suite and typecheck**

Run: `npx jest && npx tsc --noEmit`
Expected: all suites PASS; no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/services/LoadOrchestrator.ts src/services/__tests__/loadOrchestrator.test.ts
git commit -m "feat: per-project fan-out orchestrator"
```

---

### Task 8: MatrixTable component (TDD)

**Files:**
- Create: `src/components/MatrixTable.tsx`
- Test: `src/components/__tests__/MatrixTable.test.tsx`

- [ ] **Step 1: Write the failing test**

`src/components/__tests__/MatrixTable.test.tsx`:
```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { MatrixTable } from '../MatrixTable';
import { buildMatrix } from '../../services/Aggregation';
import { TaskItem } from '../../models/types';

function task(over: Partial<TaskItem>): TaskItem {
  return {
    id: 1, title: 'Fix bug', state: 'Active', project: 'A', iterationPath: 'A\\S1',
    assigneeKey: 'u1', assigneeName: 'User One', originalEstimate: 8, completedWork: 2, ...over,
  };
}

const matrix = buildMatrix([
  task({ id: 1 }),
  task({ id: 2, project: 'B', originalEstimate: 16, completedWork: 4 }),
  task({ id: 3, assigneeKey: 'u2', assigneeName: 'User Two', project: 'B', originalEstimate: 40, completedWork: 20 }),
]);

describe('MatrixTable', () => {
  it('renders one row per person with per-project cells and totals', () => {
    const { getByText, getAllByText } = render(<MatrixTable matrix={matrix} filter="" baseUrl="http://s" />);
    expect(getByText('User One')).toBeTruthy();
    expect(getByText('User Two')).toBeTruthy();
    expect(getAllByText('24 / 6').length).toBeGreaterThan(0); // User One total
    expect(getAllByText('56 / 24').length).toBeGreaterThan(0); // project B total
  });

  it('expands a row into the task list on click', () => {
    const { getByText, queryByText } = render(<MatrixTable matrix={matrix} filter="" baseUrl="http://s" />);
    expect(queryByText('Fix bug')).toBeNull();
    fireEvent.click(getByText('User One'));
    expect(getByText('Fix bug')).toBeTruthy();
  });

  it('filters rows by name substring, case-insensitive', () => {
    const { queryByText } = render(<MatrixTable matrix={matrix} filter="two" baseUrl="http://s" />);
    expect(queryByText('User One')).toBeNull();
    expect(queryByText('User Two')).toBeTruthy();
  });

  it('shows a dash for a project the person has no tasks in', () => {
    const { getAllByText } = render(<MatrixTable matrix={matrix} filter="" baseUrl="http://s" />);
    expect(getAllByText('—').length).toBe(1); // User Two × project A
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest MatrixTable`
Expected: FAIL — cannot find module `../MatrixTable`.

- [ ] **Step 3: Write implementation**

`src/components/MatrixTable.tsx`:
```tsx
import React, { useState } from 'react';
import { Matrix, MatrixCell, MatrixRow } from '../services/Aggregation';

function fmt(c: MatrixCell): string {
  return `${c.oe} / ${c.completed}`;
}

function TaskRows({ row, colSpan, baseUrl }: { row: MatrixRow; colSpan: number; baseUrl: string }): JSX.Element {
  return (
    <tr className="task-details">
      <td colSpan={colSpan}>
        <table className="task-list">
          <tbody>
            {row.tasks.map((t) => (
              <tr key={t.id}>
                <td>
                  <a href={`${baseUrl}/${encodeURIComponent(t.project)}/_workitems/edit/${t.id}`} target="_blank" rel="noreferrer">
                    #{t.id}
                  </a>
                </td>
                <td>{t.title}</td>
                <td>{t.project}</td>
                <td>{t.iterationPath}</td>
                <td>{t.state}</td>
                <td>{t.originalEstimate} / {t.completedWork}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </td>
    </tr>
  );
}

export function MatrixTable({ matrix, filter, baseUrl }: { matrix: Matrix; filter: string; baseUrl: string }): JSX.Element {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const needle = filter.trim().toLowerCase();
  const rows = needle ? matrix.rows.filter((r) => r.name.toLowerCase().includes(needle)) : matrix.rows;
  const colSpan = matrix.projects.length + 2;

  function toggle(key: string): void {
    const next = new Set(expanded);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpanded(next);
  }

  return (
    <table className="matrix">
      <thead>
        <tr>
          <th>Person</th>
          {matrix.projects.map((p) => <th key={p}>{p}</th>)}
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <React.Fragment key={r.key}>
            <tr className="person-row" onClick={() => toggle(r.key)}>
              <td>{r.name}</td>
              {matrix.projects.map((p) => {
                const cell = r.cells.get(p);
                return <td key={p}>{cell ? fmt(cell) : '—'}</td>;
              })}
              <td className="total">{fmt(r.total)}</td>
            </tr>
            {expanded.has(r.key) && <TaskRows row={r} colSpan={colSpan} baseUrl={baseUrl} />}
          </React.Fragment>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td>Total</td>
          {matrix.projects.map((p) => <td key={p}>{fmt(matrix.projectTotals.get(p)!)}</td>)}
          <td className="total">{fmt(matrix.grandTotal)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest MatrixTable`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/MatrixTable.tsx src/components/__tests__/MatrixTable.test.tsx
git commit -m "feat: matrix table with expandable rows"
```

---

### Task 9: Hub entry, styles, manifest, build

**Files:**
- Create: `src/hub.tsx`, `src/hub.css`, `vss-extension.json`, `overview.md`

- [ ] **Step 1: Create `src/hub.tsx`**

```tsx
import './hub.css';
import * as SDK from 'azure-devops-extension-sdk';
import { CommonServiceIds, ILocationService } from 'azure-devops-extension-api';
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { RestApiClient } from './services/ApiClient';
import { ProjectService } from './services/ProjectService';
import { IterationService } from './services/IterationService';
import { WorkItemService } from './services/WorkItemService';
import { LoadOrchestrator, LoadResult } from './services/LoadOrchestrator';
import { buildMatrix } from './services/Aggregation';
import { defaultWindow } from './services/window';
import { DateWindow } from './models/types';
import { MatrixTable } from './components/MatrixTable';

function describeError(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function App({ orchestrator, baseUrl }: { orchestrator: LoadOrchestrator; baseUrl: string }): JSX.Element {
  const [win, setWin] = useState<DateWindow>(defaultWindow(new Date()));
  const [filter, setFilter] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<LoadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(w: DateWindow): Promise<void> {
    setError(null);
    setResult(null);
    setProgress({ done: 0, total: 0 });
    try {
      const res = await orchestrator.load(w, (done, total) => setProgress({ done, total }));
      setResult(res);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setProgress(null);
    }
  }

  useEffect(() => {
    void load(win);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matrix = result ? buildMatrix(result.tasks) : null;
  return (
    <div className="app">
      <div className="toolbar">
        <label>
          From <input type="date" value={win.start} onChange={(e) => setWin({ ...win, start: e.target.value })} />
        </label>
        <label>
          to <input type="date" value={win.end} onChange={(e) => setWin({ ...win, end: e.target.value })} />
        </label>
        <button onClick={() => void load(win)} disabled={progress !== null}>Refresh</button>
        <input
          type="text"
          placeholder="Filter by name…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="hint">cell: Original Estimate / Completed, hours</span>
      </div>
      {progress && <div className="progress">Loaded {progress.done} of {progress.total} projects</div>}
      {error && <div className="error-box">Failed to load data: {error}</div>}
      {result && result.skippedProjects.length > 0 && (
        <div className="warning">Skipped projects: {result.skippedProjects.join(', ')}</div>
      )}
      {matrix && matrix.rows.length === 0 && !progress && (
        <div className="empty">No assigned tasks in the selected date window.</div>
      )}
      {matrix && matrix.rows.length > 0 && <MatrixTable matrix={matrix} filter={filter} baseUrl={baseUrl} />}
    </div>
  );
}

async function start(): Promise<void> {
  await SDK.init();
  const loc = await SDK.getService<ILocationService>(CommonServiceIds.LocationService);
  const baseUrl = (await loc.getServiceLocation()).replace(/\/$/, '');
  const token = await SDK.getAccessToken();
  const api = new RestApiClient(baseUrl, token);
  const orchestrator = new LoadOrchestrator({
    projects: new ProjectService(api),
    iterations: new IterationService(api),
    workItems: new WorkItemService(api),
  });
  ReactDOM.render(<App orchestrator={orchestrator} baseUrl={baseUrl} />, document.getElementById('root'));
}

start().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Workload Dashboard init failed:', e);
  const root = document.getElementById('root');
  if (root) root.textContent = `Failed to initialize Workload Dashboard: ${describeError(e)}`;
});
```

- [ ] **Step 2: Create `src/hub.css`**

```css
body { font-family: "Segoe UI", sans-serif; font-size: 14px; margin: 0; color: #201f1e; }
.app { padding: 16px; }
.toolbar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
.toolbar input[type="text"] { padding: 4px 8px; min-width: 220px; }
.hint { color: #605e5c; }
.progress { color: #605e5c; margin: 8px 0; }
.warning { background: #fff4ce; border: 1px solid #ffb900; padding: 8px 12px; margin: 8px 0; border-radius: 2px; }
.error-box { background: #fde7e9; border: 1px solid #d13438; padding: 8px 12px; margin: 8px 0; border-radius: 2px; }
.empty { color: #605e5c; padding: 24px 0; }
table.matrix { border-collapse: collapse; width: 100%; }
table.matrix th, table.matrix td { border: 1px solid #edebe9; padding: 6px 10px; text-align: right; white-space: nowrap; }
table.matrix th:first-child, table.matrix td:first-child { text-align: left; }
table.matrix thead th { background: #f3f2f1; position: sticky; top: 0; }
tr.person-row { cursor: pointer; }
tr.person-row:hover { background: #f3f2f1; }
td.total { font-weight: 600; }
tfoot td { font-weight: 600; background: #f3f2f1; }
table.task-list { width: 100%; border-collapse: collapse; }
table.task-list td { border: none; border-bottom: 1px solid #f3f2f1; color: #605e5c; text-align: left; }
```

- [ ] **Step 3: Create `vss-extension.json` and `overview.md`**

`vss-extension.json`:
```json
{
  "manifestVersion": 1,
  "id": "workload-dashboard",
  "publisher": "iksoftware",
  "version": "1.0.0",
  "name": "Workload Dashboard",
  "description": "Specialist workload across all projects: Original Estimate and Completed Work hours per sprint window in one matrix.",
  "content": { "details": { "path": "overview.md" } },
  "categories": ["Boards"],
  "targets": [{ "id": "Microsoft.TeamFoundation.Server", "version": "[17.0,)" }],
  "icons": { "default": "images/icon.png" },
  "scopes": ["vso.work", "vso.project"],
  "contributions": [
    {
      "id": "workload-dashboard-hub",
      "type": "ms.vss-web.hub",
      "targets": ["ms.vss-work-web.work-hub-group"],
      "properties": { "name": "Workload", "uri": "dist/hub.html" }
    }
  ],
  "files": [
    { "path": "dist", "addressable": true },
    { "path": "images", "addressable": true }
  ]
}
```

`overview.md`:
```markdown
# Workload Dashboard

Shows specialist workload across **all projects of the collection** in one matrix:
rows are people, columns are projects, each cell is `Original Estimate / Completed Work`
hours from Tasks assigned to the person in iterations intersecting the selected
date window (default: the current two weeks). A row expands into the person's task list.

Each viewer sees only the projects they have access to.
```

- [ ] **Step 4: Full verification**

Run: `npx jest && npx tsc --noEmit && npm run build`
Expected: all tests PASS; typecheck clean; webpack emits `dist/hub.html` + hashed `hub.*.js`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: hub entry, styles and extension manifest"
```

---

### Task 10: Package the extension

- [ ] **Step 1: Build the .vsix**

Run: `npm run package`
Expected: `out/iksoftware.workload-dashboard-1.0.0.vsix` created.

- [ ] **Step 2: Commit any remaining files**

```bash
git add -A && git commit -m "chore: package v1.0.0" || true
```
