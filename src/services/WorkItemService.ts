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
