import { describe, it, expect } from "vitest";
import {
  validateRadiusMiles,
  radiusMilesToMeters,
  distanceBand,
  METERS_PER_MILE,
  MIN_RADIUS_MILES,
  MAX_RADIUS_MILES,
} from "./radius";

describe("validateRadiusMiles — rejects what parseInt() used to accept", () => {
  it("rejects zero and negatives", () => {
    // A negative radius reaching ST_DWithin matches nothing; the pro would go
    // silent with no error anywhere.
    expect(validateRadiusMiles(0).ok).toBe(false);
    expect(validateRadiusMiles(-1).ok).toBe(false);
    expect(validateRadiusMiles("-50").ok).toBe(false);
    expect(validateRadiusMiles(-0.5).ok).toBe(false);
  });

  it("rejects NaN and non-finite values", () => {
    expect(validateRadiusMiles(NaN)).toMatchObject({ ok: false, error: "not_a_number" });
    expect(validateRadiusMiles(Infinity)).toMatchObject({ ok: false, error: "not_finite" });
    expect(validateRadiusMiles(-Infinity).ok).toBe(false);
  });

  it("rejects non-numeric and empty input", () => {
    for (const bad of ["", "   ", "abc", null, undefined, {}, [], true]) {
      expect(validateRadiusMiles(bad as unknown).ok).toBe(false);
    }
  });

  it("rejects partially-numeric strings that parseInt would have accepted", () => {
    // parseInt("50abc") === 50 — the old route would have stored 50.
    expect(validateRadiusMiles("50abc").ok).toBe(false);
    expect(validateRadiusMiles("1e9").ok).toBe(false); // 1e9 parses, then exceeds the cap
  });

  it("rejects an excessive radius, preventing nationwide distribution", () => {
    expect(validateRadiusMiles(99999)).toMatchObject({ ok: false, error: "too_large" });
    expect(validateRadiusMiles(MAX_RADIUS_MILES + 1).ok).toBe(false);
  });
});

describe("validateRadiusMiles — boundaries", () => {
  it("accepts exactly the minimum and maximum", () => {
    expect(validateRadiusMiles(MIN_RADIUS_MILES)).toMatchObject({ ok: true, miles: MIN_RADIUS_MILES });
    expect(validateRadiusMiles(MAX_RADIUS_MILES)).toMatchObject({ ok: true, miles: MAX_RADIUS_MILES });
  });

  it("rejects just outside both boundaries", () => {
    expect(validateRadiusMiles(MIN_RADIUS_MILES - 1).ok).toBe(false);
    expect(validateRadiusMiles(MAX_RADIUS_MILES + 1).ok).toBe(false);
  });

  it("floors fractional input", () => {
    expect(validateRadiusMiles(10.9)).toMatchObject({ ok: true, miles: 10 });
    expect(validateRadiusMiles("25.7")).toMatchObject({ ok: true, miles: 25 });
  });

  it("accepts the existing default of 50", () => {
    expect(validateRadiusMiles(50)).toMatchObject({ ok: true, miles: 50 });
  });
});

describe("radiusMilesToMeters", () => {
  it("converts using 1609.344", () => {
    expect(radiusMilesToMeters(1)).toBeCloseTo(METERS_PER_MILE, 6);
    expect(radiusMilesToMeters(50)).toBeCloseTo(50 * 1609.344, 6);
  });

  it("throws rather than coercing an invalid radius", () => {
    // Failing loudly matters: a coerced value would silently widen distribution.
    expect(() => radiusMilesToMeters(0)).toThrow();
    expect(() => radiusMilesToMeters(-5)).toThrow();
    expect(() => radiusMilesToMeters(NaN)).toThrow();
    expect(() => radiusMilesToMeters(99999)).toThrow();
  });
});

describe("distanceBand — pros never see an exact distance", () => {
  const mi = (m: number) => m * METERS_PER_MILE;

  it("maps distances to the documented bands", () => {
    expect(distanceBand(mi(0.5))).toBe("Under 2 miles");
    expect(distanceBand(mi(3))).toBe("2–5 miles");
    expect(distanceBand(mi(7))).toBe("5–10 miles");
    expect(distanceBand(mi(20))).toBe("10–25 miles");
    expect(distanceBand(mi(40))).toBe("25–50 miles");
    expect(distanceBand(mi(80))).toBe("Over 50 miles");
  });

  it("puts exact band boundaries in the upper band", () => {
    expect(distanceBand(mi(2))).toBe("2–5 miles");
    expect(distanceBand(mi(5))).toBe("5–10 miles");
    expect(distanceBand(mi(50))).toBe("Over 50 miles");
  });

  it("never reports an unknown distance as close", () => {
    expect(distanceBand(NaN)).toBe("Over 50 miles");
    expect(distanceBand(-1)).toBe("Over 50 miles");
    expect(distanceBand(Infinity)).toBe("Over 50 miles");
  });

  it("returns only a label, never a number", () => {
    // Guards the privacy contract: the band must not leak the underlying value.
    const label = distanceBand(mi(3.7419));
    expect(label).toBe("2–5 miles");
    expect(label).not.toMatch(/3\.7/);
  });

  // Darby -> Crum Lynne, the case that notified nobody under string matching.
  it("bands the original failing pair as very close", () => {
    expect(distanceBand(mi(2.9))).toBe("2–5 miles");
  });
});
