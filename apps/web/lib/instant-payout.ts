// Whether a given pro can actually take an instant payout right now.
//
// Instant payouts have three independent preconditions, and failing any one of
// them produces the same useless outcome: the pro taps "cash out", agrees to a
// fee, and is told it did not work.
//
//   1. The PLATFORM needs an instant-payout credit limit from Stripe. Stripe
//      fronts the money before the funds settle, so this is a credit decision,
//      not a toggle. A brand-new platform sits at $0/day until it asks.
//   2. The PRO needs a debit card on file. A bank account cannot receive an
//      instant payout — only a card can, and only certain issuers.
//   3. The card itself must support it, which Stripe reports per external
//      account in `available_payout_methods`.
//
// Only (2) and (3) are knowable per pro from the API, so that is what this
// checks. (1) is a platform-wide fact that lives in the Dashboard, mirrored
// here by INSTANT_PAYOUTS_ENABLED so the feature can be switched off in one
// place while Stripe's limit is still zero — rather than letting every pro
// discover it one failed cash-out at a time.
import { stripe } from "@/lib/stripe";

/** Platform-level kill switch. Defaults to ON — the per-pro checks below are
 *  the real gate, and this exists to close the feature during the window where
 *  Stripe's platform limit is still $0. */
export const instantPayoutsEnabled = () =>
  (process.env.INSTANT_PAYOUTS_ENABLED ?? "true").toLowerCase() !== "false";

export interface InstantEligibility {
  eligible: boolean;
  /** Why not — used to tell the pro what to fix, not just that it failed. */
  reason?: "platform_disabled" | "no_account" | "no_debit_card" | "card_not_instant" | "lookup_failed";
  /** Last 4 of the card the payout would land on, when there is one. */
  cardLast4?: string;
}

export async function checkInstantEligibility(stripeAccountId?: string | null): Promise<InstantEligibility> {
  if (!instantPayoutsEnabled()) return { eligible: false, reason: "platform_disabled" };
  if (!stripeAccountId) return { eligible: false, reason: "no_account" };

  try {
    const cards = await stripe.accounts.listExternalAccounts(stripeAccountId, {
      object: "card",
      limit: 10,
    });
    if (cards.data.length === 0) return { eligible: false, reason: "no_debit_card" };

    // `available_payout_methods` is the card's own answer, per issuer. A debit
    // card being present is not the same as that card supporting instant.
    const instantCard = cards.data.find((c) => {
      const methods = (c as { available_payout_methods?: string[] }).available_payout_methods;
      return Array.isArray(methods) && methods.includes("instant");
    });
    if (!instantCard) return { eligible: false, reason: "card_not_instant" };

    return { eligible: true, cardLast4: (instantCard as { last4?: string }).last4 };
  } catch (err) {
    // Unknown is not the same as ineligible. Report the failure so the caller
    // can let the pro try rather than hiding a feature over a transient error.
    console.warn("[instant-payout] eligibility lookup failed:", err);
    return { eligible: false, reason: "lookup_failed" };
  }
}

/** What to tell the pro, given why they cannot use it. */
export function instantBlockedMessage(reason: InstantEligibility["reason"]): string {
  switch (reason) {
    case "no_debit_card":
      return "Add a debit card to cash out instantly. Bank accounts can only receive the free standard payout.";
    case "card_not_instant":
      return "Your card's bank does not support instant payouts. Add a different debit card, or use the free standard payout.";
    case "no_account":
      return "Finish setting up your payout account first.";
    case "platform_disabled":
      return "Instant cash-out is temporarily unavailable. Your earnings will arrive on your normal payout schedule.";
    default:
      return "We could not check your instant cash-out eligibility just now. You can still use the free standard payout.";
  }
}
