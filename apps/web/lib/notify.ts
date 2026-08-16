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
// Deliberately NOT included: `payout` (platform to pro, not an interaction
// with a customer) and `booking_reminder` (system-generated, and a reminder
// that arrives as a text at an awkward hour reads as spam rather than help).
const SMS_TYPES = new Set([
  "booking_request",      // customer books -> pro
  "booking_accepted",     // pro accepts -> customer
  "booking_cancelled",    // either party cancels -> the other
  "booking_completed",    // pro marks done -> customer
  "job_application",      // pro applies -> customer
  "application_accepted", // customer selects a pro -> pro
  "message",              // chat, either direction
  "review",               // customer reviews -> pro
]);

/// SMS has no buttons, so a text without a link is a dead end — the recipient
/// knows something happened and has no way to act on it. It also bills per
/// 160-character segment, so the body is trimmed to keep the common case to
/// one segment rather than silently costing three.
function smsBody(title: string, body: string, url: string): string {
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
