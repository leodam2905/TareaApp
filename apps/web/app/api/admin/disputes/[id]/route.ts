import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { createNotification } from "@/lib/notify";
import { handymanNet } from "@/lib/fees";

// POST /api/admin/disputes/[id]/resolve  body: { decision: "refund" | "release", note }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { decision, note } = await req.json();
  if (!["refund", "release"].includes(decision)) {
    return NextResponse.json({ error: "decision must be refund or release" }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: {
      handyman: { select: { stripeAccountId: true, stripeAccountStatus: true } },
    },
  });
  if (!booking || booking.status !== "DISPUTED") {
    return NextResponse.json({ error: "Disputed booking not found" }, { status: 404 });
  }

  // Refund customer
  if (decision === "refund" && booking.isPaid && booking.stripePaymentIntentId) {
    try {
      await stripe.refunds.create({ payment_intent: booking.stripePaymentIntentId });
    } catch (err) {
      console.error("[disputes/resolve] Refund failed:", err);
    }
  }

  // Release payment to handyman if they have Stripe Connect
  if (decision === "release" && booking.isPaid && !booking.handymanPaidOut) {
    const h = booking.handyman;
    if (h.stripeAccountId && h.stripeAccountStatus === "active") {
      try {
        await stripe.transfers.create({
          amount: Math.round((handymanNet(booking.totalPrice) + (booking.materialsEstimate ?? 0)) * 100),
          currency: "usd",
          destination: h.stripeAccountId,
          transfer_group: booking.id,
        });
      } catch (err) {
        console.error("[disputes/resolve] Transfer failed:", err);
      }
    }
  }

  const updated = await prisma.booking.update({
    where: { id: params.id },
    data: {
      status: decision === "refund" ? "CANCELLED" : "COMPLETED",
      resolutionNote: note?.trim() || null,
      resolvedAt: new Date(),
      ...(decision === "release" && { handymanPaidOut: true }),
    },
  });

  // Notify both parties
  await Promise.all([
    createNotification({
      userId: booking.customerId,
      title: "Dispute resolved",
      body: decision === "refund"
        ? "Your dispute was resolved. A refund has been issued."
        : "Your dispute was reviewed. The booking has been marked completed.",
      type: "booking_cancelled",
      refId: booking.id,
    }),
    createNotification({
      userId: booking.handymanId,
      title: "Dispute resolved",
      body: decision === "release"
        ? "Dispute resolved in your favor. Payment has been released."
        : "Dispute resolved. The booking was refunded to the customer.",
      type: "booking_cancelled",
      refId: booking.id,
    }),
  ]);

  return NextResponse.json(updated);
}
