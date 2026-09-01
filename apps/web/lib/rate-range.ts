// What pros actually charge for a category, as a range.
//
// Tarea does not set this price. That is the point of it.
//
// A single platform-set figure is the strongest control indicator there is
// under the ABC test: if the platform decides what the work pays and a pro can
// only take it or leave it, the pro looks like an employee. Independent pros
// setting their own rates, with the customer choosing among them, is what a
// marketplace looks like instead. So the customer is quoted the SPREAD of real
// rates and picks; nobody is quoted a number Tarea invented.
//
// This is not free of downsides and they were accepted deliberately: a visible
// floor invites undercutting. That is a business consequence of a legal
// requirement, not an oversight.

import { prisma } from "./prisma";
import { stateAliases } from "./us-states";

export type RateRange = {
  /** Lowest hourly rate any eligible pro charges for this category. */
  min: number;
  /** Highest. Equal to min when only one pro qualifies. */
  max: number;
  /** How many pros the range is drawn from. Zero means nobody — see the caller. */
  count: number;
};

/**
 * The min and max hourly rate among pros who could actually take this job.
 *
 * Eligibility deliberately mirrors /api/match: same background-check bar, same
 * active-state restriction, same requirement for an active service in the
 * category. A range built from pros the customer will never be shown is a range
 * they cannot act on — and quoting a $60 floor nobody can book is worse than
 * quoting nothing.
 *
 * Returns count 0 when no pro qualifies. The caller decides what to show then;
 * this does not invent a number to fill the gap.
 */
export async function rateRangeForCategory(
  category: string,
  opts: { excludeUserId?: string } = {},
): Promise<RateRange> {
  const activeStates = await prisma.activeState.findMany({
    where: { isActive: true },
    select: { state: true },
  });
  const activeStateList = activeStates.map((s) => s.state);
  // ActiveState holds two-letter codes while user.state holds whatever signup
  // produced — production has both "pennsylvania" and "CA" — so the raw values
  // have to be expanded to every spelling before they are compared.
  const stateFilter =
    activeStateList.length > 0 ? { in: stateAliases(activeStateList) } : undefined;

  const rows = await prisma.service.findMany({
    where: {
      category: category as never,
      isActive: true,
      hourlyRate: { gt: 0 },
      handyman: {
        backgroundCheckStatus: "PASSED",
        user: {
          // A deleted account must not price a job. DELETE /api/account
          // anonymizes rather than erases (App Store 5.1.1), so the profile,
          // the PASSED background check and every priced service survive it —
          // and production holds a deleted pro in exactly that state. It sets
          // isActive:false, but nothing outside login has ever read that, so
          // the only thing keeping those rates out of a customer's quote was
          // the avatarUrl null that deletion also happens to write. That is a
          // coincidence, not a guard, and it fails the moment the avatar rule
          // is relaxed.
          isActive: true,
          avatarUrl: { not: null },
          ...(opts.excludeUserId ? { id: { not: opts.excludeUserId } } : {}),
          ...(stateFilter ? { state: stateFilter } : {}),
        },
      },
    },
    select: { hourlyRate: true, handymanId: true },
  });

  const priced = rows.filter(
    (r): r is typeof r & { hourlyRate: number } =>
      typeof r.hourlyRate === "number" && r.hourlyRate > 0,
  );

  if (priced.length === 0) return { min: 0, max: 0, count: 0 };

  const rates = priced.map((r) => r.hourlyRate);

  // Count PROS, not service rows.
  //
  // Nothing stops one pro listing two services in the same category, and
  // production has exactly that: a pro with "Plumbing" at $100 and a second
  // plumbing row at $80. Counting rows reported three pros for plumbing when
  // two exist, and the app renders that number verbatim — "Estimated total
  // across 3 pros" is a factual claim to a customer, and it was false. It also
  // inflates without limit, since a single pro adding rows raises the count of
  // people the customer can supposedly choose between.
  //
  // min/max still span every priced row: those really are prices this job can
  // resolve to, whoever holds them.
  const count = new Set(priced.map((r) => r.handymanId)).size;

  return {
    min: Math.min(...rates),
    max: Math.max(...rates),
    count,
  };
}
