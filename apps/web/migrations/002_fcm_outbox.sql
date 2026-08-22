-- 002 · FCM outbox
--
-- EXPAND-ONLY: creates one new table and its indexes. Touches nothing existing.
--
-- Why this exists: sendFcm() discarded the message name FCM returns and logged
-- only failures, so the only evidence a push was ever attempted was the
-- notifications row written beside it. During the 2026-08-10 investigation that
-- made it impossible to distinguish "never sent" from "sent and swallowed by the
-- device" without re-running live tests -- and no amount of server evidence
-- could settle it.
--
-- NAMING IS DELIBERATE. The success state is `accepted_by_fcm`, never
-- `delivered`. FCM returning a message name means the message was accepted for
-- delivery; it says nothing about whether the device displayed it, and a device
-- with notifications disabled returns success just the same. Device receipt, if
-- ever added, is a SEPARATE signal acknowledged by the app -- never inferred
-- from this table.

BEGIN;

CREATE TABLE IF NOT EXISTS fcm_outbox (
  id                text         PRIMARY KEY,

  -- What this send was for. notification_id is nullable because some sends
  -- (diagnostics, verification pushes) have no in-app notification row.
  notification_id   text,
  user_id           text         NOT NULL,
  purpose           text         NOT NULL,

  -- Which device. The raw token is NOT duplicated here -- device_tokens already
  -- holds it, and a token is a credential-shaped value. token_hash lets a send
  -- be correlated to a device without widening exposure.
  device_token_id   text,
  token_hash        text         NOT NULL,
  platform          text,

  -- Idempotency. One row per (purpose, notification, device): a retried or
  -- redelivered request cannot produce a second push, a second job_match, or a
  -- duplicate email. Enforced by the unique index below, not by application
  -- convention.
  dedupe_key        text         NOT NULL,

  -- queued | accepted_by_fcm | invalid_token | error
  status            text         NOT NULL DEFAULT 'queued',
  attempt_count     integer      NOT NULL DEFAULT 0,
  last_attempt_at   timestamp(3),
  next_attempt_at   timestamp(3),

  -- Provider acknowledgement. Presence proves acceptance, NOT device delivery.
  fcm_message_name  text,

  -- Sanitized provider code only (e.g. 'messaging/registration-token-not-registered').
  -- Never the payload, never the token, never a raw provider response.
  error_code        text,

  created_at        timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- The idempotency guarantee.
CREATE UNIQUE INDEX IF NOT EXISTS fcm_outbox_dedupe_uidx
  ON fcm_outbox (dedupe_key);

-- Retry sweep: "what is due to be retried now".
CREATE INDEX IF NOT EXISTS fcm_outbox_retry_idx
  ON fcm_outbox (status, next_attempt_at);

-- "Show me every send attempt for this notification" -- the query that was
-- impossible during the investigation.
CREATE INDEX IF NOT EXISTS fcm_outbox_notification_idx
  ON fcm_outbox (notification_id);

CREATE INDEX IF NOT EXISTS fcm_outbox_user_created_idx
  ON fcm_outbox (user_id, created_at);

COMMIT;
