import { describe, it, expect } from "vitest";
import {
  licenseAlwaysRequired,
  licenseMatters,
  LICENSE_ALWAYS,
  LICENSE_REQUIRED,
} from "./credentials";

describe("licenseAlwaysRequired", () => {
  it("reserves roofing and HVAC, which are permitted work at any price", () => {
    expect(licenseAlwaysRequired("ROOFING")).toBe(true);
    expect(licenseAlwaysRequired("HVAC")).toBe(true);
  });

  // The whole point of the gate: the $1,000 minor-work exemption caps
  // UNPERMITTED work, so a cheap roof job is no more lawful than a dear one.
  // Nothing about this predicate may consult a price.
  it("does not depend on job value", () => {
    expect(licenseAlwaysRequired.length).toBe(1);
  });

  it("leaves electrical and plumbing on the price cap, pending a task allowlist", () => {
    expect(licenseAlwaysRequired("ELECTRICAL")).toBe(false);
    expect(licenseAlwaysRequired("PLUMBING")).toBe(false);
  });

  // GENERAL is in LICENSE_REQUIRED because a licence is a useful RANKING
  // signal there. Promoting that set to a gate would make general handyman
  // work licensed-only and delete the core product.
  it("never blocks GENERAL, even though a licence ranks well on it", () => {
    expect(licenseMatters("GENERAL")).toBe(true);
    expect(licenseAlwaysRequired("GENERAL")).toBe(false);
  });

  it("ignores unlicensed occupations entirely", () => {
    for (const c of ["CLEANING", "MOVING", "LAUNDRY", "PAINTING", "CARPENTRY", "LANDSCAPING", "APPLIANCE_REPAIR"]) {
      expect(licenseAlwaysRequired(c)).toBe(false);
    }
  });

  it("treats a missing category as unrestricted rather than throwing", () => {
    expect(licenseAlwaysRequired(null)).toBe(false);
    expect(licenseAlwaysRequired(undefined)).toBe(false);
    expect(licenseAlwaysRequired("")).toBe(false);
  });

  it("keeps the hard gate a subset of the ranking set", () => {
    for (const c of LICENSE_ALWAYS) expect(LICENSE_REQUIRED.has(c)).toBe(true);
  });
});
