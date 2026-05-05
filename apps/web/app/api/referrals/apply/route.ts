import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.referredBy) {
    return NextResponse.json({ error: "Referral code already applied" }, { status: 400 });
  }

  const { code } = await req.json();
  if (!code?.trim()) return NextResponse.json({ error: "Code required" }, { status: 400 });

  const referrer = await prisma.user.findUnique({ where: { referralCode: code.trim().toUpperCase() } });
  if (!referrer) return NextResponse.json({ error: "Invalid referral code" }, { status: 404 });
  if (referrer.id === user.id) return NextResponse.json({ error: "Cannot use your own code" }, { status: 400 });

  await prisma.user.update({ where: { id: user.id }, data: { referredBy: referrer.referralCode } });

  // Create a 10% promo credit for the new user
  const newUserPromo = await prisma.promoCode.create({
    data: {
      code: `REF-${user.id.slice(-6).toUpperCase()}`,
      discountType: "PERCENT",
      discountValue: 10,
      maxUses: 1,
      isActive: true,
    },
  });

  // Create a 10% promo credit for the referrer
  const referrerPromo = await prisma.promoCode.create({
    data: {
      code: `TKS-${referrer.id.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase().slice(-4)}`,
      discountType: "PERCENT",
      discountValue: 10,
      maxUses: 1,
      isActive: true,
    },
  });

  // Notify both
  await prisma.notification.create({
    data: {
      userId: referrer.id,
      title: "Someone used your referral code!",
      body: `${user.name} joined Tarea with your code. Use ${referrerPromo.code} for 10% off your next booking.`,
      type: "booking_accepted",
    },
  });

  return NextResponse.json({ promoCode: newUserPromo.code, message: "Referral applied! Use your promo code for 10% off." });
}
