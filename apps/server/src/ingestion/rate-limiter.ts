/** Simple token-bucket limiter so bursts of on-demand lookups can't hammer an upstream API. */
export class TokenBucket {
  private tokens: number;
  private lastRefill = performance.now();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
  ) {
    this.tokens = capacity;
  }

  private refill() {
    const now = performance.now();
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSeconds * this.refillPerSecond);
    this.lastRefill = now;
  }

  async take(): Promise<void> {
    for (;;) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const waitMs = ((1 - this.tokens) / this.refillPerSecond) * 1000;
      await new Promise((resolve) => setTimeout(resolve, Math.max(waitMs, 10)));
    }
  }
}
