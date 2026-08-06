import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";
import { isAuthorizedCron } from "@/lib/cron-auth";

// One-off broadcast to the whole user base (e.g. announcing the store update).
// Protected by the CRON_SECRET bearer token. POST with { dryRun: true } first to
// confirm the recipient count without sending anything.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULTS = {
  pushTitle: "🚀 Big Tarea update!",
  pushBody: "We've rebuilt the app to be faster & smoother. Update now — you may need to sign in again.",
  emailSubject: "A brand-new Tarea is here — please update",
  emailTitle: "A brand-new Tarea is here",
  emailBody:
    "We've rebuilt Tarea from the ground up for a faster, more reliable experience. " +
    "Please update to the latest version in the App Store or Google Play. " +
    "Note: after updating, you may need to sign in again. Thanks for being with us!",
};

export async function POST(req: NextRequest) {
  if (!isAuthorizedCron()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const channels = (b.channels as string) ?? "both"; // "push" | "email" | "both"
  const dryRun = b.dryRun === true;
  const msg = {
    pushTitle: (b.pushTitle as string) ?? DEFAULTS.pushTitle,
    pushBody: (b.pushBody as string) ?? DEFAULTS.pushBody,
    emailSubject: (b.emailSubject as string) ?? DEFAULTS.emailSubject,
    emailTitle: (b.emailTitle as string) ?? DEFAULTS.emailTitle,
    emailBody: (b.emailBody as string) ?? DEFAULTS.emailBody,
  };

  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, email: true },
  });

  if (dryRun) {
    return NextResponse.json({ dryRun: true, recipients: users.length, channels, message: msg });
  }

  const cta = { label: "Update Tarea", url: process.env.NEXT_PUBLIC_APP_URL ?? "https://taptarea.com" };
  let pushAttempts = 0;
  let emailAttempts = 0;
  const CONCURRENCY = 20;

  for (let i = 0; i < users.length; i += CONCURRENCY) {
    const batch = users.slice(i, i + CONCURRENCY);
    await Promise.allSettled(
      batch.flatMap((u) => {
        const jobs: Promise<unknown>[] = [];
        if (channels !== "email") {
          pushAttempts++;
          jobs.push(
            sendPushToUser(u.id, msg.pushTitle, msg.pushBody, { type: "announcement" }).catch(() => {})
          );
        }
        if (channels !== "push" && u.email) {
          emailAttempts++;
          jobs.push(sendEmail(u.email, msg.emailSubject, msg.emailTitle, msg.emailBody, cta).catch(() => {}));
        }
        return jobs;
      })
    );
  }

  return NextResponse.json({ recipients: users.length, pushAttempts, emailAttempts, channels });
}
