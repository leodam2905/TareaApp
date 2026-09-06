import { prisma } from "@/lib/prisma";

/**
 * A global daily ceiling on the unauthenticated AI routes.
 *
 * Why this exists ALONGSIDE the per-IP limiter, not instead of it: per-caller
 * throttling divides a budget, it cannot cap one. A thousand hosts each politely
 * under the per-IP limit still produce a bill nobody approved. Only a shared
 * counter can bound a shared resource, and the counter has to be shared across
 * Cloud Run instances -- which is exactly what lib/rate-limit.ts's in-memory Map
 * is not.
 *
 * Requests, not tokens, are what gets enforced. Token cost is only known AFTER
 * the call, which is too late to decline it; requests are knowable before. Tokens
 * are still recorded, because they are what turns "we hit the cap" into "chat is
 * eating 80% of the budget".
 *
 * FAILS OPEN on a database error, deliberately. This is a cost guard, not a
 * security control -- if Postgres is unreachable the site is largely down
 * anyway, and turning a DB blip into a total AI outage trades a bounded money
 * risk for an unbounded product one. The failure is logged loudly so it cannot
 * be silent.
 */

/** Routes that take no auth, and so share one budget. */
export const CAPPED_ROUTES = ["chat", "diagnose", "instant-quote", "price-estimate"] as const;

function dailyRequestCap(): number {
  const n = Number(process.env.AI_DAILY_REQUEST_CAP);
  // A deliberately generous default: this is a runaway-bill backstop, not a
  // product limit, and a cap that trips in normal use trains people to raise it
  // without looking.
  return Number.isFinite(n) && n > 0 ? n : 2000;
}

export interface BudgetVerdict {
  ok: boolean;
  used: number;
  cap: number;
}

/**
 * Count one request against today's budget and say whether it may proceed.
 *
 * The increment and the read are one statement so concurrent instances cannot
 * both observe "under cap" and both proceed -- the race a check-then-increment
 * would lose under exactly the traffic this is meant to stop.
 */
export async function reserveAiBudget(route: string): Promise<BudgetVerdict> {
  const cap = dailyRequestCap();
  try {
    const rows = await prisma.$queryRaw<{ total: bigint }[]>`
      WITH bumped AS (
        INSERT INTO ai_daily_usage (day, route, requests)
        VALUES (CURRENT_DATE, ${route}, 1)
        ON CONFLICT (day, route) DO UPDATE
          SET requests = ai_daily_usage.requests + 1, updated_at = now()
        RETURNING day
      )
      SELECT COALESCE(SUM(requests), 0)::bigint AS total
      FROM ai_daily_usage
      WHERE day = CURRENT_DATE
    `;
    const used = Number(rows[0]?.total ?? 0);
    return { ok: used <= cap, used, cap };
  } catch (e) {
    console.error(
      JSON.stringify({ kind: "ai_budget_error", route, detail: String(e).slice(0, 200) }),
    );
    return { ok: true, used: -1, cap };
  }
}

/** Record what the call actually consumed. Never throws; never blocks. */
export async function recordAiTokens(route: string, input: number, output: number): Promise<void> {
  try {
    await prisma.$executeRaw`
      INSERT INTO ai_daily_usage (day, route, input_tokens, output_tokens)
      VALUES (CURRENT_DATE, ${route}, ${input}::bigint, ${output}::bigint)
      ON CONFLICT (day, route) DO UPDATE
        SET input_tokens  = ai_daily_usage.input_tokens  + ${input}::bigint,
            output_tokens = ai_daily_usage.output_tokens + ${output}::bigint,
            updated_at    = now()
    `;
  } catch {
    /* accounting must never break a request that already succeeded */
  }
}
