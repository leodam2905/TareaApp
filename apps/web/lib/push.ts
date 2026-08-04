import { sendFcm, type PushResult } from "./fcm";
import { prisma } from "./prisma";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Routes a push to the right provider based on the token shape:
// Expo tokens look like "ExponentPushToken[...]"; anything else is treated as
// an FCM registration token (used by the Flutter apps). Returns a PushResult
// so callers can prune tokens that are permanently invalid.
export async function sendPush(
  token: string | null | undefined,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<PushResult> {
  if (!token) return "error";

  if (token.startsWith("ExponentPushToken")) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ to: token, title, body, data: data ?? {}, sound: "default" }),
      });
      const json = await res.json().catch(() => null);
      // Expo reports a dead token via DeviceNotRegistered.
      const err = json?.data?.details?.error ?? json?.errors?.[0]?.code;
      if (err === "DeviceNotRegistered") return "invalid";
      return "ok";
    } catch (e) {
      console.error("[push]", e);
      return "error";
    }
  }

  // FCM: data values must be strings.
  const strData = data
    ? Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]))
    : undefined;
  return sendFcm(token, title, body, strData);
}

// Send a push to EVERY device a user has registered (multi-device), then prune
// any tokens that come back permanently invalid. This is the reliable entry
// point — a user logged in on several devices gets the alert on all of them.
export async function sendPushToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  const [devices, user] = await Promise.all([
    prisma.deviceToken.findMany({ where: { userId }, select: { token: true } }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true, expoPushToken: true },
    }),
  ]);

  // Union of the device-token table and the legacy single columns (dedup), so
  // installs that haven't re-registered under the new table still get pushes.
  const seen = new Set<string>();
  const tokens: string[] = [];
  const add = (t?: string | null) => {
    if (t && !seen.has(t)) {
      seen.add(t);
      tokens.push(t);
    }
  };
  devices.forEach((d) => add(d.token));
  add(user?.fcmToken);
  add(user?.expoPushToken);
  if (tokens.length === 0) return;

  await Promise.all(
    tokens.map(async (token) => {
      const result = await sendPush(token, title, body, data);
      if (result === "invalid") {
        await Promise.all([
          prisma.deviceToken.deleteMany({ where: { token } }).catch(() => {}),
          prisma.user.updateMany({ where: { fcmToken: token }, data: { fcmToken: null } }).catch(() => {}),
          prisma.user.updateMany({ where: { expoPushToken: token }, data: { expoPushToken: null } }).catch(() => {}),
        ]);
      }
    })
  );
}
