import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

// GET — list debit cards and bank accounts on connected account
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!user.stripeAccountId) return NextResponse.json({ cards: [], banks: [] });

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
}

// POST — add a debit card or bank account via Stripe token
// Body: { token: string, type: "card" | "bank_account" }
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Create Stripe account if not yet created
  let accountId = user.stripeAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email,
      capabilities: { transfers: { requested: true } },
      metadata: { userId: user.id },
    });
    accountId = account.id;
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeAccountId: accountId, stripeAccountStatus: "pending" },
    });
  }

  const { token, type } = await req.json();
  if (!token || !type) return NextResponse.json({ error: "Missing token or type" }, { status: 400 });

  const external = await stripe.accounts.createExternalAccount(accountId, {
    external_account: token,
    default_for_currency: true,
  });

  return NextResponse.json({ success: true, id: external.id, type });
}
