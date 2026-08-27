// What Stripe actually thinks of the platform account.
//
// The Dashboard's support assistant says things like "there is an outstanding
// issue with your account that might be affecting your ability to process
// payments or transfer funds" without saying WHICH issue. This prints the
// fields that decide it: whether charges and payouts are enabled, what Stripe
// is still waiting on, and the deadline attached.
//
//   STRIPE_SECRET_KEY="$(gcloud secrets versions access latest --secret=STRIPE_SECRET_KEY)" \
//     node scripts/stripe-account-status.mjs
//
// Read-only. Prints no key material.
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is not set.");
  process.exit(1);
}
if (key.includes("_test_") && !process.argv.includes("--test")) {
  console.error("This is a TEST-mode key — it reports on the test account, not the live one. Pass --test if that is what you want.");
  process.exit(1);
}

const stripe = new Stripe(key);
const list = (xs) => (xs?.length ? xs.join(", ") : "none");

try {
  const a = await stripe.accounts.retrieve();
  const r = a.requirements ?? {};

  console.log(`account          ${a.id}  (${a.business_profile?.name ?? a.email ?? "unnamed"})`);
  console.log(`charges_enabled  ${a.charges_enabled}`);
  console.log(`payouts_enabled  ${a.payouts_enabled}`);
  console.log(`disabled_reason  ${r.disabled_reason ?? "—"}`);
  console.log("");
  console.log(`past_due         ${list(r.past_due)}`);
  console.log(`currently_due    ${list(r.currently_due)}`);
  console.log(`eventually_due   ${list(r.eventually_due)}`);
  console.log(`pending_verif.   ${list(r.pending_verification)}`);
  if (r.current_deadline) {
    console.log(`deadline         ${new Date(r.current_deadline * 1000).toISOString()}`);
  }

  // charges_enabled/payouts_enabled are the summary; a single degraded
  // capability is what usually causes the vague banner.
  const caps = Object.entries(a.capabilities ?? {}).filter(([, v]) => v !== "active");
  console.log("");
  console.log(`capabilities not active: ${caps.length ? caps.map(([k, v]) => `${k}=${v}`).join(", ") : "none — all active"}`);

  const bal = await stripe.balance.retrieve();
  const sum = (rows) => (rows.reduce((t, x) => t + x.amount, 0) / 100).toFixed(2);
  console.log("");
  console.log(`platform balance available $${sum(bal.available)}  pending $${sum(bal.pending)}`);
} catch (err) {
  // A restricted key may not carry permission to read the account itself.
  console.error(`Could not read the account: ${err?.message?.slice(0, 160)}`);
  process.exit(1);
}
