import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { prisma } from "./prisma";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET environment variable is not set");
const COOKIE_NAME = "tarea_token";

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number; // issued-at (seconds), set by jwt.sign
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function signPendingToken(userId: string): string {
  return jwt.sign({ userId, purpose: "otp_pending" }, JWT_SECRET, { expiresIn: "10m" });
}

export function verifyPendingToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; purpose: string };
    if (payload.purpose !== "otp_pending") return null;
    return payload.userId;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getCurrentUser() {
  let token: string | undefined;

  // Bearer token from Authorization header (mobile clients)
  try {
    const h = headers();
    const auth = h.get("authorization") ?? "";
    if (auth.startsWith("Bearer ")) token = auth.slice(7);
  } catch { /* headers() throws outside request context */ }

  // Cookie fallback (web)
  if (!token) {
    try {
      const cookieStore = cookies();
      token = cookieStore.get(COOKIE_NAME)?.value;
    } catch { /* same reason */ }
  }

  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: { handymanProfile: true },
  });
  if (!user?.isActive) return null;

  // Invalidate tokens issued before the user's last password change.
  if (user.passwordChangedAt && payload.iat) {
    const issuedAtMs = payload.iat * 1000;
    if (issuedAtMs < user.passwordChangedAt.getTime()) return null;
  }

  return user;
}

export function setAuthCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
}

export function clearAuthCookie() {
  cookies().set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}
