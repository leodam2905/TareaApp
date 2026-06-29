import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateImageBuffer } from "@/lib/upload-validate";
import { uploadImageToR2, uid } from "@/lib/r2";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const mimeType = file.type || "image/jpeg";
  const buffer = Buffer.from(await file.arrayBuffer());
  const v = validateImageBuffer(mimeType, buffer, 8 * 1024 * 1024);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  const url = await uploadImageToR2(buffer, {
    key: `avatars/${user.id}-${uid()}`,
    resize: { fit: "cover", width: 256, height: 256 },
    quality: 85,
  });

  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: url } });

  return NextResponse.json({ url });
}
