import { TeamService } from '../TeamService';
import { ApiClient } from '../ApiClient';

function fakeApi(handlers: { get?: (path: string) => unknown }): ApiClient {
  return {
    get: async <T>(path: string) => handlers.get!(path) as T,
    post: async <T>(_path: string, _body: unknown) => {
      throw new Error('post should not be called');
    },
  };
}

describe('TeamService', () => {
  describe('getTeams', () => {
    it('lists the teams of a project', async () => {
      const paths: string[] = [];
      const api = fakeApi({
        get: (path) => {
          paths.push(path);
          return { value: [{ id: 't1', name: 'Team One' }] };
        },
      });
      const teams = await new TeamService(api).getTeams('proj id');
      expect(teams).toEqual([{ id: 't1', name: 'Team One' }]);
      expect(paths).toEqual(['/_apis/projects/proj%20id/teams?api-version=6.0']);
    });
  });

  describe('getProjectMembers', () => {
    it('lists teams then fetches the members of each team', async () => {
      const paths: string[] = [];
      const api = fakeApi({
        get: (path) => {
          paths.push(path);
          if (path.endsWith('/teams?api-version=6.0')) {
            return { value: [{ id: 't1', name: 'Team One' }] };
          }
          return { value: [{ identity: { uniqueName: 'u1', displayName: 'User One' } }] };
        },
      });
      const members = await new TeamService(api).getProjectMembers('P');
      expect(members).toEqual([{ key: 'u1', name: 'User One' }]);
      expect(paths).toEqual([
        '/_apis/projects/P/teams?api-version=6.0',
        '/_apis/projects/P/teams/t1/members?api-version=6.0',
      ]);
    });

    it('dedupes a person who belongs to two teams', async () => {
      const api = fakeApi({
        get: (path) => {
          if (path.endsWith('/teams?api-version=6.0')) {
            return {
              value: [
                { id: 't1', name: 'Team One' },
                { id: 't2', name: 'Team Two' },
              ],
            };
          }
          return { value: [{ identity: { uniqueName: 'u1', displayName: 'User One' } }] };
        },
      });
      const members = await new TeamService(api).getProjectMembers('P');
      expect(members).toEqual([{ key: 'u1', name: 'User One' }]);
    });

    it('tolerates a member with no identity object', async () => {
      const api = fakeApi({
        get: (path) => {
          if (path.endsWith('/teams?api-version=6.0')) {
            return { value: [{ id: 't1', name: 'Team One' }] };
          }
          return { value: [{}, { identity: { uniqueName: 'u1', displayName: 'User One' } }] };
        },
      });
      const members = await new TeamService(api).getProjectMembers('P');
      expect(members).toEqual([{ key: 'u1', name: 'User One' }]);
    });

    it('returns an empty list for a project with no teams', async () => {
      const api = fakeApi({
        get: (path) => {
          if (path.endsWith('/teams?api-version=6.0')) return { value: [] };
          throw new Error('members should not be fetched when there are no teams');
        },
      });
      const members = await new TeamService(api).getProjectMembers('P');
      expect(members).toEqual([]);
    });
  });
});
