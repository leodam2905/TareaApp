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
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
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
