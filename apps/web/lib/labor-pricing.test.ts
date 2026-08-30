import { describe, it, expect } from "vitest";
import { resolveRate, quoteLabor, quoteExtraTime, formatMinutes, quoteRange,
         resolveMinimumMinutes, DEFAULT_MINIMUM_MINUTES } from "./labor-pricing";
import { grossHourlyFor, grossTravel } from "./pricing-config";
import { CUSTOMER_FEE_RATE } from "./fees";

describe("resolveRate", () => {
  it("prefers the rate the pro set for this category", () => {
    const r = resolveRate({ serviceHourlyRate: 95, profileHourlyRate: 70, category: "PLUMBING" });
    expect(r).toEqual({ hourlyRate: 95, source: "pro_service" });
  });

  it("falls back to the profile rate when the category has none", () => {
    const r = resolveRate({ serviceHourlyRate: null, profileHourlyRate: 70, category: "PLUMBING" });
    expect(r).toEqual({ hourlyRate: 70, source: "pro_profile" });
  });

  it("falls back to the rate card when the pro has set nothing", () => {
    const r = resolveRate({ serviceHourlyRate: null, profileHourlyRate: null, category: "PLUMBING" });
    expect(r).toEqual({ hourlyRate: grossHourlyFor("PLUMBING"), source: "rate_card" });
  });

  it("treats a zero rate as unset rather than as free", () => {
    // A pro row seeded with hourlyRate 0 must not produce a $0 job.
    const r = resolveRate({ serviceHourlyRate: 0, profileHourlyRate: 0, category: "GENERAL" });
    expect(r.source).toBe("rate_card");
    expect(r.hourlyRate).toBeGreaterThan(0);
  });
});

describe("quoteLabor", () => {
  it("is rate/60 x minutes, plus travel", () => {
    const q = quoteLabor({ hourlyRate: 120, estimatedBillableMinutes: 90 });
    expect(q.labor).toBe(180);                       // 120/60 * 90
    expect(q.travel).toBeCloseTo(grossTravel(), 2);
    expect(q.initialLaborAmount).toBeCloseTo(180 + grossTravel(), 2);
    expect(q.minimumApplied).toBe(false);
  });

  it("bills the minimum TIME, not a minimum price", () => {
    const q = quoteLabor({ hourlyRate: 60, estimatedBillableMinutes: 15 });
    expect(q.estimatedBillableMinutes).toBe(15);   // the estimate stays honest
    expect(q.billableMinutes).toBe(60);            // an hour is billed
    expect(q.labor).toBe(60);                      // 60/60 * 60
    expect(q.minimumApplied).toBe(true);
  });

  it("applies urgency to labour only, not to travel", () => {
    const plain  = quoteLabor({ hourlyRate: 200, estimatedBillableMinutes: 120 });
    const urgent = quoteLabor({ hourlyRate: 200, estimatedBillableMinutes: 120, urgent: true });
    expect(urgent.urgency).toBeCloseTo(plain.labor * 0.2, 2);
    expect(urgent.travel).toBeCloseTo(plain.travel, 2);
  });

  it("honours a snapshot minimum over today's default", () => {
    // Re-deriving an old booking must reproduce the minimum it was sold under.
    const q = quoteLabor({ hourlyRate: 50, estimatedBillableMinutes: 30, minimumMinutes: 120 });
    expect(q.billableMinutes).toBe(120);
    expect(q.labor).toBe(100); // 50/60 * 120
  });

  it("still bills the minimum hour for a zero-minute estimate", () => {
    const q = quoteLabor({ hourlyRate: 100, estimatedBillableMinutes: 0 });
    expect(q.billableMinutes).toBe(60);
    expect(q.labor).toBe(100);
  });
});

describe("quoteExtraTime", () => {
  it("is pure rate x time — no travel, no floor", () => {
    // The pro is already on site. Re-charging the call-out minimum for fifteen
    // extra minutes is the bug this guards.
    expect(quoteExtraTime({ hourlyRate: 120, additionalMinutes: 15 })).toBe(30);
    expect(quoteExtraTime({ hourlyRate: 80, additionalMinutes: 60 })).toBe(80);
  });

  it("is zero for zero minutes", () => {
    expect(quoteExtraTime({ hourlyRate: 120, additionalMinutes: 0 })).toBe(0);
  });
});

describe("formatMinutes", () => {
  it("reads the way a customer would say it", () => {
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(60)).toBe("1h");
    expect(formatMinutes(90)).toBe("1h 30m");
    expect(formatMinutes(0)).toBe("0m");
  });
});


