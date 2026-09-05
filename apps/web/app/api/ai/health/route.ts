import { NextRequest, NextResponse } from "next/server";
import { geminiSelfTest } from "@/lib/ai-fallback";

export const dynamic = "force-dynamic";

/**
 * Is the AI fallback actually usable?
 *
 * Gated by CRON_SECRET rather than a session: this is an operational probe, and
 * it costs a (tiny) Vertex call per request, so it should not be open to the
 * internet. Same secret the broadcast endpoint uses.
 *
 * Exists because the fallback is dormant until Anthropic fails, and something
 * that only runs during an incident is something you find broken during an
 * incident.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || given !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await geminiSelfTest();
  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
