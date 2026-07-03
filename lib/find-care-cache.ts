// SERVER ONLY — per-instance in-memory caching and upstream-fetch helpers for
// the Find Care proxy routes. Each route module instantiates its own TtlCache,
// so caches are encapsulated per route (and per serverless instance).
import "server-only";
import { FIND_CARE_CONFIG } from "@/lib/find-care";

/** Thrown when an upstream request exceeds its timeout (routes map this to 504). */
export class UpstreamTimeoutError extends Error {
  constructor() {
    super("upstream_timeout");
    this.name = "UpstreamTimeoutError";
  }
}

/** Thrown when an upstream request fails or returns an unusable response (→ 502). */
export class UpstreamError extends Error {
  constructor(message = "upstream_unavailable") {
    super(message);
    this.name = "UpstreamError";
  }
}

/**
 * Time-based in-memory cache with lazy expiry, an entry cap with
 * oldest-insertion eviction, and in-flight de-duplication so concurrent
 * identical requests coalesce into a single upstream call.
 */
export class TtlCache<T> {
  private store = new Map<string, { value: T; expiry: number }>();
  private inflight = new Map<string, Promise<T>>();

  constructor(
    private ttlMs: number,
    private maxEntries: number = FIND_CARE_CONFIG.cacheMaxEntries,
  ) {}

  private evictIfNeeded(): void {
    while (this.store.size > this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }

  get(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expiry) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T): void {
    this.store.delete(key); // re-insert to refresh insertion order
    this.store.set(key, { value, expiry: Date.now() + this.ttlMs });
    this.evictIfNeeded();
  }

  /**
   * Return a cached value or compute it. Concurrent callers for the same key
   * share a single in-flight computation. Returns whether the value was served
   * from cache (or a coalesced in-flight request).
   */
  async getOrCompute(key: string, fn: () => Promise<T>): Promise<{ value: T; cached: boolean }> {
    const cached = this.get(key);
    if (cached !== undefined) return { value: cached, cached: true };

    const existing = this.inflight.get(key);
    if (existing) return { value: await existing, cached: true };

    const promise = fn();
    this.inflight.set(key, promise);
    try {
      const value = await promise;
      this.set(key, value);
      return { value, cached: false };
    } finally {
      this.inflight.delete(key);
    }
  }
}

/**
 * Fetch an upstream URL with an abort-based timeout and at most `retries` retries
 * on *network* errors. A timeout is NOT retried — re-issuing an identical query
 * to an already-slow instance just doubles the wait for the same result, so we
 * give a single, longer attempt (see overpassTimeoutMs) and fail fast with
 * UpstreamTimeoutError. A returned non-2xx response is NOT retried and is
 * returned to the caller for status handling; a network error retried to
 * exhaustion throws UpstreamError.
 */
export async function fetchUpstream(
  url: string,
  init: RequestInit,
  opts: { timeoutMs: number; retries?: number },
): Promise<Response> {
  const retries = opts.retries ?? FIND_CARE_CONFIG.upstreamRetries;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: { "User-Agent": FIND_CARE_CONFIG.userAgent, ...(init.headers || {}) },
      });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      // A timeout won't resolve faster on retry — fail fast.
      if (err instanceof Error && err.name === "AbortError") {
        throw new UpstreamTimeoutError();
      }
      // Otherwise it's a network error: allow the loop to retry.
    }
  }

  throw new UpstreamError();
}
