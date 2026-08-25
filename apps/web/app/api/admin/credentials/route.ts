import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { CREDENTIAL_SELECT, credentialViews } from "@/lib/credentials";

/**
 * The review queue: every pro with a licence or insurance document waiting on
 * a decision, oldest submission first so nobody sits at the back forever.
 *
 * `?status=all` returns every pro who has ever submitted either document,
 * which is what the admin page needs to show already-decided credentials and
 * ones that have since expired.
 */
export async function GET(req: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const all = new URL(req.url).searchParams.get("status") === "all";

  const where = all
    ? { OR: [{ licenseDocUrl: { not: null } }, { insuranceDocUrl: { not: null } }] }
    : { OR: [{ licenseStatus: "pending" }, { insuranceStatus: "pending" }] };

  const profiles = await prisma.handymanProfile.findMany({
    where,
    select: {
      id: true,
      updatedAt: true,
      ...CREDENTIAL_SELECT,
      user: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } },
    },
    orderBy: { updatedAt: "asc" },
  });

  const now = new Date();
  return NextResponse.json(
    profiles.map(p => ({
      handymanId: p.id,
      user: p.user,
      credentials: credentialViews(p, now),
    })),
  );
}
