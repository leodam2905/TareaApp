import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { validateImageBuffer } from "@/lib/upload-validate";
import { uploadImageToR2, uid } from "@/lib/r2";

// Only these key prefixes may be targeted (prevents writing into arbitrary
// namespaces via the client-supplied `folder` field).
const ALLOWED_FOLDERS: Record<string, string> = {
  "tarea/images": "images",
  "tarea/portfolio": "portfolio",
  "tarea/services": "services",
  "tarea/verification": "verification",
};

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const requestedFolder = (formData.get("folder") as string | null) ?? "tarea/images";
  const prefix = ALLOWED_FOLDERS[requestedFolder] ?? "images";

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  const mimeType = file.type || "image/jpeg";
  const buffer = Buffer.from(await file.arrayBuffer());
  const v = validateImageBuffer(mimeType, buffer, 10 * 1024 * 1024);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  const url = await uploadImageToR2(buffer, {
    key: `${prefix}/${user.id}-${uid()}`,
    resize: { fit: "inside", width: 1200, height: 900 },
  });

  return NextResponse.json({ url });
}
