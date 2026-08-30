-- 012 · The estimated billable time on an open job request
--
-- EXPAND-ONLY: one nullable column.
--
-- Migration 010 gave a BOOKING the time it was priced from, but an open job
-- request had nowhere to keep it -- only budgetMin/budgetMax, a money range
-- computed from the platform rate card before any pro existed.
--
-- That left the customer-facing price interval dishonest. The estimate promises
-- "$150-$338 across 7 pros, your price depends on which pro you choose", and
-- then every applicant types whatever proposedPrice they like, so the spread the
-- customer was shown has no relationship to what they are quoted.
--
-- With the time stored on the request, an applicant's quote is arithmetic:
-- their own rate times the same minutes every other applicant is quoted on. The
-- customer then compares like with like, and the interval means what it says.
--
-- Nullable because requests created before this have no estimate, and inventing
-- minutes for them would fabricate a figure the customer never saw.

BEGIN;
ALTER TABLE "job_requests" ADD COLUMN IF NOT EXISTS "estimatedBillableMinutes" INTEGER;
COMMIT;
