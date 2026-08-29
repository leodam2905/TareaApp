import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { CUSTOMER_FEE_RATE } from "@/lib/fees";
import { materialsOwed } from "@/lib/pro-payout";
import { invoiceToken } from "@/lib/invoice-link";

export const dynamic = "force-dynamic";

// Every receipt a customer has, in one place.
//
// Invoices only existed as a link inside a completion email, so anyone who
// deleted the mail, or changed address, or simply wanted last month's receipt
// had no way to reach it. The app is where they already keep track of the jobs;
// the receipts belong there too.
//
// Each row carries a SIGNED url so tapping it opens the printable invoice
// without a website login — the same token the email uses.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Paid is the test, not completed: a customer who paid for a job that was
  // later cancelled still paid, and still needs the receipt.
  const bookings = await prisma.booking.findMany({
    where: { customerId: user.id, isPaid: true },
    orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      status: true,
      totalPrice: true,
      materialsEstimate: true,
      materialsActual: true,
      materialsRefunded: true,
      completedAt: true,
      createdAt: true,
      service: { select: { title: true, category: true } },
      handyman: { select: { name: true } },
      tips: { select: { amount: true } },
      extensions: { where: { status: "APPROVED" }, select: { extraAmount: true } },
    },
  });

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://taptarea.com";
  const round2 = (n: number) => Math.round(n * 100) / 100;

  return NextResponse.json({
    invoices: bookings.map((b) => {
      const fee = b.totalPrice * CUSTOMER_FEE_RATE;
      const materials = b.materialsEstimate ?? 0;
      const refunded = b.materialsRefunded ?? 0;
      const tips = b.tips.reduce((s, t) => s + t.amount, 0);
      const extensions = b.extensions.reduce((s, e) => s + (e.extraAmount ?? 0), 0);
      return {
        id: b.id,
        // What the invoice is called on screen and in the email.
        number: b.id.slice(-8).toUpperCase(),
        service: b.service.title,
        category: b.service.category,
        handyman: b.handyman.name,
        status: b.status,
        date: b.completedAt ?? b.createdAt,
        labour: round2(b.totalPrice),
        serviceFee: round2(fee),
        materials: round2(materials),
        // What the pro actually spent, once reported.
        materialsSpent: b.materialsActual == null ? null : round2(materialsOwed(b)),
        materialsRefunded: round2(refunded),
        tips: round2(tips),
        extensions: round2(extensions),
        // The figure that should match their card statement.
        total: round2(b.totalPrice + fee + materials + tips + extensions - refunded),
        url: `${base}/invoice/${b.id}?t=${invoiceToken(b.id)}`,
      };
    }),
  });
}
