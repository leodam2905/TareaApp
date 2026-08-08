import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";

// How long a proxy number stays bound to a booking. Long enough to cover the
// run-up to the appointment and the job itself; after this the number is freed.
// Sessions are also released explicitly when a booking completes or cancels.
const PROXY_TTL_MS = 1000 * 60 * 60 * 24; // 24h

/** Comma-separated pool of Twilio numbers reserved for masked calls. */
export function proxyPool(): string[] {
  return (process.env.TWILIO_PROXY_NUMBERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Pick a pool number that can unambiguously serve these two parties.
 *
 * A single proxy number can host many concurrent sessions — the voice webhook
 * routes by matching the caller's number against the session. The only hard
 * requirement is that neither of *these* two phones is already bound to the
 * candidate number, otherwise an inbound call from that phone could mean two
 * different counterparties and we'd have to guess.
 *
 * So the pool scales with how many jobs one person has open at once, not with
 * total concurrent bookings — a handful of numbers covers a large marketplace.
 * Among eligible numbers we take the least loaded, to spread call traffic.
 */
async function assignProxyNumber(
  customerPhone: string,
  handymanPhone: string
): Promise<string | null> {
  const pool = proxyPool();
  if (pool.length === 0) return null;

  const active = await prisma.proxySession.findMany({
    where: { status: "ACTIVE", proxyNumber: { in: pool }, expiresAt: { gt: new Date() } },
    select: { proxyNumber: true, customerPhone: true, handymanPhone: true },
  });

  const parties = new Set([customerPhone, handymanPhone]);
  const blocked = new Set<string>();
  const load = new Map<string, number>();

  for (const s of active) {
    load.set(s.proxyNumber, (load.get(s.proxyNumber) ?? 0) + 1);
    if (parties.has(s.customerPhone) || parties.has(s.handymanPhone)) {
      blocked.add(s.proxyNumber);
    }
  }

  const eligible = pool.filter((n) => !blocked.has(n));
  if (eligible.length === 0) return null;

  return eligible.reduce((best, n) =>
    (load.get(n) ?? 0) < (load.get(best) ?? 0) ? n : best
  );
}

/**
 * Whether a masked call channel can be opened for a booking. Drives whether the
 * apps show a Call button at all — if the pool is unprovisioned we hide it
 * rather than let someone tap into an error, and we never fall back to exposing
 * the raw number.
 */
export function canCall(
  status: string,
  customerPhone?: string | null,
  handymanPhone?: string | null
): boolean {
  if (status === "COMPLETED" || status === "CANCELLED") return false;
  return !!customerPhone && !!handymanPhone && proxyPool().length > 0;
}

/**
 * Return the live proxy session for a booking, creating one if needed. Returns
 * null if either party lacks a phone number or no pool number can serve them.
 */
export async function getOrCreateProxySession(bookingId: string) {
  const existing = await prisma.proxySession.findFirst({
    where: { bookingId, status: "ACTIVE", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { customer: { select: { phone: true } }, handyman: { select: { phone: true } } },
  });
  if (!booking?.customer.phone || !booking.handyman.phone) return null;

  // Store E.164 — the webhook compares these against Twilio's `From` verbatim.
  const customerPhone = normalizePhone(booking.customer.phone);
  const handymanPhone = normalizePhone(booking.handyman.phone);

  // Both sides dialing the same number would make routing ambiguous.
  if (customerPhone === handymanPhone) return null;

  const proxyNumber = await assignProxyNumber(customerPhone, handymanPhone);
  if (!proxyNumber) return null;

  return prisma.proxySession.create({
    data: {
      bookingId,
      proxyNumber,
      customerPhone,
      handymanPhone,
      expiresAt: new Date(Date.now() + PROXY_TTL_MS),
    },
  });
}

/** Free a proxy number back to the pool (e.g. when a booking completes). */
export async function releaseProxySessions(bookingId: string): Promise<void> {
  await prisma.proxySession.updateMany({
    where: { bookingId, status: "ACTIVE" },
    data: { status: "RELEASED", releasedAt: new Date() },
  });
}

/** Minimal XML escape for values interpolated into TwiML. */
export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
