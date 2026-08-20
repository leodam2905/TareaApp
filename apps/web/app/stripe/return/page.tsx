"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

// Bridge between Stripe and the Tarea apps.
//
// Stripe only accepts http(s) in a return URL, so it cannot send someone
// straight back to tarea://. This page is that return URL: it hands off to the
// app, and stays put as a way back if the app does not open (desktop browser,
// app uninstalled, or a build older than 1.0.19 with no scheme registered).
//
// The destination is chosen from a fixed set. The booking id is the only value
// taken from the query string and it is checked against a strict pattern before
// being placed in a URL — nothing here should be able to redirect a user to an
// address an attacker composed.
const SCHEMES = {
  // The two apps register different schemes, so each flow must name its own.
  payouts: (q: string) => `tareapro://app/pro/payout-methods?stripe=${q}`,
  bgcheck: (q: string) => `tareapro://app/pro/background-check?stripe=${q}`,
  booking: (q: string, id: string) =>
    `tarea://app/booking-detail?stripe=${q}${id ? `&bookingId=${id}` : ""}`,
} as const;

const CANCELLED = {
  title: "Payment cancelled",
  body: "Nothing was charged. You can try again whenever you're ready.",
  escrow: false,
};

function copyFor(to: string, stripe: string) {
  if (stripe === "cancelled") return CANCELLED;

  if (to === "booking") {
    if (stripe === "tip_paid") {
      return {
        title: "Tip sent",
        body: "Thank you — your pro will receive it with their next payout.",
        escrow: false,
      };
    }
    if (stripe === "ext_paid") {
      return {
        title: "Extra time paid",
        body: "Your booking has been extended. Returning you to the Tarea app…",
        escrow: true,
      };
    }
    return { title: "Payment received", body: "Returning you to the Tarea app…", escrow: true };
  }

  if (to === "bgcheck") {
    return {
      title: "Background check paid",
      body: "Certn will email you a secure link to complete your screening. It usually takes 1–3 business days.",
      escrow: false,
    };
  }

  if (stripe === "refresh") {
    return {
      title: "Setup not finished",
      body: "Head back to the Tarea Pro app to finish connecting your payout account.",
      escrow: false,
    };
  }
  return { title: "You're all set", body: "Returning you to the Tarea Pro app…", escrow: false };
}

function StripeReturn() {
  const params = useSearchParams();

  const rawTo = params.get("to") ?? "";
  const to = rawTo === "booking" || rawTo === "bgcheck" ? rawTo : "payouts";

  const rawStripe = params.get("stripe") ?? "";
  const stripe = ["connected", "refresh", "paid", "cancelled", "tip_paid", "ext_paid"].includes(
    rawStripe,
  )
    ? rawStripe
    : "connected";

  // Booking ids are cuids. Anything else is discarded rather than echoed.
  const rawId = params.get("id") ?? "";
  const id = /^[a-z0-9]{1,40}$/i.test(rawId) ? rawId : "";

  const deepLink =
    to === "booking"
      ? SCHEMES.booking(stripe, id)
      : to === "bgcheck"
        ? SCHEMES.bgcheck(stripe)
        : SCHEMES.payouts(stripe);
  const webFallback =
    to === "booking"
      ? "/customer/bookings"
      : to === "bgcheck"
        ? "/handyman/onboarding"
        : "/handyman/payout-methods";
  const { title, body, escrow } = copyFor(to, stripe);

  const [handedOff, setHandedOff] = useState(false);

  useEffect(() => {
    window.location.href = deepLink;
    const t = setTimeout(() => setHandedOff(true), 1200);
    return () => clearTimeout(t);
  }, [deepLink]);

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        fontFamily: "system-ui, -apple-system, sans-serif",
        background: "#F6F8FB",
      }}
    >
      <div style={{ maxWidth: 380, width: "100%", textAlign: "center" }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", margin: "0 0 8px" }}>
          {title}
        </h1>
        <p style={{ color: "#64748B", fontSize: 15, lineHeight: 1.5, margin: "0 0 16px" }}>{body}</p>

        {escrow && (
          <p
            style={{
              background: "#EFF6FF",
              color: "#1D4ED8",
              fontSize: 14,
              lineHeight: 1.5,
              fontWeight: 600,
              textAlign: "left",
              padding: "12px 14px",
              borderRadius: 12,
              margin: "0 0 20px",
            }}
          >
            Your payment is held securely by Tarea. It is released to your pro only after the job is
            complete and you have confirmed it.
          </p>
        )}

        <a
          href={deepLink}
          style={{
            display: "block",
            background: "#2563EB",
            color: "#fff",
            fontWeight: 700,
            padding: "14px 16px",
            borderRadius: 14,
            textDecoration: "none",
          }}
        >
          {to === "booking" ? "Open Tarea" : "Open Tarea Pro"}
        </a>

        {handedOff && (
          <a
            href={webFallback}
            style={{
              display: "block",
              marginTop: 12,
              color: "#64748B",
              fontWeight: 600,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            Continue in the browser instead
          </a>
        )}
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <StripeReturn />
    </Suspense>
  );
}
