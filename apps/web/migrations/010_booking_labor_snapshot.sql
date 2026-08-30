-- 010 · What the job was priced from, frozen at booking time
--
-- EXPAND-ONLY: five nullable columns on bookings.
--
-- The price stops being a number Tarea picks and becomes arithmetic:
--
--   initialLaborAmount = (proRateSnapshot / 60) * estimatedBillableMinutes
--
-- Both inputs are SNAPSHOTS. A pro who raises their rate on Tuesday must not
-- retroactively change what a customer agreed to on Monday, and an invoice
-- issued months later has to reproduce the same figure -- so the rate is copied
-- onto the booking rather than read back through the service row. The same
-- reasoning applies to the minimum: it is policy, and policy moves.
--
-- estimatedBillableMinutes is ONE number, not a range. A range cannot be
-- charged, and every downstream surface (approval, invoice, extension) needs a
-- single figure both sides agreed to. It is an ESTIMATE of billable time, not
-- a duration the pro is obliged to fill or forbidden to exceed -- running over
-- is what BookingExtension is for, and it needs the customer's approval.
--
-- pricingType records which shape the job was sold as, because "2 hours at
-- $80/hr" and "$180 for the job" reconcile differently when the work runs long:
--   hourly         - rate x minutes, extensions billable
--   service        - a flat agreed figure, minutes advisory
--   quote_required - no price until the pro has seen it
--
-- All nullable: every booking written before this migration has none of it, and
-- the old totalPrice remains the amount actually charged.

BEGIN;

ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "proRateSnapshot"          DOUBLE PRECISION;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "estimatedBillableMinutes" INTEGER;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "initialLaborAmount"       DOUBLE PRECISION;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "minimumChargeSnapshot"    DOUBLE PRECISION;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "pricingType"              TEXT;

COMMIT;

-- No backfill. Existing bookings were priced by the rate card, not by a pro's
-- own rate, and inventing a proRateSnapshot for them would assert something
-- that was never agreed. They keep totalPrice and read as pricingType NULL.
