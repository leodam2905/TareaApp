import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPendingToken, signPendingToken } from "@/lib/auth";
import { createAndSendOtp } from "@/lib/otp";

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

    const cleaned = phone.trim();
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
