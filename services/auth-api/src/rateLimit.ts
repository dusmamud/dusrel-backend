/**
 * Tiny in-memory sliding-window rate limiter.
 *
 * Starting values only, not locks (docs/22, 27). Per-process and
 * lost on restart — that is acceptable for v1 (single API instance),
 * and is exactly the assumption docs/29 says breaks at multi-instance
 * scale, when a shared store (Valkey) becomes the trigger.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private windowMs: number,
    private maxHits: number,
  ) {}

  allow(key: string, nowMs = Date.now()): boolean {
    const cutoff = nowMs - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (recent.length >= this.maxHits) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(nowMs);
    this.hits.set(key, recent);
    return true;
  }
}
