/** Simple in-memory fixed-window limiter (security review M1). Per process, which is enough for a prototype. */
export class RateLimiter {
  private hits = new Map<string, { start: number; count: number }>();
  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly maxKeys = 10_000,
  ) {}

  /** True when the call is allowed; counts it. `nowMs` is a parameter for tests. */
  allow(key: string, nowMs: number): boolean {
    const entry = this.hits.get(key);
    if (!entry || nowMs - entry.start >= this.windowMs) {
      if (this.hits.size >= this.maxKeys) this.sweep(nowMs);
      this.hits.set(key, { start: nowMs, count: 1 });
      return true;
    }
    entry.count += 1;
    return entry.count <= this.max;
  }

  private sweep(nowMs: number) {
    for (const [key, entry] of this.hits) if (nowMs - entry.start >= this.windowMs) this.hits.delete(key);
    if (this.hits.size >= this.maxKeys) this.hits.clear();
  }
}
