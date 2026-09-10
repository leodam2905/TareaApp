import { describe, it, expect } from "vitest";
import { descriptorSuffix, DESCRIPTOR } from "./statement-descriptor";

describe("descriptorSuffix", () => {
  it("passes through a plain label", () => {
    expect(descriptorSuffix("JOB")).toBe("JOB");
  });

  it("uppercases", () => {
    expect(descriptorSuffix("tip")).toBe("TIP");
  });

  it("strips characters Stripe rejects", () => {
    // < > \ ' " * are refused outright and would fail the charge, not the
    // descriptor — so this has to be stripped before it reaches the API.
    expect(descriptorSuffix(`a<b>c\\d'e"f*g`)).toBe("ABCDEFG");
  });

  it("drops accents and emoji rather than mangling them", () => {
    expect(descriptorSuffix("Café 🔧")).toBe("CAFE");
  });

  it("caps length so prefix + suffix stays within 22", () => {
    expect(descriptorSuffix("EXTRAORDINARILY LONG LABEL").length).toBeLessThanOrEqual(12);
  });

  it("never returns a suffix without a letter", () => {
    // Stripe requires at least one latin letter; a digits-only or empty suffix
    // would be rejected and silently cost us the descriptor entirely.
    expect(descriptorSuffix("123")).toBe("SERVICE");
    expect(descriptorSuffix("")).toBe("SERVICE");
    expect(descriptorSuffix("   ")).toBe("SERVICE");
    expect(descriptorSuffix("***")).toBe("SERVICE");
  });

  it("collapses whitespace so the suffix cannot end mid-gap", () => {
    expect(descriptorSuffix("BG    CHECK")).toBe("BG CHECK");
  });
});

describe("DESCRIPTOR", () => {
  it("every charge type produces a valid suffix", () => {
    for (const [kind, value] of Object.entries(DESCRIPTOR)) {
      expect(value.length, kind).toBeGreaterThan(0);
      expect(value.length, kind).toBeLessThanOrEqual(12);
      expect(value, kind).toMatch(/[A-Z]/);
      expect(value, kind).not.toMatch(/[<>\\'"*]/);
    }
  });
});
