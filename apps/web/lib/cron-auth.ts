import { headers } from "next/headers";
import crypto from "crypto";

/**
 * Authorizes a cron request via the Authorization: Bearer <CRON_SECRET> header.
 *
 * Fails CLOSED: if CRON_SECRET is not configured the request is rejected, so a
 * missing env var can never leave payout/cancellation endpoints publicly callable.
 * Uses a constant-time comparison to avoid leaking the secret via timing.
 */
export function isAuthorizedCron(): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = headers().get("authorization") ?? "";
  const expected = `Bearer ${cronSecret}`;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
