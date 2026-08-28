// Clean up the demo-visible copy on the original live-payment test job.
//
// That job request is what the App Store reviewer sees first in My Requests,
// and it was titled "LIVE PAYMENT TEST — small faucet check". Internal test
// wording in a store screenshot reads as an unfinished app.
//
//   node scripts/fix-test-job-copy.mjs --dry-run   # show what changes
//   node scripts/fix-test-job-copy.mjs             # rename (recommended)
//   node scripts/fix-test-job-copy.mjs --delete    # remove it entirely
//
// Starts its own cloud-sql-proxy. The DATABASE_URL in Secret Manager points at
// a unix socket that only exists inside Cloud Run, so passing it straight to
// Prisma from a laptop fails with "Can't reach database server".
//
// RENAME is the default on purpose. This is the only job in the system with a
// pro actually hired against it, so its card is the one screenshot that shows
// the marketplace working — three "no pros have applied yet" cards do not.
// Deleting also cascades away the JobApplication, the only real one there is.
//
// Either way the Booking survives: Booking.jobRequestId carries no foreign key,
// so the record of the real $57.50 charge and the $45 transfer is untouched.
import { PrismaClient } from '@prisma/client';
import { openCloudSql } from './lib/cloudsql.mjs';

const db = await openCloudSql();
const prisma = new PrismaClient({ datasources: { db: { url: db.url } } });
const dry = process.argv.includes('--dry-run');
const del = process.argv.includes('--delete');

const jr = await prisma.jobRequest.findFirst({
  where: { title: { contains: 'LIVE PAYMENT TEST' } },
  select: { id: true, title: true, description: true, status: true },
});

if (!jr) {
  console.log('Nothing to do — no job request matching "LIVE PAYMENT TEST".');
  await prisma.$disconnect();
  await db.close();
  process.exit(0);
}

console.log(`found: ${jr.title}  [${jr.status}]`);
console.log(`  ${JSON.stringify(jr.description?.slice(0, 70))}`);

if (del) {
  const apps = await prisma.jobApplication.count({ where: { jobRequestId: jr.id } });
  console.log(`\n${dry ? '[dry run] would delete' : 'deleting'} the request and ${apps} application(s).`);
  if (!dry) await prisma.jobRequest.delete({ where: { id: jr.id } });
} else {
  const title = 'Kitchen faucet check';
  const description =
    'Kitchen faucet had a slow drip at the base. Small job, looked at and sorted the same day.';
  console.log(`\n${dry ? '[dry run] would rename to' : 'renaming to'}: ${title}`);
  console.log(`  ${JSON.stringify(description)}`);
  if (!dry) await prisma.jobRequest.update({ where: { id: jr.id }, data: { title, description } });
}

console.log(dry ? '\nnothing written' : '\ndone');
await prisma.$disconnect();
await db.close();
