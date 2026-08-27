import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { reconcile } from "@/lib/reconcile";

// Admin-only: the money actually received against the money owed to pros.
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const days = Number(new URL(req.url).searchParams.get("days") ?? "");
  const since = Number.isFinite(days) && days > 0
    ? new Date(Date.now() - days * 86400_000)
    : undefined;
  return NextResponse.json(await reconcile({ since }));
}
