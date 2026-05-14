export async function sendSms(to: string, body: string): Promise<void> {
  const apiKey = process.env.TELNYX_API_KEY;
  const from   = process.env.TELNYX_PHONE_NUMBER;

  if (!apiKey || !from) {
    console.log(`[SMS to ${to}]: ${body}`);
    return;
  }

  const res = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to, text: body }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Telnyx SMS failed: ${JSON.stringify(err)}`);
  }
}
