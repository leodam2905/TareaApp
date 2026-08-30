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
            // No coordinates: this route computes no distance, so they were
            // pure exposure — a pro's home position handed to any caller.
            user: { select: { name: true, avatarUrl: true, city: true, isVerified: true } },
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

// A pro names ONE hourly rate per category. minPrice/maxPrice are still accepted
// because build 48 and earlier send them and will keep doing so until every
// install updates; they are recorded but no longer price anything. A request
// carrying only the old range yields a rate from minPrice, which is the closest
// honest reading of "what this pro charges".
const createSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  category: z.string(),
  hourlyRate: z.number().positive().optional(),
  minimumMinutes: z.number().int().min(60).max(240).optional(),
  minPrice: z.number().positive().optional(),
  maxPrice: z.number().positive().optional(),
  duration: z.number().int().positive(),
  imageUrl: z.string().url().optional(),
}).refine(d => d.hourlyRate !== undefined || d.minPrice !== undefined, {
  message: "Set an hourly rate for this category",
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
        hourlyRate: data.hourlyRate ?? data.minPrice,
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
