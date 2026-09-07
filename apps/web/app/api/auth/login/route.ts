import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { comparePassword, signPendingToken, signToken, setAuthCookie } from "@/lib/auth";
import { createAndSendOtp } from "@/lib/otp";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";
import { rateLimitDb } from "@/lib/rate-limit-db";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// A real bcrypt hash (cost 12) of a random string, used only to equalize timing
// for unknown emails so login can't be used to enumerate accounts.
const DUMMY_HASH = "$2a$12$m5QYcHRW4qswFvJbEnKGyeLZ.IE.PqQoBYc1yg0mQN5ft8LolUAXa";

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const rl = await rateLimitDb(`login:${ip}`, 10, 60_000);
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

    // Bypass OTP ONLY for the dedicated App Store / Play review accounts (so
    // reviewers can sign in without a phone). Admin and personal accounts are
    // intentionally NOT here — they must complete OTP (2FA). Set
    // DISABLE_REVIEW_OTP_BYPASS=true to turn this off entirely (no redeploy).
    // The delete-* pair exists so Guideline 5.1.1 can be demonstrated WITHOUT
    // destroying the demo login. Account deletion here is a permanent erase, and
    // a reviewer following the deletion instructions on the main demo account
    // takes it with them: ahissezirignon@gmail.com was erased on 2026-07-15 and
    // the Pro review info pointed at a ghost for six weeks afterwards.
    const REVIEW_ACCOUNTS = [
      "reviewer@taptarea.com",        // Tarea Home — explore the app
      "test@taptarea.com",            // Tarea Pro — explore the app
      "delete-me@taptarea.com",       // Tarea Home — deletion demo, expendable
      "delete-me-pro@taptarea.com",   // Tarea Pro — deletion demo, expendable
      "ahissezirignon@gmail.com",     // deleted 2026-07-15; kept so a recreated account still works
    ];
    if (process.env.DISABLE_REVIEW_OTP_BYPASS !== "true" && REVIEW_ACCOUNTS.includes(user.email)) {
      const token = signToken({ userId: user.id, email: user.email, role: user.role });
      setAuthCookie(token);
      return NextResponse.json({ success: true, id: user.id, name: user.name, email: user.email, role: user.role, token });
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
