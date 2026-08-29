// Checks the materials-underspend refund end to end, against BOTH the database
// and Stripe — because the whole point of the feature is that those two agree.
//
//   STRIPE_SECRET_KEY="$(gcloud secrets versions access latest --secret=STRIPE_SECRET_KEY \
//     --account=tarea-deployer@splendid-drake-497611-h6.iam.gserviceaccount.com)" \
//     node scripts/verify-materials-refund.mjs
//
// Run it after completing the test job. Read-only.
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { openCloudSql } from './lib/cloudsql.mjs';

const key = process.env.STRIPE_SECRET_KEY;
if (!key) { console.error('STRIPE_SECRET_KEY is not set.'); process.exit(1); }
if (key.includes('_test_') && !process.argv.includes('--test')) {
  console.error('TEST-mode key — that reports on test data, not the live job.'); process.exit(1);
}

const stripe = new Stripe(key);
const db = await openCloudSql();
const prisma = new PrismaClient({ datasources: { db: { url: db.url } } });

const ok = (b) => (b ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m');
const usd = (n) => `$${Number(n ?? 0).toFixed(2)}`;

const b = await prisma.booking.findFirst({
  where: { materialsEstimate: { gt: 0 } },
  orderBy: { createdAt: 'desc' },
  select: {
    id: true, status: true, totalPrice: true, isPaid: true,
    materialsEstimate: true, materialsActual: true, materialsRefunded: true,
    receiptUrl: true, handymanPaidOut: true, stripePaymentIntentId: true,
    handyman: { select: { name: true, stripeAccountId: true } },
  },
});

if (!b) {
  console.log('No booking with a materials estimate yet — hire the pro first.');
  await prisma.$disconnect(); await db.close(); process.exit(0);
}

console.log(`booking ${b.id}   status=${b.status}   paid=${b.isPaid}\n`);
console.log('  materials quoted   ', usd(b.materialsEstimate));
console.log('  materials reported ', b.materialsActual == null ? 'NOT REPORTED' : usd(b.materialsActual));
console.log('  receipt attached   ', b.receiptUrl ? 'yes' : 'no');
console.log('  refund recorded    ', b.materialsRefunded == null ? 'none' : usd(b.materialsRefunded));

if (b.materialsActual == null) {
  console.log('\nThe pro has not reported a spend yet — complete the job in Tarea Pro.');
  await prisma.$disconnect(); await db.close(); process.exit(0);
}

const expected = Math.round((b.materialsEstimate - Math.min(Math.max(0, b.materialsActual), b.materialsEstimate)) * 100) / 100;
console.log(`\n  expected refund    ${usd(expected)}`);

// What Stripe actually did — the only account that matters.
let refunded = 0, transferred = 0;
if (b.stripePaymentIntentId) {
  const pi = await stripe.paymentIntents.retrieve(b.stripePaymentIntentId, { expand: ['latest_charge'] });
  const charge = typeof pi.latest_charge === 'string' ? null : pi.latest_charge;
  refunded = (charge?.amount_refunded ?? 0) / 100;
}
const transfers = await stripe.transfers.list({ transfer_group: b.id, limit: 10 });
transferred = transfers.data.filter((t) => !t.reversed).reduce((s, t) => s + t.amount, 0) / 100;

const expectedPayout = Math.round((b.totalPrice * 0.9 + Math.min(b.materialsActual, b.materialsEstimate)) * 100) / 100;

console.log('\nSTRIPE');
console.log('  refunded to customer', usd(refunded));
console.log('  transferred to pro  ', usd(transferred));
console.log('  expected payout     ', usd(expectedPayout));

console.log('\nCHECKS');
console.log(` ${ok(b.status === 'COMPLETED')}  booking completed`);
console.log(` ${ok(b.materialsRefunded != null)}  refund recorded in the database`);
console.log(` ${ok(Math.abs(refunded - expected) < 0.02)}  Stripe refunded ${usd(expected)} (actual ${usd(refunded)})`);
console.log(` ${ok(Math.abs(transferred - expectedPayout) < 0.02)}  pro paid labour net + materials at cost`);
console.log(` ${ok(b.receiptUrl != null)}  receipt captured`);

await prisma.$disconnect(); await db.close();
