import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getCurrentUser } from "@/lib/auth";
import { validateImageBuffer } from "@/lib/upload-validate";

// Only these Cloudinary folders may be targeted (prevents writing into arbitrary
// namespaces via the client-supplied `folder` field).
const ALLOWED_FOLDERS = new Set([
  "tarea/images",
  "tarea/portfolio",
  "tarea/services",
  "tarea/verification",
]);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const requestedFolder = (formData.get("folder") as string | null) ?? "tarea/images";
  const folder = ALLOWED_FOLDERS.has(requestedFolder) ? requestedFolder : "tarea/images";

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  const mimeType = file.type || "image/jpeg";
  const buffer = Buffer.from(await file.arrayBuffer());
  const v = validateImageBuffer(mimeType, buffer, 10 * 1024 * 1024);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  const base64 = buffer.toString("base64");
  const dataUri = `data:${mimeType};base64,${base64}`;

  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    transformation: [{ width: 1200, height: 900, crop: "limit", quality: "auto" }],
  });

  return NextResponse.json({ url: result.secure_url });
}
