import { describe, it, expect } from "vitest";
import { homePathFor } from "./home-path";

describe("homePathFor", () => {
  it("sends each role to its own area", () => {
    expect(homePathFor("CUSTOMER")).toBe("/customer/dashboard");
    expect(homePathFor("HANDYMAN")).toBe("/handyman/dashboard");
    expect(homePathFor("ADMIN")).toBe("/admin/dashboard");
  });

  it("never sends a role into another role's area", () => {
    // The regression this exists for: the customer layout redirected any
    // non-customer to /handyman, and the handyman layout redirected any
    // non-handyman to /customer, so an ADMIN bounced between them forever.
    expect(homePathFor("ADMIN")).not.toMatch(/^\/customer/);
    expect(homePathFor("ADMIN")).not.toMatch(/^\/handyman/);
  });

  it("cannot produce a loop between the customer and pro layouts", () => {
    // Simulate the guards: each layout redirects when the role does not match.
    const customerLayout = (role: string) => (role === "CUSTOMER" ? null : homePathFor(role));
    const handymanLayout = (role: string) => (role === "HANDYMAN" ? null : homePathFor(role));

    for (const role of ["CUSTOMER", "HANDYMAN", "ADMIN", "SOMETHING_NEW"]) {
      let path = "/customer/dashboard";
      const seen = new Set<string>();
      for (let hop = 0; hop < 10; hop++) {
        if (seen.has(path)) throw new Error(`loop for ${role} at ${path}`);
        seen.add(path);
        const next = path.startsWith("/customer")
          ? customerLayout(role)
          : path.startsWith("/handyman")
            ? handymanLayout(role)
            : null;
        if (!next) break;
        path = next;
      }
      expect(seen.size, role).toBeLessThan(4);
    }
  });

  it("sends an unknown role to the public site, not a protected area", () => {
    expect(homePathFor("SOMETHING_NEW")).toBe("/");
    expect(homePathFor(null)).toBe("/");
    expect(homePathFor(undefined)).toBe("/");
  });
});
