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
| 001 | PostGIS service points | **No** |
| 002 | FCM outbox | **No** |
| 003 | Job timer pause/resume | **Yes** — 2026-08-22 |
| 004 | Licence + insurance credentials | **Yes** — 2026-08-25 |

> Neither is applied. `schema.prisma` describes them, so the deploy script's
> drift gate will **refuse all deploys** until they are applied. That is
> deliberate fail-closed behaviour, but it means the next deploy of `apps/web`
> requires applying 001 and 002 first.

## Notes

- **PostGIS on Cloud SQL** — `CREATE EXTENSION postgis` is supported. If the
  database later moves to Supabase, PostGIS is available there too, so this
  choice does not constrain that decision.
- **Prisma and `geography`** — Prisma has no native geography type; the columns
  are mapped as `Unsupported(...)`. They cannot be read through the Prisma client
  and are queried with `$queryRaw` instead. This is expected, not a workaround:
  the distance predicate needs to run in the database against the GiST index.
