import { describe, it, expect } from "vitest";
import { clientIp } from "./client-ip";

const req = (xff?: string, realIp?: string) => ({
  headers: {
    get: (n: string) =>
      n === "x-forwarded-for" ? (xff ?? null) : n === "x-real-ip" ? (realIp ?? null) : null,
  },
});

describe("clientIp", () => {
  // The two strings below were measured against production, not invented.
  it("takes the client, not the load balancer, on a normal request", () => {
    expect(clientIp(req("68.81.101.90, 34.110.225.91"))).toBe("68.81.101.90");
  });

  it("ignores a spoofed X-Forwarded-For prepended by the caller", () => {
    expect(clientIp(req("203.0.113.99, 68.81.101.90, 34.110.225.91"))).toBe("68.81.101.90");
  });

  it("is not fooled by a long forged chain", () => {
    const forged = "1.1.1.1, 2.2.2.2, 3.3.3.3, 68.81.101.90, 34.110.225.91";
    expect(clientIp(req(forged))).toBe("68.81.101.90");
  });

  it("never returns the load balancer, which would bucket all users together", () => {
    for (const xff of [
      "68.81.101.90, 34.110.225.91",
      "203.0.113.99, 68.81.101.90, 34.110.225.91",
    ]) {
      expect(clientIp(req(xff))).not.toBe("34.110.225.91");
    }
  });

  it("handles a single-entry chain (local dev / internal probe)", () => {
    expect(clientIp(req("10.0.0.5"))).toBe("10.0.0.5");
  });

  it("falls back to x-real-ip, then unknown", () => {
    expect(clientIp(req(undefined, "9.9.9.9"))).toBe("9.9.9.9");
    expect(clientIp(req())).toBe("unknown");
  });

  it("tolerates whitespace and empty entries", () => {
    expect(clientIp(req("  203.0.113.99 ,  68.81.101.90 , 34.110.225.91 "))).toBe("68.81.101.90");
  });
});
