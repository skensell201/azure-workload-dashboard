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
