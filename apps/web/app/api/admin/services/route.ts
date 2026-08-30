import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const services = await prisma.service.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      handyman: { include: { user: { select: { name: true, email: true } } } },
    },
  });

  return NextResponse.json(services);
}

export async function POST(req: NextRequest) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { title, description, category, hourlyRate, minPrice, maxPrice, duration } = body;

  if (!title || !description || !category || !duration || (!hourlyRate && !minPrice)) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  // Create a platform-wide service (no handymanId)
  const service = await prisma.service.create({
    data: {
      title,
      description,
      category,
      hourlyRate: parseFloat(hourlyRate ?? minPrice) || null,
      minPrice: minPrice !== undefined ? parseFloat(minPrice) : null,
      maxPrice: maxPrice !== undefined ? parseFloat(maxPrice) : null,
      duration: parseInt(duration),
      isActive: true,
    },
  });

  // Notify all handymen
  const handymanUsers = await prisma.user.findMany({
    where: { role: "HANDYMAN" },
    select: { id: true },
  });

  if (handymanUsers.length > 0) {
    await prisma.notification.createMany({
      data: handymanUsers.map(u => ({
        userId: u.id,
        title: "New Service Available",
        body: `Admin added a new service: "${title}". It's now visible in your services list.`,
        type: "booking_request",
        isRead: false,
      })),
    });
  }

  return NextResponse.json({ ok: true, service }, { status: 201 });
}
