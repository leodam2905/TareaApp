export async function sendSms(to: string, body: string, opts?: { from?: string }): Promise<void> {
  // Provider preference: Twilio (if configured) → Telnyx → console log.
  // Cutting over to Twilio is just a matter of populating its secrets; Telnyx
  // stays as an automatic fallback until it's removed.
  const twilioCreds =
    !!process.env.TWILIO_ACCOUNT_SID &&
    !!((process.env.TWILIO_API_KEY_SID && process.env.TWILIO_API_KEY_SECRET) || process.env.TWILIO_AUTH_TOKEN);
  const twilioSender =
    !!(process.env.TWILIO_MESSAGING_SERVICE_SID || process.env.TWILIO_PHONE_NUMBER || opts?.from);

  if (twilioCreds && twilioSender) return sendViaTwilio(to, body, opts);

  const hasTelnyx =
    !!process.env.TELNYX_API_KEY &&
    !!(process.env.TELNYX_MESSAGING_PROFILE_ID || process.env.TELNYX_PHONE_NUMBER || opts?.from);

  if (hasTelnyx) return sendViaTelnyx(to, body, opts);

  console.log(`[SMS to ${to}]: ${body}`);
}

async function sendViaTwilio(to: string, body: string, opts?: { from?: string }): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  // Prefer API Key auth (TWILIO_API_KEY_SID / _SECRET) — matches the deploy config —
  // and fall back to the account Auth Token if only that is set.
  const keySid = process.env.TWILIO_API_KEY_SID;
  const keySecret = process.env.TWILIO_API_KEY_SECRET;
  const useApiKey = !!(keySid && keySecret);
  const authUser = useApiKey ? keySid! : accountSid;
  const authPass = useApiKey ? keySecret! : process.env.TWILIO_AUTH_TOKEN!;

  // A Messaging Service (recommended) manages the sender-number pool and ties
  // traffic to the approved 10DLC campaign; otherwise send from a specific number.
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const from = opts?.from || process.env.TWILIO_PHONE_NUMBER;

  const form = new URLSearchParams({ To: to, Body: body });
  if (messagingServiceSid) form.set("MessagingServiceSid", messagingServiceSid);
  else if (from) form.set("From", from);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${Buffer.from(`${authUser}:${authPass}`).toString("base64")}`,
    },
    body: form.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Twilio SMS failed: ${JSON.stringify(err)}`);
  }
}

async function sendViaTelnyx(to: string, body: string, opts?: { from?: string }): Promise<void> {
  const apiKey = process.env.TELNYX_API_KEY!;
  // Prefer the Messaging Profile (handles the sender-number pool and ties traffic
  // to the approved 10DLC campaign) when configured; otherwise send from a specific
  // number. A per-call sender can still be passed via opts.from.
  const messagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID;
  const from = opts?.from || process.env.TELNYX_PHONE_NUMBER;

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
