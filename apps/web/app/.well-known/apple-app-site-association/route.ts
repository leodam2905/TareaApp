import { NextResponse } from "next/server";

// Apple's Universal Links manifest.
//
// Served from a route handler rather than public/ on purpose: the file must be
// returned as application/json and it has NO extension, so Next's static
// handler would label it application/octet-stream and iOS would reject it. It
// must also be reachable over https with no redirect — Apple does not follow
// one — which is why there is no trailing-slash variant.
//
// TEAM ID GZT8C3C2A2. The SHIPPED bundle IDs are the same on both platforms:
//   com.taptarea.customer  /  com.taptarea.handyman
// `com.taptarea.tarea` is only the repo's checked-in default, which
// tool/swap_ios_app.sh rewrites before every store build — an earlier version
// of this file claimed it for the customer app, so iOS would never have matched
// the app people actually install. It is listed alongside so local dev builds
// resolve links too. Do not copy fingerprints between this file and
// assetlinks.json; Android's are certificate hashes, not bundle IDs.
//
// PATH SCOPING is what keeps the two apps apart, since both claim taptarea.com.
// `components` is evaluated in order and the FIRST match wins, so the exclusions
// must stay above the includes.
const AASA = {
  applinks: {
    details: [
      {
        // Tarea (customer)
        appIDs: [
          "GZT8C3C2A2.com.taptarea.customer", // shipped
          "GZT8C3C2A2.com.taptarea.tarea",    // local dev default
        ],
        components: [
          // Stripe onboarding returns through the website, which then forwards
          // to the tarea:// scheme. Claiming these paths would intercept that
          // hop and break a payment flow that currently works.
          { "/": "/stripe/*", exclude: true },
          { "/": "/customer/*" },
          { "/": "/chat/*" },
        ],
      },
      {
        // Tarea Pro
        appIDs: ["GZT8C3C2A2.com.taptarea.handyman"],
        components: [
          { "/": "/stripe/*", exclude: true },
          { "/": "/handyman/*" },
        ],
      },
    ],
  },
  // Lets an installed app be offered when the site is opened in Safari.
  webcredentials: {
    apps: [
      "GZT8C3C2A2.com.taptarea.customer",
      "GZT8C3C2A2.com.taptarea.tarea",
      "GZT8C3C2A2.com.taptarea.handyman",
    ],
  },
};

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(AASA, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
