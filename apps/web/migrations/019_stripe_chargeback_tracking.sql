-- 019 · Track card-network chargebacks, and hold payouts while one is open
--
-- EXPAND-ONLY: six nullable/defaulted columns on bookings, plus a partial
-- index for the "what is on hold?" sweep.
--
-- The Stripe webhook handled eight event types and none of them were disputes.
-- charge.dispute.created, charge.dispute.closed and
-- radar.early_fraud_warning.created were all unhandled, so a chargeback reached
-- us only as an email: nothing in the product knew it had happened.
--
-- That matters more here than it would for an ordinary shop, because Tarea is
-- merchant of record with separate charges and transfers. The sequence is:
--
--     job completes -> transfer to the pro -> pro cashes out
--     ... weeks later ...
--     customer charges back -> funds are pulled from TAREA's balance
--
-- The pro has already been paid and the loss lands on the platform. Six
-- different code paths create transfers (completion, weekly cron, instant
-- cashout, admin payout, dispute release, tips), and every one of them selects
-- on { status: COMPLETED, isPaid: true, handymanPaidOut: false }. None of them
-- could see a dispute, so none of them could decline to pay.
--
-- payoutHold is the flag those queries now also test. It is set when a dispute
-- opens or an early fraud warning arrives, and cleared when the dispute is won
-- or an admin releases it. Existing rows default to false, which is correct:
-- nothing is on hold until Stripe says so.
--
-- The chargeback* columns are deliberately separate from the existing
-- disputeReason / disputedBy / disputedAt fields. Those record a CUSTOMER
-- complaint raised inside the app; these record the CARD NETWORK pulling the
-- money back. They can occur independently, and conflating them would make it
-- impossible to tell which one froze a payout.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS "chargebackStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "chargebackReason" TEXT,
  ADD COLUMN IF NOT EXISTS "chargebackAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "chargebackAmount" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "fraudWarningAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "payoutHold" BOOLEAN NOT NULL DEFAULT false;

-- Partial: the overwhelming majority of rows are never held, and the only
-- question ever asked is "which ones are?"
CREATE INDEX IF NOT EXISTS bookings_payout_hold_idx
  ON bookings ("payoutHold")
  WHERE "payoutHold" = true;
