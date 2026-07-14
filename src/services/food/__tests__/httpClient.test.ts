import { createHttpClient, HttpClientError } from '../httpClient';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('httpClient', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns JSON on success and sets User-Agent', async () => {
    const fetchImpl = jest.fn(async (_url: string, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)['User-Agent']).toMatch(/Macronaut/);
      return jsonResponse({ ok: true });
    });
    const client = createHttpClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      minIntervalMs: 0,
      sleep: async () => {},
    });
    await expect(client.requestJson<{ ok: boolean }>('https://example.com/a')).resolves.toEqual({
      ok: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries transient 503 with exponential backoff', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ e: 1 }, 503))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const sleeps: number[] = [];
    const client = createHttpClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      minIntervalMs: 0,
      backoffMs: 100,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    await expect(client.requestJson<{ ok: boolean }>('https://example.com/b')).resolves.toEqual({
      ok: true,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleeps[0]).toBe(100);
  });

  it('retries 429 and respects Retry-After', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 429, { 'retry-after': '2' }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    const sleeps: number[] = [];
    const client = createHttpClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      minIntervalMs: 0,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    await expect(client.requestJson('https://api.example.com/x')).resolves.toEqual({ ok: true });
    expect(sleeps[0]).toBe(2000);
  });

  it('throws HttpClientError after exhausting retries', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse({}, 500));
    const client = createHttpClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      maxAttempts: 2,
      minIntervalMs: 0,
      sleep: async () => {},
      log: () => {},
    });
    await expect(client.request('https://example.com/fail')).rejects.toMatchObject({
      name: 'HttpClientError',
      kind: 'server',
      status: 500,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('supports AbortSignal', async () => {
    const controller = new AbortController();
    controller.abort();
    const client = createHttpClient({
      fetchImpl: jest.fn() as unknown as typeof fetch,
      minIntervalMs: 0,
      sleep: async () => {},
    });
    await expect(client.request('https://example.com/z', { signal: controller.signal })).rejects.toBeInstanceOf(
      HttpClientError,
    );
  });

  it('rate-limits per host via min interval', async () => {
    let now = 1_000;
    const fetchImpl = jest.fn(async () => jsonResponse({ ok: true }));
    const sleeps: number[] = [];
    const client = createHttpClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      minIntervalMs: 50,
      now: () => now,
      sleep: async (ms) => {
        sleeps.push(ms);
        now += ms;
      },
    });
    await client.request('https://host.example/1');
    await client.request('https://host.example/2');
    expect(sleeps.some((ms) => ms > 0)).toBe(true);
  });
});
