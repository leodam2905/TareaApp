-- 011 · Which version of the contractor agreement a pro actually signed
--
-- EXPAND-ONLY: one nullable column.
--
-- lib/ica-text.ts has carried AGREEMENT_VERSION and an editing rule saying to
-- bump it "so a re-acceptance can be required later and it is possible to tell
-- which text somebody signed". Neither was possible: only icaSignedAt and
-- icaSignedIp were stored, so the version identified the text on the SERVER
-- today and said nothing about the text on the pro's screen when they tapped
-- accept. Every bump silently rewrote what everyone had agreed to.
--
-- That matters for this bump in particular. The 2026-08-30 revision changes the
-- economics: the platform no longer takes 10% from the pro, the customer-side
-- fee is 25%, and the pro sets their own rate. A pro who signed 2026-08-17
-- agreed to different terms, and there has to be a record of which.
--
-- Existing rows stay NULL rather than being backfilled with a guess. NULL means
-- "signed before versions were recorded" -- which is the truth, and is more
-- useful than asserting a version nobody can evidence.

BEGIN;
ALTER TABLE "handyman_profiles" ADD COLUMN IF NOT EXISTS "icaSignedVersion" TEXT;
COMMIT;
