import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// Cancel a job request the customer posted. Only the owner can cancel, and only
// while it's still OPEN (no pro hired yet). Applications cascade-delete with it.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jr = await prisma.jobRequest.findUnique({ where: { id: params.id } });
  if (!jr) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (jr.customerId !== user.id) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  if (jr.status !== "OPEN") {
    return NextResponse.json(
      { error: "This request can no longer be cancelled." },
      { status: 409 }
    );
  }

  await prisma.jobRequest.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
