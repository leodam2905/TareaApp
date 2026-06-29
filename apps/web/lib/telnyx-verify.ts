import crypto from "crypto";

// Telnyx signs each webhook with Ed25519 over `${timestamp}|${rawBody}`. The
// public key (base64 raw 32-byte Ed25519 key) is provided in the Telnyx portal.
// Node's crypto needs the key wrapped in an SPKI/DER header to import it.
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export function verifyTelnyxSignature(
  rawBody: string,
  signatureB64: string | null,
  timestamp: string | null,
  publicKeyB64: string
): boolean {
  if (!signatureB64 || !timestamp) return false;
  try {
    const der = Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyB64, "base64")]);
    const key = crypto.createPublicKey({ key: der, format: "der", type: "spki" });
    const signed = Buffer.from(`${timestamp}|${rawBody}`);
    return crypto.verify(null, signed, key, Buffer.from(signatureB64, "base64"));
  } catch {
    return false;
  }
}
