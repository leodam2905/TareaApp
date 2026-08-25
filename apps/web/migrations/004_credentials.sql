-- 004 · Licence and insurance as separate, renewable credentials
--
-- EXPAND-ONLY: eleven nullable/defaulted columns on an existing table. Safe to
-- run while the current code is live — old code never selects them, and the new
-- code treats 'none' as "nothing submitted".
--
-- WHY THESE EXIST. Both badges were previously driven by the presence of an
-- uploaded file: `licenseDocUrl != null && insuranceDocUrl != null`. Uploading
-- any PDF lit up "Licensed" AND "Insured", an insured pro with no licence
-- showed neither, and — the part that matters legally — that same expression
-- gated who could take work at or over the CSLB $1,000 cap. A pro who uploaded
-- a shopping list could take jobs the law reserves for licensed contractors.
--
-- Each credential now carries its own decision and its own expiry, because a
-- current licence and a lapsed insurance certificate are two different facts and
-- an admin must be able to accept one while bouncing the other.
--
-- Status is `none | pending | approved | rejected`. `expired` is NOT stored:
-- lib/credentials.ts derives it at query time from expiresAt, so a lapsed
-- document stops counting the moment it lapses — no cron, nothing to keep in
-- sync, and no window where a badge outlives the paper behind it.
--
-- verificationStatus on the same table is untouched. That is the IDENTITY
-- decision and is deliberately not reused for credentials.

BEGIN;

ALTER TABLE "handyman_profiles" ADD COLUMN IF NOT EXISTS "licenseIssuer"         TEXT;
ALTER TABLE "handyman_profiles" ADD COLUMN IF NOT EXISTS "licenseStatus"         TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "handyman_profiles" ADD COLUMN IF NOT EXISTS "licenseExpiresAt"      TIMESTAMP(3);
ALTER TABLE "handyman_profiles" ADD COLUMN IF NOT EXISTS "licenseReviewedAt"     TIMESTAMP(3);
ALTER TABLE "handyman_profiles" ADD COLUMN IF NOT EXISTS "licenseReviewNote"     TEXT;

ALTER TABLE "handyman_profiles" ADD COLUMN IF NOT EXISTS "insuranceProvider"     TEXT;
ALTER TABLE "handyman_profiles" ADD COLUMN IF NOT EXISTS "insurancePolicyNumber" TEXT;
ALTER TABLE "handyman_profiles" ADD COLUMN IF NOT EXISTS "insuranceStatus"       TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "handyman_profiles" ADD COLUMN IF NOT EXISTS "insuranceExpiresAt"    TIMESTAMP(3);
ALTER TABLE "handyman_profiles" ADD COLUMN IF NOT EXISTS "insuranceReviewedAt"   TIMESTAMP(3);
ALTER TABLE "handyman_profiles" ADD COLUMN IF NOT EXISTS "insuranceReviewNote"   TEXT;

-- NO BACKFILL ON PURPOSE. Every existing pro starts at 'none', including those
-- who already uploaded a document. Backfilling them to 'approved' would grant
-- the exact badges this migration exists to stop granting automatically — an
-- admin has to look at each one. Pros with documents on file appear in the
-- admin queue as pending once they resubmit.

COMMIT;
