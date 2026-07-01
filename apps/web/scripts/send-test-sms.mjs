// One-off Telnyx SMS delivery test — verifies the same config lib/sms.ts uses.
//
// Usage (Node 20+, loads apps/web/.env automatically):
//   node --env-file=.env scripts/send-test-sms.mjs +15551234567
//   node --env-file=.env scripts/send-test-sms.mjs +15551234567 "custom message"

const to = process.argv[2];
const body = process.argv[3] || "Tarea test: your SMS pipeline is working ✅";

if (!to) {
  console.error("Usage: node --env-file=.env scripts/send-test-sms.mjs <+E164number> [message]");
  process.exit(1);
}

const apiKey = process.env.TELNYX_API_KEY;
const messagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID;
const from = process.env.TELNYX_PHONE_NUMBER;

if (!apiKey) {
  console.error("✗ TELNYX_API_KEY is not set — nothing would be sent (dev console fallback).");
  process.exit(1);
}
if (!from && !messagingProfileId) {
  console.error("✗ Neither TELNYX_PHONE_NUMBER nor TELNYX_MESSAGING_PROFILE_ID is set.");
  process.exit(1);
}

const payload = { to, text: body };
if (from) payload.from = from;
if (messagingProfileId) payload.messaging_profile_id = messagingProfileId;

console.log("→ Sending via Telnyx:", {
  to,
  from: from || "(from messaging profile pool)",
  messaging_profile_id: messagingProfileId || "(none)",
});

const res = await fetch("https://api.telnyx.com/v2/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify(payload),
});

const json = await res.json().catch(() => ({}));

if (!res.ok) {
  console.error(`✗ Telnyx returned ${res.status}:`, JSON.stringify(json, null, 2));
  process.exit(1);
}

const id = json?.data?.id;
console.log(`✓ Accepted by Telnyx (message id: ${id}).`);
console.log("  Delivery is async — watch the phone, and check the telnyx/webhook");
console.log("  delivery-status logs to confirm it reached the carrier.");
