import { ApiClient } from './ApiClient';
import { NamedRef } from '../models/types';
import { Person } from './people';
import { runBatched } from '../utils/batch';

export class TeamService {
  constructor(private api: ApiClient) {}

  async getTeams(projectId: string): Promise<NamedRef[]> {
    const res = await this.api.get<{ value: NamedRef[] }>(
      `/_apis/projects/${encodeURIComponent(projectId)}/teams?api-version=6.0`
    );
    return res.value;
  }

  /** Team membership is the only roster available on-prem without Graph API scopes. */
  async getProjectMembers(projectId: string): Promise<Person[]> {
    const teams = await this.getTeams(projectId);
    const perTeam = await runBatched(teams, (t) =>
      this.api.get<{ value: { identity?: { uniqueName?: string; displayName?: string } }[] }>(
        `/_apis/projects/${encodeURIComponent(projectId)}/teams/${encodeURIComponent(t.id)}/members?api-version=6.0`
      )
    );
    const byKey = new Map<string, Person>();
    for (const res of perTeam) {
      for (const m of res.value) {
        const name = m.identity?.displayName ?? m.identity?.uniqueName;
        const key = m.identity?.uniqueName ?? name;
        if (key && name) byKey.set(key, { key, name });
      }
    }
    return [...byKey.values()];
  }
}
