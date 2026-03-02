import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createHash } from "crypto";

type LimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  reset: number; // unix seconds
};

function sha256Hex(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

export function hasUpstash(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

let _ratelimit: Ratelimit | null = null;

function getRatelimit(): Ratelimit {
  if (_ratelimit) return _ratelimit;

  // Upstash SDK toma credenciales de env vars REST por defecto si no pasas args.
  const redis =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
      ? new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        })
      : Redis.fromEnv();

  // 60 requests / 5 min, sliding window (global real, multi-instance)
  _ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, "5 m"),
    analytics: false,
    prefix: "verijob:rl",
  });

  return _ratelimit;
}

// key: hash(IP + pepper opcional) para no almacenar IP en claro en Redis
export async function limitByIp(ip: string): Promise<LimitResult> {
  const pepper = process.env.RATE_LIMIT_PEPPER || "";
  const ipNorm = (ip || "unknown").trim();
  const key = `pubverif:${sha256Hex(`${ipNorm}|${pepper}`)}`;

  try {
    const rl = getRatelimit();
    const res = await rl.limit(key);
    return {
      ok: res.success,
      limit: res.limit,
      remaining: res.remaining,
      reset: res.reset, // unix seconds
    };
  } catch {
    // Fail-open suave: si Upstash cae, no rompemos prod. Caller puede fallback.
    return { ok: true, limit: 60, remaining: 0, reset: Math.floor(Date.now() / 1000) + 300 };
  }
}
