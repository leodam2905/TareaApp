import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://taptarea.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Disallowing these is about crawl budget and noise, not secrecy —
        // they are already protected by middleware and auth. A crawler that
        // spends its budget on /login redirects is not reading /diagnose.
        disallow: [
          "/api/",
          "/admin/",
          "/customer/",
          "/handyman/",
          "/account/",
          "/notifications",
          "/chat/",
          "/stripe/",
          "/login",
          "/register",
          "/reset-password",
          "/forgot-password",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
