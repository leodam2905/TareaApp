import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { handymanNet } from "@/lib/fees";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()), 10);
  const format = searchParams.get("format") || "json"; // "json" | "csv"

  const start = new Date(year, 0, 1);
  const end   = new Date(year + 1, 0, 1);

  const bookings = await prisma.booking.findMany({
    where: {
      handymanId: user.id,
      status: "COMPLETED",
      completedAt: { gte: start, lt: end },
    },
    include: {
      service: { select: { title: true, category: true } },
      customer: { select: { name: true } },
    },
    orderBy: { completedAt: "asc" },
  });

  const grossEarnings = bookings.reduce((s, b) => s + b.totalPrice, 0);
  const netEarnings   = bookings.reduce((s, b) => s + handymanNet(b.totalPrice), 0);
  const platformFees  = grossEarnings - netEarnings;

  if (format === "csv") {
    const rows = [
      ["Date", "Booking ID", "Service", "Customer", "Gross ($)", "Platform Fee ($)", "Net ($)"],
      ...bookings.map(b => [
        (b.completedAt ?? b.updatedAt).toISOString().split("T")[0],
        b.id.slice(-8).toUpperCase(),
        b.service.title,
        b.customer.name,
        b.totalPrice.toFixed(2),
        (b.totalPrice - handymanNet(b.totalPrice)).toFixed(2),
        handymanNet(b.totalPrice).toFixed(2),
      ]),
      [],
      ["", "", "", "TOTAL", grossEarnings.toFixed(2), platformFees.toFixed(2), netEarnings.toFixed(2)],
    ];

    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="tarea-earnings-${year}.csv"`,
      },
    });
  }

  return NextResponse.json({
    year,
    handymanName: user.name,
    jobCount: bookings.length,
    grossEarnings,
    netEarnings,
    platformFees,
    bookings: bookings.map(b => ({
      id: b.id,
      completedAt: b.completedAt,
      serviceTitle: b.service.title,
      serviceCategory: b.service.category,
      customerName: b.customer.name,
      grossAmount: b.totalPrice,
      platformFee: b.totalPrice - handymanNet(b.totalPrice),
      netAmount: handymanNet(b.totalPrice),
    })),
  });
}
