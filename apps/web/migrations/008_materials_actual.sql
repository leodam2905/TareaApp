-- 008 · Actual materials spend, and what was refunded
--
-- EXPAND-ONLY: two nullable columns.
--
-- Materials are quoted by the pro when they apply and prepaid by the customer.
-- The rule is cost, CAPPED AT THE ESTIMATE:
--
--   spent less than quoted  -> refund the difference to the customer
--   spent more than quoted  -> the pro absorbs it
--
-- Asymmetric on purpose. The customer agreed to a number before the job and
-- should not pay for materials nobody bought; the pro chose the number and is
-- the only one who can control the overrun.
--
-- materialsActual is what the receipt says, entered by the pro at work-done.
-- Null means no figure was given and the estimate stands — which is why the
-- app asks for the amount whenever the estimate is above zero.
--
-- materialsRefunded records what was actually returned, so a retry after a
-- failed Stripe refund cannot pay it twice.

BEGIN;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "materialsActual"   DOUBLE PRECISION;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "materialsRefunded" DOUBLE PRECISION;
COMMIT;
