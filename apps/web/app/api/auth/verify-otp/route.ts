import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPendingToken, signToken, setAuthCookie } from "@/lib/auth";
import { verifyOtp } from "@/lib/otp";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";

const schema = z.object({
  pendingToken: z.string().min(1),
  code: z.string().length(6),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);

    const userId = verifyPendingToken(data.pendingToken);
    if (!userId) {
      return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 });
    }

    // Throttle OTP guesses to make brute-forcing the 6-digit code infeasible.
    const ip = clientIp(req);
    const rlUser = rateLimit(`otp-verify:${userId}`, 5, 10 * 60_000);
    const rlIp = rateLimit(`otp-verify-ip:${ip}`, 20, 10 * 60_000);
    if (!rlUser.ok || !rlIp.ok) {
      return NextResponse.json(
        { error: "Too many attempts. Please request a new code and try again later." },
        { status: 429 }
      );
    }

    const valid = await verifyOtp(userId, data.code);
    if (!valid) {
      return NextResponse.json({ error: "Invalid or expired code." }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    setAuthCookie(token);

    return NextResponse.json({ id: user.id, name: user.name, role: user.role, email: user.email, token });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
