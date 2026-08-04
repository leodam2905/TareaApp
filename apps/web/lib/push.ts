import { sendFcm } from "./fcm";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Routes a push to the right provider based on the token shape:
// Expo tokens look like "ExponentPushToken[...]"; anything else is treated as
// an FCM registration token (used by the Flutter apps).
export async function sendPush(
  token: string | null | undefined,
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  if (!token) return;

  if (token.startsWith("ExponentPushToken")) {
    try {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ to: token, title, body, data: data ?? {}, sound: "default" }),
      });
    } catch (e) {
      console.error("[push]", e);
    }
    return;
  }

  // FCM: data values must be strings.
  const strData = data
    ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
    : undefined;
  await sendFcm(token, title, body, strData);
}
