import "server-only";
import { prisma } from "@/lib/prisma";

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Fixed-window counter backed by Postgres, so the limit holds across server
 * instances (an in-memory counter would let each lambda start its own budget).
 * The window is derived from the clock, so there is nothing to expire except
 * old rows, which are pruned opportunistically.
 */
export async function consume(
  bucketKey: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);

  const rows = await prisma.$queryRaw<{ count: number }[]>`
    insert into "RateLimit" ("id", "bucketKey", "windowStart", "count")
    values (${crypto.randomUUID()}, ${bucketKey}, ${windowStart}, 1)
    on conflict ("bucketKey", "windowStart")
    do update set "count" = "RateLimit"."count" + 1
    returning "count"
  `;

  const count = Number(rows[0]?.count ?? 1);
  const resetAt = windowStart.getTime() + windowMs;

  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
  };
}

/**
 * Drops counters that can no longer be consulted. Called on a small fraction
 * of writes so it costs nothing in the common path and needs no scheduler.
 */
export async function pruneRateLimits(olderThanSeconds = 60 * 60 * 24): Promise<void> {
  if (Math.random() > 0.02) return;
  const cutoff = new Date(Date.now() - olderThanSeconds * 1000);
  try {
    await prisma.rateLimit.deleteMany({ where: { windowStart: { lt: cutoff } } });
  } catch {
    // Pruning is housekeeping; a failure must never affect the request.
  }
}
