import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import { join } from "path";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateImageBuffer } from "@/lib/upload-validate";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const v = validateImageBuffer(file.type, buffer, MAX_BYTES);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });

  // Extension is server-derived from the validated type — never from the client
  // filename (which could inject .html/.svg into the public web root).
  const filename = `${user.id}-${Date.now()}.${v.ext}`;
  const path = join(process.cwd(), "public", "uploads", filename);

  await writeFile(path, buffer);

  const url = `/uploads/${filename}`;
  await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: url } });

  return NextResponse.json({ url });
}
