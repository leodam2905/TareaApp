const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export async function sendPush(expoPushToken: string, title: string, body: string, data?: Record<string, unknown>) {
  if (!expoPushToken?.startsWith("ExponentPushToken")) return;
  try {
    await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ to: expoPushToken, title, body, data: data ?? {}, sound: "default" }),
    });
  } catch (e) {
    console.error("[push]", e);
  }
}
