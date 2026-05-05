import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { code } = await req.json();
  if (!code?.trim()) {
    return NextResponse.json({ valid: false, error: "Code is required" });
  }

  const promo = await prisma.promoCode.findUnique({
    where: { code: code.trim().toUpperCase() },
  });

  if (!promo) {
    return NextResponse.json({ valid: false, error: "Invalid promo code" });
  }

  if (!promo.isActive) {
    return NextResponse.json({ valid: false, error: "This promo code is no longer active" });
  }

  if (promo.expiresAt && promo.expiresAt < new Date()) {
    return NextResponse.json({ valid: false, error: "This promo code has expired" });
  }

  if (promo.maxUses !== null && promo.usesCount >= promo.maxUses) {
    return NextResponse.json({ valid: false, error: "This promo code has reached its usage limit" });
  }

  return NextResponse.json({
    valid: true,
    code: promo.code,
    discountType: promo.discountType,
    discountValue: promo.discountValue,
  });
}
