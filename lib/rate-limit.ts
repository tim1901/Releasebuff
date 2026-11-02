const buckets = new Map<string, { count: number; resetAt: number }>();

/** Best-effort per-process guard for local testing. Use a shared rate limiter before production scale. */
export function allowRequest(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}
