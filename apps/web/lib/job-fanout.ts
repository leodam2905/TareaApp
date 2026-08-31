// Telling pros a job exists.
//
// Lifted out of POST /api/job-requests so it can run twice: once when a customer
// posts, and again when an admin repairs a DRAFT job's address and publishes it.
// A job that becomes visible without this having run is in every pro's Find Jobs
// list and in nobody's notifications — which is the same invisible-job failure
// the comments below keep describing, arrived at from the other direction.

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";
import { sendSms } from "@/lib/sms";
import { smsBody } from "@/lib/notify";

const DEFAULT_RADIUS_MILES = 50;
const MILES_TO_KM = 1.60934;

export const radiusKmFor = (miles?: number | null) =>
  (miles && miles > 0 ? miles : DEFAULT_RADIUS_MILES) * MILES_TO_KM;

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** The fields of a JobRequest this needs. Keeps callers from passing a whole row. */
export interface FanoutJob {
  id: string;
  category: string;
  title: string;
  description: string;
  city: string;
  urgency: string;
  budgetMin: number;
  budgetMax: number;
  latitude: number | null;
  longitude: number | null;
}

/** Notifies every eligible pro. Returns how many were reached. */
export async function notifyProsOfJob(job: FanoutJob): Promise<number> {
  // Who hears about a new job: every APPROVED pro who is ONLINE.
  //
  // A missing profile photo used to exclude a pro here. That is a display
  // concern — it belongs on the browse surface a customer sees, not on whether
  // somebody is told work exists. An approved, available pro silently not
  // hearing about a job is the same failure this whole path keeps producing.
  const handymen = await prisma.handymanProfile.findMany({
    where: {
      isAvailable: true,
      backgroundCheckStatus: "PASSED",
      // GENERAL is the AI's catch-all: anything it cannot place lands there.
      // Few pros register for it, so those jobs reached nobody at all — no
      // push, no SMS, and no row in Find Jobs, in complete silence. A GENERAL
      // job therefore goes to every otherwise-eligible pro; specific
      // categories still match exactly.
      ...(job.category === "GENERAL"
        ? {}
        : { services: { some: { category: job.category as never, isActive: true } } }),
    },
    include: {
      user: {
        select: {
          id: true, city: true, email: true, name: true, expoPushToken: true,
          fcmToken: true, latitude: true, longitude: true, phone: true, notifSms: true,
        },
      },
    },
  });

  // Match by distance (catches pros in nearby towns, not just an exact city-name
  // match). Fall back to notifying when coordinates are missing on either side.
  //
  // A pro is excluded only on positive evidence they're out of range. Missing
  // coordinates or a blank city are gaps in our own data, not a signal the pro
  // is far away — treating them as a mismatch meant an open job could notify
  // nobody at all while still appearing in every pro's Find Jobs list.
  const { latitude: jLat, longitude: jLng } = job;
  const nearby = handymen.filter((h) => {
    const u = h.user;
    if (jLat != null && jLng != null && u.latitude != null && u.longitude != null) {
      // The pro's own limit, not a global one.
      return haversine(jLat, jLng, u.latitude, u.longitude) <= radiusKmFor(h.serviceRadius);
    }
    // Without coordinates on both sides we genuinely cannot tell how far apart
    // these are, and a city name is not a proxy for distance. Under-notifying is
    // fatal for a marketplace; over-notifying is noise.
    return true;
  });

  if (nearby.length === 0) return 0;

  const isUrgent = job.urgency === "URGENT";
  const pushTitle = isUrgent ? "🚨 Urgent Job Near You" : "New Job Near You 🔧";

  await prisma.notification.createMany({
    data: nearby.map((h) => ({
      userId: h.user.id,
      title: isUrgent ? "🚨 Urgent Job Near You" : "New Job Near You",
      body: `${isUrgent ? "URGENT — " : ""}"${job.title}" posted in ${job.city}. Apply before it's taken!`,
      type: "booking_request",
      refId: job.id,
    })),
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://taptarea.com";
  const jobUrl = `${appUrl}/handyman/find-jobs`;
  const budgetStr =
    job.budgetMin || job.budgetMax
      ? `$${job.budgetMin.toFixed(0)}–$${job.budgetMax.toFixed(0)}`
      : "Open / flexible";
  const categoryLabel = job.category
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c: string) => c.toUpperCase());

  // Push and email run concurrently per pro rather than in sequence: the push
  // is the time-critical signal and shouldn't queue behind an email delivery.
  await Promise.allSettled(
    nearby.map(async (h) =>
      Promise.all([
        sendPushToUser(
          h.user.id,
          pushTitle,
          `${isUrgent ? "URGENT · " : ""}${job.title} in ${job.city} — Budget ${budgetStr}`,
          { type: "booking_request", screen: "FindJobs", jobId: job.id, urgent: isUrgent },
        ),

        // SMS. This fan-out does not go through createNotification, so the SMS
        // that every other pro/customer interaction gets has to be sent here
        // too — and this is the one that matters most, because a pro who never
        // learns a job exists cannot take it. Trimmed to one 160-character
        // segment: this fans out to every eligible pro, so an extra segment is
        // billed per pro per job, not once.
        h.user.notifSms && h.user.phone
          ? sendSms(
              h.user.phone,
              smsBody(
                `${isUrgent ? "URGENT " : ""}New ${categoryLabel} job in ${job.city}`,
                `${job.title} — Budget ${budgetStr}`,
                jobUrl,
              ),
            )
          : Promise.resolve(),

        sendEmail(
          h.user.email,
          `New ${categoryLabel} job near you — ${job.city}`,
          "New Job Opportunity Near You",
          `A customer just posted a <strong>${categoryLabel}</strong> job in <strong>${job.city}</strong>.<br><br>
        <strong>${job.title}</strong><br>
        Budget: ${budgetStr}<br><br>
        ${job.description.slice(0, 200)}${job.description.length > 200 ? "…" : ""}<br><br>
        Apply now before another Pro takes it!`,
          { label: "View Job & Apply", url: jobUrl },
        ),
      ]),
    ),
  );

  return nearby.length;
}
