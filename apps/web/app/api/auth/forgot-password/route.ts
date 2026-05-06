import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

  // Always return success to prevent email enumeration
  if (!user) return NextResponse.json({ ok: true });

  // Invalidate any existing reset tokens for this user
  await prisma.otpCode.updateMany({
    where: { userId: user.id, used: false },
    data: { used: true },
  });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.otpCode.create({
    data: { userId: user.id, code: `RESET_${token}`, expiresAt },
  });

  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;

  await sendEmail({
    to: user.email,
    subject: "Reset your Tarea password",
    html: `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:32px">
          <div style="width:36px;height:36px;background:linear-gradient(135deg,#1E3A8A,#38BDF8);border-radius:10px;display:flex;align-items:center;justify-content:center">
            <span style="color:white;font-size:18px">🔧</span>
          </div>
          <span style="font-size:20px;font-weight:800;color:#0F172A">Tarea</span>
        </div>
        <h1 style="font-size:24px;font-weight:700;color:#0F172A;margin:0 0 8px">Reset your password</h1>
        <p style="color:#64748B;margin:0 0 24px">Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#38BDF8;color:#0F172A;font-weight:700;padding:14px 28px;border-radius:12px;text-decoration:none;font-size:15px">
          Reset Password
        </a>
        <p style="color:#94A3B8;font-size:13px;margin-top:24px">
          If you didn't request this, you can safely ignore this email. Your password won't change.
        </p>
        <p style="color:#94A3B8;font-size:12px;margin-top:16px">
          Or copy this link: <span style="color:#38BDF8">${resetUrl}</span>
        </p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
