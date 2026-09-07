import { describe, it, expect } from "vitest";
import {
  materialsOwed,
  materialsRefundDue,
  proOwedFor,
  proOwedForAll,
  tipTotal,
  unpaidTipsWhere,
  payoutIdempotencyKey,
} from "./pro-payout";

describe("materials reconciliation", () => {
  it("reimburses the receipt when the pro underspent, and refunds the rest", () => {
    const b = { totalPrice: 200, materialsEstimate: 100, materialsActual: 60 };
    expect(materialsOwed(b)).toBe(60);
    expect(materialsRefundDue(b)).toBe(40);
  });

  it("caps at the estimate when the pro overspent — the pro absorbs it", () => {
    const b = { totalPrice: 200, materialsEstimate: 100, materialsActual: 175 };
    expect(materialsOwed(b)).toBe(100);
    expect(materialsRefundDue(b)).toBe(0);
  });

  it("lets the estimate stand when no figure was reported", () => {
    const b = { totalPrice: 200, materialsEstimate: 100, materialsActual: null };
    expect(materialsOwed(b)).toBe(100);
    expect(materialsRefundDue(b)).toBe(0);
  });
});

describe("proOwedFor", () => {
  // HANDYMAN_FEE_RATE is 0: the pro sets the rate and Tarea does not deduct
  // from it (§2777). The whole platform take is the customer-side fee.
  it("pays labour in full plus materials at cost", () => {
    expect(proOwedFor({ totalPrice: 200, materialsEstimate: 40, materialsActual: 40 })).toBe(240);
  });

  it("rounds once across a batch, not per booking", () => {
    const b = { totalPrice: 33.333, materialsEstimate: 0, materialsActual: null };
    expect(proOwedForAll([b, b, b])).toBe(100);
  });
});

describe("tips", () => {
  it("sums to whole cents", () => {
    expect(tipTotal([{ amount: 10.005 }, { amount: 5.005 }])).toBe(15.01);
    expect(tipTotal([])).toBe(0);
  });

  // THE REGRESSION. A tip was previously found through the BOOKING's
  // handymanPaidOut flag. That flag is set at completion, and a customer may
  // only tip a booking that is already completed and paid — so the condition
  // was false before a tip could exist, and tips were never transferred.
  it("asks the tip whether it was paid, never the booking's payout flag", () => {
    const where = unpaidTipsWhere("pro_1");
    expect(where.paidOutAt).toBeNull();
    expect(where.booking).toEqual({ isPaid: true, handymanId: "pro_1" });
    expect(JSON.stringify(where)).not.toContain("handymanPaidOut");
  });

  it("scopes to one pro, or to none for the cron's global sweep", () => {
    expect(unpaidTipsWhere("pro_1").booking).toHaveProperty("handymanId", "pro_1");
    expect(unpaidTipsWhere().booking).not.toHaveProperty("handymanId");
  });
});

describe("payoutIdempotencyKey", () => {
  it("is stable and order-independent for the same set", () => {
    expect(payoutIdempotencyKey(["b", "a"], "weekly")).toBe(payoutIdempotencyKey(["a", "b"], "weekly"));
  });

  it("separates purposes, so the transfer and the payout are distinct calls", () => {
    expect(payoutIdempotencyKey(["a"], "weekly")).not.toBe(payoutIdempotencyKey(["a"], "weekly-payout"));
  });

  // Tips must be namespaced into the key. Two tips-only payouts would otherwise
  // both hash the empty set of booking ids, giving them the same key — and
  // Stripe would answer the second transfer by replaying the first, silently
  // paying the pro once for two separate sets of tips.
  it("distinguishes two tips-only payouts", () => {
    const first = payoutIdempotencyKey(["tip:t1"], "weekly");
    const second = payoutIdempotencyKey(["tip:t2"], "weekly");
    expect(first).not.toBe(second);
    expect(first).not.toBe(payoutIdempotencyKey([], "weekly"));
  });

  it("cannot confuse a tip id with a booking id", () => {
    expect(payoutIdempotencyKey(["x"], "weekly")).not.toBe(payoutIdempotencyKey(["tip:x"], "weekly"));
  });
});
