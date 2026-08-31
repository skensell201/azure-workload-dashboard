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
    expect((posted!.body as { query: string }).query).toContain("= 'My Proj\\S1'");
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
