// What goes on an invoice, in one place.
//
// Deliberately NOT in the admin_settings table. These print on a document a
// customer keeps and may hand to an accountant or a court, so they should be
// versioned, reviewable in a diff, and impossible to change by mistyping a form
// field at 2am. Env vars override for a staging deploy or an entity rename;
// nothing else edits them.
//
// (The admin Settings page reads none of this — it also does not drive the fee
// rate it displays, despite its own copy implying otherwise. See lib/fees.ts.)

/** The platform entity. It supplies the service fee, and nothing else. */
export const INVOICE_PLATFORM = {
  legalName: process.env.INVOICE_LEGAL_NAME ?? "Tarea US LLC",
  address:
    process.env.INVOICE_ADDRESS ?? "400 N Oakland Avenue, Apt 209, Pasadena, California 91101",
  site: process.env.INVOICE_SITE ?? "taptarea.com",
  supportEmail: process.env.INVOICE_SUPPORT_EMAIL ?? "support@taptarea.com",
} as const;

export const INVOICE_PREFIX = process.env.INVOICE_PREFIX ?? "INV";

/**
 * The invoice number for a booking.
 *
 * Derived from the booking id rather than a counter, and this was already true
 * in two places — InvoicePrint and /api/invoices each sliced the id themselves,
 * so a change to one silently disagreed with the other. One definition now.
 *
 * NOT SEQUENTIAL, and worth knowing before this is relied on: it is unique and
 * stable, but unordered and gapped. Some jurisdictions require a sequential,
 * gapless series per issuing entity. Moving to one means a counter and a
 * uniqueness constraint, and is a schema change rather than a formatting one.
 */
export const invoiceNumber = (bookingId: string) =>
  `${INVOICE_PREFIX}-${bookingId.slice(-8).toUpperCase()}`;

/** The pro's identity as it should be PRINTED, not as the account is named. */
export interface ProIdentity {
  /** Trading name: the company where there is one, else the person. */
  name: string;
  /** e.g. "CSLB C-36 #1234567" — omitted when unlicensed or unverified. */
  license: string | null;
  /** True when the licence names a different legal person than the account. */
  licenseeNote: string | null;
}

/**
 * Who performed the work, for the invoice header.
 *
 * `licenseeName` is printed rather than the account name whenever it differs:
 * it is the name AS IT APPEARS ON THE LICENCE, which is the only one that can
 * be checked against the CSLB register. An invoice naming "Dave" for work
 * performed under "D. Ramirez Plumbing Inc." is not verifiable by the customer.
 */
export function proIdentity(input: {
  name: string;
  accountType?: string | null;
  companyName?: string | null;
  licenseNumber?: string | null;
  licenseeName?: string | null;
  licenseIssuer?: string | null;
  licenseStatus?: string | null;
}): ProIdentity {
  const trading =
    input.accountType === "COMPANY" && input.companyName?.trim()
      ? input.companyName.trim()
      : input.name;

  // Only an APPROVED licence is printed. An uploaded-but-unreviewed document is
  // not a credential, and printing its number would launder it into one.
  const approved = input.licenseStatus === "approved" && input.licenseNumber?.trim();
  const license = approved
    ? [input.licenseIssuer?.trim() || "Licence", `#${input.licenseNumber!.trim()}`].join(" ")
    : null;

  const licensee = input.licenseeName?.trim();
  const licenseeNote =
    approved && licensee && licensee.toLowerCase() !== trading.toLowerCase()
      ? `Licensed to ${licensee}`
      : null;

  return { name: trading, license, licenseeNote };
}
