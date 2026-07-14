/** Shared HTTP client for food-data providers: retries, timeout, rate limit,
 * AbortSignal, User-Agent, and structured failure logging. */

export type HttpFailureKind = 'network' | 'timeout' | 'rate-limit' | 'server' | 'http' | 'abort';

export interface HttpClientOptions {
  /** Default timeout in ms (default 12_000). */
  timeoutMs?: number;
  /** Max attempts including the first try (default 3). */
  maxAttempts?: number;
  /** Base backoff delay in ms (default 300); doubles each retry. */
  backoffMs?: number;
  /** Minimum interval between requests to the same host (default 100 ms). */
  minIntervalMs?: number;
  /** User-Agent header (default Macronaut). */
  userAgent?: string;
  /** Optional fetch implementation (tests). */
  fetchImpl?: typeof fetch;
  /** Optional clock (tests). */
  now?: () => number;
  /** Optional sleep (tests). */
  sleep?: (ms: number) => Promise<void>;
  /** Optional logger (defaults to console.warn). */
  log?: (message: string, detail?: Record<string, unknown>) => void;
}

export interface HttpRequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
  /** Override default timeout for this request. */
  timeoutMs?: number;
  /** Skip retries when false (default true). */
  retry?: boolean;
}

export class HttpClientError extends Error {
  constructor(
    message: string,
    readonly kind: HttpFailureKind,
    readonly status?: number,
    readonly url?: string,
  ) {
    super(message);
    this.name = 'HttpClientError';
  }
}

interface HostBucket {
  nextAllowedAt: number;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'unknown';
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export function createHttpClient(opts: HttpClientOptions = {}) {
  const timeoutMs = opts.timeoutMs ?? 12_000;
  const maxAttempts = opts.maxAttempts ?? 3;
  const backoffMs = opts.backoffMs ?? 300;
  const minIntervalMs = opts.minIntervalMs ?? 100;
  const userAgent = opts.userAgent ?? 'Macronaut/1.0 (nutrition tracker; +https://macronaut.app)';
  const fetchImpl =
    opts.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init));
  const now = opts.now ?? (() => Date.now());
  const sleep = opts.sleep ?? defaultSleep;
  const log =
    opts.log ??
    ((message: string, detail?: Record<string, unknown>) => {
      console.warn(`[food-http] ${message}`, detail ?? '');
    });

  const buckets = new Map<string, HostBucket>();

  async function acquireHost(host: string, signal?: AbortSignal): Promise<void> {
    const bucket = buckets.get(host) ?? { nextAllowedAt: 0 };
    buckets.set(host, bucket);
    const wait = bucket.nextAllowedAt - now();
    if (wait > 0) {
      await sleep(wait);
      if (signal?.aborted) throw new HttpClientError('Aborted', 'abort', undefined);
    }
    bucket.nextAllowedAt = now() + minIntervalMs;
  }

  async function request(url: string, init: HttpRequestInit = {}): Promise<Response> {
    const attempts = init.retry === false ? 1 : maxAttempts;
    const reqTimeout = init.timeoutMs ?? timeoutMs;
    let lastError: HttpClientError | undefined;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      if (init.signal?.aborted) {
        throw new HttpClientError('Aborted', 'abort', undefined, url);
      }

      await acquireHost(hostOf(url), init.signal);

      const controller = new AbortController();
      const onAbort = () => controller.abort();
      init.signal?.addEventListener('abort', onAbort);

      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        timer = setTimeout(() => controller.abort(), reqTimeout);

        let res: Response;
        try {
          res = await fetchImpl(url, {
            method: init.method ?? 'GET',
            headers: {
              'User-Agent': userAgent,
              Accept: 'application/json',
              ...init.headers,
            },
            body: init.body,
            signal: controller.signal,
          });
        } catch (err) {
          if (init.signal?.aborted || (err as Error).name === 'AbortError') {
            // Distinguish caller abort vs our timeout.
            if (init.signal?.aborted) {
              throw new HttpClientError('Aborted', 'abort', undefined, url);
            }
            lastError = new HttpClientError('Request timed out', 'timeout', undefined, url);
          } else {
            lastError = new HttpClientError(
              (err as Error).message || 'Network request failed',
              'network',
              undefined,
              url,
            );
          }
          log('request failed', {
            url,
            attempt,
            kind: lastError.kind,
            message: lastError.message,
          });
          if (attempt < attempts && (lastError.kind === 'network' || lastError.kind === 'timeout')) {
            await sleep(backoffMs * 2 ** (attempt - 1));
            continue;
          }
          throw lastError;
        }

        if (isRetryableStatus(res.status)) {
          lastError = new HttpClientError(
            `HTTP ${res.status}`,
            res.status === 429 ? 'rate-limit' : 'server',
            res.status,
            url,
          );
          log('transient http failure', {
            url,
            attempt,
            status: res.status,
            kind: lastError.kind,
          });
          if (attempt < attempts) {
            const retryAfter = Number(res.headers?.get?.('retry-after'));
            const delay = Number.isFinite(retryAfter) && retryAfter > 0
              ? retryAfter * 1000
              : backoffMs * 2 ** (attempt - 1);
            await sleep(delay);
            continue;
          }
          throw lastError;
        }

        return res;
      } finally {
        if (timer) clearTimeout(timer);
        init.signal?.removeEventListener('abort', onAbort);
      }
    }

    throw lastError ?? new HttpClientError('Request failed', 'network', undefined, url);
  }

  async function requestJson<T>(url: string, init: HttpRequestInit = {}): Promise<T> {
    const res = await request(url, init);
    if (!res.ok) {
      const kind: HttpFailureKind = res.status === 429 ? 'rate-limit' : 'http';
      log('non-ok response', { url, status: res.status, kind });
      throw new HttpClientError(`HTTP ${res.status}`, kind, res.status, url);
    }
    return res.json() as Promise<T>;
  }

  return { request, requestJson };
}

export type HttpClient = ReturnType<typeof createHttpClient>;

/** Shared singleton used by USDA / OFF / Nutritionix / FatSecret providers. */
export const foodHttp = createHttpClient();
