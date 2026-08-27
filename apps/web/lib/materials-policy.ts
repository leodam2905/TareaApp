// How much a pro may be asked to front for parts.
//
// Materials pass through Tarea at cost: no commission, but full Stripe fees on
// the way in, so every dollar of materials is a dollar Tarea floats and loses
// ~2.9% on. Left unbounded, a single job could put a pro $2,000 out of pocket
// on a marketplace built for small home repair.
//
// A HARD cap at a small number was the obvious move and is the wrong one. Since
// the estimate is also the reimbursement ceiling (see lib/pro-payout.ts), a low
// cap turns pro overspend from a deferral into a permanent loss — and a pro who
// cannot quote what a job needs will either bury the parts in the labour price
// (10% commission is cheaper than eating the difference) or take the materials
// off-platform. The second is the dangerous one: B&P §7048 counts materials
// toward the aggregate EVEN WHEN THE HOMEOWNER BUYS THEM DIRECTLY, so materials
// that vanish from Tarea do not vanish from the contract price — they just stop
// being visible to the licensing gate in app/api/job-requests/route.ts, which
// then under-counts the total and clears an unlicensed pro for work the law
// reserves for a licensed one. A cap that low manufactures the exact incentive
// that defeats the compliance check.
//
// So the rule is tiered rather than binary, and the middle tier routes work
// instead of refusing it:
//
//   up to $300      ordinary small repair — no friction
//   $300 to $1,000  allowed, but Licensed & Insured pros only. Materials this
//                   size track the work the minor-work exemption does not cover
//                   anyway, so this sends the right jobs to the right pros.
//   over $1,000     refused. Past roughly $986 of materials the Stripe fees on
//                   the pass-through exceed Tarea's entire commission on a
//                   minimum job, so the platform is paying to carry the parts.
//                   The customer buys these directly — and is told to record it
//                   on the request, so the aggregate stays honest.
export const MATERIALS_OPEN_LIMIT = 300;
export const MATERIALS_MAX = 1000;

export type MaterialsTier = "open" | "licensed_only" | "refused";

export function materialsTier(amount: number | null | undefined): MaterialsTier {
  const m = amount ?? 0;
  if (m <= MATERIALS_OPEN_LIMIT) return "open";
  if (m <= MATERIALS_MAX) return "licensed_only";
  return "refused";
}

/**
 * Validates a materials figure at any point where one enters the system.
 *
 * Returns an error string, or null when acceptable. NaN and negatives are
 * rejected here rather than silently coerced: `parseFloat` on a fat-fingered
 * field used to yield NaN, which reaches Prisma as a Float and lands in the
 * charge arithmetic as a total that is also NaN.
 */
export function validateMaterials(raw: unknown): { ok: false; error: string } | { ok: true; value: number } {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: 0 };
  const m = typeof raw === "number" ? raw : parseFloat(String(raw));
  if (!Number.isFinite(m) || m < 0) {
    return { ok: false, error: "Materials must be a positive amount." };
  }
  if (m > MATERIALS_MAX) {
    return {
      ok: false,
      error:
        `Materials are capped at $${MATERIALS_MAX.toLocaleString()} on Tarea. For a job needing more, ` +
        `the customer should buy the parts directly and note the cost on the request — it still counts ` +
        `toward the $1,000 contractor-licence threshold, so it has to be written down.`,
    };
  }
  return { ok: true, value: Math.round(m * 100) / 100 };
}
