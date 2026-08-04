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

// Send an FCM push to a single device token. Best-effort: never throws.
export async function sendFcm(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  try {
    await getMessaging(fbApp()).send({
      token,
      notification: { title, body },
      data: data ?? {},
      android: { priority: "high", notification: { sound: "default" } },
      apns: { payload: { aps: { sound: "default" } } },
    });
  } catch (e) {
    console.error("[fcm]", e);
  }
}
