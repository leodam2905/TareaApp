import { prisma } from "./prisma";
import { sendSms } from "./sms";
import { sendEmail } from "./email";

const OTP_TTL_MINUTES = 10;

export function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export async function createAndSendOtp(userId: string, phone: string, email?: string): Promise<void> {
  await prisma.otpCode.updateMany({
    where: { userId, used: false },
    data: { used: true },
  });

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  await prisma.otpCode.create({ data: { userId, code, expiresAt } });

  // Send via SMS (best-effort — carrier filtering may apply)
  sendSms(normalizePhone(phone), `Your Tarea verification code is: ${code}. It expires in ${OTP_TTL_MINUTES} minutes. Msg&data rates may apply. Reply STOP to opt out.`).catch(() => {});

  // Always send via email as fallback
  if (email) {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body{font-family:Inter,sans-serif;background:#f1f5f9;margin:0;padding:32px 0}
      .card{background:#fff;max-width:480px;margin:0 auto;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
      .header{background:linear-gradient(135deg,#1E3A8A,#0F2560);padding:32px;text-align:center}
      .logo{font-size:28px;font-weight:900;color:#fff;letter-spacing:-1px}
      .body{padding:32px;text-align:center}
      h2{color:#0F172A;font-size:20px;font-weight:700;margin:0 0 8px}
      p{color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px}
      .code{font-size:40px;font-weight:900;letter-spacing:10px;color:#1E3A8A;background:#f0f7ff;border-radius:12px;padding:20px 32px;display:inline-block;margin-bottom:24px}
      .footer{padding:20px 32px;background:#f8fafc;text-align:center;font-size:12px;color:#94a3b8}
    </style></head><body>
      <div class="card">
        <div class="header"><div class="logo">Tarea</div></div>
        <div class="body">
          <h2>Your verification code</h2>
          <p>Enter this code to verify your account. It expires in ${OTP_TTL_MINUTES} minutes.</p>
          <div class="code">${code}</div>
          <p style="font-size:13px;color:#94a3b8">If you didn't create a Tarea account, ignore this email.</p>
        </div>
        <div class="footer">© 2026 Tarea · taptarea.com</div>
      </div>
    </body></html>`;
    sendEmail({ to: email, subject: `${code} is your Tarea verification code`, html }).catch(() => {});
  }
}

export async function verifyOtp(userId: string, code: string): Promise<boolean> {
  const record = await prisma.otpCode.findFirst({
    where: {
      userId,
      code,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return false;

  await prisma.otpCode.update({ where: { id: record.id }, data: { used: true } });
  return true;
}
