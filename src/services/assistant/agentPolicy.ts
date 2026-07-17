/** Reliability helpers for the voice agent harness. */

export function fingerprintToolCall(name: string, args: Record<string, unknown>): string {
  try {
    return `${name}:${JSON.stringify(args, Object.keys(args).sort())}`;
  } catch {
    return `${name}:unserializable`;
  }
}

export class LoopGuard {
  private counts = new Map<string, number>();

  /** Returns true if this identical call has already failed twice. */
  noteFailure(fp: string): boolean {
    const n = (this.counts.get(fp) ?? 0) + 1;
    this.counts.set(fp, n);
    return n >= 2;
  }

  noteSuccess(fp: string): void {
    this.counts.delete(fp);
  }
}

/** Fetch with an AbortSignal that times out (and chains an outer signal). */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit | undefined,
  ms: number,
  outer?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const onOuter = () => controller.abort();
  outer?.addEventListener('abort', onOuter);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onOuter);
  }
}

export function spokenAbortError(err: unknown): string | null {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return 'That took too long — try a shorter request.';
  }
  if (err instanceof Error && /abort/i.test(err.message)) {
    return 'That took too long — try a shorter request.';
  }
  return null;
}
