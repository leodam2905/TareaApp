-- 014 · Let a customer restrict a job to licensed & insured pros
--
-- EXPAND-ONLY: one column on job_requests, NOT NULL with a false default, so
-- every existing row keeps its current behaviour and the deploy can go either
-- side of this migration without a window where reads break.
--
-- Why a column rather than a client-side filter: the platform already reserves
-- roofing and HVAC for licensed pros, and it does it by excluding the job from
-- the fan-out entirely (see licenseAlwaysRequired in lib/credentials, and the
-- three gates in job-requests, apply, and bookings). A customer preference has
-- to bind at the same three points, or an unlicensed pro applies to a job that
-- was never meant for them and the refusal lands on the customer at hire time.
-- Filtering the list a customer sees would leave that hole open.
--
-- Two reasons, one gate. licenseAlwaysRequired(category) is the law's answer and
-- cannot be switched off; requiresLicensed is the customer's, and only ever
-- narrows. Neither widens the other: a customer cannot opt INTO an unlicensed
-- roofer, and a licence-only trade does not stop being one because the box was
-- left unticked.
--
-- Note what this does NOT do. It does not promise a licence is relevant to every
-- trade — a licensed cleaner is not a safer cleaner, and the UI only offers the
-- choice where licenseMatters(category) is true. It also does not guarantee
-- applicants: restricting a job in a market with no licensed supply is how a
-- request reaches nobody, which is why POST /job-requests counts eligible pros
-- and tells the customer up front rather than letting the job sit in silence.

ALTER TABLE job_requests
  ADD COLUMN IF NOT EXISTS "requiresLicensed" BOOLEAN NOT NULL DEFAULT false;

-- Partial index: the restricted jobs are the minority and are the only ones the
-- eligibility gate has to reason about separately.
CREATE INDEX IF NOT EXISTS job_requests_requires_licensed_idx
  ON job_requests ("requiresLicensed")
  WHERE "requiresLicensed" = true;
