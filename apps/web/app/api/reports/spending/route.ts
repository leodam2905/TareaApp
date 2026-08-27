import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { CUSTOMER_FEE_RATE } from "@/lib/fees";
import { assertPromoUsable } from "@/lib/promo";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bookings = await prisma.booking.findMany({
    where: { customerId: user.id, isPaid: true },
    include: {
      service: { select: { category: true, title: true } },
      // Everything else the customer was charged for on this job. Without
      // these the report is an idealised figure rather than what left their
      // card, and the first support ticket is "your report says X, you charged
      // me Y".
      promoCode: true,
      tips: { select: { amount: true } },
      extensions: { where: { status: "APPROVED" }, select: { extraAmount: true } },
    },
    orderBy: { completedAt: "desc" },
  });

  /**
   * What the customer actually paid for this job.
   *
   *   labour − discount, + 15% fee on that, + materials at cost,
   *   + approved time extensions, + tips.
   *
   * The three additions matter for different reasons. A promo means they paid
   * LESS than the booking's totalPrice, which is stored pre-discount. An
   * approved extension is a second charge on the same job. A tip is money they
   * chose to add — 100% of it goes to the pro, so it is not revenue, but it is
   * unquestionably spending.
   *
   * The discount is recomputed rather than stored: booking.totalPrice is the
   * pre-discount labour on both paths, and re-deriving it from the code that
   * was recorded keeps one definition of what a promo is worth.
   */
  const charged = (b: (typeof bookings)[number]) => {
    let discount = 0;
    if (b.promoCode) {
      const check = assertPromoUsable(b.promoCode, user.id, b.totalPrice, false);
      if (check.ok) discount = Math.min(check.discountAmount, b.totalPrice);
    }
    const labour = b.totalPrice - discount;
    const extensions = b.extensions.reduce((t, e) => t + (e.extraAmount ?? 0), 0);
    const tips = b.tips.reduce((t, x) => t + x.amount, 0);
    return labour * (1 + CUSTOMER_FEE_RATE) + (b.materialsEstimate ?? 0) + extensions + tips;
  };

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const totalSpent = round2(bookings.reduce((s, b) => s + charged(b), 0));

  // By category
  const byCategory: Record<string, number> = {};
  for (const b of bookings) {
    const cat = b.service.category;
    byCategory[cat] = round2((byCategory[cat] ?? 0) + charged(b));
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
    months.push({ label, amount: round2(amount) });
  }

  // The breakdown behind the total. A customer who can see the fee is a
  // customer who is not surprised by it.
  const sum = (fn: (b: (typeof bookings)[number]) => number) =>
    Math.round(bookings.reduce((t, b) => t + fn(b), 0) * 100) / 100;
  const discountFor = (b: (typeof bookings)[number]) => {
    if (!b.promoCode) return 0;
    const check = assertPromoUsable(b.promoCode, user.id, b.totalPrice, false);
    return check.ok ? Math.min(check.discountAmount, b.totalPrice) : 0;
  };

  return NextResponse.json({
    totalSpent,
    breakdown: {
      labour: sum((b) => b.totalPrice - discountFor(b)),
      serviceFee: sum((b) => (b.totalPrice - discountFor(b)) * CUSTOMER_FEE_RATE),
      materials: sum((b) => b.materialsEstimate ?? 0),
      extensions: sum((b) => b.extensions.reduce((t, e) => t + (e.extraAmount ?? 0), 0)),
      tips: sum((b) => b.tips.reduce((t, x) => t + x.amount, 0)),
      discounts: sum(discountFor),
    },
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
