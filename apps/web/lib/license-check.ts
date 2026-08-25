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
