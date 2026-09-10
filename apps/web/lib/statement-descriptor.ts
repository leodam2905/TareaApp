/**
 * What the customer sees on their card statement.
 *
 * "I don't recognise this charge" is the single most common chargeback reason,
 * and home services are unusually exposed to it: the charge can post days after
 * the customer last thought about the booking, and the person they actually
 * dealt with was an individual pro, not a company called Tarea.
 *
 * Tarea is merchant of record, so the static part of the descriptor is the
 * PLATFORM's, set once in the Stripe Dashboard (Settings -> Business ->
 * Public details). This module supplies only the dynamic suffix, which Stripe
 * appends to that prefix. Suffix rather than a full `statement_descriptor`
 * deliberately: on current API versions card charges reject a full override
 * unless the account is specially configured, whereas a suffix always works.
 *
 * Stripe's constraints: prefix + suffix <= 22 characters, latin only, must
 * contain at least one letter, and none of < > \ ' " *
 */

const FORBIDDEN = /[<>\\'"*]/g;

/** Longest suffix that still fits beside a short prefix such as "TAPTAREA ". */
const MAX = 12;

export function descriptorSuffix(label: string): string {
  const cleaned = label
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "") // drop accents/emoji rather than mangling them
    .replace(FORBIDDEN, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, MAX)
    .trim();

  // A suffix of only digits or punctuation is rejected by Stripe, and an empty
  // one would silently drop the descriptor. Both fall back to something valid.
  return /[A-Z]/.test(cleaned) ? cleaned : "SERVICE";
}

/**
 * Fixed suffixes per charge type. Deliberately not the service title: those are
 * user-authored, vary in length and language, and a descriptor that changes
 * shape between charges is harder to recognise, not easier. What a customer
 * needs is "this is Tarea, and this is what kind of charge it was".
 */
export const DESCRIPTOR = {
  booking: descriptorSuffix("JOB"),
  hold: descriptorSuffix("JOB HOLD"),
  tip: descriptorSuffix("TIP"),
  extension: descriptorSuffix("EXTRA TIME"),
  materials: descriptorSuffix("MATERIALS"),
  backgroundCheck: descriptorSuffix("BG CHECK"),
} as const;
