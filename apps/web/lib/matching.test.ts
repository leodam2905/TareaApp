import { describe, it, expect } from "vitest";
import {
  matchScore, matchQuality, credentialTier, compareForCustomer,
  ratingScore, isAvailableAt, type Rankable,
} from "./matching";

const pro = (o: Partial<Rankable> = {}): Rankable => ({
  rating: 4.5, totalJobs: 20, responseTime: 30,
  isPremium: false, distanceKm: 10, ...o,
});

describe("credential ordering", () => {
  it("puts licensed AND insured above one credential, above none", () => {
    expect(credentialTier(pro({ licensed: true, insured: true }))).toBe(2);
    expect(credentialTier(pro({ licensed: true }))).toBe(1);
    expect(credentialTier(pro())).toBe(0);
  });

  it("outranks quality — an uninsured pro cannot out-review their way to the top", () => {
    // This is the whole point of a tier rather than a boost: the risk an
    // uninsured pro carries does not shrink as their rating improves.
    const best = pro({ rating: 5, totalJobs: 500, responseTime: 1, distanceKm: 0 });
    const credentialed = pro({ rating: 3, totalJobs: 1, responseTime: 240, distanceKm: 90, licensed: true, insured: true });
    expect(matchScore(best)).toBeGreaterThan(matchScore(credentialed));
    expect(compareForCustomer(credentialed, best)).toBeLessThan(0); // credentialed sorts first
  });

  it("falls back to fit within the same tier", () => {
    const strong = pro({ rating: 4.9, totalJobs: 80, licensed: true, insured: true });
    const weak   = pro({ rating: 3.2, totalJobs: 3,  licensed: true, insured: true });
    expect(compareForCustomer(strong, weak)).toBeLessThan(0);
  });

  it("sorts a real list credentials-first, quality-second", () => {
    const list = [
      pro({ rating: 5.0, totalJobs: 200 }),                                  // great, no papers
      pro({ rating: 3.5, totalJobs: 5,  licensed: true }),                   // one paper
      pro({ rating: 4.0, totalJobs: 10, licensed: true, insured: true }),    // both
      pro({ rating: 4.8, totalJobs: 90, licensed: true, insured: true }),    // both, better
    ];
    const order = [...list].sort(compareForCustomer).map((p) => credentialTier(p));
    expect(order).toEqual([2, 2, 1, 0]);
    expect([...list].sort(compareForCustomer)[0].rating).toBe(4.8);
  });
});

describe("matchQuality", () => {
  it("bands a strong pro as excellent and says why", () => {
    const q = matchQuality(pro({ rating: 4.9, totalJobs: 60, responseTime: 10, distanceKm: 3, licensed: true, insured: true }));
    expect(q.band).toBe("excellent");
    expect(q.reasons).toContain("licensed_insured");
    expect(q.reasons).toContain("highly_rated");
    expect(q.reasons).toContain("fast_replies");
    expect(q.reasons).toContain("nearby");
  });

  it("does not label a brand-new pro as bad, but does say they are new", () => {
    // A new pro scores off the rating prior, so they must not read as a warning.
    const q = matchQuality(pro({ rating: 0, totalJobs: 0, responseTime: 60, distanceKm: null }));
    expect(q.reasons).toContain("new_pro");
    expect(["good", "great"]).toContain(q.band);
  });

  it("never claims a credential the pro does not hold", () => {
    const q = matchQuality(pro({ licensed: false, insured: false }));
    expect(q.licensed).toBe(false);
    expect(q.reasons).not.toContain("licensed_insured");
    expect(q.reasons).not.toContain("licensed");
    expect(q.reasons).not.toContain("insured");
  });

  it("reports one credential without implying both", () => {
    const q = matchQuality(pro({ insured: true }));
    expect(q.reasons).toContain("insured");
    expect(q.reasons).not.toContain("licensed_insured");
  });
});

describe("ratingScore", () => {
  it("does not let one 5-star review beat a long good record", () => {
    expect(ratingScore(5, 1)).toBeLessThan(ratingScore(4.8, 40));
  });
});

describe("isAvailableAt", () => {
  it("treats no stated availability as available", () => {
    expect(isAvailableAt([], new Date("2026-09-01T10:00:00"))).toBe(true);
  });
});


describe("a licence only outranks quality where the trade is regulated", () => {
  it("counts the licence in a regulated trade", () => {
    // Plumbing: the law asks for a licence, so holding one is a real distinction.
    expect(credentialTier(pro({ licensed: true, insured: true }), true)).toBe(2);
    expect(credentialTier(pro({ licensed: true }), true)).toBe(1);
  });

  it("ignores it where no licence is required, but still counts insurance", () => {
    // Cleaning, moving, assembly: a licensed pro gets no ranking advantage,
    // because sorting on a document the job never needed buries good pros.
    expect(credentialTier(pro({ licensed: true }), false)).toBe(0);
    expect(credentialTier(pro({ insured: true }), false)).toBe(1);
    expect(credentialTier(pro({ licensed: true, insured: true }), false)).toBe(1);
  });

  it("lets an excellent unlicensed cleaner beat a mediocre licensed one", () => {
    const great = pro({ rating: 4.9, totalJobs: 120, insured: true });
    const mediocreLicensed = pro({ rating: 3.4, totalJobs: 4, licensed: true, insured: true });
    // Regulated trade: the licence wins.
    expect(compareForCustomer(mediocreLicensed, great, true)).toBeLessThan(0);
    // Unregulated: quality wins, which is the whole point of the fix.
    expect(compareForCustomer(great, mediocreLicensed, false)).toBeLessThan(0);
  });

  it("insurance still outranks quality even when a licence does not", () => {
    const uninsuredStar = pro({ rating: 5, totalJobs: 300, distanceKm: 1 });
    const insuredAverage = pro({ rating: 4.0, totalJobs: 8, insured: true });
    expect(compareForCustomer(insuredAverage, uninsuredStar, false)).toBeLessThan(0);
  });
});