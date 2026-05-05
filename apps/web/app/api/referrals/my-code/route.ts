import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

function generateCode(name: string) {
  const prefix = name.replace(/\s+/g, "").toUpperCase().slice(0, 4).padEnd(4, "X");
  const suffix = Math.random().toString(36).toUpperCase().slice(2, 6);
  return `${prefix}${suffix}`;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let code = user.referralCode;
  if (!code) {
    // Generate a unique code on first request
    let candidate = generateCode(user.name);
    while (await prisma.user.findUnique({ where: { referralCode: candidate } })) {
      candidate = generateCode(user.name);
    }
    await prisma.user.update({ where: { id: user.id }, data: { referralCode: candidate } });
    code = candidate;
  }

  const referredCount = await prisma.user.count({ where: { referredBy: user.referralCode ?? code } });

  return NextResponse.json({ code, referredCount });
}
