import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { handymanNet } from "@/lib/fees";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "month"; // "week" | "month" | "year"

  const now = new Date();
  let since: Date;
  let buckets: { label: string; start: Date; end: Date }[] = [];

  if (period === "week") {
    // Last 7 days
    since = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    since.setHours(0, 0, 0, 0);
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const start = new Date(d); start.setHours(0, 0, 0, 0);
      const end = new Date(d); end.setHours(23, 59, 59, 999);
      buckets.push({ label: start.toLocaleDateString("en", { weekday: "short" }), start, end });
    }
  } else if (period === "month") {
    // Last 4 weeks
    for (let i = 3; i >= 0; i--) {
      const end = new Date(now);
      end.setDate(end.getDate() - i * 7);
      end.setHours(23, 59, 59, 999);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      buckets.push({ label: `Wk ${4 - i}`, start, end });
    }
    since = buckets[0].start;
  } else {
    // Last 12 months
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      buckets.push({ label: start.toLocaleDateString("en", { month: "short" }), start, end });
    }
    since = buckets[0].start;
  }

  const completed = await prisma.booking.findMany({
    where: {
      handymanId: user.id,
      status: "COMPLETED",
      completedAt: { gte: since },
    },
    select: { totalPrice: true, completedAt: true },
  });

  const chart = buckets.map(b => ({
    label: b.label,
    earnings: completed
      .filter(c => c.completedAt && c.completedAt >= b.start && c.completedAt <= b.end)
      .reduce((s, c) => s + handymanNet(c.totalPrice), 0),
    jobs: completed.filter(c => c.completedAt && c.completedAt >= b.start && c.completedAt <= b.end).length,
  }));

  return NextResponse.json(chart);
}
