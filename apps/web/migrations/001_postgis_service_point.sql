-- 001 · PostGIS service points for geographic job matching
--
-- EXPAND-ONLY. Every statement is idempotent and additive: no column is dropped,
-- narrowed or backfilled here, and nothing existing code reads is altered. Safe
-- to apply to a live database ahead of the code that uses it, which is the
-- required order -- Prisma selects all scalar fields by default, so deploying
-- code whose schema names a column the database lacks 500s every endpoint that
-- reads that model. (That is what took production down on 2026-08-08.)
--
-- Apply BEFORE deploying the geocoding code. Verify with:
--   npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma \
--     --to-schema-datasource prisma/schema.prisma --exit-code
-- which must report "No difference detected".

BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------------------------
-- Job side
-- ---------------------------------------------------------------------------
-- service_point is SERVER-DERIVED and authoritative: it is written only from a
-- server-side geocode of the submitted address. Client-supplied coordinates are
-- never trusted and never written here -- the existing latitude/longitude
-- columns stay as-is precisely so that untrusted client input cannot be
-- confused with this value.
--
-- geocode_confidence drives the fail-closed publication gate: below the
-- threshold the job stays DRAFT and the customer is asked to correct the
-- address. It must never publish first and fail afterwards.
ALTER TABLE job_requests
  ADD COLUMN IF NOT EXISTS service_point      geography(Point, 4326),
  ADD COLUMN IF NOT EXISTS geocode_confidence double precision,
  ADD COLUMN IF NOT EXISTS geocode_source     text,
  ADD COLUMN IF NOT EXISTS geocode_error      text,
  ADD COLUMN IF NOT EXISTS geocoded_at        timestamp(3);

-- ---------------------------------------------------------------------------
-- Pro side
-- ---------------------------------------------------------------------------
-- A pro's service centre. How far they travel is NOT added here: the existing
-- handyman_profiles.serviceRadius column already holds it (in MILES, per the
-- 50 * 1.60934 conversion in the old matcher) and is already editable through
-- /api/profile. It has only ever been displayed, never used for eligibility --
-- wiring it into the query is the point of this work, not a new column.
--
-- Eligibility then respects the radius the pro actually chose, so a pro who
-- covers a wide area is not excluded by a job outside their home town: the
-- failure that made neighbouring-town jobs (Darby vs Crum Lynne, a few miles
-- apart) notify nobody at all.
ALTER TABLE handyman_profiles
  ADD COLUMN IF NOT EXISTS service_point      geography(Point, 4326),
  ADD COLUMN IF NOT EXISTS geocode_confidence double precision,
  ADD COLUMN IF NOT EXISTS geocode_source     text,
  ADD COLUMN IF NOT EXISTS geocoded_at        timestamp(3);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
-- GiST indexes make ST_DWithin an index scan rather than a sequential one. The
-- previous matcher compared city strings in application code, which no index
-- could help and which was wrong regardless.
CREATE INDEX IF NOT EXISTS job_requests_service_point_gix
  ON job_requests USING GIST (service_point);

CREATE INDEX IF NOT EXISTS handyman_profiles_service_point_gix
  ON handyman_profiles USING GIST (service_point);

-- Supports the "jobs awaiting geocode / stuck in draft" operational query.
CREATE INDEX IF NOT EXISTS job_requests_status_geocoded_idx
  ON job_requests (status, geocoded_at);

COMMIT;

-- ---------------------------------------------------------------------------
-- Backfill (deliberately NOT run here)
-- ---------------------------------------------------------------------------
-- Backfilling requires calling the geocoding provider for every existing row,
-- which costs money, is rate-limited, and must be resumable. It belongs in a
-- separate, restartable job -- not in a migration that holds a transaction open.
-- Until a row is backfilled its service_point is NULL, and the matcher treats
-- NULL as "not yet eligible for geographic matching" rather than as "matches
-- everyone" -- fail closed, never fan out.
