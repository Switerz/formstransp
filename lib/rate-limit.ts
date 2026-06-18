type Bucket = {
  count: number;
  resetAt: number;
};

const globalRateLimit = globalThis as unknown as {
  reportRateLimitBuckets?: Map<string, Bucket>;
};

const buckets = globalRateLimit.reportRateLimitBuckets ?? new Map<string, Bucket>();
globalRateLimit.reportRateLimitBuckets = buckets;

export function checkRateLimit(key: string, limit = 20, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  return { allowed: true, remaining: limit - current.count, resetAt: current.resetAt };
}