describe("quoteRange", () => {
  const base = { proCount: 5, estimatedBillableMinutes: 90 };

  it("quotes the spread of what pros charge, fee included", () => {
    const r = quoteRange({ ...base, minRate: 60, maxRate: 120 });
    // Low end: 60/60*90 = 90, +30 travel = 120, x1.25 = 150
    expect(r.lowTotal).toBe(150);
    // High end: 120/60*90 = 180, +30 travel = 210, x1.25 = 262.5
    expect(r.highTotal).toBe(262.5);
    expect(r.single).toBe(false);
  });

  it("both ends include the fee — SB 478 makes a range an advertised price", () => {
    const r = quoteRange({ ...base, minRate: 100, maxRate: 100 });
    const labour = quoteLabor({ hourlyRate: 100, estimatedBillableMinutes: 90 });
    expect(r.lowTotal).toBeCloseTo(labour.initialLaborAmount * (1 + CUSTOMER_FEE_RATE), 2);
  });

  it("reports a single price when only one pro qualifies", () => {
    const r = quoteRange({ ...base, proCount: 1, minRate: 95, maxRate: 95 });
    expect(r.single).toBe(true);
    expect(r.lowTotal).toBe(r.highTotal);
  });

  it("keeps the range open on a short job — the bug the time minimum fixed", () => {
    // A DOLLAR floor collapsed this to "$150 - $150": every pro from $50 to
    // $150/hr was charged an identical $120, so the rate decided nothing and
    // the platform was setting one price for every competing pro. A TIME
    // minimum keeps them apart, because the rate still does the arithmetic.
    const r = quoteRange({ ...base, estimatedBillableMinutes: 15, minRate: 50, maxRate: 150 });
    expect(r.lowTotal).toBeLessThan(r.highTotal);
    expect(r.single).toBe(false);
  });

  it("never renders backwards, even if handed a swapped pair", () => {
    const r = quoteRange({ ...base, minRate: 150, maxRate: 50 });
    expect(r.lowRate).toBe(50);
    expect(r.highRate).toBe(150);
    expect(r.lowTotal).toBeLessThan(r.highTotal);
  });
});

describe("applicants quoted on the same job", () => {
  // The customer is shown an interval built from real rates. It only means
  // anything if every applicant is then priced the same way: same minutes,
  // their own rate. This pins that relationship.
  const MINUTES = 90;
  const quoteFor = (rate: number) =>
    quoteLabor({ hourlyRate: rate, estimatedBillableMinutes: MINUTES }).initialLaborAmount;

  it("lands inside the interval the customer was shown", () => {
    const shown = quoteRange({ minRate: 60, maxRate: 120, proCount: 5, estimatedBillableMinutes: MINUTES });
    // Applicants' labour subtotals, before the customer fee the range includes.
    for (const rate of [60, 85, 95, 120]) {
      const labour = quoteFor(rate);
      expect(labour * 1.25).toBeGreaterThanOrEqual(shown.lowTotal - 0.01);
      expect(labour * 1.25).toBeLessThanOrEqual(shown.highTotal + 0.01);
    }
  });

  it("orders applicants by rate, so a cheaper pro is genuinely cheaper", () => {
    expect(quoteFor(60)).toBeLessThan(quoteFor(95));
    expect(quoteFor(95)).toBeLessThan(quoteFor(120));
  });

  it("prices two pros at the same rate identically", () => {
    // Same job, same minutes, same rate — nothing else may move the number.
    expect(quoteFor(95)).toBe(quoteFor(95));
  });
});

describe("resolveMinimumMinutes", () => {
  it("defaults to an hour when the pro has set nothing", () => {
    expect(resolveMinimumMinutes(null)).toBe(DEFAULT_MINIMUM_MINUTES);
    expect(resolveMinimumMinutes(undefined)).toBe(60);
  });

  it("lets a pro bill a longer minimum", () => {
    // A plumber who needs two hours of setup should be able to say so.
    expect(resolveMinimumMinutes(120)).toBe(120);
  });

  it("refuses a shorter one, and a fat-fingered enormous one", () => {
    expect(resolveMinimumMinutes(15)).toBe(60);
    expect(resolveMinimumMinutes(0)).toBe(60);
    expect(resolveMinimumMinutes(6000)).toBe(240);
  });
});

describe("the dollar floor no longer decides prices", () => {
  it("a cheaper pro is genuinely cheaper on a short job", () => {
    // The exact case that motivated migration 013: on a 30-minute job the old
    // $120 floor charged $50/hr and $150/hr pros the SAME amount.
    const cheap = quoteLabor({ hourlyRate: 50, estimatedBillableMinutes: 30 });
    const dear  = quoteLabor({ hourlyRate: 150, estimatedBillableMinutes: 30 });
    expect(cheap.initialLaborAmount).toBeLessThan(dear.initialLaborAmount);
    expect(cheap.labor).toBe(50);
    expect(dear.labor).toBe(150);
  });

  it("reproduces the retired floor for the trades it was calibrated on", () => {
    // Electrical at $90/hr: the $120 floor minus $30 travel bought exactly 1.00h,
    // so a one-hour minimum must land on the same number. If this drifts, the
    // change stopped being economically neutral for the skilled trades.
    const q = quoteLabor({ hourlyRate: 90, estimatedBillableMinutes: 30 });
    expect(q.initialLaborAmount).toBe(120);
  });
});