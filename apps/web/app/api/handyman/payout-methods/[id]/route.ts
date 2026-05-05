import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

// DELETE — remove an external account
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.stripeAccountId) return NextResponse.json({ error: "No Stripe account" }, { status: 400 });

  await stripe.accounts.deleteExternalAccount(user.stripeAccountId, params.id);
  return NextResponse.json({ success: true });
}

// PATCH — set as default for currency
export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.stripeAccountId) return NextResponse.json({ error: "No Stripe account" }, { status: 400 });

  await stripe.accounts.updateExternalAccount(user.stripeAccountId, params.id, {
    default_for_currency: true,
  });
  return NextResponse.json({ success: true });
}
