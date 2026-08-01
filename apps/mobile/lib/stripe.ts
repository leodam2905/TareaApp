// Client-side Stripe tokenization for payout bank accounts.
// Uses the publishable key to send raw bank details directly to Stripe's
// token API — the account number never touches the Tarea backend. The
// resulting token is exchanged for an external account server-side.

const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";

type BankTokenResult = { id?: string; error?: string };

export async function createBankAccountToken(params: {
  routingNumber: string;
  accountNumber: string;
  accountHolderName: string;
}): Promise<BankTokenResult> {
  if (!PUBLISHABLE_KEY || PUBLISHABLE_KEY.includes("placeholder")) {
    return { error: "Payments are not configured. Please contact support." };
  }

  const body = new URLSearchParams({
    "bank_account[country]": "US",
    "bank_account[currency]": "usd",
    "bank_account[routing_number]": params.routingNumber,
    "bank_account[account_number]": params.accountNumber,
    "bank_account[account_holder_name]": params.accountHolderName,
    "bank_account[account_holder_type]": "individual",
  });

  try {
    const res = await fetch("https://api.stripe.com/v1/tokens", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PUBLISHABLE_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    const data = await res.json();
    if (!res.ok) {
      return { error: data?.error?.message ?? "Could not validate your bank details." };
    }
    return { id: data.id as string };
  } catch {
    return { error: "Network error. Please check your connection and try again." };
  }
}

type CardTokenResult = { id?: string; error?: string };

// Tokenize a debit card for instant payouts. Card number/CVC go directly to
// Stripe — never to the Tarea backend. `currency` makes it a payout-capable
// external-account token (required to attach it to the connected account).
export async function createCardToken(params: {
  number: string;
  expMonth: string;
  expYear: string;
  cvc: string;
  name?: string;
}): Promise<CardTokenResult> {
  if (!PUBLISHABLE_KEY || PUBLISHABLE_KEY.includes("placeholder")) {
    return { error: "Payments are not configured. Please contact support." };
  }

  const body = new URLSearchParams({
    "card[number]": params.number,
    "card[exp_month]": params.expMonth,
    "card[exp_year]": params.expYear,
    "card[cvc]": params.cvc,
    "card[currency]": "usd",
    ...(params.name ? { "card[name]": params.name } : {}),
  });

  try {
    const res = await fetch("https://api.stripe.com/v1/tokens", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PUBLISHABLE_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    const data = await res.json();
    if (!res.ok) {
      return { error: data?.error?.message ?? "Could not validate your card details." };
    }
    if (data?.card?.funding && data.card.funding !== "debit") {
      return { error: "That looks like a credit card. Instant payouts require a debit card." };
    }
    return { id: data.id as string };
  } catch {
    return { error: "Network error. Please check your connection and try again." };
  }
}
