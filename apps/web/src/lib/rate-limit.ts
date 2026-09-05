/**
 * In-memory rate limiter for API routes.
 *
 * Uses a sliding window approach: tracks request timestamps per key,
 * and rejects requests that exceed the limit within the window.
 *
 * Defaults: 10 requests per 60 seconds per user.
 *
 * This is an in-memory implementation suitable for single-process
 * deployments (Vercel serverless). For multi-instance deployments,
 * replace with Redis-backed rate limiting.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  const cutoff = now - windowMs;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

export interface RateLimitConfig {
  /** Maximum requests allowed within the window. Default: 10. */
  maxRequests?: number;
  /** Window duration in milliseconds. Default: 60_000 (1 minute). */
  windowMs?: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed. */
  allowed: boolean;
  /** Number of requests remaining in the current window. */
  remaining: number;
  /** Timestamp (ms since epoch) when the window resets. */
  resetAt: number;
}

/**
 * Check if a request is within the rate limit.
 *
 * @param key - Unique identifier (typically userId or IP)
 * @param config - Rate limit configuration
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = {},
): RateLimitResult {
  const maxRequests = config.maxRequests ?? 10;
  const windowMs = config.windowMs ?? 60_000;

  cleanup(windowMs);

  const now = Date.now();
  const cutoff = now - windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0]!;
    return {
      allowed: false,
      remaining: 0,
      resetAt: oldestInWindow + windowMs,
    };
  }

  entry.timestamps.push(now);

  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    resetAt: now + windowMs,
  };
}

/**
 * Create a Response with rate limit headers.
 * Call when checkRateLimit returns `allowed: false`.
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please try again later.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.max(1, retryAfter)),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
      },
    },
  );
}
