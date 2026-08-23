import { afterEach, beforeEach, expect, test, vi } from "vitest";

process.env.JWT_SECRET = "test-secret-value-at-least-32-characters-long!!";

import { rateLimit } from "@/lib/rateLimit";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test("allows up to the limit within the window", () => {
  const key = `t1-${Math.random()}`;
  for (let i = 0; i < 5; i++) {
    const r = rateLimit(key, 5, 60_000);
    expect(r.allowed).toBe(true);
  }
  expect(rateLimit(key, 5, 60_000).allowed).toBe(false);
});

test("blocks after limit and reports retry-after", () => {
  const key = `t2-${Math.random()}`;
  rateLimit(key, 2, 60_000);
  rateLimit(key, 2, 60_000);
  const blocked = rateLimit(key, 2, 60_000);
  expect(blocked.allowed).toBe(false);
  expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
});

test("window slides: old hits expire", () => {
  const key = `t3-${Math.random()}`;
  rateLimit(key, 1, 10_000);
  expect(rateLimit(key, 1, 10_000).allowed).toBe(false);
  vi.advanceTimersByTime(11_000);
  expect(rateLimit(key, 1, 10_000).allowed).toBe(true);
});

test("keys are isolated", () => {
  const a = `a-${Math.random()}`;
  const b = `b-${Math.random()}`;
  rateLimit(a, 1, 60_000);
  expect(rateLimit(a, 1, 60_000).allowed).toBe(false);
  expect(rateLimit(b, 1, 60_000).allowed).toBe(true);
});
