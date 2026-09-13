// Push Tarea users into Quo as contacts, so an inbound call to the support
// line shows who is ringing instead of a bare number.
//
// Keyed on `externalId` = the Tarea user id, which is what makes this safe to
// re-run: a second run updates the same contact rather than creating a twin.
//
// Deliberately uses only `defaultFields`. Quo custom fields would be a tidier
// home for role/rating/job counts, but they must exist before a contact can
// reference them, and creating them is a write this environment gates. The
// free-text `role` field carries the same information with no setup.
//
//   node scripts/quo-contact-sync.mjs            # dry run, prints the diff
//   node scripts/quo-contact-sync.mjs --apply    # writes to Quo
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const API = "https://api.quo.com/v1";

const sh = (c) => execSync(c, { encoding: "utf8" }).trim();
const KEY = sh(`gcloud secrets versions access latest --secret=QUO_API_KEY`);
const DB = sh(`gcloud secrets versions access latest --secret=DATABASE_URL --account=tarea-deployer@splendid-drake-497611-h6.iam.gserviceaccount.com`);

async function quo(path, init = {}) {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: KEY, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}

// 10 req/s per key, so stay under it rather than discovering the limit in prod.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The stored DATABASE_URL points at a Cloud SQL unix socket, which only exists
// inside Cloud Run. Locally the same database is reached through
// cloud-sql-proxy on a loopback port, so rewrite the socket form to TCP --
// the same swap scripts/deploy-web.sh makes for its schema gate.
const PROXY_PORT = process.env.SQL_PROXY_PORT || "5432";
const url = DB.includes("?host=/cloudsql/")
  ? DB.replace(/@[^/]*\//, `@127.0.0.1:${PROXY_PORT}/`).replace(/\?host=.*$/, "")
  : DB;
if (url.includes("/cloudsql/")) {
  console.error("  DATABASE_URL still points at a unix socket; start cloud-sql-proxy first.");
  process.exit(1);
}

// Prisma rather than a raw pg driver: it is the only Postgres client resolvable
// from the repo root, and $queryRawUnsafe keeps this a plain read.
const prisma = new PrismaClient({ datasources: { db: { url } } });

// Admins are staff, not people who ring support about a job.
const rows = await prisma.$queryRawUnsafe(`
  SELECT u.id, u.name, u.email, u.phone, u.role,
         h.rating,
         (SELECT count(*) FROM bookings b WHERE b."handymanId" = u.id AND b.status = 'COMPLETED') AS jobs_done,
         (SELECT count(*) FROM bookings b WHERE b."customerId" = u.id) AS jobs_booked
    FROM users u
    LEFT JOIN handyman_profiles h ON h."userId" = u.id
   WHERE u."isActive" AND u.role IN ('CUSTOMER','HANDYMAN') AND u.phone IS NOT NULL
   ORDER BY u.role, u.name`);
await prisma.$disconnect();

// One page is plenty at this size; paginate if the workspace ever grows.
const existing = new Map();
const list = await quo(`/contacts?maxResults=100`);
for (const c of list.body?.data ?? []) if (c.externalId) existing.set(c.externalId, c.id);

// What a support agent wants on screen when the phone rings.
function describe(u) {
  if (u.role === "HANDYMAN") {
    const bits = ["Pro"];
    if (u.rating > 0) bits.push(`${Number(u.rating).toFixed(1)}★`);
    if (Number(u.jobs_done) > 0) bits.push(`${u.jobs_done} job${Number(u.jobs_done) === 1 ? "" : "s"} done`);
    return bits.join(" · ");
  }
  const bits = ["Customer"];
  if (Number(u.jobs_booked) > 0) bits.push(`${u.jobs_booked} booking${Number(u.jobs_booked) === 1 ? "" : "s"}`);
  return bits.join(" · ");
}

let created = 0, updated = 0, failed = 0;
for (const u of rows) {
  const [firstName, ...rest] = (u.name || "").trim().split(/\s+/);
  const payload = {
    defaultFields: {
      firstName: firstName || u.email.split("@")[0],
      lastName: rest.join(" ") || undefined,
      company: "Tarea",
      role: describe(u),
      emails: u.email ? [{ name: "work", value: u.email }] : [],
      phoneNumbers: u.phone ? [{ name: "mobile", value: u.phone }] : [],
    },
    externalId: u.id,
  };
  const id = existing.get(u.id);
  const verb = id ? "update" : "create";
  if (!APPLY) { console.log(`  [dry] ${verb.padEnd(6)} ${(u.name || u.email).padEnd(24)} ${payload.defaultFields.role}`); continue; }

  const r = id
    ? await quo(`/contacts/${id}`, { method: "PATCH", body: JSON.stringify(payload) })
    : await quo(`/contacts`, { method: "POST", body: JSON.stringify(payload) });
  if (r.status < 300) { id ? updated++ : created++; }
  else { failed++; console.log(`  FAIL ${verb} ${u.name}: ${r.status} ${JSON.stringify(r.body?.message ?? r.body).slice(0, 120)}`); }
  await sleep(120);
}

console.log(APPLY
  ? `\n  created ${created}, updated ${updated}, failed ${failed}`
  : `\n  dry run: ${rows.length} contact(s) would be written. Re-run with --apply.`);
