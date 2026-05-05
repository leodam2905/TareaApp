import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const DEFAULTS = [
  { key: "customer_fee_rate",         value: "0.10", label: "Customer fee rate (e.g. 0.10 = 10%)" },
  { key: "handyman_fee_rate",         value: "0.10", label: "Handyman fee rate (e.g. 0.10 = 10%)" },
  { key: "subscription_price_cents",  value: "2900", label: "Pro subscription price in cents ($29.00)" },
  { key: "cancellation_fee_rate",     value: "0.50", label: "Late cancellation fee rate (e.g. 0.50 = 50%)" },
  { key: "service_radius_miles",      value: "50",   label: "Default handyman service radius (miles)" },
];

async function seedDefaults() {
  for (const d of DEFAULTS) {
    await prisma.adminSetting.upsert({
      where: { key: d.key },
      create: d,
      update: {},
    });
  }
}

export async function GET() {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await seedDefaults();
  const settings = await prisma.adminSetting.findMany({ orderBy: { key: "asc" } });
  return NextResponse.json(settings);
}

export async function PATCH(req: NextRequest) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updates: { key: string; value: string }[] = await req.json();
  const results = await Promise.all(
    updates.map(({ key, value }) =>
      prisma.adminSetting.updateMany({ where: { key }, data: { value } })
    )
  );
  return NextResponse.json({ updated: results.length });
}
