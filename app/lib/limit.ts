type Bucket = { count: number; resetAt: number };

/** Fixed-window limiter. Serverless instances each keep their own count, so the account spend limit is the hard cap. */
export function createLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const buckets = new Map<string, Bucket>();
  return (key: string): boolean => {
    const t = now();
    if (buckets.size > 5000) buckets.clear();
    const bucket = buckets.get(key);
    if (!bucket || t >= bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: t + windowMs });
      return true;
    }
    if (bucket.count >= limit) return false;
    bucket.count++;
    return true;
  };
}
