import { expect, test, vi } from "vitest";
import { RateLimiter, isRateLimitDisabled } from "./rate-limit";

test("allows up to max per window per key, then recovers", () => {
  const limiter = new RateLimiter(2, 1000);
  expect(limiter.allow("a", 0)).toBe(true);
  expect(limiter.allow("a", 10)).toBe(true);
  expect(limiter.allow("a", 20)).toBe(false);
  expect(limiter.allow("b", 20)).toBe(true);
  expect(limiter.allow("a", 1000)).toBe(true);
});

test("disabled limiter always allows", () => {
  const limiter = new RateLimiter(1, 1000, 10_000, true);
  for (let i = 0; i < 5; i++) expect(limiter.allow("a", 0)).toBe(true);
});

test("enabled explicitly still limits", () => {
  const limiter = new RateLimiter(1, 1000, 10_000, false);
  expect(limiter.allow("a", 0)).toBe(true);
  expect(limiter.allow("a", 1)).toBe(false);
});

test("RATE_LIMIT_DISABLED=1 is read from the environment at load", async () => {
  vi.stubEnv("RATE_LIMIT_DISABLED", "1");
  vi.resetModules();
  const mod = await import("./rate-limit");
  const limiter = new mod.RateLimiter(1, 1000);
  expect(limiter.allow("a", 0)).toBe(true);
  expect(limiter.allow("a", 1)).toBe(true);
  vi.unstubAllEnvs();
});

test("memory stays bounded", () => {
  const limiter = new RateLimiter(1, 1000, 3);
  for (let i = 0; i < 10; i++) expect(limiter.allow(`k${i}`, 0)).toBe(true);
});

test("RATE_LIMIT_DISABLED is honoured without VERCEL_ENV and ignored in production", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(isRateLimitDisabled({ RATE_LIMIT_DISABLED: "1" })).toBe(true);
  expect(isRateLimitDisabled({ RATE_LIMIT_DISABLED: "1", VERCEL_ENV: "preview" })).toBe(true);
  expect(warn).not.toHaveBeenCalled();
  expect(isRateLimitDisabled({ RATE_LIMIT_DISABLED: "1", VERCEL_ENV: "production" })).toBe(false);
  expect(warn).toHaveBeenCalledTimes(1);
  expect(isRateLimitDisabled({ VERCEL_ENV: "production" })).toBe(false);
  warn.mockRestore();
});
