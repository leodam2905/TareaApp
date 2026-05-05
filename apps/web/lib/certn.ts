const CERTN_BASE = "https://api.certn.co/api/v1";

function certnHeaders() {
  return {
    "Authorization": `Bearer ${process.env.CERTN_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export interface CertnInvitation {
  id: string;
  application_url: string;
  status: string;
}

/**
 * Create a Certn background check invitation.
 * Certn emails the applicant a link to submit their personal info.
 */
export async function createCertnInvitation(params: {
  email: string;
  firstName: string;
  lastName: string;
}): Promise<CertnInvitation> {
  const res = await fetch(`${CERTN_BASE}/invitations/`, {
    method: "POST",
    headers: certnHeaders(),
    body: JSON.stringify({
      email: params.email,
      first_name: params.firstName,
      last_name: params.lastName,
      send_email: true,
      // Criminal record check (US)
      request_us_criminal: true,
      request_criminal: true,
      // Identity verification
      request_enhanced_identity_verification: false,
      // SSN trace
      request_ssn: true,
      // Sex offender registry
      request_sex_offender: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Certn API error ${res.status}: ${err}`);
  }

  return res.json();
}

/**
 * Fetch a Certn application by ID.
 */
export async function getCertnApplication(applicationId: string) {
  const res = await fetch(`${CERTN_BASE}/applications/${applicationId}/`, {
    headers: certnHeaders(),
  });
  if (!res.ok) throw new Error(`Certn fetch error ${res.status}`);
  return res.json();
}

/**
 * Map Certn result status → our BackgroundCheckStatus.
 * Certn statuses: "clear" | "consider" | "dispute" | "pending"
 */
export function mapCertnStatus(certnStatus: string): "PASSED" | "FAILED" | "IN_PROGRESS" {
  if (certnStatus === "clear") return "PASSED";
  if (certnStatus === "consider" || certnStatus === "dispute") return "FAILED";
  return "IN_PROGRESS";
}
