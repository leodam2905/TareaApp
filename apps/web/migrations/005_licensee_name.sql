-- 005 · Name on the licence
--
-- EXPAND-ONLY: one nullable column.
--
-- WHY. CSLB licence numbers are PUBLIC RECORD. A pro can type a real
-- contractor's number, upload a plausible PDF, and an admin reviewing it has
-- nothing to compare against — we never captured who the licence belongs to.
-- A licence number on its own is not evidence; a number plus a matching name is.
--
-- This matters more than the badge: the same credential decides who may take
-- work at or over the CSLB $1,000 cap, so an impersonated licence is not a
-- cosmetic problem, it puts an unlicensed person on jobs the law reserves.
--
-- Insurance deliberately gets no equivalent: there is no registry to compare a
-- certificate against, and the ICA already places that duty on the pro.

BEGIN;
ALTER TABLE "handyman_profiles" ADD COLUMN IF NOT EXISTS "licenseeName" TEXT;
COMMIT;
