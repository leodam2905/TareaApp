import { prisma } from "./prisma";
import { notifyUser } from "@/app/api/sse/route";
import { sendEmail } from "./email";
import { sendPush } from "./push";
import { sendSms } from "./sms";

interface NotifyInput {
  userId: string;
  title: string;
  body: string;
  type: string;
  refId?: string;
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const SMS_TYPES = new Set(["booking_accepted", "booking_request", "booking_completed", "booking_cancelled"]);

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
      if (user.expoPushToken) {
        sendPush(user.expoPushToken, data.title, data.body, { type: data.type, refId: data.refId ?? null }).catch(() => {});
      }
      if (user.fcmToken) {
        sendPush(user.fcmToken, data.title, data.body, { type: data.type, refId: data.refId ?? null }).catch(() => {});
      }
      if (user.notifSms && user.phone && SMS_TYPES.has(data.type)) {
        sendSms(user.phone, `Tarea: ${data.title} — ${data.body}`).catch(() => {});
      }
    }
  }

  return n;
}
