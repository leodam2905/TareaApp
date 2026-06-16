import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { comparePassword, signPendingToken } from "@/lib/auth";
import { createAndSendOtp } from "@/lib/otp";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// A real bcrypt hash (cost 12) of a random string, used only to equalize timing
// for unknown emails so login can't be used to enumerate accounts.
const DUMMY_HASH = "$2a$12$m5QYcHRW4qswFvJbEnKGyeLZ.IE.PqQoBYc1yg0mQN5ft8LolUAXa";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const rl = rateLimit(`login:${ip}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many login attempts. Try again in a minute." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const data = schema.parse(body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      // Run a dummy bcrypt comparison so response timing doesn't reveal whether
      // the email exists (prevents timing-based user enumeration).
      await comparePassword(data.password, DUMMY_HASH);
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const valid = await comparePassword(data.password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json({ error: "Your account has been suspended. Contact support at support@taptarea.com." }, { status: 403 });
    }

    // Send OTP via SMS + email, return pending token for verification step
    await createAndSendOtp(user.id, user.phone ?? "", user.email);
    const pendingToken = signPendingToken(user.id);

    // Mask phone for display: +1 (***) ***-1234
    const phoneMask = user.phone
      ? user.phone.replace(/\d(?=\d{4})/g, "*")
      : null;

    return NextResponse.json({
      requiresOtp: true,
      pendingToken,
      phoneMask,
      requiresPhone: !user.phone,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
