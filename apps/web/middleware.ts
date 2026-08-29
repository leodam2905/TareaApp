import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

// Verify the JWT *signature* (not just decode the payload) so a forged cookie
// with an arbitrary role cannot reach a protected page shell.
async function getVerifiedRole(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
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
  const role = token ? await getVerifiedRole(token) : null;

  if (pathname.startsWith("/admin")) {
    if (role !== "ADMIN") return redirectToLogin(req);
  } else if (pathname.startsWith("/handyman")) {
    if (role !== "HANDYMAN") return redirectToLogin(req);
  } else if (pathname.startsWith("/customer")) {
    if (role !== "CUSTOMER") return redirectToLogin(req);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/handyman/:path*", "/customer/:path*"],
};
