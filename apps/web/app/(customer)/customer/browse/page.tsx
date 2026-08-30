"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Star, Navigation, ShieldCheck, Loader2, Search } from "lucide-react";
import { SERVICE_CATEGORIES } from "@/lib/service-catalog";

type Pro = {
  id: string;
  name: string;
  avatarUrl: string | null;
  city: string | null;
  isVerified: boolean;
  distanceMiles: number | null;
  handymanProfile: {
    bio: string | null;
    hourlyRate: number | null;
    rating: number;
    totalJobs: number;
    yearsExperience: number | null;
  } | null;
  services: { title: string; category: string }[];
  trust?: { licensed?: boolean; insured?: boolean; backgroundChecked?: boolean };
  match?: { band: "excellent" | "great" | "good" | "fair"; reasons: string[] };
};

// Mirrors the app's Browse Pros.
//
// This was a 3-step Category -> When -> Choose wizard with a map, while the app
// showed a directory: category chips, filter pills, and a card per pro. Two
// different products for the same job. Web follows mobile, so this is the
// directory — same filters, same card, same order.

// Mirrors the app's browse.band / browse.reason keys, so the two clients
// describe the same ranking in the same words.
const MATCH_BAND_LABEL: Record<string, string> = {
  excellent: "Excellent match", great: "Great match", good: "Good match", fair: "Match",
};
// Not red at the bottom: "fair" is often just a new pro, and a warning colour
// would libel somebody perfectly capable.
const MATCH_BAND_CLASS: Record<string, string> = {
  excellent: "text-emerald-600", great: "text-blue-600",
  good: "text-slate-500", fair: "text-slate-400",
};
const MATCH_REASON_LABEL: Record<string, string> = {
  licensed_insured: "Licensed & insured", licensed: "Licensed", insured: "Insured",
  highly_rated: "Highly rated", experienced: "Experienced",
  fast_replies: "Replies fast", nearby: "Nearby", new_pro: "New to Tarea",
};

