-- 013 · A minimum billable TIME, replacing the platform's minimum PRICE
--
-- EXPAND-ONLY: one nullable column on services, one on bookings.
--
-- MINIMUM_NET_JOB ($120) floored every quote, and on a short job it erased the
-- whole pricing model. Measured on a 30-minute job, every pro from $50/hr to
-- $150/hr was charged EXACTLY $120: the customer's range collapsed to a single
-- number, and the rate the pro had chosen decided nothing at all.
--
-- It also inverted the incentive it was meant to protect. All pros netted the
-- same $120, so a $50/hr pro earned 4.8x their rate on that job while a $150/hr
-- pro earned 1.6x -- the cheapest pro gaining the most, which is the behaviour
-- the floor existed to discourage.
--
-- And it was the most exposed thing in the pricing code: one identical price,
-- set by the platform, across every competing pro. See the note in
-- lib/labor-pricing on why that shape is the one to avoid.
--
-- A minimum TIME fixes all three. Price stays rate x time, so it still varies by
-- pro; the platform sets a billing unit rather than an amount; and hour minimums
-- are ordinary trade practice rather than a number nobody chose.
--
-- 60 minutes is not arbitrary. The $120 floor minus $30 travel already bought
-- 1.00h at the electrical/HVAC rate and 1.06h at plumbing, so for the skilled
-- trades this changes almost nothing. What it fixes is the bottom of the card,
-- where a flat dollar figure meeting a low rate was silently imposing a 1.8h
-- minimum on cleaning and 2.25h on laundry -- minimums no pro ever agreed to.
--
-- Nullable so the pro who has set nothing falls back to the 60-minute default
-- rather than to zero, and so existing rows need no backfill.

BEGIN;

-- What this pro bills as a minimum for this category. Theirs to choose: once
-- the pro owns this number, the platform has stopped setting prices entirely.
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "minimumMinutes" INTEGER;

-- Frozen onto the booking beside the rate, so an invoice reproduces the figure
-- the customer agreed to even after the pro changes their minimum.
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "minimumMinutesSnapshot" INTEGER;

COMMIT;
