-- 009 · One fixed hourly rate per category, replacing the min/max range
--
-- EXPAND-ONLY: one nullable column, plus two NOT NULLs dropped.
--
-- Every pro carried the seeded $50-$150 range on every category, which meant
-- the range said nothing about the pro and priced nothing -- booking already
-- validates against grossMinimum() instead (see 007-era work). Worse, a range
-- cannot answer the only question the new pricing model asks: what does THIS
-- pro charge for an hour of THIS kind of work?
--
-- So the pro now names a single number per category. The customer sees one
-- rate, not a spread, and the initial labour amount is arithmetic:
--
--   initialLaborAmount = (hourlyRate / 60) * estimatedBillableMinutes
--
-- minPrice/maxPrice are made nullable rather than dropped: the currently
-- deployed code still selects them, and Prisma selects every scalar by default,
-- so dropping them here would 500 every endpoint that reads a Service until the
-- new revision is live. They are dropped in a later contracting migration once
-- nothing reads them.
--
-- The backfill takes each pro's existing profile rate. It is deliberately not
-- the midpoint of the seeded range: $100/hr is a number nobody chose, whereas
-- the profile rate is one they typed at onboarding. Services with no pro
-- (admin-created templates) stay NULL and fall back to the rate card.

BEGIN;

ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "hourlyRate" DOUBLE PRECISION;

ALTER TABLE "services" ALTER COLUMN "minPrice" DROP NOT NULL;
ALTER TABLE "services" ALTER COLUMN "maxPrice" DROP NOT NULL;

COMMIT;

-- Backfill, run separately and restartable (see migrations/README.md):
--
--   UPDATE "services" s
--      SET "hourlyRate" = p."hourlyRate"
--     FROM "handyman_profiles" p
--    WHERE s."handymanId" = p."id"
--      AND s."hourlyRate" IS NULL
--      AND p."hourlyRate" > 0;
