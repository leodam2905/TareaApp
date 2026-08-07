import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { CUSTOMER_FEE_RATE } from "@/lib/fees";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bookings = await prisma.booking.findMany({
    where: { customerId: user.id, isPaid: true },
    include: { service: { select: { category: true, title: true } } },
    orderBy: { completedAt: "desc" },
  });

  // What the customer paid: service + 15% fee + materials (at cost, no fee).
  const charged = (b: (typeof bookings)[number]) =>
    b.totalPrice * (1 + CUSTOMER_FEE_RATE) + (b.materialsEstimate ?? 0);

  const totalSpent = bookings.reduce((s, b) => s + charged(b), 0);

  // By category
  const byCategory: Record<string, number> = {};
  for (const b of bookings) {
    const cat = b.service.category;
    byCategory[cat] = (byCategory[cat] ?? 0) + charged(b);
  }

  // Last 6 months buckets
  const now = new Date();
  const months: { label: string; amount: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    const amount = bookings
      .filter(b => {
        const bDate = b.completedAt ?? b.createdAt;
        return bDate.getFullYear() === d.getFullYear() && bDate.getMonth() === d.getMonth();
      })
      .reduce((s, b) => s + charged(b), 0);
    months.push({ label, amount });
  }

  return NextResponse.json({
    totalSpent,
    bookingCount: bookings.length,
    byCategory,
    months,
    recent: bookings.slice(0, 10).map(b => ({
      id: b.id,
      title: b.service.title,
      category: b.service.category,
      amount: charged(b),
      date: b.completedAt ?? b.createdAt,
    })),
  });
}
