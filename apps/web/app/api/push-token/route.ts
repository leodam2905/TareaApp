import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token } = await req.json();
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "token required" }, { status: 400 });
  }

  // Expo tokens go in expoPushToken (RN app); FCM tokens go in fcmToken (Flutter).
  const isExpo = token.startsWith("ExponentPushToken");
  await prisma.user.update({
    where: { id: user.id },
    data: isExpo ? { expoPushToken: token } : { fcmToken: token },
  });
  return NextResponse.json({ ok: true });
}
