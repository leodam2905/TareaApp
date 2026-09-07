-- Durable rate-limit counters.
--
-- lib/rate-limit.ts keeps its counters in a per-instance in-memory Map. On Cloud
-- Run that is wrong in two directions at once, and both favour the attacker:
--
--   * tarea-web runs min=1 max=10, and each instance holds its OWN Map. Every
--     limit is therefore multiplied by the live instance count -- "5 OTP attempts
--     per 10 minutes" is really up to 50, and the ceiling rises exactly when
--     traffic (or an attack) scales the service up.
--   * a cold start wipes the Map, so an attacker who pauses until the service
--     scales in gets a clean slate for free.
--
-- That most weakens the per-USER OTP limit, which is the only thing between an
-- attacker and a 6-digit code inside a 10-minute window: 5 tries against 10^6 is
-- negligible, 50 across instances is 50x better odds, and unbounded retries after
-- scale-in eventually succeed.
--
-- Fixed windows rather than a sliding log: one row per (key, window), no per-hit
-- rows to store or trim, and the worst case is a 2x burst across a window
-- boundary -- acceptable for brute-force protection, where the aim is bounding
-- attempts per unit time, not perfect smoothness.
--
-- Kept OUT of lib/rate-limit.ts's path: the in-memory limiter still serves the
-- AI and contact routes, where a DB round trip per request buys little (the
-- global cap in ai_daily_usage already bounds the money) and costs latency.
CREATE TABLE IF NOT EXISTS rate_limit_counters (
  key        text        NOT NULL,
  window_end timestamptz NOT NULL,
  count      integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_end)
);

-- Sweeping expired rows is the only query that does not hit the primary key.
CREATE INDEX IF NOT EXISTS rate_limit_counters_window_end_idx
  ON rate_limit_counters (window_end);
