import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const service = await prisma.service.findUnique({
    where: { id: params.id },
    include: {
      handyman: {
        select: {
          id: true,
          rating: true,
          totalJobs: true,
          isPremium: true,
          user: { select: { id: true, name: true, isVerified: true, avatarUrl: true, city: true, state: true } },
        },
      },
    },
  });

  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(service);
}

// hourlyRate is the rate that counts; the range is still accepted from older
// installs (see the note in ../route.ts) and recorded without pricing anything.
const updateSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(10).optional(),
  hourlyRate: z.number().positive().optional(),
  minimumMinutes: z.number().int().min(60).max(240).optional(),
  minPrice: z.number().positive().optional(),
  maxPrice: z.number().positive().optional(),
  duration: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = await prisma.service.findUnique({ where: { id: params.id } });
  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (service.handymanId !== user.handymanProfile!.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = updateSchema.parse(body);
    // An old client sending only the range still ends up with a usable rate.
    if (data.hourlyRate === undefined && data.minPrice !== undefined) {
      data.hourlyRate = data.minPrice;
    }
    const updated = await prisma.service.update({ where: { id: params.id }, data });
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "HANDYMAN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = await prisma.service.findUnique({ where: { id: params.id } });
  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (service.handymanId !== user.handymanProfile!.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.service.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
