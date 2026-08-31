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
