import { prisma } from "@/lib/prisma";

// How long a proxy number stays bound to a booking. Long enough to cover the
// run-up to the appointment and the job itself; after this the number is freed.
const PROXY_TTL_MS = 1000 * 60 * 60 * 24; // 24h

/** Comma-separated pool of Telnyx numbers reserved for masked calls. */
export function proxyPool(): string[] {
  return (process.env.TELNYX_PROXY_NUMBERS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Pick a pool number not currently held by another ACTIVE session. */
async function assignProxyNumber(): Promise<string | null> {
  const pool = proxyPool();
  if (pool.length === 0) return null;

  const inUse = await prisma.proxySession.findMany({
    where: { status: "ACTIVE", proxyNumber: { in: pool }, expiresAt: { gt: new Date() } },
    select: { proxyNumber: true },
  });
  const taken = new Set(inUse.map((s) => s.proxyNumber));
  return pool.find((n) => !taken.has(n)) ?? null;
}

/**
 * Return the live proxy session for a booking, creating one if needed. Returns
 * null if either party lacks a phone number or the pool is exhausted.
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
  const customerPhone = booking?.customer.phone;
  const handymanPhone = booking?.handyman.phone;
  if (!customerPhone || !handymanPhone) return null;

  const proxyNumber = await assignProxyNumber();
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

/** Minimal XML escape for values interpolated into TeXML. */
export function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
