-- 003 · Job timer pause/resume
--
-- EXPAND-ONLY: two nullable/defaulted columns on an existing table. Safe to run
-- while the current code is live — old code never selects them, and new code
-- treats NULL pausedAt as "running".
--
-- WHY THE SERVER OWNS THE PAUSE. The customer and the pro look at the same job,
-- so they must see the same clock. If the pro's app owned the pause state, the
-- customer's screen would keep counting through a break and the two would show
-- different totals for the same job — the exact disagreement the timer exists to
-- prevent. Elapsed time is therefore never stored; it is derived identically in
-- both apps:
--
--   elapsed = (now - jobStartedAt) - pausedSeconds - (pausedAt ? now - pausedAt : 0)
--
-- pausedAt      non-null means paused right now; cleared on resume and on
--               completion, banking the final stretch into pausedSeconds.
-- pausedSeconds accumulated paused time, only ever incremented server-side from
--               stored timestamps — never from a value a client sends.
--
-- The timer is informational: the price is fixed before a pro is chosen, so
-- pausing changes no money. Extra time is charged through booking_extensions,
-- which is an explicit, separately approved charge.

BEGIN;

ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "pausedAt" TIMESTAMP(3);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "pausedSeconds" INTEGER NOT NULL DEFAULT 0;

COMMIT;
