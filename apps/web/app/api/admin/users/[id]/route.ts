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

  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
