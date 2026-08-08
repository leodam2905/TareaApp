import crypto from "crypto";

/**
 * Validate Twilio's `X-Twilio-Signature` on an inbound webhook.
 *
 * Twilio signs HMAC-SHA1 over the full request URL with every POST parameter
 * appended as `key + value`, sorted by key, then base64-encodes it.
 *
 * Two things bite here:
 *  - The secret is the account **Auth Token**, NOT the API Key secret used for
 *    REST calls. Signing with the API key silently fails every request.
 *  - The URL must match byte-for-byte what Twilio was configured to call.
 *    Behind Cloud Run the inbound request can present as http:// or carry an
 *    internal host, so callers must build the URL from the public base URL
 *    rather than from the raw request.
 */
export function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string | null,
  authToken: string
): boolean {
  if (!signature) return false;

  const payload = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);

  const expected = crypto
    .createHmac("sha1", authToken)
    .update(Buffer.from(payload, "utf-8"))
    .digest("base64");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
