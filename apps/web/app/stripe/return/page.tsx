"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// Bridge between Stripe and the Tarea Pro app.
//
// Stripe only accepts http(s) in an account link's return_url, so it cannot
// send a pro straight back to tareapro://. This page is that return_url: it
// hands off to the app, and stays put as a way back if the app does not open
// (desktop browser, app uninstalled, scheme not registered on an old build).
function StripeReturn() {
  const params = useSearchParams();
  const stripe = params.get("stripe") === "refresh" ? "refresh" : "connected";
  const deepLink = `tareapro://app/pro/payout-methods?stripe=${stripe}`;
  const [handedOff, setHandedOff] = useState(false);

  useEffect(() => {
    // Assigning to location is what actually triggers the scheme handler; a
    // browser with no handler simply stays on this page.
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
          {stripe === "refresh" ? "Setup not finished" : "You're all set"}
        </h1>
        <p style={{ color: "#64748B", fontSize: 15, lineHeight: 1.5, margin: "0 0 20px" }}>
          {stripe === "refresh"
            ? "Head back to the Tarea Pro app to finish connecting your payout account."
            : "Returning you to the Tarea Pro app…"}
        </p>

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
          Open Tarea Pro
        </a>

        {handedOff && (
          <a
            href="/handyman/payout-methods"
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
