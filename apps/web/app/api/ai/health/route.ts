import { NextRequest, NextResponse } from "next/server";
import { geminiSelfTest } from "@/lib/ai-fallback";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
// The metadata server is a nodejs-runtime facility; an edge runtime cannot
// reach it and the self test would report a failure that is not real.
export const runtime = "nodejs";

/**
 * Is the AI fallback actually usable?
 *
 * Gated by CRON_SECRET rather than a session: this is an operational probe and
 * it costs a small Vertex call per request, so it does not belong open to the
 * internet. Same secret the broadcast endpoint uses.
 *
 * Exists because the fallback is dormant until Anthropic fails, and something
 * that only runs during an incident is something you find broken during one.
 * It shipped broken once already: the metadata token path was wrong in two
 * separate ways and every check outside the container said it was fine.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || given !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await geminiSelfTest();

  // A red job in a console nobody opens is not an alert. Cloud Scheduler will
  // retry and record a 503, but it tells no one — so the check reports itself.
  //
  // Only on failure, and the daily schedule bounds this to one mail a day, so
  // no deduplication is needed. Admin addresses are read from the database:
  // @taptarea.com now forwards through ImprovMX to a reachable Gmail, so these
  // still arrive after the Workspace cancellation.
  if (!result.ok) {
    try {
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN", isActive: true },
        select: { email: true },
      });
      const detail = result.detail ?? "no detail";
      await Promise.allSettled(
        admins.map((a) =>
          sendEmail({
            to: a.email,
            subject: "Tarea: the AI fallback is not working",
            html:
              `<p><strong>The Claude → Gemini fallback cannot run.</strong></p>` +
              `<p>Nothing is broken for users right now — Claude still serves every AI route. ` +
              `But if Anthropic has an outage, Post a Job and Instant Quote will fail the way they ` +
              `did on 3 September, because the safety net is not there.</p>` +
              `<p><code>token: ${result.token}</code><br><code>model: ${result.model}</code><br>` +
              `<code>${detail.replace(/[<>]/g, "")}</code></p>` +
              `<p>Check with:<br><code>curl -H "Authorization: Bearer $CRON_SECRET" https://taptarea.com/api/ai/health</code></p>`,
          }),
        ),
      );
    } catch (err) {
      // Never let alerting mask the probe's own answer.
      console.error("[ai-health] alerting failed:", err);
    }
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 503 });
}
