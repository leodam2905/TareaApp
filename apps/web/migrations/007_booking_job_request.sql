-- 007 · Link a booking back to the job request that produced it
--
-- EXPAND-ONLY: one nullable column.
--
-- materializeHire creates a booking from an accepted application but recorded
-- nothing about where it came from, so nothing could close the request when the
-- job finished. The customer's own list kept showing a job they had had done,
-- paid for and reviewed as still ASSIGNED — the request outliving the work.
--
-- Nullable because directed bookings never had a request: a customer who books
-- a specific pro from Browse creates a booking directly.
--
-- NOT backfilled. There is no reliable key to match old bookings to old
-- requests — the title was copied into a service, not preserved — and guessing
-- would close the wrong request. Existing rows keep null and behave as they do
-- today; every hire from here on carries the link.

BEGIN;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "jobRequestId" TEXT;
CREATE INDEX IF NOT EXISTS "bookings_jobRequestId_idx" ON "bookings" ("jobRequestId");
COMMIT;
