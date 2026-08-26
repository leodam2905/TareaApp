import type { MetadataRoute } from "next";
import { allFixPages } from "@/lib/seo/content";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://taptarea.com";

// Only pages a signed-out visitor can actually open.
//
// Listing an authenticated route would be worse than omitting it: the crawler
// follows it, gets a 307 to /login, and learns that taptarea.com answers
// redirects for content it was promised. Everything under /customer, /handyman
// and /admin is behind middleware, and /chat, /notifications, /account and
// /stripe/return are per-user pages with nothing to index.
const PUBLIC_ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/",           priority: 1.0, changeFrequency: "weekly" },
  // The two tools are the reason to index this site at all: they answer a
  // question a person actually typed into a search box.
  { path: "/diagnose",   priority: 0.9, changeFrequency: "weekly" },
  { path: "/browse",     priority: 0.8, changeFrequency: "daily" },
  { path: "/guarantee",  priority: 0.6, changeFrequency: "monthly" },
  { path: "/contact",    priority: 0.5, changeFrequency: "monthly" },
  { path: "/terms",      priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacy",    priority: 0.3, changeFrequency: "yearly" },
  { path: "/delete-account", priority: 0.3, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const core = PUBLIC_ROUTES.map((r) => ({
    url: `${BASE}${r.path}`,
    lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  // The generated /fix pages. Read from committed JSON, so the sitemap can
  // never advertise a page that was not built — the two come from one source.
  // Priority 0.7: below the tools they funnel into, above the legal pages.
  const fix = allFixPages().map((p) => ({
    url: `${BASE}/fix/${p.city}/${p.problem}`,
    lastModified: new Date(p.generatedAt),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...core, ...fix];
}
