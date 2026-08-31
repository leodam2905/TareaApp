# Migrations

Hand-written, version-controlled SQL. The project has always used `prisma db push`
and has no `prisma/migrations` history, so these files are the migration record:
numbered, idempotent, applied deliberately, reviewable in a diff.

## The rule

**Apply the migration to the database BEFORE deploying code that depends on it.**

Prisma selects every scalar field by default. A column named in `schema.prisma`
but missing from the database therefore 500s *every endpoint that reads that
model* — not just the feature that introduced it. That is what took production
down for ~30 minutes on 2026-08-08.

`scripts/deploy-web.sh` enforces this: it refuses to deploy while
`prisma migrate diff` reports drift.

## Expand / backfill / verify

Each migration is **expand-only** — additive, idempotent, and safe to run while
the current code is live:

1. **Expand** — add nullable columns, new tables, new indexes. Old code ignores
   them; new code tolerates NULL.
2. **Backfill** — separately, restartable, outside the migration. Never inside a
   transaction that holds locks on a live table.
3. **Verify** — `migrate diff` reports no difference, then deploy.

Contracting (dropping or narrowing) only happens after the deployed code has
stopped referencing the old shape, as its own numbered migration.

## Applying

Cloud SQL is reachable only through the proxy:

```bash
cloud-sql-proxy "splendid-drake-497611-h6:us-central1:tarea-db" --port 15432

SA=tarea-deployer@splendid-drake-497611-h6.iam.gserviceaccount.com
export PGPASSWORD=$(gcloud secrets versions access latest --secret=DATABASE_URL \
  --project splendid-drake-497611-h6 --account=$SA \
  | sed -E 's|postgresql://[^:]+:([^@]+)@.*|\1|')

psql -h 127.0.0.1 -p 15432 -U tarea_user -d tarea_db \
  -v ON_ERROR_STOP=1 -f migrations/001_postgis_service_point.sql
```

Then verify:

```bash
npx prisma migrate diff \
  --from-schema-datamodel prisma/schema.prisma \
  --to-schema-datasource prisma/schema.prisma --exit-code
# must print: No difference detected
```

## Status

| # | Migration | Applied to production |
|---|-----------|----------------------|
| 001 | PostGIS service points | **Yes** — 2026-08-30 |
| 002 | FCM outbox | **Yes** — 2026-08-30 |
| 003 | Job timer pause/resume | **Yes** — 2026-08-22 |
| 004 | Licence + insurance credentials | **Yes** — 2026-08-25 |
| 005 | Name on the licence | **Yes** — 2026-08-25 |
| 006 | Insurance certificate detail | **Yes** — 2026-08-25 |
| 007 | Booking → job request link | **Yes** — 2026-08-26 |
| 008 | Actual materials spend + refund record | **Yes** — 2026-08-29 |
| 009 | One hourly rate per category (range retired) | **Yes** — 2026-08-30 |
| 010 | Booking labour snapshot (rate, minutes, amount) | **Yes** — 2026-08-30 |
| 011 | Which ICA version a pro signed | **Yes** — 2026-08-30 |
| 012 | Estimated billable minutes on a job request | **Yes** — 2026-08-30 |
| 013 | Minimum billable TIME, replacing the price floor | **Yes** — 2026-08-30 |
| 014 | Customer can require a licensed & insured pro | **Yes** — 2026-08-31 |
| 015 | Materials receipt read + verification state | **Yes** — 2026-08-31 |

> **All applied as of 2026-08-31.** The drift gate passes.
>
> 001 and 002 were recorded here as unapplied but their columns and tables were
> already present — created by an earlier `prisma db push`, not by running these
> files. The three GiST indexes 001 declares were therefore missing, because
> `db push` cannot create an index on a column Prisma models as `Unsupported()`.
> Re-running 001 (it is idempotent) added them.
>
> Those indexes now show in `migrate diff` as three `DROP INDEX` lines forever,
> for the same reason: Prisma cannot express them, so it reports them as extra.
> `scripts/deploy-web.sh` fails only on `CREATE TABLE` / `ADD COLUMN` — things
> the code needs and the database lacks — and treats extra database objects as a
> warning, so this does not block a deploy. Do not "fix" it by dropping them.
>
> 014 and 015 create **partial** indexes (`WHERE "requiresLicensed" = true`,
> `WHERE "materialsVerified" = 'review'`). Prisma cannot express those either,
> so they are deliberately NOT declared in `schema.prisma` — the same treatment
> as the GiST indexes above. They were briefly declared as full `@@index` lines,
> which made the gate ask for a second, redundant index on each column; the
> declarations were removed rather than the partial indexes widened.
>
> Separately, `bookings_jobRequestId_idx` was created by 007 but never declared
> in `schema.prisma`, so the two disagreed from 2026-08-26 until it was added to
> the Booking model on 2026-08-30.

## Notes

- **PostGIS on Cloud SQL** — `CREATE EXTENSION postgis` is supported. If the
  database later moves to Supabase, PostGIS is available there too, so this
  choice does not constrain that decision.
- **Prisma and `geography`** — Prisma has no native geography type; the columns
  are mapped as `Unsupported(...)`. They cannot be read through the Prisma client
  and are queried with `$queryRaw` instead. This is expected, not a workaround:
  the distance predicate needs to run in the database against the GiST index.
