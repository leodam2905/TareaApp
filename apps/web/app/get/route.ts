import { NextRequest, NextResponse } from "next/server";

// One link to hand out: taptarea.com/get
//
// Sending people a raw store URL means picking the wrong one for half of them —
// an Android user tapping an App Store link gets a dead end, and nobody
// forwards a message that says "iPhone use this, Android use that". This reads
// the user agent and sends each device to the store it can actually install
// from; a desktop gets the landing page, where both badges are.
export const dynamic = "force-dynamic";

export const STORE = {
  customer: {
    ios: "https://apps.apple.com/app/id6784023441",
    android: "https://play.google.com/store/apps/details?id=com.taptarea.customer",
  },
  pro: {
    ios: "https://apps.apple.com/app/id6784029141",
    android: "https://play.google.com/store/apps/details?id=com.taptarea.handyman",
  },
} as const;

export function storeRedirect(req: NextRequest, app: keyof typeof STORE) {
  const ua = req.headers.get("user-agent") ?? "";
  // iPadOS reports as Macintosh with touch, so the naive iPad check misses it;
  // Android must be tested before the generic Linux/mobile shapes.
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && /Mobile/i.test(ua));
  const isAndroid = /Android/i.test(ua);

  if (isIOS) return NextResponse.redirect(STORE[app].ios, 302);
  if (isAndroid) return NextResponse.redirect(STORE[app].android, 302);
  // Desktop, a crawler, or something unrecognised: the landing page carries
  // both badges and explains what the app is, which is a better answer than
  // guessing a store the visitor cannot use.
  //
  // The origin comes from config, NOT from req.url — behind Cloud Run that
  // resolves to the container's own address and sent desktop visitors to
  // https://0.0.0.0:3000.
  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://taptarea.com";
  return NextResponse.redirect(`${origin}/?from=get${app === "pro" ? "-pro" : ""}`, 302);
}

export function GET(req: NextRequest) {
  return storeRedirect(req, "customer");
}
