import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

async function getOrCreateStripeCustomer(userId: string, email: string, name: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
  if (user?.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({ email, name, metadata: { userId } });
  await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

// GET — list saved payment methods
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "CUSTOMER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!user.stripeCustomerId) return NextResponse.json({ methods: [], defaultMethodId: null });

  const customer = await stripe.customers.retrieve(user.stripeCustomerId) as { deleted?: boolean; invoice_settings?: { default_payment_method: string | null } };
  if (customer.deleted) return NextResponse.json({ methods: [], defaultMethodId: null });

  const list = await stripe.paymentMethods.list({ customer: user.stripeCustomerId, type: "card", limit: 10 });
  const defaultMethodId = customer.invoice_settings?.default_payment_method ?? null;

  return NextResponse.json({
    methods: list.data.map(pm => ({
      id: pm.id,
      brand: pm.card?.brand ?? "card",
      last4: pm.card?.last4 ?? "••••",
      expMonth: pm.card?.exp_month,
      expYear: pm.card?.exp_year,
      funding: pm.card?.funding ?? "credit",
      isDefault: pm.id === defaultMethodId,
    })),
    defaultMethodId,
  });
}

// POST — create SetupIntent to save a new card
export async function POST(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "CUSTOMER") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const customerId = await getOrCreateStripeCustomer(user.id, user.email, user.name);
  const intent = await stripe.setupIntents.create({ customer: customerId, payment_method_types: ["card"] });

  return NextResponse.json({ clientSecret: intent.client_secret });
}
