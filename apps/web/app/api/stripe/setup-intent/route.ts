import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getCurrentUser } from "@/lib/auth";
import { getOrCreateStripeCustomer } from "@/lib/payment-hold";

// POST /api/stripe/setup-intent
// Saves a card for later use. Called when the customer books — no money moves.
// The saved method is what we place the authorization hold against once a Pro
// accepts, and what add-ons are charged to during the job.
export async function POST(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const customerId = await getOrCreateStripeCustomer(user.id);

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    // The customer is present now, but the resulting charges happen later
    // without them — authenticating here is what makes those charges possible.
    usage: "off_session",
    payment_method_types: ["card"],
    metadata: { tareaUserId: user.id },
  });

  return NextResponse.json({ clientSecret: setupIntent.client_secret, customerId });
}
