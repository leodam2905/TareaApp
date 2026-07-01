export async function sendSms(to: string, body: string, opts?: { from?: string }): Promise<void> {
  const apiKey = process.env.TELNYX_API_KEY;
  // Prefer the Messaging Profile (handles the sender-number pool and ties traffic
  // to the approved 10DLC campaign) when configured; otherwise send from a specific
  // number. A per-call sender can still be passed via opts.from.
  const messagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID;
  const from = opts?.from || process.env.TELNYX_PHONE_NUMBER;

  if (!apiKey || (!from && !messagingProfileId)) {
    console.log(`[SMS to ${to}]: ${body}`);
    return;
  }

  // A specific sender (opts.from or TELNYX_PHONE_NUMBER) takes precedence; the
  // messaging profile is included so Telnyx can apply campaign/compliance routing.
  const payload: Record<string, string> = { to, text: body };
  if (from) payload.from = from;
  if (messagingProfileId) payload.messaging_profile_id = messagingProfileId;

  const res = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Telnyx SMS failed: ${JSON.stringify(err)}`);
  }
}
