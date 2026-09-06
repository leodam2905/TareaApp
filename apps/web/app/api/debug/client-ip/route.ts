import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * What does the proxy chain actually look like from inside the container?
 *
 * Every rate limit keys on the client IP, and picking the wrong element of
 * X-Forwarded-For fails in one of two ways, both bad: take the first and it is
 * attacker-supplied, so every limit is bypassable; take the last and it is the
 * load balancer, identical for everyone, so all users share one bucket and lock
 * each other out. The correct index depends on the ingress path
 * (taptarea.com -> global external LB -> Cloud Run), which is exactly the kind
 * of thing that is guessed wrong and then trusted.
 *
 * CRON_SECRET-gated: it reflects request headers, which is not something to
 * leave open. Kept rather than deleted because the answer changes if the
 * ingress ever changes, and re-deriving it is how the off-by-one gets made.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || given !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const xff = req.headers.get("x-forwarded-for") ?? "";
  const chain = xff.split(",").map((s) => s.trim()).filter(Boolean);

  return NextResponse.json({
    xForwardedFor: xff,
    chain,
    chainLength: chain.length,
    first: chain[0] ?? null,
    last: chain[chain.length - 1] ?? null,
    secondFromLast: chain[chain.length - 2] ?? null,
    xRealIp: req.headers.get("x-real-ip"),
    via: req.headers.get("via"),
  });
}
