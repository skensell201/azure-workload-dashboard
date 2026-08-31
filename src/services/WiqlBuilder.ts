export function buildTaskWiql(iterationPaths: string[]): string {
  if (iterationPaths.length === 0) throw new Error('buildTaskWiql requires at least one iteration path');
  // In WIQL string literals the only escape is quote doubling; backslash is a literal character.
  const clauses = iterationPaths
    .map((p) => `[System.IterationPath] = '${p.replace(/'/g, "''")}'`)
    .join(' OR ');
  return (
    'SELECT [System.Id] FROM workitems ' +
    "WHERE [System.WorkItemType] = 'Task' " +
    "AND [System.AssignedTo] <> '' " +
    "AND [System.State] <> 'Removed' " +
    `AND (${clauses})`
  );
}
