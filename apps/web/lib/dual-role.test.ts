import { describe, it, expect } from "vitest";
import { mayEnter } from "./dual-role";

describe("mayEnter", () => {
  it("keeps admin closed to everyone but ADMIN, dual or not", () => {
    expect(mayEnter("admin", "ADMIN", false)).toBe(true);
    expect(mayEnter("admin", "HANDYMAN", true)).toBe(false);
    expect(mayEnter("admin", "CUSTOMER", true)).toBe(false);
  });

  it("admits each single-role user to their own half only", () => {
    expect(mayEnter("customer", "CUSTOMER", false)).toBe(true);
    expect(mayEnter("handyman", "CUSTOMER", false)).toBe(false);
    expect(mayEnter("handyman", "HANDYMAN", false)).toBe(true);
    expect(mayEnter("customer", "HANDYMAN", false)).toBe(false);
  });

  it("admits a dual-role account to both halves, whichever role is stored", () => {
    for (const role of ["CUSTOMER", "HANDYMAN"]) {
      expect(mayEnter("customer", role, true)).toBe(true);
      expect(mayEnter("handyman", role, true)).toBe(true);
    }
  });

  it("lets nobody in without a role, even if the pro flag is set", () => {
    // A token that fails to verify yields role=null. `pro` is a permission on
    // top of a session, never a session on its own.
    expect(mayEnter("customer", null, true)).toBe(false);
    expect(mayEnter("handyman", null, true)).toBe(false);
    expect(mayEnter("admin", null, true)).toBe(false);
    expect(mayEnter("customer", null, false)).toBe(false);
  });
});
