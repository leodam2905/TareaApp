// Licence and insurance — the two credentials a pro renews.
//
// They were previously "verified" by the mere presence of a file URL, which
// meant uploading any PDF lit up the Licensed and Insured badges. Everything
// here exists to make those badges mean "an admin looked at this document and
// it has not expired".

export type CredentialKind = "license" | "insurance";

export const CREDENTIAL_KINDS: CredentialKind[] = ["license", "insurance"];

/** Stored decision. `expired` is never stored — it is derived, see below. */
export type StoredStatus = "none" | "pending" | "approved" | "rejected";
export type EffectiveStatus = StoredStatus | "expired";

export const STORED_STATUSES: StoredStatus[] = ["none", "pending", "approved", "rejected"];

/** The subset of HandymanProfile this module reads. */
export interface CredentialFields {
  licenseNumber: string | null;
  licenseeName: string | null;
  licenseDocUrl: string | null;
  licenseIssuer: string | null;
  licenseStatus: string;
  licenseExpiresAt: Date | null;
  licenseReviewedAt: Date | null;
  licenseReviewNote: string | null;
  insuranceDocUrl: string | null;
  insuranceProvider: string | null;
  insurancePolicyNumber: string | null;
  insuranceNamedInsured: string | null;
  insurancePerOccurrence: number | null;
  insuranceAggregate: number | null;
  insuranceStatus: string;
  insuranceExpiresAt: Date | null;
  insuranceReviewedAt: Date | null;
  insuranceReviewNote: string | null;
}

/** What a client gets back for one credential. */
export interface CredentialView {
  kind: CredentialKind;
  status: EffectiveStatus;
  docUrl: string | null;
  expiresAt: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  /** Drives the badge. True only when approved AND not past its expiry. */
  valid: boolean;
  /** Approved, unexpired, but inside the renewal window — nudge the pro. */
  expiringSoon: boolean;
  daysUntilExpiry: number | null;
  // Licence only.
  number?: string | null;
  /** Name as printed on the licence — what a reviewer matches against. */
  licenseeName?: string | null;
  // Insurance only.
  namedInsured?: string | null;
  perOccurrence?: number | null;
  aggregate?: number | null;
  /** False when a stated limit is below the ICA minimum. Null when unstated. */
  meetsMinimums?: boolean | null;
  issuer?: string | null;
  // Insurance only.
  provider?: string | null;
  policyNumber?: string | null;
}

/** Select clause so callers pull exactly these columns and nothing else. */
export const CREDENTIAL_SELECT = {
  licenseNumber: true,
  licenseeName: true,
  licenseDocUrl: true,
  licenseIssuer: true,
  licenseStatus: true,
  licenseExpiresAt: true,
  licenseReviewedAt: true,
  licenseReviewNote: true,
  insuranceDocUrl: true,
  insuranceProvider: true,
  insurancePolicyNumber: true,
  insuranceNamedInsured: true,
  insurancePerOccurrence: true,
  insuranceAggregate: true,
  insuranceStatus: true,
  insuranceExpiresAt: true,
  insuranceReviewedAt: true,
  insuranceReviewNote: true,
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

/** A pro is warned this many days before a credential lapses. */
export const EXPIRY_WARNING_DAYS = 30;

// Straight from the ICA: "General Liability Insurance (minimum $1,000,000 per
// occurrence / $2,000,000 aggregate)". Kept here so the number the contract
// promises and the number the code enforces cannot drift apart.
export const MIN_PER_OCCURRENCE = 1_000_000;
export const MIN_AGGREGATE = 2_000_000;

/**
 * Whether stated limits clear the ICA minimums.
 *
 * Null when either limit is unstated — "nobody typed it in" is not the same as
 * "the policy is too small", and collapsing them would either block honest pros
 * or wave through unknown ones.
 */
export function meetsInsuranceMinimums(perOccurrence: number | null, aggregate: number | null): boolean | null {
  if (perOccurrence == null || aggregate == null) return null;
  return perOccurrence >= MIN_PER_OCCURRENCE && aggregate >= MIN_AGGREGATE;
}

/**
 * An approved document whose expiry has passed is `expired`, not `approved`.
 *
 * Deriving this instead of storing it is deliberate: a stored flag needs a job
 * to flip it, and between the lapse and the job running the pro would still be
 * showing a badge for a credential that had already run out.
 */
export function effectiveStatus(stored: string, expiresAt: Date | null, now: Date = new Date()): EffectiveStatus {
  const status = (STORED_STATUSES as string[]).includes(stored) ? (stored as StoredStatus) : "none";
  if (status === "approved" && expiresAt && expiresAt.getTime() <= now.getTime()) return "expired";
  return status;
}

function daysUntil(expiresAt: Date | null, now: Date): number | null {
  if (!expiresAt) return null;
  return Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS);
}

