import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", { apiVersion: "2024-06-20" });

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
  });
}

// POST — choose payment method: { method: "now" | "deferred" }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.handymanProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Already processed
  if (["PAID", "IN_PROGRESS", "PASSED", "DEFERRED"].includes(profile.backgroundCheckStatus)) {
    return NextResponse.json({ status: profile.backgroundCheckStatus });
  }

  const { method } = await req.json();

  if (method === "deferred") {
    await prisma.handymanProfile.update({
      where: { userId: user.id },
      data: { backgroundCheckStatus: "DEFERRED" },
    });
    return NextResponse.json({ status: "DEFERRED" });
  }

  if (method === "now") {
    // Create Stripe Checkout session for $29.99
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Background Check — Tarea",
              description: "Mandatory one-time background check to activate your handyman account.",
            },
            unit_amount: Math.round(BACKGROUND_CHECK_FEE * 100),
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/handyman/onboarding?bg_check=success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/handyman/onboarding?bg_check=cancelled`,
      metadata: { userId: user.id, type: "background_check" },
    });

    return NextResponse.json({ checkoutUrl: session.url });
  }

  return NextResponse.json({ error: "Invalid method" }, { status: 400 });
}
