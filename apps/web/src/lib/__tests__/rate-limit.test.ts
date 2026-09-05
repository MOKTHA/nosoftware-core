/**
 * Unit tests for rate-limit.ts
 *
 * Tests the sliding window rate limiter.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateLimit } from '../rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => {
    // Reset the module state by using unique keys per test
    vi.useFakeTimers();
  });

  it('allows requests within the limit', () => {
    const key = `test-allow-${Date.now()}`;
    const result = checkRateLimit(key, { maxRequests: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('blocks requests exceeding the limit', () => {
    const key = `test-block-${Date.now()}`;
    const config = { maxRequests: 3, windowMs: 60_000 };

    checkRateLimit(key, config); // 1
    checkRateLimit(key, config); // 2
    checkRateLimit(key, config); // 3

    const result = checkRateLimit(key, config); // 4 → blocked
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('allows requests after the window expires', () => {
    const key = `test-expire-${Date.now()}`;
    const config = { maxRequests: 2, windowMs: 1_000 };

    checkRateLimit(key, config); // 1
    checkRateLimit(key, config); // 2

    // Move time forward past the window
    vi.advanceTimersByTime(1_100);

    const result = checkRateLimit(key, config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it('tracks remaining count correctly', () => {
    const key = `test-remaining-${Date.now()}`;
    const config = { maxRequests: 5, windowMs: 60_000 };

    expect(checkRateLimit(key, config).remaining).toBe(4);
    expect(checkRateLimit(key, config).remaining).toBe(3);
    expect(checkRateLimit(key, config).remaining).toBe(2);
    expect(checkRateLimit(key, config).remaining).toBe(1);
    expect(checkRateLimit(key, config).remaining).toBe(0);
  });

  it('uses default config (10 per 60s)', () => {
    const key = `test-default-${Date.now()}`;

    for (let i = 0; i < 10; i++) {
      const r = checkRateLimit(key);
      expect(r.allowed).toBe(true);
    }

    const blocked = checkRateLimit(key);
    expect(blocked.allowed).toBe(false);
  });

  it('returns resetAt timestamp', () => {
    const key = `test-reset-${Date.now()}`;
    const config = { maxRequests: 1, windowMs: 30_000 };

    checkRateLimit(key, config); // 1 → allowed
    const result = checkRateLimit(key, config); // 2 → blocked

    expect(result.allowed).toBe(false);
    expect(result.resetAt).toBeGreaterThan(Date.now());
    expect(result.resetAt).toBeLessThanOrEqual(Date.now() + 30_000);
  });

  it('isolates keys from each other', () => {
    const config = { maxRequests: 1, windowMs: 60_000 };

    const key1 = `test-isolate-a-${Date.now()}`;
    const key2 = `test-isolate-b-${Date.now()}`;

    checkRateLimit(key1, config); // key1: 1
    const r1 = checkRateLimit(key1, config); // key1: blocked
    expect(r1.allowed).toBe(false);

    const r2 = checkRateLimit(key2, config); // key2: first request → allowed
    expect(r2.allowed).toBe(true);
  });
});
