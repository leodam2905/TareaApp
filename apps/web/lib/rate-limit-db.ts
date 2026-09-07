import { prisma } from "@/lib/prisma";

/**
 * A rate limiter whose counters survive both scale-out and cold starts.
 *
 * lib/rate-limit.ts keeps a per-instance Map, which on Cloud Run (min=1, max=10)
 * multiplies every limit by the live instance count and resets whenever an
 * instance is recycled. For the auth routes that is the difference between "5 OTP
 * attempts per 10 minutes" and "up to 50, plus a fresh slate after any scale-in".
 *
 * Fixed windows: the bucket is the timestamp the window ends, so the key is
 * derivable without reading anything first, and one UPSERT does the whole job.
 * Worst case is a 2x burst straddling a boundary, which is a fine trade for
 * brute-force protection -- the goal is bounding attempts per unit time.
 *
 * FAILS CLOSED, unlike lib/ai-budget.ts which deliberately fails open. The
 * difference is what each protects: the budget guard protects money, so a DB blip
 * must not take the product down; this protects credentials, so a DB blip must not
 * hand out unlimited guesses. It costs nothing in practice -- every caller of this
 * needs the same database on the very next line to look up the user.
 */
export interface DbLimitResult {
  ok: boolean;
  count: number;
  limit: number;
}

export async function rateLimitDb(
  key: string,
  limit: number,
  windowMs: number,
): Promise<DbLimitResult> {
  // Align to a fixed window so concurrent instances compute an identical bucket.
  const windowEnd = new Date(Math.ceil(Date.now() / windowMs) * windowMs);
  try {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO rate_limit_counters (key, window_end, count)
      VALUES (${key}, ${windowEnd}, 1)
      ON CONFLICT (key, window_end) DO UPDATE
        SET count = rate_limit_counters.count + 1
      RETURNING count
    `;
    const count = Number(rows[0]?.count ?? 0);

    // Opportunistic sweep. Rows are only ever read for the CURRENT window, so
    // expired ones are dead weight rather than a correctness problem -- which is
    // why this can be probabilistic and needs no cron of its own. 1% keeps the
    // table bounded without putting a DELETE on every login.
    if (Math.random() < 0.01) {
      void prisma
        .$executeRaw`DELETE FROM rate_limit_counters WHERE window_end < now()`
        .catch(() => {});
    }

    return { ok: count <= limit, count, limit };
  } catch (e) {
    console.error(
      JSON.stringify({ kind: "rate_limit_db_error", key: key.split(":")[0], detail: String(e).slice(0, 200) }),
    );
    // Fail closed -- see the note above.
    return { ok: false, count: -1, limit };
  }
}
