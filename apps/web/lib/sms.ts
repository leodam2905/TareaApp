import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken  = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

export async function sendSms(to: string, body: string): Promise<void> {
  if (!accountSid || !authToken || !fromNumber) {
    console.log(`[SMS to ${to}]: ${body}`);
    return;
  }
  const client = twilio(accountSid, authToken);
  await client.messages.create({ body, from: fromNumber, to });
}
