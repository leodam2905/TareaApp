import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { createCertnInvitation } from "@/lib/certn";

export const BACKGROUND_CHECK_FEE = 29.99; // USD

// GET — current background check status
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.handymanProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  return NextResponse.json({
    status: profile.backgroundCheckStatus,
    fee: BACKGROUND_CHECK_FEE,
    paidAt: profile.backgroundCheckPaidAt,
    ref: profile.backgroundCheckRef,
  });
}

// POST — choose payment method: { method: "now" | "deferred" }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.handymanProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  if (["PAID", "IN_PROGRESS", "PASSED", "DEFERRED"].includes(profile.backgroundCheckStatus)) {
    return NextResponse.json({ status: profile.backgroundCheckStatus });
  }

  const { method } = await req.json();
  if (!["now", "deferred"].includes(method)) {
    return NextResponse.json({ error: "Invalid method" }, { status: 400 });
  }

  // Split name into first / last (best-effort)
  const parts = user.name.trim().split(" ");
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ") || parts[0];

  // Create Certn invitation regardless of payment method —
  // Certn emails the handyman a link to submit their personal info
  let certnRef: string | null = null;
  if (process.env.CERTN_API_KEY) {
    try {
      const invitation = await createCertnInvitation({ email: user.email, firstName, lastName });
      certnRef = invitation.id;
    } catch (err) {
      console.error("[background-check] Certn invitation failed:", err);
      // Don't block the handyman — log and continue
    }
  }

  if (method === "deferred") {
    await prisma.handymanProfile.update({
      where: { userId: user.id },
      data: {
        backgroundCheckStatus: "DEFERRED",
        backgroundCheckRef: certnRef,
      },
    });
    return NextResponse.json({ status: "DEFERRED" });
  }

  // method === "now" — create Stripe Checkout for the fee
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: user.email,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Background Check — Tarea (powered by Certn)",
            description: "One-time mandatory background check. Certn will email you a secure link to complete your screening.",
          },
          unit_amount: Math.round(BACKGROUND_CHECK_FEE * 100),
        },
        quantity: 1,
      },
    ],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/handyman/onboarding?bg_check=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/handyman/onboarding?bg_check=cancelled`,
    metadata: { userId: user.id, type: "background_check", certnRef: certnRef ?? "" },
  });

  // Optimistically store Certn ref
  if (certnRef) {
    await prisma.handymanProfile.update({
      where: { userId: user.id },
      data: { backgroundCheckRef: certnRef },
    });
  }

  return NextResponse.json({ checkoutUrl: session.url });
}
