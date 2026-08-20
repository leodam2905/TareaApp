const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Where Stripe sends someone back to, for flows that start in the mobile app.
//
// A pro who entered payout details, and a customer who paid for a booking, both
// used to land on the WEB dashboard and stop there: every return URL was
// hardcoded to a taptarea.com page, so the app had no way to get its own user
// back. Requests now say where they came from.
//
// Stripe validates these as http(s) URLs and rejects a custom scheme, so the
// app case cannot point at tarea:// directly. It points at a bridge page on our
// own domain (/stripe/return) which forwards to the app and offers the website
// if the app does not open.
export type ReturnTarget = "web" | "app";

/// Reads the caller's platform off a request body. Anything that is not
/// literally "app" is treated as the browser — an unknown value must not widen
/// where Stripe is allowed to send someone.
export function returnTarget(body: unknown): ReturnTarget {
  const platform = (body as { platform?: unknown } | null | undefined)?.platform;
  return platform === "app" ? "app" : "web";
}

/** Bridge URL for a flow, or the plain web page when not coming from the app. */
function bridge(to: "payouts" | "booking" | "bgcheck", stripe: string, id?: string): string {
  const params = new URLSearchParams({ to, stripe });
  if (id) params.set("id", id);
  return `${APP_URL}/stripe/return?${params.toString()}`;
}

/** Connect onboarding / Express dashboard links, for a pro. */
export function accountLinkUrls(target: ReturnTarget): {
  refresh_url: string;
  return_url: string;
} {
  if (target === "app") {
    return {
      refresh_url: bridge("payouts", "refresh"),
      return_url: bridge("payouts", "connected"),
    };
  }
  return {
    refresh_url: `${APP_URL}/handyman/payout-methods?stripe=refresh`,
    return_url: `${APP_URL}/handyman/payout-methods?stripe=connected`,
  };
}

/** Checkout success / cancel links, for a customer paying for a booking. */
export function checkoutReturnUrls(
  target: ReturnTarget,
  bookingId: string,
): { success_url: string; cancel_url: string } {
  if (target === "app") {
    return {
      // Stripe substitutes the session id, so the success page can still verify
      // the payment before telling anyone it worked.
      success_url: `${bridge("booking", "paid", bookingId)}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: bridge("booking", "cancelled", bookingId),
    };
  }
  return {
    success_url: `${APP_URL}/customer/pay/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/customer/bookings/${bookingId}`,
  };
}

/**
 * Tip and time-extension checkouts, which both end back on the same booking.
 *
 * `kind` only picks the wording on the return page — the destination is the
 * booking either way.
 */
export function bookingExtraReturnUrls(
  target: ReturnTarget,
  bookingId: string,
  kind: "tip" | "extension",
): { success_url: string; cancel_url: string } {
  const paid = kind === "tip" ? "tip_paid" : "ext_paid";
  if (target === "app") {
    return {
      success_url: bridge("booking", paid, bookingId),
      cancel_url: bridge("booking", "cancelled", bookingId),
    };
  }
  const q = kind === "tip" ? "tip=success" : "ext=paid";
  return {
    success_url: `${APP_URL}/customer/bookings/${bookingId}?${q}`,
    cancel_url: `${APP_URL}/customer/bookings/${bookingId}`,
  };
}

/**
 * The background-check fee, which a pro pays as part of onboarding.
 *
 * Worth routing back properly: it is a paid, mandatory step, and the screen
 * tracking the pro's setup progress is the one they just left.
 */
export function backgroundCheckReturnUrls(target: ReturnTarget): {
  success_url: string;
  cancel_url: string;
} {
  if (target === "app") {
    return {
      success_url: bridge("bgcheck", "paid"),
      cancel_url: bridge("bgcheck", "cancelled"),
    };
  }
  return {
    success_url: `${APP_URL}/handyman/onboarding?bg_check=success`,
    cancel_url: `${APP_URL}/handyman/onboarding?bg_check=cancelled`,
  };
}
