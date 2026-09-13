-- 020 · Record WHICH Stripe transfer paid a booking, and when
--
-- EXPAND-ONLY: three nullable columns on bookings, plus a partial index for
-- "what did we pay, and when?".
--
-- Today a payout writes exactly one thing: handymanPaidOut = true. The
-- transfer id that Stripe hands back is discarded at every one of the six call
-- sites. So the database can say THAT a pro was paid and nothing else -- not
-- when, not how much, not which transfer it was.
--
-- That is survivable at two bookings and not at two thousand. Answering "what
-- did we actually pay this pro in September?" means opening the Stripe
-- dashboard and matching transfers to pros by hand, and a transfer covering
-- several bookings at once cannot be split back apart at all. Reconciliation,
-- a pro disputing their payout, and an accountant at year end all need the
-- link that is currently thrown away.
--
-- payoutAmount is stored per BOOKING even though one transfer often covers
-- several: the transfer carries the total, and without the split there is no
-- way to say what any individual job earned.
--
-- Backfill is deliberately not attempted. Existing paid bookings have no
-- transfer id anywhere, and inventing one from amount-and-date matching would
-- put a guess in a financial record. They stay NULL, which reads honestly as
-- "paid before we tracked this".

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "payoutTransferId" TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "payoutAt"         TIMESTAMP(3);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS "payoutAmount"     DOUBLE PRECISION;

-- Partial: only paid-out rows are ever scanned for payout history.
CREATE INDEX IF NOT EXISTS bookings_payout_at_idx
  ON bookings ("payoutAt" DESC)
  WHERE "payoutAt" IS NOT NULL;

-- One transfer covers many bookings, so this is NOT unique -- it is the
-- grouping key that reassembles a transfer from its rows.
CREATE INDEX IF NOT EXISTS bookings_payout_transfer_idx
  ON bookings ("payoutTransferId")
  WHERE "payoutTransferId" IS NOT NULL;
