export async function sendSms(to: string, body: string, opts?: { from?: string }): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  // Prefer a dedicated API Key (recommended — never put the account Auth Token in apps);
  // fall back to the account Auth Token if no API Key is configured.
  const authUser = process.env.TWILIO_API_KEY_SID || accountSid;
  const authPass = process.env.TWILIO_API_KEY_SECRET || process.env.TWILIO_AUTH_TOKEN;
  // Prefer a Messaging Service (handles sender pool, compliance, fallback) when configured;
  // otherwise send from a specific number. A per-call sender can still be passed via opts.from.
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const from = opts?.from || process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authPass || (!from && !messagingServiceSid)) {
    console.log(`[SMS to ${to}]: ${body}`);
    return;
  }

  const params = new URLSearchParams();
  params.append("To", to);
  params.append("Body", body);
  // A specific opts.from takes precedence; otherwise use the Messaging Service if set.
  if (opts?.from) {
    params.append("From", opts.from);
  } else if (messagingServiceSid) {
    params.append("MessagingServiceSid", messagingServiceSid);
  } else {
    params.append("From", from!);
  }

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": "Basic " + Buffer.from(`${authUser}:${authPass}`).toString("base64"),
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Twilio SMS failed: ${JSON.stringify(err)}`);
  }
}
