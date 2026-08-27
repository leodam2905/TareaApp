// Where Tarea's money actually is, from the CLI.
//
// The Dashboard splits this across three screens and hides it behind a fourth
// (Global Payouts) that Tarea does not use at all. This prints the whole chain
// in one pass, in the order money travels:
//
//   1. charges      customer -> Tarea's balance
//   2. transfers    Tarea's balance -> a pro's connected account
//   3. pro payouts  connected account -> the pro's bank/card
//   4. own payouts  Tarea's balance -> Tarea's bank
//
//   STRIPE_SECRET_KEY="$(gcloud secrets versions access latest --secret=STRIPE_SECRET_KEY)" \
//     node scripts/stripe-payouts.mjs
//
// Read-only. Prints no key material.
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) { console.error("STRIPE_SECRET_KEY is not set."); process.exit(1); }
if (key.includes("_test_") && !process.argv.includes("--test")) {
  console.error("TEST-mode key — this would report on test data, not real money. Pass --test if that is what you want.");
  process.exit(1);
}

const stripe = new Stripe(key);
const usd = (cents) => `$${(cents / 100).toFixed(2)}`;
const when = (unix) => new Date(unix * 1000).toISOString().slice(0, 16).replace("T", " ");
const pad = (s, n) => String(s).padEnd(n);
const head = (t) => console.log(`\n\x1b[1m${t}\x1b[0m`);

// Cache account -> email so transfer rows name a person, not an acct_ id.
const names = new Map();
for await (const a of stripe.accounts.list({ limit: 100 })) {
  names.set(a.id, a.email ?? a.business_profile?.name ?? a.id);
}

head("PLATFORM BALANCE");
const bal = await stripe.balance.retrieve();
const sum = (rows) => rows.reduce((t, r) => t + r.amount, 0);
console.log(`  available ${usd(sum(bal.available))}   pending ${usd(sum(bal.pending))}`);

head("TRANSFERS  Tarea -> pros");
let transfers = 0;
for await (const t of stripe.transfers.list({ limit: 25 })) {
  if (++transfers > 25) break;
  const who = names.get(t.destination) ?? t.destination;
  console.log(`  ${when(t.created)}  ${pad(usd(t.amount), 10)} ${pad(who, 32)} ${t.reversed ? "REVERSED" : ""}`);
}
if (!transfers) console.log("  (none)");

head("PAYOUTS  Tarea -> Tarea's bank");
let own = 0;
for await (const p of stripe.payouts.list({ limit: 15 })) {
  if (++own > 15) break;
  const arrival = p.arrival_date ? when(p.arrival_date).slice(0, 10) : "—";
  console.log(`  ${when(p.created)}  ${pad(usd(p.amount), 10)} ${pad(p.status, 12)} arrives ${arrival}  ${p.failure_message ?? ""}`);
}
if (!own) console.log("  (none — your margin has not reached your bank yet)");

head("PAYOUTS  each pro -> their own bank/card");
for (const [id, who] of names) {
  try {
    const [payouts, b] = await Promise.all([
      stripe.payouts.list({ limit: 5 }, { stripeAccount: id }),
      stripe.balance.retrieve({}, { stripeAccount: id }),
    ]);
    const held = `avail ${usd(sum(b.available))} / pending ${usd(sum(b.pending))}`;
    console.log(`\n  ${who}  (${held})`);
    if (!payouts.data.length) { console.log("    (no payouts yet)"); continue; }
    for (const p of payouts.data) {
      console.log(`    ${when(p.created)}  ${pad(usd(p.amount), 10)} ${pad(p.method, 9)} ${pad(p.status, 12)} ${p.failure_message ?? ""}`);
    }
  } catch (err) {
    // An account that never finished onboarding cannot be queried this way.
    console.log(`\n  ${who}: ${err?.message?.slice(0, 80)}`);
  }
}
console.log("");
