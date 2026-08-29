// Moves EXISTING connected accounts onto the daily payout schedule.
//
// New accounts get it at creation (lib/payout-schedule.ts, applied in
// api/stripe/connect and api/stripe/login-link). Stripe's Connect dashboard
// setting is explicit that a schedule change there "will only apply to new
// accounts that you onboard", so pros who signed up before this ran keep
// whatever they had — daily, by Stripe's default — until this script moves them.
//
// THIS CHANGES WHEN REAL PEOPLE ARE PAID. Run --dry-run first and read the list.
//
//   node scripts/set-payout-schedule.mjs --dry-run   # show what would change
//   node scripts/set-payout-schedule.mjs             # apply
//
// Needs STRIPE_SECRET_KEY with write access to connected accounts.
import Stripe from "stripe";

const dryRun = process.argv.includes("--dry-run");
const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is not set.");
  process.exit(1);
}
// A test key here is the quiet failure mode: apps/web/.env holds rk_test_, so
// running this without thinking lists Stripe's TEST connected accounts, changes
// nothing that matters, and prints a reassuring summary. Real pros stay on
// daily. Refuse unless a test run is what was actually meant.
if (key.includes("_test_") && !process.argv.includes("--test")) {
  console.error(
    "This is a TEST-mode key, so it would operate on test connected accounts,\n" +
    "not your real pros - and report success either way.\n\n" +
    "For the live accounts:\n" +
    '  STRIPE_SECRET_KEY="$(gcloud secrets versions access latest --secret=STRIPE_SECRET_KEY)" \\\n' +
    "    node scripts/set-payout-schedule.mjs --dry-run\n\n" +
    "To run against test mode deliberately, pass --test.",
  );
  process.exit(1);
}

const stripe = new Stripe(key);

const TARGET = { interval: "daily" };

let changed = 0, already = 0, failed = 0, skipped = 0;

for await (const account of stripe.accounts.list({ limit: 100 })) {
  const current = account.settings?.payouts?.schedule;
  const label = `${account.id} ${account.email ?? ""}`.trim();

  // A pro who deliberately chose manual is left alone: overriding that would
  // start moving their money on a timetable they opted out of.
  if (current?.interval === "manual") {
    console.log(`- ${label}: manual (left alone)`);
    skipped++;
    continue;
  }
  if (current?.interval === "daily") {
    already++;
    continue;
  }

  const from = current ? `${current.interval}${current.weekly_anchor ? `/${current.weekly_anchor}` : ""}` : "unset";
  if (dryRun) {
    console.log(`~ ${label}: ${from} -> daily`);
    changed++;
    continue;
  }

  try {
    await stripe.accounts.update(account.id, { settings: { payouts: { schedule: TARGET } } });
    console.log(`✓ ${label}: ${from} -> daily`);
    changed++;
  } catch (err) {
    // Usually an account that has not finished onboarding and has no payouts
    // capability yet. It will pick the schedule up when it is next updated.
    console.error(`✖ ${label}: ${err?.message?.slice(0, 100)}`);
    failed++;
  }
}

console.log(
  `\n${dryRun ? "[dry run] " : ""}${changed} ${dryRun ? "would change" : "changed"}, ` +
  `${already} already daily, ${skipped} manual, ${failed} failed`,
);
