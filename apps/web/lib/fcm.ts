import { App, initializeApp, applicationDefault, getApps, getApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

// Firebase Admin, initialized lazily with Application Default Credentials.
// On Cloud Run this is the runtime service account (no key file needed) since
// Firebase == the same GCP project.
let cached: App | null = null;

function fbApp(): App {
  if (cached) return cached;
  cached = getApps().length
    ? getApp()
    : initializeApp({
        credential: applicationDefault(),
        projectId:
          process.env.GOOGLE_CLOUD_PROJECT ||
          process.env.GCLOUD_PROJECT ||
          "splendid-drake-497611-h6",
      });
  return cached;
}

export type PushResult = "ok" | "invalid" | "error";

// Send an FCM push to a single device token. Best-effort: never throws.
// Returns "invalid" when the token is dead/unregistered so callers can prune it.
export async function sendFcm(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<PushResult> {
  // Incoming job requests get a dedicated channel + loud custom ringtone so a
  // pro notices them even from across the room. Everything else uses the
  // default notification tone. The Android channel ("tarea_jobs") and the iOS
  // sound file ("job_ring.caf") are pre-created/bundled by the Flutter app.
  const isJobRequest =
    data?.type === "booking_request" || data?.screen === "FindJobs";

  try {
    await getMessaging(fbApp()).send({
      token,
      notification: { title, body },
      data: data ?? {},
      android: {
        priority: "high",
        notification: isJobRequest
          ? { sound: "job_ring", channelId: "tarea_jobs_v2" }
          : { sound: "default" },
      },
      apns: {
        payload: {
          aps: { sound: isJobRequest ? "job_ring.caf" : "default" },
        },
      },
    });
    return "ok";
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code ?? "";
    if (
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/invalid-registration-token" ||
      code === "messaging/invalid-argument"
    ) {
      return "invalid";
    }
    console.error("[fcm]", e);
    return "error";
  }
}
