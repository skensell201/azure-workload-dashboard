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
