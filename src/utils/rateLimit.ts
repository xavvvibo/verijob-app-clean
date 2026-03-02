type Bucket = {
  resetAt: number;
  count: number;
};

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
};

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || now >= b.resetAt) {
    const resetAt = now + windowMs;
    buckets.set(key, { resetAt, count: 1 });
    return { ok: true, limit, remaining: limit - 1, resetMs: windowMs };
  }

  if (b.count >= limit) {
    return { ok: false, limit, remaining: 0, resetMs: Math.max(0, b.resetAt - now) };
  }

  b.count += 1;
  return { ok: true, limit, remaining: Math.max(0, limit - b.count), resetMs: Math.max(0, b.resetAt - now) };
}

export function getClientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  const xr = req.headers.get("x-real-ip");
  if (xr) return xr.trim();
  return "unknown";
}
