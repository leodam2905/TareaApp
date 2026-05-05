import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const city = searchParams.get("city");
  const mine = searchParams.get("mine") === "1";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "12");

  const where: Record<string, unknown> = mine ? {} : { isActive: true };
  if (category) where.category = category;
  if (city) where.handyman = { user: { city } };

  if (mine) {
    let user = null;
    try { user = await getCurrentUser(); } catch { /* unauthenticated */ }
    if (!user || user.role !== "HANDYMAN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    where.handymanId = user.handymanProfile!.id;
  }

  const [services, total] = await Promise.all([
    prisma.service.findMany({
      where,
      include: {
        handyman: {
          select: {
            id: true,
            isPremium: true,
            rating: true,
            user: { select: { name: true, avatarUrl: true, city: true, isVerified: true, latitude: true, longitude: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.service.count({ where }),
  ]);

  return NextResponse.json({ services, total, page, pages: Math.ceil(total / limit) });
}

const createSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  category: z.string(),
  minPrice: z.number().positive(),
  maxPrice: z.number().positive(),
  duration: z.number().int().positive(),
  imageUrl: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const service = await prisma.service.create({
      data: {
        ...data,
        category: data.category as never,
        handymanId: user.handymanProfile!.id,
      },
    });
    return NextResponse.json(service, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
