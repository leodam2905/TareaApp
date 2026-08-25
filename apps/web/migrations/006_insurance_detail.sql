-- 006 · Insurance certificate detail
--
-- EXPAND-ONLY: three nullable columns.
--
-- A certificate of insurance is a one-page ACORD form that anybody can forward,
-- and its own boilerplate says it "is issued as a matter of information only
-- and confers no rights upon the certificate holder". A lapsed policy leaves a
-- PDF that looks identical to a live one. There is no registry to check it
-- against — insurers publish nothing — so verification is a human reading the
-- form and emailing the producer.
--
-- These three columns move the mechanical parts off that human:
--
--   insuranceNamedInsured   compared to the pro's own name (compareLicenseeName
--                           already handles trade names), because a borrowed
--                           COI is the insurance equivalent of a borrowed
--                           licence number.
--   insurancePerOccurrence  checked against the ICA minimum of $1,000,000.
--   insuranceAggregate      checked against the ICA minimum of $2,000,000.
--
-- Limits are whole dollars, not cents: ACORD states them as round figures and
-- storing cents would invite a $1,000,000.00 vs 100000000 confusion on a field
-- that gates whether a badge is shown.

BEGIN;
ALTER TABLE "handyman_profiles" ADD COLUMN IF NOT EXISTS "insuranceNamedInsured"  TEXT;
ALTER TABLE "handyman_profiles" ADD COLUMN IF NOT EXISTS "insurancePerOccurrence" INTEGER;
ALTER TABLE "handyman_profiles" ADD COLUMN IF NOT EXISTS "insuranceAggregate"     INTEGER;
COMMIT;
