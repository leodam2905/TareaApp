import { describe, it, expect } from "vitest";
import { invoiceNumber, proIdentity, INVOICE_PREFIX } from "./invoice-config";

describe("invoiceNumber", () => {
  it("is stable for a booking", () => {
    const id = "cmqomc4qf0000117iltp2zle0";
    expect(invoiceNumber(id)).toBe(invoiceNumber(id));
    expect(invoiceNumber(id)).toBe(`${INVOICE_PREFIX}-${id.slice(-8).toUpperCase()}`);
  });

  // Unique and stable, but neither ordered nor gapless. Recorded as a test so
  // nobody later reads a rising number off two cuids and assumes a series.
  it("is not sequential", () => {
    expect(invoiceNumber("aaaaaaaaaaaa00000002")).not.toBe(invoiceNumber("bbbbbbbbbbbb00000001"));
    expect(invoiceNumber("zzzz00000001") < invoiceNumber("aaaa00000002")).toBe(true);
  });

  it("uses the last 8 characters, uppercased", () => {
    expect(invoiceNumber("abcdefghij12345678")).toBe(`${INVOICE_PREFIX}-12345678`);
  });
});

describe("proIdentity", () => {
  const base = { name: "Leonce Dah" };

  it("prints the company name for a company account", () => {
    expect(
      proIdentity({ ...base, accountType: "COMPANY", companyName: "Dah Plumbing LLC" }).name,
    ).toBe("Dah Plumbing LLC");
  });

  it("falls back to the person for an individual, even with a company name set", () => {
    expect(
      proIdentity({ ...base, accountType: "INDIVIDUAL", companyName: "Dah Plumbing LLC" }).name,
    ).toBe("Leonce Dah");
  });

  it("ignores a blank company name", () => {
    expect(proIdentity({ ...base, accountType: "COMPANY", companyName: "   " }).name).toBe("Leonce Dah");
  });

  // An uploaded-but-unreviewed document is not a credential. Printing its
  // number on an invoice would launder it into one.
  it("prints no licence until an admin has approved it", () => {
    for (const licenseStatus of ["none", "pending", "rejected", undefined]) {
      expect(
        proIdentity({ ...base, licenseNumber: "1234567", licenseIssuer: "CSLB", licenseStatus }).license,
      ).toBeNull();
    }
  });

  it("prints issuer and number once approved", () => {
    expect(
      proIdentity({
        ...base, licenseNumber: "1234567", licenseIssuer: "CSLB", licenseStatus: "approved",
      }).license,
    ).toBe("CSLB #1234567");
  });

  // The licence names the legal person who holds it. When that differs from the
  // trading name, a customer checking the CSLB register needs both.
  it("notes the licensee when it differs from the trading name", () => {
    const r = proIdentity({
      ...base,
      accountType: "COMPANY",
      companyName: "Dah Plumbing LLC",
      licenseNumber: "1234567",
      licenseIssuer: "CSLB",
      licenseeName: "D. Ramirez Plumbing Inc.",
      licenseStatus: "approved",
    });
    expect(r.licenseeNote).toBe("Licensed to D. Ramirez Plumbing Inc.");
  });

  it("stays quiet when the licensee and the trading name agree", () => {
    const r = proIdentity({
      ...base,
      licenseNumber: "1234567",
      licenseIssuer: "CSLB",
      licenseeName: "leonce dah",
      licenseStatus: "approved",
    });
    expect(r.licenseeNote).toBeNull();
  });

  it("never notes a licensee for an unapproved licence", () => {
    const r = proIdentity({
      ...base, licenseNumber: "1234567", licenseeName: "Someone Else", licenseStatus: "pending",
    });
    expect(r.license).toBeNull();
    expect(r.licenseeNote).toBeNull();
  });
});
