import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

// DELETE — detach a payment method
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "CUSTOMER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pm = await stripe.paymentMethods.retrieve(params.id);
  if (pm.customer !== user.stripeCustomerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await stripe.paymentMethods.detach(params.id);
  return NextResponse.json({ ok: true });
}

// PATCH — set as default payment method
export async function PATCH(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "CUSTOMER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.stripeCustomerId) return NextResponse.json({ error: "No Stripe customer" }, { status: 400 });

  const pm = await stripe.paymentMethods.retrieve(params.id);
  if (pm.customer !== user.stripeCustomerId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await stripe.customers.update(user.stripeCustomerId, {
    invoice_settings: { default_payment_method: params.id },
  });
  return NextResponse.json({ ok: true });
}