export default function BrowsePage() {
  const [pros, setPros] = useState<Pro[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<string>("ALL");
  const [nearMe, setNearMe] = useState(false);
  const [sort, setSort] = useState<"best" | "rating">("best");
  const [outsideRadius, setOutsideRadius] = useState(false);

  useEffect(() => {
    // Send the customer's position so the server can return pros within 60
    // miles, nearest first — same as the app. Refused location just means an
    // unsorted list, never an empty one.
    const load = (query = "") =>
      fetch(`/api/handyman/browse${query}`)
        .then((r) => r.json())
        .then((d) => {
          setPros(Array.isArray(d) ? d : d.handymen ?? d.pros ?? []);
          // The server says so when nobody was actually within range, so the
          // list can be honest about it instead of implying these pros are
          // nearby.
          setOutsideRadius(!Array.isArray(d) && d.outsideRadius === true);
        })
        .catch(() => setPros([]))
        .finally(() => setLoading(false));

    if (!navigator.geolocation) { load(); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => load(`?lat=${p.coords.latitude}&lng=${p.coords.longitude}`),
      () => load(),
      { timeout: 8000 },
    );
  }, []);

  const filtered = useMemo(() => {
    let list = pros.filter((p) =>
      cat === "ALL" ? true : p.services?.some((s) => s.category === cat),
    );
    if (nearMe) list = list.filter((p) => p.distanceMiles == null || p.distanceMiles <= 60);
    // No price sort. Ranking by cheapest is the strongest incentive to
    // undercut there is, and it would defeat hiding the rate on the card. The
    // default order is match quality — see lib/matching.ts.
    if (sort === "rating") {
      list = [...list].sort((a, b) => (b.handymanProfile?.rating ?? 0) - (a.handymanProfile?.rating ?? 0));
    }
    return list;
  }, [pros, cat, nearMe, sort]);

  const pill = (label: string, on: boolean, onClick: () => void, Icon?: typeof Navigation) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold border transition-colors ${
        on ? "bg-tarea-sky text-tarea-ink border-tarea-sky" : "border-[var(--card-border-2)] hover:border-tarea-sky"
      }`}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {label}
    </button>
  );

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-black mb-1">Browse Pros</h1>
      <p className="text-[var(--text-muted)] mb-5">Near you</p>

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-3 -mx-1 px-1">
        {pill("All", cat === "ALL", () => setCat("ALL"))}
        {SERVICE_CATEGORIES.map((c) => pill(c.name, cat === c.api, () => setCat(c.api)))}
      </div>

      {/* Filters — the same three the app offers */}
      <div className="flex flex-wrap gap-2 mb-6">
        {pill("Within 60 mi", nearMe, () => setNearMe((v) => !v), Navigation)}
        {pill("Top rated", sort === "rating", () => setSort(sort === "rating" ? "best" : "rating"))}
      </div>

      {outsideRadius && !loading && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          No pros in your area yet — showing the nearest available. Distances are on each card.
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
          <Loader2 className="w-4 h-4 animate-spin" /> Finding pros near you…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-10 text-center">
          <Search className="w-10 h-10 mx-auto mb-3 text-[var(--text-subtle)]" />
          <p className="font-bold">No pros match your filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const hp = p.handymanProfile;
            return (
              <div key={p.id} className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-full bg-tarea-sky/10 flex items-center justify-center overflow-hidden shrink-0">
                    {p.avatarUrl
                      ? /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={p.avatarUrl} alt="" className="w-full h-full object-cover" />
                      : <span className="text-xl font-black text-tarea-sky">{p.name[0]}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-lg truncate">{p.name}</p>
                    <div className="flex items-center gap-2 text-sm mt-0.5">
                      <span className="flex items-center gap-1 text-amber-500 font-bold">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        {hp?.rating ? hp.rating.toFixed(1) : "New"}
                      </span>
                      {!!hp?.totalJobs && (
                        <span className="text-[var(--text-muted)]">({hp.totalJobs} reviews)</span>
                      )}
                      {p.distanceMiles != null && (
                        <span className="text-[var(--text-muted)]">· {Math.round(p.distanceMiles)} mi away</span>
                      )}
                    </div>
                    {!!hp?.yearsExperience && (
                      <p className="text-sm text-[var(--text-muted)] mt-0.5">
                        {hp.yearsExperience}+ years experience
                      </p>
                    )}
                    {/* Why this pro sits where they do. The list is ordered
                        credentials-first then by fit, and an unexplained order
                        reads as arbitrary — or as paid placement. */}
                    {p.match?.band && (
                      <p className={`text-xs font-bold mt-2 ${MATCH_BAND_CLASS[p.match.band]}`}>
                        {MATCH_BAND_LABEL[p.match.band]}
                        {p.match.reasons?.length > 0 && (
                          <span className="font-normal text-[var(--text-muted)]">
                            {" · "}{p.match.reasons.slice(0, 3).map(r => MATCH_REASON_LABEL[r] ?? r).join(" · ")}
                          </span>
                        )}
                      </p>
                    )}
                    {/* Badges mean approved and unexpired, not "a file was
                        uploaded" — same rule the app renders. */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {p.trust?.licensed && <Badge label="Licensed" />}
                      {p.trust?.insured && <Badge label="Insured" />}
                      {p.trust?.backgroundChecked && <Badge label="Background checked" />}
                    </div>
                    {hp?.bio && (
                      <p className="text-sm text-[var(--text-muted)] mt-2 line-clamp-2">{hp.bio}</p>
                    )}
                    {!!p.services?.length && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {p.services.slice(0, 4).map((s) => (
                          <span key={s.title} className="text-xs px-2 py-1 rounded-lg bg-white/10">
                            {s.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* The rate is NOT on the card, deliberately.
                    A price on every tile makes price the axis customers compare
                    on, and the cheapest pro wins by being cheapest. The rate is
                    shown when a pro is opened, before any commitment. */}
                <div className="flex items-center justify-end mt-4 pt-4 border-t border-white/10">
                  <Link
                    href={`/customer/handymen/${p.id}`}
                    className="bg-tarea-sky text-tarea-ink font-bold px-5 py-2.5 rounded-xl hover:bg-sky-300 transition-all text-sm"
                  >
                    View Profile
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600">
      <ShieldCheck className="w-3 h-3" /> {label}
    </span>
  );
}
