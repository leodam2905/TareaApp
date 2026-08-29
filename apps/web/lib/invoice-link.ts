// Signed links for emailed invoices.
//
// The invoice email carried a plain link into /customer/..., which middleware
// guards — so a customer who lives in the app clicked "View Full Invoice" and
// hit a login wall for a website account they had never used. An invoice is a
// receipt for money they already paid; asking them to authenticate to read it
// is friction with no security purpose the link itself cannot serve.
//
// So the email link carries an HMAC over the booking id. It grants read access
// to ONE invoice, nothing else, and expires — a receipt does not need to be
// readable for ever, and a forwarded email should not be a permanent key.
import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error("JWT_SECRET environment variable is not set");

/** How long an emailed invoice link stays valid. */
const TTL_DAYS = 180;

const sign = (bookingId: string, expiry: number) =>
  createHmac("sha256", SECRET!).update(`${bookingId}.${expiry}`).digest("base64url");

/** Token to append as ?t= on an invoice URL. */
export function invoiceToken(bookingId: string): string {
  const expiry = Math.floor(Date.now() / 1000) + TTL_DAYS * 86400;
  return `${expiry}.${sign(bookingId, expiry)}`;
}

/**
 * True when the token really was issued for this booking and has not expired.
 *
 * Compared with timingSafeEqual rather than ===: string comparison returns as
 * soon as it finds a differing byte, which leaks how much of a guess was right.
 */
export function verifyInvoiceToken(bookingId: string, token: string | undefined): boolean {
  if (!token) return false;
  const [expiryStr, mac] = token.split(".");
  const expiry = Number(expiryStr);
  if (!expiry || !mac || Number.isNaN(expiry)) return false;
  if (expiry < Math.floor(Date.now() / 1000)) return false;

  const expected = Buffer.from(sign(bookingId, expiry));
  const given = Buffer.from(mac);
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}
