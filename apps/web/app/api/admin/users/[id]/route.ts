import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const user = await prisma.user.update({
    where: { id: params.id },
    data: {
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.isVerified !== undefined && { isVerified: body.isVerified }),
      ...(body.role !== undefined && { role: body.role }),
    },
  });

  return NextResponse.json(user);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (params.id === admin.id) return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });

  const id = params.id;
  try {
    // Several relations to User have no onDelete: Cascade (bookings, reviews,
    // job requests, applications, messages). A bare user.delete() fails with a
    // foreign-key error once the user has any activity, so we clear those rows
    // first, in dependency order, inside a transaction. The remaining relations
    // (handymanProfile, notifications, otpCodes, favorites) cascade on their own.
    await prisma.$transaction(async (tx) => {
      await tx.review.deleteMany({ where: { OR: [{ authorId: id }, { receiverId: id }] } });
      await tx.message.deleteMany({ where: { senderId: id } });
      await tx.jobApplication.deleteMany({ where: { userId: id } });
      await tx.jobRequest.deleteMany({ where: { customerId: id } });
      // Bookings cascade to their payments/messages/reviews
      await tx.booking.deleteMany({ where: { OR: [{ customerId: id }, { handymanId: id }] } });
      await tx.user.delete({ where: { id } });
    });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete user";
    console.error("[admin] delete user failed:", message);
    return NextResponse.json({ error: "Could not delete this user: " + message.slice(0, 200) }, { status: 500 });
  }
}
