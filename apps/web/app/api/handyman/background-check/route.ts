import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { createCheckrInvitation } from "@/lib/checkr";
import { BACKGROUND_CHECK_FEE } from "@/lib/background-check";
import { backgroundCheckReturnUrls, returnTarget } from "@/lib/stripe-return-urls";

export { BACKGROUND_CHECK_FEE };

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

  const body = await req.json();
  const { method } = body;
  // A paid, mandatory onboarding step: send the pro back to the setup screen
  // they started from, not to the website.
  const target = returnTarget(body);
  if (!["now", "deferred"].includes(method)) {
    return NextResponse.json({ error: "Invalid method" }, { status: 400 });
  }

  // Split name into first / last (best-effort)
  const parts = user.name.trim().split(" ");
  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ") || parts[0];

  // DEFERRED first: deferring means the Pro pays later, so there is nothing to
  // charge and nothing to order yet. Gating this path on the screening provider
  // would block onboarding entirely whenever Checkr is unreachable, which is a
  // worse failure than a check ordered a few minutes later.
  if (method === "deferred") {
    await prisma.handymanProfile.update({
      where: { userId: user.id },
      data: { backgroundCheckStatus: "DEFERRED", backgroundCheckRef: null },
    });
    return NextResponse.json({ status: "DEFERRED" });
  }

  // Paid path: order the screening BEFORE taking any money.
  //
  // This used to swallow the failure and continue, so a Pro could be charged
  // $29.99 for "Background Check (powered by Certn)" while no check was ever
  // ordered -- and with no API key configured that was the NORMAL path, not an
  // edge case. Charging for a service we never requested is not something to log
  // and move past, so both failures now refuse before Stripe is touched.
  let checkrRef: string | null = null;
  if (!process.env.CHECKR_API_KEY) {
    console.error("[background-check] CHECKR_API_KEY not configured — refusing to charge");
    return NextResponse.json(
      { error: "Background checks are temporarily unavailable. Please try again later." },
      { status: 503 },
    );
  }
  try {
    const invitation = await createCheckrInvitation({ email: user.email, firstName, lastName });
    // The CANDIDATE id, not the invitation id: a candidate outlives any single
    // report, and the webhook keys on it.
    checkrRef = invitation.candidateId;
  } catch (err) {
    console.error("[background-check] Checkr invitation failed:", err);
    return NextResponse.json(
      { error: "We could not start your background check. Please try again shortly." },
      { status: 502 },
    );
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
            name: "Background Check — Tarea (powered by Checkr)",
            description: "One-time mandatory background check. Checkr will email you a secure link to complete your screening.",
          },
          unit_amount: Math.round(BACKGROUND_CHECK_FEE * 100),
        },
        quantity: 1,
      },
    ],
    ...backgroundCheckReturnUrls(target),
    metadata: { userId: user.id, type: "background_check", checkrRef: checkrRef ?? "" },
  });

  // Store the Checkr candidate ref
  if (checkrRef) {
    await prisma.handymanProfile.update({
      where: { userId: user.id },
      data: { backgroundCheckRef: checkrRef },
    });
  }

  return NextResponse.json({ checkoutUrl: session.url });
}
