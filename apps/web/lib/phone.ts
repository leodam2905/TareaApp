/**
 * Normalize a phone number to E.164 (assumes US/NANP when no country code).
 *
 * Masked calling depends on this: the voice webhook identifies a caller by
 * matching the carrier-supplied `From` against the numbers stored on the proxy
 * session, and that comparison is exact. If one side is stored as
 * "(626) 659-2974" and Twilio reports "+16266592974", the bridge silently
 * refuses the call. Normalize on every write and every comparison.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}
