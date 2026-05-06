import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();

  if (!token || !password || password.length < 8) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const record = await prisma.otpCode.findFirst({
    where: {
      code: `RESET_${token}`,
      used: false,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!record) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Please request a new one." },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await Promise.all([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.otpCode.update({ where: { id: record.id }, data: { used: true } }),
  ]);

  return NextResponse.json({ ok: true });
}
