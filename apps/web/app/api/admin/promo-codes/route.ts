import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const codes = await prisma.promoCode.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(codes);
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code, discountType, discountValue, maxUses, expiresAt } = await req.json();

  if (!code?.trim()) return NextResponse.json({ error: "code is required" }, { status: 400 });
  if (!["PERCENT", "FLAT"].includes(discountType)) {
    return NextResponse.json({ error: "discountType must be PERCENT or FLAT" }, { status: 400 });
  }
  if (!discountValue || discountValue <= 0) {
    return NextResponse.json({ error: "discountValue must be positive" }, { status: 400 });
  }

  try {
    const promo = await prisma.promoCode.create({
      data: {
        code: code.trim().toUpperCase(),
        discountType,
        discountValue: Number(discountValue),
        maxUses: maxUses ? Number(maxUses) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });
    return NextResponse.json(promo, { status: 201 });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Promo code already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
