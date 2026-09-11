/// Which halves of the site an account may enter.
///
/// `User.role` holds exactly one value and cannot express "both", but an
/// account with a handyman profile genuinely has two sides: the bookings API
/// is written for it ("a dual-role account can hire, but not itself") and the
/// mobile apps disambiguate by passing `?role=`. The web has no such signal,
/// so this is what stands in for it.
///
/// Extracted so the rule is stated once and can be tested. It is enforced in
/// two places -- the edge middleware, from the token's `pro` claim, and each
/// dashboard layout, from the loaded user -- and if those two ever disagree a
/// user is let through one gate only to be bounced by the next.
export function mayEnter(
  area: "admin" | "handyman" | "customer",
  role: string | null,
  pro: boolean,
): boolean {
  // No verified role, no entry -- `pro` is an extra permission on top of a
  // real session, never a session by itself. The middleware already returns
  // role=null AND pro=false when a token fails to verify, but this must not
  // depend on a caller elsewhere getting that pairing right.
  if (!role) return false;
  if (area === "admin") return role === "ADMIN";
  if (area === "handyman") return role === "HANDYMAN" || pro;
  return role === "CUSTOMER" || pro;
}
