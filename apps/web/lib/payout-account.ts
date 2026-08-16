// Refuses to pay a destination the running Stripe key cannot address, and says
// so out loud when it happens.
//
// WHY
//
// Every connected account in the production database was a TEST-mode account
// while STRIPE_SECRET_KEY was sk_live_. Stripe keeps test and live objects in
// separate spaces, so a live transfer to a test account comes back "No such
// destination". The transfer was wrapped in a bare try/catch that logged and
// moved on, handymanPaidOut stayed false, and the weekly cron retried the same
// impossible transfer every Monday. A pro would never be paid and nobody would
// find out.
//
// Two failures made that possible: nothing checked that the destination was
// addressable, and the failure was silent. This module fixes both.
//
// It also stops trusting users.stripeAccountStatus, which said "active" for all
// four unusable accounts because it was written from test-mode data. The
// account is asked about directly instead.

import type Stripe from "stripe";
import { stripe } from "./stripe";
import { prisma } from "./prisma";
import { createNotification } from "./notify";

export type StripeMode = "live" | "test";

/** Which Stripe world the running process is in, per its secret key. */
export function stripeMode(): StripeMode {
  return /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY ?? "") ? "live" : "test";
}

export type PayoutBlockReason =
  | "no_account"
  | "wrong_mode"
  | "onboarding_incomplete"
  | "lookup_failed";

export type PayoutAccountCheck =
  | { ok: true }
  | { ok: false; reason: PayoutBlockReason; detail: string };

/**
 * Can we actually transfer to this connected account right now?
 *
 * `wrong_mode` and `lookup_failed` are deliberately separate. A mode mismatch
 * is permanent and means the pro must re-onboard; a lookup failure may be a
 * transient Stripe blip. Only the first is allowed to change stored state.
 */
export async function checkPayoutAccount(accountId?: string | null): Promise<PayoutAccountCheck> {
  if (!accountId) {
    return { ok: false, reason: "no_account", detail: "handyman has no stripeAccountId" };
  }

  let account: Stripe.Account;
  try {
    account = await stripe.accounts.retrieve(accountId);
  } catch (err) {
    const e = err as { code?: string; statusCode?: number; message?: string };
    // Stripe does NOT call this a mode mismatch, and does not 404 either. The
    // real response — verified against the API — is HTTP 403, type api_error,
    // code "account_invalid", message "The provided key '…' does not have
    // access to account '…' (or that account does not exist)". An earlier
    // version of this check looked for resource_missing/404 and therefore
    // missed the exact case it was written for. resource_missing is kept as a
    // secondary match; account_invalid is the one that actually fires.
    const missing =
      e?.code === "account_invalid" ||
      e?.code === "resource_missing" ||
      e?.statusCode === 403 ||
      e?.statusCode === 404 ||
      /does not have access to account|no such account/i.test(e?.message ?? "");
    if (missing) {
      const mode = stripeMode();
      return {
        ok: false,
        reason: "wrong_mode",
        detail: `${accountId} is invisible to the ${mode} key — it was created in ${mode === "live" ? "test" : "live"} mode and cannot receive ${mode} funds`,
      };
    }
    return { ok: false, reason: "lookup_failed", detail: e?.message ?? "account lookup failed" };
  }

  if (account.capabilities?.transfers !== "active") {
    return {
      ok: false,
      reason: "onboarding_incomplete",
      detail: `transfers capability is "${account.capabilities?.transfers ?? "absent"}"`,
    };
  }

  return { ok: true };
}

/**
 * Record a payout that did not happen, loudly.
 *
 * A pro who has finished a job and not been paid is the worst failure this
 * system has, so it gets a structured log line AND an admin notification. The
 * log line is greppable; the notification means somebody finds out without
 * going looking.
 */
export async function alertPayoutFailure(input: {
  handymanId: string;
  amount: number;
  reason: PayoutBlockReason | "transfer_failed";
  detail: string;
  bookingId?: string;
}): Promise<void> {
  const { handymanId, amount, reason, detail, bookingId } = input;

  console.error(
    "[payout] FAILED",
    JSON.stringify({ reason, detail, handymanId, bookingId, amount, mode: stripeMode() }),
  );

  // A permanently unusable account must stop looking bookable, or the pro keeps
  // being sent work they cannot be paid for. A transient lookup failure must
  // NOT do this — a Stripe blip would otherwise unbook every pro at once.
  if (reason === "wrong_mode" || reason === "onboarding_incomplete") {
    await prisma.user
      .update({ where: { id: handymanId }, data: { stripeAccountStatus: "pending" } })
      .catch(() => {});
  }

  try {
    const [admins, pro] = await Promise.all([
      prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: handymanId }, select: { name: true } }),
    ]);
    await Promise.allSettled(
      admins.map((a) =>
        createNotification({
          userId: a.id,
          title: "Payout failed — pro not paid",
          body: `${pro?.name ?? handymanId} is owed $${amount.toFixed(2)} and the transfer did not go through (${reason}). ${detail}`,
          type: "payout",
          refId: bookingId,
        }),
      ),
    );
  } catch (err) {
    // Never let alerting break the caller — the payout already failed once.
    console.error("[payout] alerting failed:", err);
  }
}
