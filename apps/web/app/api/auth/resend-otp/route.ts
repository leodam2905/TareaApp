import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPendingToken, signPendingToken } from "@/lib/auth";
import { createAndSendOtp } from "@/lib/otp";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({ pendingToken: z.string().min(1) });

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const rl = rateLimit(`resend-otp:${ip}`, 5, 900_000); // 5 per 15 min
  if (!rl.ok) return NextResponse.json({ error: "Too many resend attempts. Wait a few minutes." }, { status: 429 });

  try {
    const { pendingToken } = schema.parse(await req.json());

    const userId = verifyPendingToken(pendingToken);
    if (!userId) {
      return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.phone) {
      return NextResponse.json({ error: "No phone number on file." }, { status: 400 });
    }

    await createAndSendOtp(user.id, user.phone, user.email);

    // Issue a fresh 10-min pending token
    return NextResponse.json({ pendingToken: signPendingToken(user.id) });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
