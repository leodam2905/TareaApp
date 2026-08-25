// Contractor licence checking.
//
// WHAT THIS CAN AND CANNOT DO, PLAINLY. The CSLB (California) publishes no
// official real-time API. Anything claiming to verify a Californian licence
// live is either scraping a page that will change under it, or lying. So this
// module does the checks that are genuinely automatable — shape, issuer,
// expiry, and whether somebody else already claimed the same number — and
// routes the rest to a human, which is what `licenseStatus: "pending"` and the
// admin credentials queue already exist for.
//
// If a paid verification provider is ever wired in, `LICENSE_LOOKUP_URL` is the
// seam: set it and lookupLicence() starts returning real registry data. Until
// then it returns `checked: false`, and no badge is ever lit on its word.

export type LicenceIssuer = "CSLB" | "OTHER";

export interface LicenceFormat {
  ok: boolean;
  normalized?: string;
  error?: string;
}

/**
 * CSLB licence numbers are 6-8 digits, no letters, no prefix. People type them
 * with spaces, dashes, or a leading "#" or "CA", so normalise before judging.
 */
export function normalizeLicenceNumber(raw: unknown, issuer: LicenceIssuer = "CSLB"): LicenceFormat {
  if (typeof raw !== "string") return { ok: false, error: "Licence number is required." };
  const cleaned = raw.trim().toUpperCase().replace(/^(CA|CSLB)?[\s#-]*/, "").replace(/[\s-]/g, "");
  if (!cleaned) return { ok: false, error: "Licence number is required." };

  if (issuer === "CSLB") {
    if (!/^\d{6,8}$/.test(cleaned)) {
      return { ok: false, error: "A CSLB licence number is 6 to 8 digits." };
    }
    return { ok: true, normalized: cleaned };
  }
  // Other states use their own formats; accept a conservative alphanumeric
  // range rather than inventing rules we cannot enforce.
  if (!/^[A-Z0-9]{4,20}$/.test(cleaned)) {
    return { ok: false, error: "Licence number looks invalid." };
  }
  return { ok: true, normalized: cleaned };
}

export interface LookupResult {
  /** False when no registry was consulted — the ONLY honest default today. */
  checked: boolean;
  status?: "active" | "inactive" | "expired" | "revoked" | "not_found";
  licensee?: string | null;
  expiresAt?: string | null;
  raw?: unknown;
  error?: string;
}

/**
 * Consults an external licence registry, if one is configured.
 *
 * Returns `checked: false` when it is not, so callers can tell "the registry
 * says this is fine" apart from "nobody asked a registry". Those must never
 * collapse into the same value: one is evidence, the other is an absence of it.
 */
export async function lookupLicence(number: string, issuer: LicenceIssuer): Promise<LookupResult> {
  const base = process.env.LICENSE_LOOKUP_URL;
  if (!base) return { checked: false };

  try {
    const url = `${base}${base.includes("?") ? "&" : "?"}number=${encodeURIComponent(number)}&issuer=${encodeURIComponent(issuer)}`;
    const res = await fetch(url, {
      headers: process.env.LICENSE_LOOKUP_KEY ? { Authorization: `Bearer ${process.env.LICENSE_LOOKUP_KEY}` } : {},
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { checked: false, error: `Registry returned ${res.status}` };
    const data = await res.json();
    return {
      checked: true,
      status: data.status,
      licensee: data.licensee ?? null,
      expiresAt: data.expiresAt ?? null,
      raw: data,
    };
  } catch (err) {
    // A registry that is down must not block onboarding — fall back to review.
    return { checked: false, error: (err as Error)?.message?.slice(0, 120) };
  }
}

/**
 * Public lookup URL for a licence, so a reviewer can check it in one click
 * instead of retyping a number into a search box — retyping is where digits get
 * transposed and the wrong contractor gets approved.
 *
 * Overridable because CSLB has changed this path before and a dead link in the
 * admin queue is worse than none: it looks like verification happened.
 */
export function licenceLookupUrl(number: string, issuer: LicenceIssuer): string | null {
  if (issuer !== "CSLB") return null;
  const base = process.env.CSLB_LOOKUP_PAGE
    ?? "https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/LicenseDetail.aspx";
  return `${base}?LicNum=${encodeURIComponent(number)}`;
}

/** How a claimed licensee name compares to the pro's own name. */
export type NameMatch = "match" | "partial" | "mismatch" | "unknown";

const normalizeName = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    // Business suffixes are noise: "Dah Plumbing LLC" and "Leonce Dah" are
    // routinely the same person, and a licence is often held in a trade name.
    .replace(/\b(llc|inc|corp|co|company|construction|plumbing|electric|electrical|services|service|and|&)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Compares the name on the licence with the pro's account name.
 *
 * Deliberately NOT a pass/fail gate. A licence legitimately sits in a spouse's
 * name, a trade name, or a maiden name, so a mismatch is a prompt for the
 * reviewer to ask — not an automatic rejection. It exists so the reviewer is
 * told where to look, which is more than they had before.
 */
export function compareLicenseeName(licenseeName: string | null | undefined, proName: string | null | undefined): NameMatch {
  if (!licenseeName?.trim() || !proName?.trim()) return "unknown";
  const a = normalizeName(licenseeName);
  const b = normalizeName(proName);
  if (!a || !b) return "unknown";
  if (a === b) return "match";
  // Arrays rather than Sets: this file is compiled against an ES5 target and
  // spreading a Set needs downlevelIteration.
  const at = a.split(" ").filter((w, i, arr) => w.length > 1 && arr.indexOf(w) === i);
  const bt = b.split(" ").filter((w, i, arr) => w.length > 1 && arr.indexOf(w) === i);
  const shared = at.filter((w) => bt.includes(w));
  // A shared surname is the common legitimate case; no shared token at all is
  // the one worth flagging.
  if (shared.length === 0) return "mismatch";
  return shared.length >= Math.min(at.length, bt.length) ? "match" : "partial";
}
