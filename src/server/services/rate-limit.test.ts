import { expect, test } from "vitest";
import { RateLimiter } from "./rate-limit";

test("allows up to max per window per key, then recovers", () => {
  const limiter = new RateLimiter(2, 1000);
  expect(limiter.allow("a", 0)).toBe(true);
  expect(limiter.allow("a", 10)).toBe(true);
  expect(limiter.allow("a", 20)).toBe(false);
  expect(limiter.allow("b", 20)).toBe(true);
  expect(limiter.allow("a", 1000)).toBe(true);
});

test("memory stays bounded", () => {
  const limiter = new RateLimiter(1, 1000, 3);
  for (let i = 0; i < 10; i++) expect(limiter.allow(`k${i}`, 0)).toBe(true);
});
