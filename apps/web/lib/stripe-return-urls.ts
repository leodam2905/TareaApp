const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Where Stripe sends a pro back to after an account link.
//
// A pro who started in the mobile app used to land on the WEB dashboard and
// stop there: both URLs below were hardcoded to /handyman/payout-methods, so
// the app had no way to get its own user back. Requests now say where they
// came from.
//
// Stripe validates these as http(s) URLs and rejects a custom scheme, so the
// app case cannot point at tareapro:// directly. It points at a bridge page on
// our own domain (/stripe/return) which forwards to the app and offers the web
// dashboard if the app does not open.
export type ReturnTarget = "web" | "app";

/// Reads the caller's platform off a request body. Anything that is not
/// literally "app" is treated as the browser — an unknown value must not widen
/// where Stripe is allowed to send someone.
export function returnTarget(body: unknown): ReturnTarget {
  const platform = (body as { platform?: unknown } | null | undefined)?.platform;
  return platform === "app" ? "app" : "web";
}

export function accountLinkUrls(target: ReturnTarget): {
  refresh_url: string;
  return_url: string;
} {
  const base =
    target === "app"
      ? `${APP_URL}/stripe/return`
      : `${APP_URL}/handyman/payout-methods`;
  return {
    refresh_url: `${base}?stripe=refresh`,
    return_url: `${base}?stripe=connected`,
  };
}
