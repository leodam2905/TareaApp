-- 018 · A tip needs its own payout flag
--
-- EXPAND-ONLY: one nullable column on tips, plus a partial index for the sweep.
--
-- Tips were never actually paid to pros. Nothing about the transfer was wrong --
-- the problem was how "has this tip been paid?" was asked. Only one path ever
-- moved tip money (POST /api/handyman/cashout), and it selected tips with:
--
--     where: { booking: { handymanId, handymanPaidOut: false } }
--
-- i.e. it read the BOOKING's payout flag, because a tip had no flag of its own.
-- Two consequences, and the second one is the money:
--
--  1. The weekly cron (api/cron/weekly-payouts) transfers proOwedForAll(bookings)
--     and contains no tip logic at all -- yet it SETS handymanPaidOut = true.
--     So the Monday sweep permanently hid every unpaid tip on those bookings
--     from the only query that could ever have paid them.
--
--  2. Worse, and it is the normal path: tipping requires the booking to be
--     COMPLETED and paid (api/stripe/tip refuses otherwise), while
--     completeBooking() transfers the pro's money and sets handymanPaidOut =
--     true at the moment of completion. So by the time a customer is allowed to
--     tip, the flag the tip query depends on has ALREADY flipped. The window in
--     which a tip was payable was open only when the completion transfer had
--     failed. Tips reached the pro exactly when something else had gone wrong.
--
-- The tips are still in the platform's Stripe balance -- the charge succeeded and
-- the Tip rows are all there, so nothing is lost. Sweeping them is what the code
-- reading this column does.
--
-- paidOutAt is nullable and NULL means unpaid, matching bookings.paidOutAt. It is
-- deliberately a timestamp rather than a boolean: "when did this pro's money
-- move" is the question asked when a pro disputes a payout, and a boolean cannot
-- answer it.

ALTER TABLE tips
  ADD COLUMN IF NOT EXISTS "paidOutAt" TIMESTAMP(3);

-- Partial: the payout sweep only ever asks for the unpaid ones, and once the
-- backlog clears that is a small and slow-growing set.
CREATE INDEX IF NOT EXISTS tips_unpaid_idx
  ON tips ("bookingId")
  WHERE "paidOutAt" IS NULL;
