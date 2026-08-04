import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token, platform } = await req.json();
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  const isExpo = token.startsWith("ExponentPushToken");
  const plat =
    typeof platform === "string" ? platform : isExpo ? "expo" : "fcm";

  // Store every device that registers (multi-device). Unique on token, so the
  // same device re-registering — or the same physical device logging into a
  // different account — moves the row to the current user rather than leaving a
  // stale token that would misdeliver someone else's job alerts.
  await prisma.deviceToken.upsert({
    where: { token },
    create: { token, platform: plat, userId: user.id },
    update: { userId: user.id, platform: plat },
  });

  // Keep the legacy single column in sync as a fallback for any install that
  // still relies on it.
  await prisma.user.update({
    where: { id: user.id },
    data: isExpo ? { expoPushToken: token } : { fcmToken: token },
  });

  return NextResponse.json({ ok: true });
}
