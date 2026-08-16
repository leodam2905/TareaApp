// What makes a pro bookable: all six onboarding steps complete.
//
// ONE DEFINITION, USED EVERYWHERE
//
// This rule was previously spelled out separately at each surface, and they did
// not agree. Hiring refused a pro with no photo or no background check; browse
// listed everybody who was merely available; applying checked nothing at all.
// The customer discovered the disagreement: they picked somebody, were refused
// at the last step, and the pro looked like the problem.
//
// So the conditions live here once. Browse filters on WHERE, applying and
// hiring assert on a loaded record, and the setup checklist the pro sees is
// built from the same six items — if a pro's ring reads 100%, they are
// bookable, and if it does not, no customer can reach them.
//
// BACKGROUND CHECK IS "PASSED", NOT "STARTED"
//
// The checklist endpoint reports `backgroundCheck: true` once a check has been
// PAID, DEFERRED or is IN_PROGRESS, so a pro can see that step ticked while an
// admin has not yet approved them. Bookability requires PASSED. That gap is
// deliberate and is why the setup screen renders "awaiting review" as its own
// state rather than a tick.

import type { Prisma } from "@prisma/client";

/**
 * Prisma filter selecting only bookable pros, for use on the `user` model.
 *
 * Mirrors the six checklist items:
 *   1. contractor agreement signed   icaSignedAt
 *   2. profile complete              avatarUrl + bio + idFrontUrl
 *   3. at least one service
 *   4. at least one availability slot
 *   5. background check PASSED
 *   6. payouts active                stripeAccountStatus
 */
export const BOOKABLE_USER_WHERE = {
  role: "HANDYMAN",
  isActive: true,
  avatarUrl: { not: null },
  stripeAccountStatus: "active",
  handymanProfile: {
    isAvailable: true,
    icaSignedAt: { not: null },
    bio: { not: null },
    idFrontUrl: { not: null },
    backgroundCheckStatus: "PASSED",
    services: { some: {} },
    availability: { some: {} },
  },
} satisfies Prisma.UserWhereInput;

/** The shape needed to judge a loaded pro. */
export interface BookableInput {
  avatarUrl: string | null;
  stripeAccountStatus: string | null;
  profile: {
    icaSignedAt: Date | null;
    bio: string | null;
    idFrontUrl: string | null;
    backgroundCheckStatus: string;
    servicesCount: number;
    availabilityCount: number;
  } | null;
}

export type UnmetStep =
  | "agreement"
  | "profile"
  | "services"
  | "availability"
  | "background_check"
  | "payouts";

/**
 * Which onboarding steps are outstanding. Empty means bookable.
 *
 * Returns the list rather than a boolean so a refusal can name what is missing:
 * "you cannot apply yet" is useless to a pro who does not know which of six
 * things to go and do.
 */
export function unmetSteps(u: BookableInput): UnmetStep[] {
  const p = u.profile;
  if (!p) return ["agreement", "profile", "services", "availability", "background_check", "payouts"];

  const missing: UnmetStep[] = [];
  if (!p.icaSignedAt) missing.push("agreement");
  if (!u.avatarUrl || !p.bio || !p.idFrontUrl) missing.push("profile");
  if (p.servicesCount < 1) missing.push("services");
  if (p.availabilityCount < 1) missing.push("availability");
  if (p.backgroundCheckStatus !== "PASSED") missing.push("background_check");
  if (u.stripeAccountStatus !== "active") missing.push("payouts");
  return missing;
}

const LABELS: Record<UnmetStep, string> = {
  agreement: "sign the contractor agreement",
  profile: "complete your profile (photo, bio and ID)",
  services: "add at least one service",
  availability: "set your weekly availability",
  background_check: "pass the background check",
  payouts: "set up payouts",
};

/** A message naming what is outstanding, for the pro who has to fix it. */
export function unmetStepsMessage(missing: UnmetStep[]): string {
  if (missing.length === 0) return "";
  const items = missing.map((m) => LABELS[m]);
  const list =
    items.length === 1
      ? items[0]
      : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  return `Finish setting up before taking work — you still need to ${list}.`;
}
