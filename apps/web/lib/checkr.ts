/**
 * Checkr — background screening for Pros.
 *
 * Hosted Flow, deliberately: Checkr owns the candidate experience, including the
 * FCRA standalone disclosure and written authorization. Those screens are the
 * part of screening that carries real legal exposure, and handing them to the
 * provider is the whole reason to pick hosted over self-hosted. We create a
 * candidate, open an invitation, and Checkr emails them a link.
 *
 * Replaces Certn. The onboarding page has told Pros "Tarea uses Checkr for all
 * background screenings" since before any Checkr code existed, so this also ends
 * a claim the backend did not support.
 */

const CHECKR_BASE = "https://api.checkr.com/v1";

/** Checkr authenticates with the API key as HTTP Basic username, empty password. */
function authHeader(): string {
  const key = process.env.CHECKR_API_KEY ?? "";
  return "Basic " + Buffer.from(`${key}:`).toString("base64");
}

async function checkr<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CHECKR_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    // Include the body: Checkr explains rejections (unsupported package, missing
    // node, bad email) in it, and a bare status sends you looking at the wrong
    // thing -- the same trap the Vertex fallback fell into.
    const body = await res.text().catch(() => "");
    throw new Error(`Checkr ${init?.method ?? "GET"} ${path} -> ${res.status} ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

export interface CheckrCandidate { id: string; email: string }
export interface CheckrInvitation { id: string; invitation_url: string; status: string }

/**
 * Create the candidate and invite them to complete screening.
 *
 * Two calls, not one: Checkr models the person (candidate) separately from the
 * request to screen them (invitation), and the candidate id is what every later
 * report and webhook refers to.
 */
export async function createCheckrInvitation(params: {
  email: string;
  firstName: string;
  lastName: string;
  /** Checkr package slug, e.g. "tasker_standard". Configured per account. */
  packageSlug?: string;
}): Promise<{ candidateId: string; invitationId: string; invitationUrl: string }> {
  const candidate = await checkr<CheckrCandidate>("/candidates", {
    method: "POST",
    body: JSON.stringify({
      email: params.email,
      first_name: params.firstName,
      last_name: params.lastName,
      // No SSN or DOB here on purpose -- in Hosted Flow the candidate gives those
      // to Checkr directly, so they never transit or rest on our servers.
      work_locations: [{ country: "US" }],
    }),
  });

  const pkg = params.packageSlug || process.env.CHECKR_PACKAGE || "tasker_standard";
  const invitation = await checkr<CheckrInvitation>("/invitations", {
    method: "POST",
    body: JSON.stringify({
      candidate_id: candidate.id,
      package: pkg,
      work_locations: [{ country: "US" }],
    }),
  });

  return {
    candidateId: candidate.id,
    invitationId: invitation.id,
    invitationUrl: invitation.invitation_url,
  };
}

/** Fetch a report, for reconciliation when a webhook is missed. */
export async function getCheckrReport(reportId: string) {
  return checkr<Record<string, unknown>>(`/reports/${reportId}`);
}

/** Fetch a candidate's reports, keyed by the id we store. */
export async function getCheckrCandidateReports(candidateId: string) {
  return checkr<{ data: Array<Record<string, unknown>> }>(`/reports?candidate_id=${encodeURIComponent(candidateId)}`);
}

/**
 * Map a Checkr report status to ours.
 *
 * Checkr separates `status` (is the report finished) from `result` (what it
 * found), and conflating them is how someone gets marked PASSED on a report that
 * merely finished. `clear` is the only result that passes; `consider` means a
 * human must look, which for us is not a pass.
 *
 * ⚠️ `consider` is NOT an adverse action. Under the FCRA, declining a Pro on the
 * strength of a report requires pre-adverse notice, a copy of the report, and a
 * waiting period before the final notice. FAILED here means "do not treat as
 * cleared", not "reject them" -- see the note in the webhook route.
 */
export function mapCheckrStatus(
  status: string,
  result?: string | null,
): "PASSED" | "FAILED" | "IN_PROGRESS" {
  if (status !== "complete") return "IN_PROGRESS";
  if (result === "clear") return "PASSED";
  if (result === "consider") return "FAILED";
  return "IN_PROGRESS";
}
