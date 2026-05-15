import { prisma } from "./prisma";
import { sendSms } from "./sms";

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

export async function createAndSendOtp(userId: string, phone: string): Promise<void> {
  await prisma.otpCode.updateMany({
    where: { userId, used: false },
    data: { used: true },
  });

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  await prisma.otpCode.create({ data: { userId, code, expiresAt } });

  await sendSms(normalizePhone(phone), `Your Tarea verification code is: ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`);
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
