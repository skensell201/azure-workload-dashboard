/** Azure DevOps palette variables hold an RGB triplet ("255, 255, 255"), sometimes quoted.
 *  Native controls (the date pickers) follow color-scheme, not our CSS, so the hub has to
 *  tell the browser which theme it is rendering in. */
export function colorSchemeOf(neutralZero: string): 'light' | 'dark' {
  const parts = neutralZero.replace(/"/g, '').split(',').map((p) => Number(p.trim()));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return 'light';
  const [r, g, b] = parts;
  return 0.299 * r + 0.587 * g + 0.114 * b < 128 ? 'dark' : 'light';
}
