import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPendingToken, signPendingToken } from "@/lib/auth";
import { createAndSendOtp } from "@/lib/otp";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  pendingToken: z.string().min(1),
  phone: z.string().min(7, "Enter a valid phone number"),
});

export async function POST(req: NextRequest) {
  try {
    const { pendingToken, phone } = schema.parse(await req.json());

    const userId = verifyPendingToken(pendingToken);
    if (!userId) {
      return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 });
    }

    if (!rateLimit(`add-phone:${userId}`, 5, 10 * 60_000).ok) {
      return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    }

    const cleaned = phone.trim();

    // Only allow setting a phone if the account doesn't already have one, and
    // reject a number already tied to a different account (prevents using an
    // attacker phone to receive the OTP / collide with another user).
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    if (me?.phone) {
      return NextResponse.json({ error: "A phone number is already on file." }, { status: 400 });
    }
    const taken = await prisma.user.findFirst({ where: { phone: cleaned, NOT: { id: userId } }, select: { id: true } });
    if (taken) {
      return NextResponse.json({ error: "This phone number is already in use." }, { status: 409 });
    }

    await prisma.user.update({ where: { id: userId }, data: { phone: cleaned } });
    await createAndSendOtp(userId, cleaned);

    return NextResponse.json({
      requiresOtp: true,
      pendingToken: signPendingToken(userId),
      phoneMask: "···· " + cleaned.slice(-4),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
