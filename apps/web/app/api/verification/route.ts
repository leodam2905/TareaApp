import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG, WebP, or PDF allowed" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const dataUri = `data:${file.type};base64,${base64}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "tarea/verification",
    public_id: `verify_${user.id}`,
    overwrite: true,
  });

  await prisma.handymanProfile.update({
    where: { userId: user.id },
    data: { verificationDocUrl: result.secure_url, verificationStatus: "pending" },
  });

  return NextResponse.json({ url: result.secure_url, status: "pending" });
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
