import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { assertPromoUsable } from "@/lib/promo";

export async function POST(req: NextRequest) {
  // Require auth so codes can't be enumerated anonymously, and so ownership
  // can be checked.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ valid: false, error: "Unauthorized" }, { status: 401 });

  const { code, amount } = await req.json();
  if (!code?.trim()) {
    return NextResponse.json({ valid: false, error: "Code is required" });
  }

  const promo = await prisma.promoCode.findUnique({
    where: { code: code.trim().toUpperCase() },
  });

  if (!promo) {
    return NextResponse.json({ valid: false, error: "Invalid promo code" });
  }

  // amount is optional here (used only to preview the discount); default to 0.
  const check = assertPromoUsable(promo, user.id, typeof amount === "number" ? amount : 0);
  if (!check.ok) {
    return NextResponse.json({ valid: false, error: check.error });
  }

  return NextResponse.json({
    valid: true,
    code: promo.code,
    discountType: promo.discountType,
    discountValue: promo.discountValue,
  });
}
