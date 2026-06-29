import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { uploadImageToR2, uploadRawToR2, uid } from "@/lib/r2";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const mimeType = file.type || "image/jpeg";
  const isPdf = mimeType === "application/pdf";
  if (!mimeType.startsWith("image/") && !isPdf) {
    return NextResponse.json({ error: "Only image or PDF files allowed" }, { status: 400 });
  }
  if (file.size > 0 && file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!buffer.byteLength) return NextResponse.json({ error: "Empty file received" }, { status: 400 });

  const url = isPdf
    ? await uploadRawToR2(buffer, { key: `verification/${user.id}-${uid()}.pdf`, contentType: "application/pdf" })
    : await uploadImageToR2(buffer, { key: `verification/${user.id}-${uid()}`, resize: { fit: "inside", width: 2000, height: 2000 } });

  await prisma.handymanProfile.update({
    where: { userId: user.id },
    data: { verificationDocUrl: url, verificationStatus: "pending" },
  });

  return NextResponse.json({ url, status: "pending" });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.handymanProfile.findUnique({
    where: { userId: user.id },
    select: { verificationDocUrl: true, verificationStatus: true },
  });

  return NextResponse.json(profile ?? { verificationDocUrl: null, verificationStatus: "none" });
}
