import { NextRequest, NextResponse } from "next/server";

function getTokenRole(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof decoded.role === "string" ? decoded.role : null;
  } catch {
    return null;
  }
}

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("tarea_token")?.value;

  if (pathname.startsWith("/admin")) {
    if (!token || getTokenRole(token) !== "ADMIN") return redirectToLogin(req);
  } else if (pathname.startsWith("/handyman")) {
    if (!token || getTokenRole(token) !== "HANDYMAN") return redirectToLogin(req);
  } else if (pathname.startsWith("/customer")) {
    if (!token || getTokenRole(token) !== "CUSTOMER") return redirectToLogin(req);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/handyman/:path*", "/customer/:path*"],
};
