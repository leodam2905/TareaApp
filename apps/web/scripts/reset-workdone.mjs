// Rewinds a PAID booking to "in progress, not yet finished" so the pro can mark
// work done again — this time on a build that asks for the materials figure.
//
//   node scripts/reset-workdone.mjs --dry-run
//   node scripts/reset-workdone.mjs
//
// Exists because build 46 finished jobs without ever asking what materials
// cost, so a paid test booking reached work-done with materialsActual null and
// no way to supply it from the app. Rather than pay for a fresh booking, this
// reuses the one already paid for.
//
// Refuses anything unpaid, already completed, or already paid out: rewinding a
// completed job would mean a second payout for work already paid for.
import { PrismaClient } from '@prisma/client';
import { openCloudSql } from './lib/cloudsql.mjs';

const dry = process.argv.includes('--dry-run');
const db = await openCloudSql();
const prisma = new PrismaClient({ datasources: { db: { url: db.url } } });

const b = await prisma.booking.findFirst({
  where: { materialsEstimate: { gt: 0 }, isPaid: true, status: 'IN_PROGRESS' },
  orderBy: { createdAt: 'desc' },
  select: {
    id: true, status: true, isPaid: true, workDoneAt: true, completedAt: true,
    materialsEstimate: true, materialsActual: true, handymanPaidOut: true,
  },
});

if (!b) {
  console.log('No paid, in-progress booking with materials to reset.');
} else if (b.completedAt || b.handymanPaidOut) {
  console.log('That booking is already completed or paid out — refusing to rewind it.');
} else {
  console.log(`booking ${b.id}`);
  console.log(
    `  paid=${b.isPaid}  workDone=${b.workDoneAt ? 'yes' : 'no'}  ` +
    `materials quoted $${b.materialsEstimate}  reported ${b.materialsActual ?? 'none'}`,
  );
  if (dry) {
    console.log('\n[dry run] would clear workDoneAt so the pro can finish it again');
  } else {
    await prisma.booking.update({ where: { id: b.id }, data: { workDoneAt: null } });
    console.log('\nCleared. In Tarea Pro (v1.0.23 build 47) the job shows "Mark work done" again —');
    console.log('tap it, change the pre-filled $20 to $5, attach a photo, then confirm in Tarea Home.');
  }
}

await prisma.$disconnect();
await db.close();
