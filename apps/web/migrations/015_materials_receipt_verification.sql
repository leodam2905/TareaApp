-- 015 · Check the materials figure against the receipt
--
-- EXPAND-ONLY: two nullable columns on bookings. Existing rows read as
-- unverified, which is what they are.
--
-- Materials are charged at cost capped at the pro's estimate: spend less and the
-- customer is refunded, spend more and the pro absorbs it. That rule was already
-- implemented (see materials_underspend in lib/complete-booking) and rested
-- entirely on the pro reporting honestly, because materialsActual was typed by
-- the pro, the receipt was optional, and nothing compared the two.
--
-- So the refund only ever fired when a pro volunteered that they had underspent.
-- A pro who quoted $150, spent $80 and simply left the field blank kept the
-- difference — the schema note says so plainly: "Null means no figure was given,
-- and the estimate stands." That is the loophole these columns close.
--
-- materialsReceiptTotal is what the model read off the photograph. It is
-- EVIDENCE, not a decision: the model is good enough to notice a discrepancy and
-- not good enough to settle one, and the money here moves toward the customer —
-- an OCR misread that came in low would refund a customer out of the pro's
-- pocket for materials they really bought, with nothing to alert them.
--
-- materialsVerified records what came of the comparison:
--   none      · no receipt read (older bookings, or no materials quoted)
--   verified  · the reading agrees with what the pro typed, within tolerance
--   review    · they disagree, or the receipt could not be read. Held for a human.
-- Refunds are computed from the pro's own figure in every case; `review` flags a
-- booking for an admin rather than moving money on a model's say-so.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS "materialsReceiptTotal" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "materialsVerified" TEXT NOT NULL DEFAULT 'none';

-- Partial: the review queue is the only thing that reads this, and it is a small
-- minority of bookings.
CREATE INDEX IF NOT EXISTS bookings_materials_review_idx
  ON bookings ("materialsVerified")
  WHERE "materialsVerified" = 'review';