function view(
  kind: CredentialKind,
  stored: string,
  docUrl: string | null,
  expiresAt: Date | null,
  reviewedAt: Date | null,
  reviewNote: string | null,
  extra: Partial<CredentialView>,
  now: Date,
): CredentialView {
  const status = effectiveStatus(stored, expiresAt, now);
  const days = daysUntil(expiresAt, now);
  return {
    kind,
    status,
    docUrl,
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    reviewedAt: reviewedAt ? reviewedAt.toISOString() : null,
    // A note only ever explains a rejection. Leaving a stale one on an
    // approved document would show the pro why their last attempt failed
    // next to a green tick.
    reviewNote: status === "rejected" ? reviewNote : null,
    valid: status === "approved",
    expiringSoon: status === "approved" && days !== null && days <= EXPIRY_WARNING_DAYS,
    daysUntilExpiry: days,
    ...extra,
  };
}

/** Both credentials, as the clients and the admin queue read them. */
export function credentialViews(p: CredentialFields, now: Date = new Date()): {
  license: CredentialView;
  insurance: CredentialView;
} {
  return {
    license: view("license", p.licenseStatus, p.licenseDocUrl, p.licenseExpiresAt, p.licenseReviewedAt, p.licenseReviewNote, {
      number: p.licenseNumber,
      licenseeName: p.licenseeName,
      issuer: p.licenseIssuer,
    }, now),
    insurance: view("insurance", p.insuranceStatus, p.insuranceDocUrl, p.insuranceExpiresAt, p.insuranceReviewedAt, p.insuranceReviewNote, {
      provider: p.insuranceProvider,
      policyNumber: p.insurancePolicyNumber,
      namedInsured: p.insuranceNamedInsured,
      perOccurrence: p.insurancePerOccurrence,
      aggregate: p.insuranceAggregate,
      meetsMinimums: meetsInsuranceMinimums(p.insurancePerOccurrence, p.insuranceAggregate),
    }, now),
  };
}

/**
 * The two badges, now independent of each other.
 *
 * `pro_profile.dart` used to drive BOTH from `licenseDocUrl != null &&
 * insuranceDocUrl != null`, so an insured pro with no licence showed neither,
 * and any uploaded file showed both.
 */
export function credentialBadges(p: CredentialFields, now: Date = new Date()): { licensed: boolean; insured: boolean } {
  const c = credentialViews(p, now);
  return { licensed: c.license.valid, insured: c.insurance.valid };
}

/**
 * Parse a client-supplied expiry date.
 *
 * Three outcomes have to stay distinct — "not sent" (leave the stored value
 * alone), "sent as empty" (clear it), and "sent as garbage" (reject the whole
 * request). Collapsing the last two would silently wipe a real expiry date
 * because someone posted `expiresAt: "next tuesday"`.
 */
export type ExpiryParse =
  | { ok: true; absent: true }
  | { ok: true; absent: false; value: Date | null }
  | { ok: false; error: string };

export function parseExpiry(input: unknown): ExpiryParse {
  if (input === undefined) return { ok: true, absent: true };
  if (input === null || input === "") return { ok: true, absent: false, value: null };
  const d = new Date(String(input));
  if (Number.isNaN(d.getTime())) return { ok: false, error: "expiresAt is not a valid date" };
  return { ok: true, absent: false, value: d };
}
