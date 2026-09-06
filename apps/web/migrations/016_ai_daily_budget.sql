-- A GLOBAL daily ceiling on the unauthenticated AI routes.
--
-- ai/chat, ai/diagnose, ai/instant-quote and ai/price-estimate take no auth --
-- deliberately, because a visitor has to be able to price a job before signing
-- up. That means anyone with curl can spend our Anthropic balance, and until
-- 2026-09-06 nothing bounded it: the per-IP limiter keyed on a caller-supplied
-- header, so it never bound at all.
--
-- Fixing the IP key was necessary but is NOT sufficient here, and the reason is
-- structural rather than a bug: per-caller throttling divides a budget, it does
-- not cap one. A thousand hosts each politely under the per-IP limit still add
-- up to a bill nobody approved. A shared resource needs a shared counter.
--
-- Per (day, route) rather than one global row: when the cap trips, the first
-- question is always "which route ran away", and a single counter cannot answer
-- it. The cap itself sums across the day.
--
-- Counters, not a ledger. Rows are tiny and bounded (a handful per day), so this
-- needs no retention policy and no cleanup cron -- the thing lib/ai-usage.ts was
-- rightly avoiding when it chose to log tokens to Cloud Logging instead of a
-- table. That choice stands for ACCOUNTING; a CAP has a different requirement,
-- because it must be read synchronously, transactionally, and shared across
-- every Cloud Run instance. Logs cannot do that.
CREATE TABLE IF NOT EXISTS ai_daily_usage (
  day            date        NOT NULL,
  route          text        NOT NULL,
  requests       integer     NOT NULL DEFAULT 0,
  input_tokens   bigint      NOT NULL DEFAULT 0,
  output_tokens  bigint      NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, route)
);

-- The cap reads today's total on every unauthenticated AI request, so this one
-- lookup is on the hot path.
CREATE INDEX IF NOT EXISTS ai_daily_usage_day_idx ON ai_daily_usage (day);
