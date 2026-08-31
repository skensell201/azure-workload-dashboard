import { ApiClient } from './ApiClient';
import { NamedRef } from '../models/types';

export class ProjectService {
  constructor(private api: ApiClient) {}

  async getProjects(): Promise<NamedRef[]> {
    const res = await this.api.get<{ value: NamedRef[] }>('/_apis/projects?$top=1000&api-version=6.0');
    return res.value;
  }
}
