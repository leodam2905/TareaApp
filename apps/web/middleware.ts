import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { mayEnter } from "@/lib/dual-role";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

// Verify the JWT *signature* (not just decode the payload) so a forged cookie
// with an arbitrary role cannot reach a protected page shell.
async function getVerifiedClaims(
  token: string,
): Promise<{ role: string | null; pro: boolean }> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      role: typeof payload.role === "string" ? payload.role : null,
      pro: payload.pro === true,
    };
  } catch {
    return { role: null, pro: false };
  }
}

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  // Carry the intended destination. Without it, someone who clicks "Diagnose my
  // issue" signs in and lands on the dashboard — the thing they asked for is
  // gone, and nothing on the page explains why.
  const intended = req.nextUrl.pathname + req.nextUrl.search;
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", intended);
  return NextResponse.redirect(url);
}

// Someone already signed in who reaches the wrong half is not a login problem:
// sending them to /login reads as a broken session and invites them to sign in
// as an account they do not have. Put them on their own dashboard instead.
function denied(req: NextRequest, role: string | null) {
  if (!role) return redirectToLogin(req);
  const url = req.nextUrl.clone();
  url.search = "";
  url.pathname =
    role === "ADMIN" ? "/admin/dashboard"
    : role === "HANDYMAN" ? "/handyman/dashboard"
    : "/customer/dashboard";
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // An invoice opened from its emailed link carries a signed token and is
  // allowed through unauthenticated — the page verifies the signature itself.
  // Without this the redirect happens here, before the page can check, and the
  // customer lands on a login wall for a receipt they already paid for.
  if (/^\/customer\/bookings\/[^/]+\/invoice$/.test(pathname) && req.nextUrl.searchParams.get("t")) {
    return NextResponse.next();
  }
  const token = req.cookies.get("tarea_token")?.value;
  const { role, pro } = token ? await getVerifiedClaims(token) : { role: null, pro: false };

  // `role` holds one value, but an account with a handyman profile genuinely
  // has two sides -- the apps already let it hire as well as be hired, and the
  // bookings API is built for exactly that. So a pro is admitted to both
  // halves; ADMIN is untouched and still the only way into /admin.
  if (pathname.startsWith("/admin")) {
    if (!mayEnter("admin", role, pro)) return redirectToLogin(req);
  } else if (pathname.startsWith("/handyman")) {
    if (!mayEnter("handyman", role, pro)) return denied(req, role);
  } else if (pathname.startsWith("/customer")) {
    if (!mayEnter("customer", role, pro)) return denied(req, role);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/handyman/:path*", "/customer/:path*"],
};
