// The corpus definition for the programmatic pages.
//
// Deliberately hand-written rather than generated. These are the terms real
// people type, and an LLM asked to invent "50 plumbing problems" produces a
// long tail nobody searches for. Fewer, real problems beat more, plausible ones
// — Google's helpful-content system exists to punish the second kind.
//
// Scale check: 8 cities x the problems below = ~300 pages, not thousands. Every
// page has to earn its place, because a corpus of near-duplicates is a spam
// signal, not a growth strategy.

export interface SeoCity {
  slug: string;
  name: string;
  /** Shown in copy so pages differ by more than a find-and-replace. */
  context: string;
}

/** Launch market only. Tarea matches pros by distance from the customer, so a
 *  page for a city with no pros within range is a promise the app cannot keep. */
export const SEO_CITIES: SeoCity[] = [
  { slug: "los-angeles", name: "Los Angeles", context: "a mix of pre-war bungalows, mid-century homes and new-build apartments" },
  { slug: "santa-monica", name: "Santa Monica", context: "coastal air that is hard on fixtures and exterior hardware" },
  { slug: "pasadena", name: "Pasadena", context: "older Craftsman and Spanish-revival housing stock" },
  { slug: "long-beach", name: "Long Beach", context: "a mix of older duplexes, bungalows and waterfront condos" },
  { slug: "glendale", name: "Glendale", context: "hillside homes and mid-century apartment buildings" },
  { slug: "burbank", name: "Burbank", context: "post-war single-family homes, many with original plumbing" },
  { slug: "inglewood", name: "Inglewood", context: "older single-family homes and recently renovated rentals" },
  { slug: "torrance", name: "Torrance", context: "suburban single-family homes built largely in the 1950s and 60s" },
];

export interface SeoProblem {
  slug: string;
  /** The page title. Phrased the way somebody searches, not the way a
   *  contractor writes an invoice. */
  title: string;
  category: string;
  /** Roughly how long the job runs, used to turn an hourly rate into a range. */
  hoursLow: number;
  hoursHigh: number;
}

export const SEO_PROBLEMS: SeoProblem[] = [
  { slug: "leaky-faucet-repair", title: "Leaky faucet repair", category: "PLUMBING", hoursLow: 1, hoursHigh: 2 },
  { slug: "running-toilet-repair", title: "Running toilet repair", category: "PLUMBING", hoursLow: 1, hoursHigh: 2 },
  { slug: "clogged-drain-cleaning", title: "Clogged drain cleaning", category: "PLUMBING", hoursLow: 1, hoursHigh: 3 },
  { slug: "garbage-disposal-replacement", title: "Garbage disposal replacement", category: "PLUMBING", hoursLow: 1, hoursHigh: 2 },
  { slug: "light-fixture-installation", title: "Light fixture installation", category: "ELECTRICAL", hoursLow: 1, hoursHigh: 2 },
  { slug: "ceiling-fan-installation", title: "Ceiling fan installation", category: "ELECTRICAL", hoursLow: 2, hoursHigh: 3 },
  { slug: "outlet-not-working", title: "Outlet not working", category: "ELECTRICAL", hoursLow: 1, hoursHigh: 2 },
  { slug: "tv-wall-mounting", title: "TV wall mounting", category: "ASSEMBLY_MOUNTING", hoursLow: 1, hoursHigh: 2 },
  { slug: "furniture-assembly", title: "Furniture assembly", category: "ASSEMBLY_MOUNTING", hoursLow: 1, hoursHigh: 3 },
  { slug: "drywall-hole-repair", title: "Drywall hole repair", category: "CARPENTRY", hoursLow: 2, hoursHigh: 4 },
  { slug: "interior-door-repair", title: "Interior door repair", category: "CARPENTRY", hoursLow: 1, hoursHigh: 3 },
  { slug: "cabinet-door-adjustment", title: "Cabinet door adjustment", category: "CARPENTRY", hoursLow: 1, hoursHigh: 2 },
  { slug: "room-painting", title: "Room painting", category: "PAINTING", hoursLow: 4, hoursHigh: 8 },
  { slug: "deep-cleaning", title: "Deep cleaning", category: "CLEANING", hoursLow: 3, hoursHigh: 6 },
  { slug: "move-out-cleaning", title: "Move-out cleaning", category: "CLEANING", hoursLow: 4, hoursHigh: 8 },
  { slug: "dishwasher-installation", title: "Dishwasher installation", category: "APPLIANCE_REPAIR", hoursLow: 2, hoursHigh: 3 },
];

export const seoPairs = () =>
  SEO_CITIES.flatMap((city) => SEO_PROBLEMS.map((problem) => ({ city, problem })));
