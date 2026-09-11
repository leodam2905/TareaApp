/**
 * Where a signed-in user belongs.
 *
 * The customer and pro layouts each expressed this as "not my role -> the other
 * role's dashboard". That is only correct while exactly two roles exist. ADMIN
 * satisfies neither test, so /customer/* sent an admin to /handyman/*, which
 * sent them back, until the browser gave up with ERR_TOO_MANY_REDIRECTS.
 *
 * Stating the destination per role removes the assumption instead of patching
 * one instance of it, and gives the next role added a defined home rather than
 * a loop. Deliberately dependency-free so the client-side login page and the
 * server-side layouts can share it.
 */
export function homePathFor(role: string | null | undefined): string {
  switch (role) {
    case "ADMIN":
      return "/admin/dashboard";
    case "HANDYMAN":
      return "/handyman/dashboard";
    case "CUSTOMER":
      return "/customer/dashboard";
    default:
      // An unrecognised role must never be guessed into a protected area.
      return "/";
  }
}
