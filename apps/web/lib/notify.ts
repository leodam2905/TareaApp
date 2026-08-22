import { prisma } from "./prisma";
import { notifyUser } from "@/app/api/sse/route";
import { sendEmail } from "./email";
import { sendPushToUser } from "./push";
import { sendSms } from "./sms";

interface NotifyInput {
  userId: string;
  title: string;
  body: string;
  type: string;
  refId?: string;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Every event where one party does something the other needs to know about.
//
// SMS is here because it is the only channel that does not depend on the app
// being installed, foregrounded, or on push working — the failure mode that
// had pros never learning a job existed. Push and email stay primary; this is
// the floor under them.
//
// NB the codebase reuses a small set of generic types for many distinct
// events, so this list reads shorter than the coverage it gives. What each one
// actually carries today:
//
//   booking_request   — a customer books, AND a pro applies to a job
//   booking_accepted  — a pro is hired, AND "I'm on my way" (bookings/[id]/location)
//   booking_cancelled — either party cancels
//   job_completed     — the pro marks the work done
//
// Types like `job_application`, `application_accepted`, `booking_completed`,
// `message` and `review` appear in ctaForType but are never emitted by any
// call site — listing them here would look like coverage while doing nothing.
//
// Deliberately NOT included: `payout` (platform to pro, not an interaction
// with a customer), `booking_reminder` (system-generated; a text at an awkward
// hour reads as spam), and chat, which creates no notification at all and
// stays inside the app once a customer has hired a pro.
const SMS_TYPES = new Set([
  "booking_request",
  "booking_accepted",
  // Was sent as booking_accepted until it got its own type; without this line
  // splitting the type would have silently dropped the "on the way" SMS.
  "handyman_on_way",
  "booking_cancelled",
  "job_completed",
]);

/// SMS has no buttons, so a text without a link is a dead end — the recipient
/// knows something happened and has no way to act on it. It also bills per
/// 160-character segment, so the body is trimmed to keep the common case to
/// one segment rather than silently costing three.
export function smsBody(title: string, body: string, url: string): string {
  const tail = ` ${url}`;
  const room = 160 - "Tarea: ".length - tail.length;
  let text = `${title} — ${body}`.replace(/\s+/g, " ").trim();
  if (text.length > room) text = `${text.slice(0, Math.max(0, room - 1)).trimEnd()}…`;
  return `Tarea: ${text}${tail}`;
}

function ctaForType(type: string, refId?: string) {
  const urls: Record<string, string> = {
    booking_request:      `${APP_URL}/handyman/jobs`,
    booking_accepted:     `${APP_URL}/customer/bookings`,
    handyman_on_way:      refId ? `${APP_URL}/customer/bookings/${refId}` : `${APP_URL}/customer/bookings`,
    booking_cancelled:    `${APP_URL}/customer/bookings`,
    booking_completed:    refId ? `${APP_URL}/customer/bookings/${refId}/review` : `${APP_URL}/customer/bookings`,
    job_application:      `${APP_URL}/customer/requests`,
    application_accepted: `${APP_URL}/handyman/jobs`,
    review:               `${APP_URL}/handyman/profile`,
    message:              refId ? `${APP_URL}/chat/${refId}` : APP_URL,
    payout:               `${APP_URL}/handyman/earnings`,
  };
  const labels: Record<string, string> = {
    booking_request:      "View Job",
    booking_accepted:     "View Booking",
    handyman_on_way:      "Track Handyman",
    booking_cancelled:    "View Bookings",
    booking_completed:    "Leave a Review",
    job_application:      "Review Applications",
    application_accepted: "View My Jobs",
    review:               "View Profile",
    message:              "Open Chat",
    payout:               "View Earnings",
  };
  return { url: urls[type] ?? APP_URL, label: labels[type] ?? "Open Tarea" };
}

export async function createNotification(data: NotifyInput) {
  const [n, user] = await Promise.all([
    prisma.notification.create({ data }),
    prisma.user.findUnique({
      where: { id: data.userId },
      select: { email: true, phone: true, expoPushToken: true, fcmToken: true, notifBookingUpdates: true, notifReminders: true, notifMessages: true, notifSms: true },
    }),
  ]);

  // SSE — real-time in-browser (always deliver)
  notifyUser(data.userId, { type: "notification", data: n });

  if (user) {
    const isMessage = data.type === "message";
    const isReminder = data.type === "booking_reminder";
    const isBookingUpdate = !isMessage && !isReminder;

    const wantsIt =
      (isMessage && user.notifMessages) ||
      (isReminder && user.notifReminders) ||
      (isBookingUpdate && user.notifBookingUpdates);

    if (wantsIt) {
      const cta = ctaForType(data.type, data.refId ?? undefined);
      sendEmail(user.email, data.title, data.title, data.body, cta).catch(() => {});
      // Push to every device the user has registered (prunes dead tokens).
      sendPushToUser(data.userId, data.title, data.body, {
        type: data.type,
        refId: data.refId ?? null,
      }).catch(() => {});
      if (user.notifSms && user.phone && SMS_TYPES.has(data.type)) {
        sendSms(user.phone, smsBody(data.title, data.body, cta.url)).catch(() => {});
      }
    }
  }

  return n;
}
