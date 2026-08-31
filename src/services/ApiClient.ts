export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
}

const RETRYABLE = new Set([429, 503]);
const MAX_RETRIES = 3;

export class RestApiClient implements ApiClient {
  constructor(
    private baseUrl: string,
    private token: string,
    private fetchFn: typeof fetch = fetch.bind(globalThis),
    private sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))
  ) {}

  get<T>(path: string): Promise<T> {
    return this.request<T>(path, undefined);
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, body);
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    const headers: Record<string, string> = { Authorization: `Bearer ${this.token}`, Accept: 'application/json' };
    const init: RequestInit =
      body === undefined
        ? { headers }
        : { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    for (let attempt = 0; ; attempt++) {
      const res = await this.fetchFn(`${this.baseUrl}${path}`, init);
      if (RETRYABLE.has(res.status) && attempt < MAX_RETRIES) {
        await this.sleep(500 * 2 ** attempt);
        continue;
      }
      if (!res.ok) throw new ApiError(res.status, `${body === undefined ? 'GET' : 'POST'} ${path} failed with ${res.status}`);
      return (await res.json()) as T;
    }
  }
}
