import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

// GET — list debit cards and bank accounts on connected account
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!user.stripeAccountId) return NextResponse.json({ cards: [], banks: [] });

  try {
    const [cards, banks] = await Promise.all([
      stripe.accounts.listExternalAccounts(user.stripeAccountId, { object: "card", limit: 10 }),
      stripe.accounts.listExternalAccounts(user.stripeAccountId, { object: "bank_account", limit: 10 }),
    ]);

    return NextResponse.json({
      cards: cards.data.map(c => {
        const card = c as Extract<typeof c, { object: "card" }>;
        return {
          id: card.id,
          brand: card.brand,
          last4: card.last4,
          expMonth: card.exp_month,
          expYear: card.exp_year,
          funding: card.funding,
          isDefault: card.default_for_currency,
        };
      }),
      banks: banks.data.map(b => {
        const bank = b as Extract<typeof b, { object: "bank_account" }>;
        return {
          id: bank.id,
          bankName: bank.bank_name,
          last4: bank.last4,
          routingNumber: bank.routing_number,
          isDefault: bank.default_for_currency,
        };
      }),
    });
  } catch {
    return NextResponse.json({ cards: [], banks: [] });
  }
}

// POST — add a debit card or bank account via Stripe token
// Body: { token: string, type: "card" | "bank_account" }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!user.stripeAccountId) {
    return NextResponse.json(
      { error: "Complete identity verification before adding payout methods." },
      { status: 422 }
    );
  }

  const { token, type } = await req.json();
  if (!token || !type) return NextResponse.json({ error: "Missing token or type" }, { status: 400 });

  try {
    // Verify account is active directly from Stripe (not the DB cache)
    const account = await stripe.accounts.retrieve(user.stripeAccountId);
    if (!account.charges_enabled) {
      return NextResponse.json(
        { error: "Your identity verification is still pending. Please complete it before adding payout methods." },
        { status: 422 }
      );
    }

    const external = await stripe.accounts.createExternalAccount(user.stripeAccountId, {
      external_account: token,
      default_for_currency: true,
    });
    return NextResponse.json({ success: true, id: external.id, type });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to add payout method";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
