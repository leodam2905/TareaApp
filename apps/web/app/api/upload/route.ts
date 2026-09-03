import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateImageBuffer, detectImageType, ALLOWED_IMAGE_TYPES } from "@/lib/upload-validate";
import { uploadImageToR2, uid } from "@/lib/r2";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  // Trust the bytes over the header — same reasoning as /api/upload/image.
  // A client that omits a content type sends application/octet-stream, and
  // rejecting that outright failed uploads whose bytes were a valid image.
  // validateImageBuffer still checks magic bytes, so a spoof cannot pass.
  const declared = file.type || "";
  const mimeType = ALLOWED_IMAGE_TYPES[declared] ? declared : (detectImageType(buffer) ?? (declared || "image/jpeg"));
  const v = validateImageBuffer(mimeType, buffer, MAX_BYTES);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  const url = await uploadImageToR2(buffer, {
    key: `avatars/${user.id}-${uid()}`,
    resize: { fit: "cover", width: 256, height: 256 },
    quality: 85,
  });
  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: url } });

  return NextResponse.json({ url });
}
