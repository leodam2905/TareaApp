import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createNotification } from "@/lib/notify";

export async function PATCH(req: NextRequest, { params }: { params: { handymanId: string } }) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { decision } = await req.json(); // "approve" | "reject"
  if (!["approve", "reject"].includes(decision)) {
    return NextResponse.json({ error: "decision must be approve or reject" }, { status: 400 });
  }

  const profile = await prisma.handymanProfile.findUnique({
    where: { id: params.handymanId },
    select: { userId: true },
  });
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.handymanProfile.update({
    where: { id: params.handymanId },
    data: {
      verificationStatus: decision === "approve" ? "approved" : "rejected",
      // Manually approve background check while Certn API access is pending
      ...(decision === "approve" && { backgroundCheckStatus: "PASSED" }),
    },
  });

  if (decision === "approve") {
    await prisma.user.update({ where: { id: profile.userId }, data: { isVerified: true } });
  }

  await createNotification({
    userId: profile.userId,
    title: decision === "approve" ? "ID Verified ✓" : "Verification rejected",
    body: decision === "approve"
      ? "Your identity has been verified. Your profile now shows the verified badge."
      : "Your verification document was not accepted. Please upload a clearer photo.",
    type: "booking_accepted",
  });

  return NextResponse.json({ ok: true });
}
