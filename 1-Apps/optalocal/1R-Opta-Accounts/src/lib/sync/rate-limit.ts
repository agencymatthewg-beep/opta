import { RateLimiter } from '@/lib/rate-limit';

type SyncRateLimitOptions = {
  namespace: string;
  limit: number;
  windowMs: number;
  redisUrl?: string;
  redisToken?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function cleanPrefix(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export class SyncDistributedRateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly prefix: string;
  private readonly inMemoryLimiter: RateLimiter;
  private readonly redisUrl: string | null;
  private readonly redisToken: string | null;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private remoteBackoffUntil = 0;

  constructor(options: SyncRateLimitOptions) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.prefix = cleanPrefix(options.namespace);
    this.inMemoryLimiter = new RateLimiter(this.limit, this.windowMs);
    this.redisUrl = options.redisUrl?.trim().replace(/\/+$/, '') || null;
    this.redisToken = options.redisToken?.trim() || null;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 1_500;
  }

  async check(identity: string): Promise<boolean> {
    const remoteAllowed = await this.checkRemote(identity);
    if (remoteAllowed !== null) {
      return remoteAllowed;
    }
    return this.inMemoryLimiter.check(identity);
  }

  private async checkRemote(identity: string): Promise<boolean | null> {
    if (!this.redisUrl || !this.redisToken) return null;
    if (Date.now() < this.remoteBackoffUntil) return null;

    const bucket = Math.floor(Date.now() / this.windowMs);
    const redisKey = `${this.prefix}:${bucket}:${identity}`;

    try {
      const count = await this.runCommand<number>('INCR', redisKey);
      if (!Number.isFinite(count)) {
        throw new Error('invalid_upstash_count');
      }

      // Keep key expiry bounded so buckets do not accumulate indefinitely.
      if (count <= 1) {
        const ttlSeconds = Math.max(1, Math.ceil((this.windowMs * 2) / 1_000));
        void this.runCommand<number>('EXPIRE', redisKey, ttlSeconds).catch(() => undefined);
      }

      return count <= this.limit;
    } catch {
      this.remoteBackoffUntil = Date.now() + 5_000;
      return null;
    }
  }

  private async runCommand<T>(command: string, ...segments: Array<string | number>): Promise<T> {
    if (!this.redisUrl || !this.redisToken) {
      throw new Error('upstash_not_configured');
    }

    const encoded = segments.map((segment) => encodeURIComponent(String(segment))).join('/');
    const endpoint = `${this.redisUrl}/${command.toUpperCase()}/${encoded}`;

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(endpoint, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${this.redisToken}`,
        },
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`upstash_http_${response.status}`);
      }

      const payload = (await response.json()) as { result?: unknown };
      return payload.result as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}

type CreateSyncRateLimiterOptions = {
  namespace: string;
  defaultLimit?: number;
  defaultWindowMs?: number;
};

export function createSyncRateLimiter(options: CreateSyncRateLimiterOptions): SyncDistributedRateLimiter {
  const envNamespace = cleanPrefix(options.namespace).replace(/[^a-z0-9]+/g, '_').toUpperCase();

  const limit = parsePositiveInt(
    process.env[`OPTA_${envNamespace}_RATE_LIMIT_LIMIT`] ?? process.env.OPTA_SYNC_RATE_LIMIT_LIMIT,
    options.defaultLimit ?? 30,
  );
  const windowMs = parsePositiveInt(
    process.env[`OPTA_${envNamespace}_RATE_LIMIT_WINDOW_MS`] ?? process.env.OPTA_SYNC_RATE_LIMIT_WINDOW_MS,
    options.defaultWindowMs ?? 60_000,
  );

  return new SyncDistributedRateLimiter({
    namespace: options.namespace,
    limit,
    windowMs,
    redisUrl: process.env.OPTA_SYNC_RATE_LIMIT_REDIS_URL ?? process.env.UPSTASH_REDIS_REST_URL,
    redisToken: process.env.OPTA_SYNC_RATE_LIMIT_REDIS_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}
